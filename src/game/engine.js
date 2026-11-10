// "Fix the bugs" — a side-view action game played on top of the real portfolio page.
// World coordinates are document pixels (x → right, y → down). The page's own blocks are
// one-way platforms and can be cracked / shattered; bugs crawl out from under them.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {SKILLS} from '../constacts';
import {clamp, ease, ENEMY_TYPES, GRAVITY, MAX_FALL, pick, rand} from './util';
import {creatureMethods} from './creatures';
import {START_AMMO, weaponMethods} from './weapons';
import {GROUND_OFFSET, GROUND_SPACE, stoneMethods} from './stones';
import {ARMOR_PLATE, armorMethods} from './armor';
import {modelMethods} from './models';
import {loadoutMethods, HEROES, MELEE} from './loadout';
import {meleeMethods} from './melee';
import {abilityMethods} from './abilities';
import {fxMethods} from './fx';
import {Sfx} from './sfx';
import {themeIndex} from './theme';
import {bossMethods} from './bosses';
import {eventMethods} from './events';
import {missileMethods} from './missiles';
import {meleeFxMethods} from './meleefx';
import {enemyUiMethods} from './enemyui';
import {pistolMethods} from './pistols';
import {signatureMethods} from './signature';
import {debuffMethods} from './debuffs';
import {pacingMethods} from './pacing';
import {siteFxMethods} from './sitefx';
import {perkMethods} from './perks';
import {allyMethods} from './allies';
import {superMethods, SUPER_NAMES} from './supers';
import {ferrumMethods} from './ferrum';
import {WEAPONS} from './weapons';

const SELECTORS = [
    '.badge', '.hero-title .line', '.hero-lead', '.hero-actions .btn',
    '.section-title h2', '.section-index',
    '.about-photo', '.about-text > p', '.about-meta > div', '.stat',
    '.timeline-period', '.timeline-card',
    '.project-media', '.project-info h3', '.project-info > p', '.project-info .tags', '.link-arrow',
    '.skill-group', '.work',
    '.contact-title', '.contact-lead', '.contact-links .btn', '.footer',
].join(',')

const RUN = 390
// snappier, a bit higher jump (the hero also falls a bit faster, so it feels quick, not floaty)
const JUMP = 1300
const AIR_JUMP = 1210
const HERO_GRAVITY = 1.15
const AIR_RUN = 1.15 // a little faster sideways in the air, to clear the gaps between blocks
const PIECE_LIMIT = 700
const NO_BURSTS = true
const SKILL_NAMES = Object.values(SKILLS).flat()


const BUG_TYPES = ENEMY_TYPES

const KEYS = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowDown: 'down', KeyS: 'down',
    KeyW: 'jump', ArrowUp: 'jump',
    Space: 'attack', KeyJ: 'attack', KeyF: 'attack', Enter: 'attack',
    KeyK: 'shoot', KeyG: 'shoot',
    KeyL: 'super',
    ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyE: 'ability',
}
const SUPER_RADIUS = 470
const SAFE_SPAWN = 300 // px around the hero where nothing may spawn
const SUPER_CHARGE = 0.7 // seconds of holding the sword button
// part of the flip clip that is in the air: start offset (s), playback speed, length in game seconds
const FLIP = {from: 0.24, ts: 1.45, dur: 0.6 / 1.45}


// sword trail: a crescent that is thick and bright in the middle and fades to nothing at both tips
function crescentGeometry(N = 40, start = -1.3, len = 2.6) {
    const pos = []
    const col = []
    const idx = []
    const edge = new THREE.Color(0xffffff)
    const body = new THREE.Color(0x9a9a9a)
    for (let i = 0; i <= N; i++) {
        const k = i / N
        const a = start + k * len
        const fade = Math.sin(Math.PI * k)
        const inner = 1 - 0.3 * fade
        pos.push(Math.cos(a), Math.sin(a), 0, Math.cos(a) * inner, Math.sin(a) * inner, 0)
        // white-hot edge, neon green body
        col.push(edge.r * fade, edge.g * fade, edge.b * fade, body.r * fade, body.g * fade, body.b * fade)
        if (i < N) {
            const o = i * 2
            idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
        }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    return g
}

export class GameEngine {
    constructor({canvas, fx, onHud, assetUrl}) {
        this.canvas = canvas
        this.fx = fx
        this.onHud = onHud
        this.assetUrl = assetUrl
        this.input = {left: false, right: false, down: false, jump: false, attack: false, shoot: false, super: false, ability: false}
        this.jumpPressedAt = -1
        this.attackPressedAt = -1
        this.dropPressedAt = -1
        this.time = 0
        this.disposed = false
        this.state = 'loading'
        this.hudTimer = 0
        this.shake = 0
        this.bugs = []
        this.pieces = []
        this.tokens = []
        this.slashes = []
        this.waves = []
        this.elements = []
        this.rewind = null
        this.stats = {score: 0, kills: 0, combo: 0, best: 0, comboTimer: 0, power: 0}
        this.boss = null
        this.bossSpawned = false
        this.sfx = new Sfx()
        if (process.env.NODE_ENV === 'development') window.__game = this
    }

    // ------------------------------------------------------------------ setup
    async init() {
        const vw = window.innerWidth
        const vh = window.innerHeight
        this.vw = vw
        this.vh = vh
        // hero size follows the screen: smaller on phones (portrait or landscape)
        this.playerH = clamp(Math.round(Math.min(vw, vh * 1.4) * 0.187), 80, 132) // ~10% bigger: easier to keep an eye on
        this.unit = this.playerH / 120

        const renderer = new THREE.WebGLRenderer({canvas: this.canvas, alpha: true, antialias: true})
        // phones have 3× screens: rendering that many pixels is the main cost, so cap it
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.5))
        renderer.setSize(vw, vh)
        renderer.setClearColor(0x000000, 0)
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.1
        this.renderer = renderer

        this.scene = new THREE.Scene()
        this.camera = new THREE.OrthographicCamera(0, vw, 0, -vh, 1, 4000)
        this.camera.position.set(0, 0, 2000)

        this.scene.add(new THREE.HemisphereLight(0xe8fff4, 0x1a1030, 1.4))
        const key = new THREE.DirectionalLight(0xffffff, 2.4)
        key.position.set(400, 700, 900)
        this.scene.add(key)
        const rim = new THREE.DirectionalLight(0x14e956, 2.2)
        rim.position.set(-600, 300, -500)
        this.scene.add(rim)

        this.buildShared()
        this.buildParticles()
        this.buildKits()

        document.documentElement.classList.add('game-on')
        this.sfx.unlock()
        this.spacer = document.createElement('div')
        this.spacer.className = 'game-ground-spacer'
        this.spacer.style.height = GROUND_SPACE + 'px'
        this.spacer.setAttribute('aria-hidden', 'true')
        document.body.appendChild(this.spacer)
        this.bind()
        this.collectElements()
        window.scrollTo({top: 0, behavior: 'instant'})
        this.scroll = 0

        this.emitHud(true)
        this.raf = requestAnimationFrame(this.loop)

        const [gltf] = await Promise.all([
            new GLTFLoader().loadAsync(this.assetUrl),
            this.loadMonsterModels(this.assetUrl.replace(/\/[^/]+$/, '/monsters')),
            this.loadWeaponModels(this.assetUrl.replace(/[^/]+$/, 'weapons.glb')),
        ])
        if (this.disposed) return
        this.setupPlayer(gltf)
        this.warmShaders()
        if (this.progress.hero && this.progress.hero !== 'knight') {
            try {
                await this.wearHero(this.progress.hero)
            } catch (err) {
                console.warn('hero failed to load', err)
            }
        }
        this.restart()
    }

    buildShared() {
        this.geo = {
            sphere: new THREE.SphereGeometry(1, 18, 14),
            leg: new THREE.CylinderGeometry(0.035, 0.022, 1, 6).translate(0, -0.5, 0),
            blade: new THREE.BoxGeometry(0.07, 1, 0.014).translate(0, 0.5, 0),
            box: new THREE.BoxGeometry(1, 1, 1),
            cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
            slash: crescentGeometry(),
            ring: new THREE.RingGeometry(0.9, 1, 72),
        }
        this.mats = {
            hit: new THREE.MeshBasicMaterial({color: 0xffffff}),
            slash: new THREE.MeshBasicMaterial({
                vertexColors: true, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
            }),
        }
        this.mats.wave = new THREE.MeshBasicMaterial({
            color: 0x7dffb0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
        })
        this.bugMats = {}
        for (const [k, t] of Object.entries(BUG_TYPES)) {
            if (t.kind && !t.boss) continue
            this.bugMats[k] = {
                body: new THREE.MeshStandardMaterial({color: t.color, roughness: 0.32, metalness: 0.15}),
                head: new THREE.MeshStandardMaterial({color: t.head, roughness: 0.4}),
                eye: new THREE.MeshStandardMaterial({color: t.eye, emissive: t.eye, emissiveIntensity: 2.2}),
            }
        }
    }

    buildKits() {
        this.buildCreatureKit()
        this.buildWeaponKit()
        this.buildStoneKit()
        this.buildLoadoutKit()
        this.buildMeleeKit()
        this.buildFxKit()
        this.buildMissileKit()
        this.buildEnemyUiKit()
        this.heroDefs = HEROES
        this.loadProgress()
    }

    buildParticles() {
        this.tmpColor = new THREE.Color()
        const N = 900
        const geo = new THREE.BufferGeometry()
        this.pPos = new Float32Array(N * 3)
        this.pCol = new Float32Array(N * 3)
        geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3))
        geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3))
        // soft round glow instead of square points
        const c = document.createElement('canvas')
        c.width = c.height = 64
        const ctx = c.getContext('2d')
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(0.25, 'rgba(255,255,255,0.85)')
        grad.addColorStop(0.6, 'rgba(255,255,255,0.25)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 64, 64)
        this.dotTex = new THREE.CanvasTexture(c)
        const mat = new THREE.PointsMaterial({
            size: 11, map: this.dotTex, vertexColors: true, transparent: true, depthTest: false, depthWrite: false,
            blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false,
        })
        this.points = new THREE.Points(geo, mat)
        this.points.frustumCulled = false
        this.points.renderOrder = 10
        this.scene.add(this.points)
        this.particles = Array.from({length: N}, () => ({life: 0}))
        this.pIndex = 0
    }

    setupPlayer(gltf) {
        // the knight file carries every animation clip; other heroes reuse them (same Mixamo skeleton)
        this.clipSource = gltf.animations
        this.knightScene = gltf.scene
        const root = new THREE.Group()
        const facing = new THREE.Group()
        // flip pivot sits at the waist so the somersault spins around the body, not the feet
        const flip = new THREE.Group()
        flip.position.y = this.playerH * 0.5
        facing.position.y = -this.playerH * 0.5
        flip.add(facing)
        root.add(flip)
        this.playerFlip = flip
        this.scene.add(root)
        this.playerRoot = root
        this.buildArmorAura()
        // make the hero stand out: a light of its own (plus the rim glow on the model's materials)
        const heroLight = new THREE.PointLight(0xffffff, 1.6, this.playerH * 3.2, 0)
        heroLight.position.set(this.playerH * 0.2, this.playerH * 0.9, 220)
        root.add(heroLight)
        this.playerFacing = facing
        this.knightHipsY = this.hipsRestY(gltf.scene)
        this.attachHero(gltf.scene, 'knight')
    }

    hipsRestY(scene) {
        let hips = null
        scene.traverse(o => { if (!hips && /Hips$/.test(o.name)) hips = o })
        return hips ? hips.position.y : 1
    }

    // put a (Mixamo-rigged) hero model into the player rig: scale, weapons in the hands, animations
    attachHero(model, id = 'knight') {
        if (this.heroModel) this.playerFacing.remove(this.heroModel)
        if (this.mixer) this.mixer.stopAllAction()
        model.scale.setScalar(1)
        model.position.set(0, 0, 0)
        model.updateMatrixWorld(true)
        // measure the bare model once: later re-attaches would also count the weapons in its hands
        // (and its current animated pose), which would cancel out the Growth upgrade
        if (!model.userData.rest) {
            const box = new THREE.Box3().setFromObject(model)
            model.userData.rest = {h: box.max.y - box.min.y, minY: box.min.y}
        }
        const {h, minY} = model.userData.rest
        // Growth upgrade: the model is drawn bigger
        const grow = this.growthScale ? this.growthScale() : 1
        model.scale.setScalar((this.playerH / h) * grow)
        model.position.y = -minY * (this.playerH / h) * grow
        this.playerMats = []
        model.traverse(o => {
            if (o.isMesh) {
                o.frustumCulled = false
                if (!o.userData.ownMat) {
                    o.material = o.material.clone()
                    o.material.emissive = new THREE.Color(0x000000)
                    o.userData.ownMat = true
                    // a light rim around the silhouette so the hero pops out of the page behind him
                    o.material.onBeforeCompile = shader => {
                        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
                            '#include <emissivemap_fragment>\n' +
                            'float heroRim = pow(1.0 - abs(normalize(normal).z), 2.6);\n' +
                            'totalEmissiveRadiance += vec3(0.62, 1.0, 0.82) * heroRim * 0.75;')
                    }
                    o.material.customProgramCacheKey = () => 'hero-rim'
                    o.material.needsUpdate = true
                }
                this.playerMats.push(o.material)
            }
        })
        this.playerFacing.add(model)
        this.heroModel = model
        model.updateMatrixWorld(true)

        // melee weapon in the right hand
        let hand = null
        model.traverse(o => { if (!hand && /RightHand$/.test(o.name)) hand = o })
        if (this.sword && this.sword.parent) this.sword.parent.remove(this.sword)
        this.sword = null
        this.axeHead = null
        if (hand) {
            const sword = this.buildSword()
            const ws = new THREE.Vector3()
            hand.getWorldScale(ws)
            sword.scale.setScalar((this.playerH * 0.62 * grow) / ws.x)
            hand.add(sword)
            this.sword = sword
        }
        // gun in the left hand
        let leftHand = null
        model.traverse(o => { if (!leftHand && /LeftHand$/.test(o.name)) leftHand = o })
        if (this.gunHolder && this.gunHolder.parent) this.gunHolder.parent.remove(this.gunHolder)
        if (leftHand) {
            const {group, muzzle} = this.buildGun(this.weapon || (this.progress && this.progress.gun))
            const ws = new THREE.Vector3()
            leftHand.getWorldScale(ws)
            const holder = new THREE.Group()
            holder.scale.setScalar((this.playerH * 0.62 * grow) / ws.x)
            holder.add(group)
            // the barrel points where the bullets go when the hero holds the left hand forward
            group.rotation.set(0, Math.PI / 2, 0)
            group.position.set(0.02, 0.07, 0)
            leftHand.add(holder)
            this.gunHolder = holder
            this.gun = group
            this.muzzle = muzzle
        }

        // clips: the hips height track is rescaled to this hero's proportions
        const k = this.hipsRestY(model) / (this.knightHipsY || 1)
        this.mixer = new THREE.AnimationMixer(model)
        this.actions = {}
        for (const src of this.clipSource) {
            const clip = Math.abs(k - 1) > 0.02 ? src.clone() : src
            if (clip !== src) {
                for (const t of clip.tracks) {
                    if (!/Hips\.position$/.test(t.name)) continue
                    t.values = t.values.slice()
                    for (let i = 1; i < t.values.length; i += 3) t.values[i] *= k
                }
            }
            this.actions[clip.name] = this.mixer.clipAction(clip)
        }
        this.curAnim = null
        if (this.progress) {
            this.setMeleeLook()
            this.setGunGlow()
        }
        // hero gear: Vanguard's jetpack, Michelle's drone
        if (this.jetpack && this.jetpack.parent) this.jetpack.parent.remove(this.jetpack)
        this.jetpack = null
        if (HEROES[id] && HEROES[id].trait === 'jetpack') this.attachJetpack(model)
        // the Gunslinger: a pistol in each hand instead of the melee weapon
        this.pistols = null
        if (HEROES[id] && HEROES[id].trait === 'dual') this.attachPistols(hand, leftHand)
        // Ferrum fights with his metal only: nothing in his hands
        if (HEROES[id] && HEROES[id].trait === 'metal') {
            if (this.sword) this.sword.visible = false
            if (this.gunHolder) this.gunHolder.visible = false
        }
        if (!HEROES[id] || HEROES[id].trait !== 'helper') this.removeDrone()
        if (this.ab) this.resetAbility()
        this.playAnim('idle')
    }

    // load (once) and wear a hero bought in the shop
    async wearHero(id) {
        const H = HEROES[id]
        if (!H) return
        if (!H.file) {
            this.attachHero(this.knightScene, id)
            return
        }
        this.heroCache = this.heroCache || {}
        if (!this.heroCache[id]) {
            const gltf = await new GLTFLoader().loadAsync(this.assetUrl.replace(/[^/]+$/, H.file))
            this.heroCache[id] = gltf.scene
        }
        // a later pick in the shop wins over an earlier, slower download
        if (this.disposed || this.progress.hero !== id) return
        this.attachHero(this.heroCache[id], id)
    }

    // melee weapon holder in the right hand; the model inside is swapped by setMeleeLook()
    buildSword() {
        const g = new THREE.Group()
        g.add(this.buildMeleeModel(this.progress ? this.progress.melee : 'sword'))
        // the Mixamo hand's Y axis runs along the fingers; the blade follows the hand's +X (out of the fist)
        const holder = new THREE.Group()
        holder.add(g)
        g.rotation.set(0, 0, -Math.PI / 2)
        g.position.set(0, 0.06, 0)
        holder.userData.inner = g
        return holder
    }

    // ------------------------------------------------------------------ input
    bind() {
        this.onKey = e => {
            const t = e.target && e.target.closest ? e.target : null
            if (t && t.closest('input, textarea, select, [contenteditable]')) return
            // HUD buttons (sound, rebuild…) never keep the keyboard: Space must stay the attack.
            // Buttons in the lobby and in the end panels keep Space / Enter for themselves.
            if (t && t.closest('.game-ui button, .game-ui a') && (e.code === 'Space' || e.code === 'Enter')) {
                if (t.closest('.game-hud')) t.blur()
                else return
            }
            if (e.code === 'KeyR' && e.type === 'keydown') this.startRewind()
            if (e.code === 'KeyM' && e.type === 'keydown' && !e.repeat) this.toggleMute()
            const k = KEYS[e.code]
            if (!k) return
            e.preventDefault()
            const down = e.type === 'keydown'
            if (down && !e.repeat) {
                if (k === 'jump' && !this.jetpackTap()) this.jumpPressedAt = this.time
                if (k === 'ability') this.useAbility()
                if (k === 'attack') this.attackPressedAt = this.time
                if (k === 'super') this.trySuper()
                if (k === 'dash') this.tryDash()
                if (k === 'down') this.dropPressedAt = this.time
                if (k === 'attack') this.attackHoldStart = this.time
            }
            if (k === 'attack' && !down) this.attackHoldStart = null
            this.input[k] = down
        }
        this.onPointerDown = e => {
            if (e.target.closest && e.target.closest('.game-ui')) return
            if (e.pointerType === 'touch') return
            e.preventDefault()
            // clicking the game world takes the focus away from any HUD button
            if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur()
            this.input.attack = true
            this.attackPressedAt = this.time
            this.attackHoldStart = this.time
        }
        this.onPointerUp = () => {
            this.input.attack = false
            this.attackHoldStart = null
        }
        this.onClick = e => {
            if (e.target.closest && e.target.closest('.game-ui')) return
            e.preventDefault()
            e.stopPropagation()
        }
        this.onWheel = e => {
            if (e.target.closest && e.target.closest('.game-ui')) return
            e.preventDefault()
        }
        this.onResize = () => {
            this.vw = window.innerWidth
            this.vh = window.innerHeight
            this.renderer.setSize(this.vw, this.vh)
            this.camera.right = this.vw
            this.camera.bottom = -this.vh
            this.camera.updateProjectionMatrix()
        }
        this.onVis = () => {
            this.lastT = performance.now()
            // the game's audio pauses while the tab is in the background
            const ctx = this.sfx && this.sfx.ctx
            if (ctx) {
                if (document.hidden) ctx.suspend()
                else ctx.resume()
            }
        }
        this.onBlur = () => {
            for (const k in this.input) this.input[k] = false
            // leaving this tab: write what we have now (it was the active one)
            if (this.progress) {
                clearTimeout(this.saveTimer)
                this.saveTimer = null
                this.saveProgress(true)
            }
        }
        this.onFocus = () => this.syncProgress()
        window.addEventListener('keydown', this.onKey)
        window.addEventListener('keyup', this.onKey)
        window.addEventListener('pointerdown', this.onPointerDown, true)
        window.addEventListener('pointerup', this.onPointerUp, true)
        window.addEventListener('click', this.onClick, true)
        window.addEventListener('wheel', this.onWheel, {passive: false})
        window.addEventListener('touchmove', this.onWheel, {passive: false})
        window.addEventListener('contextmenu', this.onClick, true)
        window.addEventListener('resize', this.onResize)
        window.addEventListener('blur', this.onBlur)
        window.addEventListener('focus', this.onFocus)
        document.addEventListener('visibilitychange', this.onVis)
    }

    // touch buttons
    press(name, down) {
        if (down && !this.input[name]) {
            if (name === 'jump' && !this.jetpackTap()) this.jumpPressedAt = this.time
            if (name === 'ability') this.useAbility()
            if (name === 'attack') this.attackPressedAt = this.time
            if (name === 'super') this.trySuper()
            if (name === 'dash' && down) this.tryDash()
            if (name === 'down') this.dropPressedAt = this.time
            if (name === 'attack') this.attackHoldStart = this.time
        }
        if (name === 'attack' && !down) this.attackHoldStart = null
        this.input[name] = down
    }

    // ------------------------------------------------------------------ page blocks
    collectElements() {
        const els = [...document.querySelectorAll(SELECTORS)]
        this.elements = els
            .filter(el => !el.closest('.game-ui'))
            .map((el, id) => {
                const r = el.getBoundingClientRect()
                const area = r.width * r.height
                const hp = clamp(Math.round(area / 30000) + 2, 2, 5)
                const cs = getComputedStyle(el)
                // gradient text (background-clip: text) is still just glyphs
                const clipText = cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text'
                const plain = (clipText || (/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) &&
                        cs.backgroundImage === 'none')) &&
                    parseFloat(cs.borderTopWidth) === 0 && el.tagName !== 'IMG' && !el.querySelector('img')
                return {
                    id, el, hp, maxHp: hp, broken: false, l: 0, r: 0, t: 0, b: 0, crack: null,
                    vis: el.style.visibility, tight: plain,
                }
            })
        this.totalElements = this.elements.length
        this.refreshRects()
    }

    refreshRects() {
        const sy = window.scrollY
        if (!this.range) this.range = document.createRange()
        for (const e of this.elements) {
            if (e.broken) continue
            let r = e.el.getBoundingClientRect()
            // plain text: use the box of the glyphs themselves, not the (wider) block
            if (e.tight && r.width > 0) {
                this.range.selectNodeContents(e.el)
                const tr = this.range.getBoundingClientRect()
                if (tr.width > 4 && tr.height > 4) r = tr
            }
            e.l = r.left
            e.r = r.right
            e.t = r.top + sy
            e.b = r.bottom + sy
            e.w = r.width
            e.h = r.height
            e.ok = r.width > 30 && r.height > 10
        }
        this.docH = document.documentElement.scrollHeight
        // the ground stands a little below the page's end; GROUND_SPACE of room is added under the page
        const pageEnd = this.docH - (this.spacer ? GROUND_SPACE : 0)
        this.floor = {floor: true, l: -1e5, r: 1e5, t: pageEnd + GROUND_OFFSET, b: this.docH}
        this.fx.style.height = this.docH + 'px'
        if (!this.contactTop) {
            const c = document.getElementById('contact')
            if (c) this.contactTop = c.getBoundingClientRect().top + sy
        }
    }

    platforms() {
        const list = this.elements.filter(e => !e.broken && e.ok)
        return this.stones && this.stones.length ? list.concat(this.stones) : list
    }

    // one-way landing test; returns the platform landed on (highest one crossed this frame)
    land(x, halfW, prevY, y, ignore) {
        let best = null
        for (const p of this.platformList) {
            if (p === ignore) continue
            if (x + halfW <= p.l || x - halfW >= p.r) continue
            if (prevY <= p.t + 2 && y >= p.t && (!best || p.t < best.t)) best = p
        }
        if (!best && prevY <= this.floor.t + 2 && y >= this.floor.t) best = this.floor
        return best
    }

    // ------------------------------------------------------------------ game flow
    restart() {
        this.instantRebuild()
        for (const b of this.bugs) this.removeEnemy(b)
        this.clearEnemyUi && this.clearEnemyUi()
        this.clearThrown && this.clearThrown()
        this.resetDebuffs && this.resetDebuffs()
        this.bugs = []
        for (const c of this.corpses || []) this.scene.remove(c.root)
        this.corpses = []
        for (const t of this.tokens) t.node.remove()
        this.tokens = []
        this.clearProjectiles()
        this.clearLoadout()
        this.clearMissiles()
        this.applyDifficulty()
        this.resetAbility()
        this.resetEvents()
        this.sfx.setMusicIntensity(false)
        this.sfx.startMusic(themeIndex(this.level))
        this.runCoins = 0
        this.levelWon = false
        this.levelBonus = 0
        this.paused = false
        this.stats = {score: 0, kills: 0, combo: 0, best: 0, comboTimer: 0, power: 0, ammo: START_AMMO + this.startAmmo(), armor: this.heroStartArmor(), armorOn: true}
        this.heartTimer = 40
        this.boss = null
        this.bossNotBefore = 0
        this.resetPace && this.resetPace()
        this.resetPerks && this.resetPerks()
        this.dashCharges = undefined
        this.dashCd = 0
        this.resetFerrum && this.resetFerrum()
        this.horde = null
        this.bossSpawned = false
        this.bossLevel = 1
        this.nextBossAt = 0
        this.clearing = false
        window.scrollTo({top: 0, behavior: 'instant'})
        this.scroll = 0
        this.refreshRects()
        this.platformList = this.platforms()
        this.generateStones()
        this.platformList = this.platforms()
        // the first magazine is waiting right next to the start
        this.dropToken(this.vw * 0.18 + 170, 40, 'ammo', 0, true)
        this.player = {
            x: this.vw * 0.18, y: -60, vx: 0, vy: 0, onGround: false, ground: null,
            facing: 1, faceAngle: 1, hp: this.heroMaxHp(), maxHp: this.heroMaxHp(), inv: 0, jumps: 1, coyote: 0,
            dropIgnore: null, dropTimer: 0, attack: null, chain: 0, dead: false, deadTimer: 0,
        }
        this.spawnTimer = 0.4
        // the ally bought in the lobby joins the run
        this.spawnAlly && this.spawnAlly().catch(e => console.warn('ally failed', e))
        this.state = 'intro'
        this.stateTimer = 2.2
        this.playAnim('idle')
        this.emitHud(true)
    }

    loop = (now) => {
        if (this.disposed) return
        this.raf = requestAnimationFrame(this.loop)
        const last = this.lastT || now
        this.lastT = now
        const dt = Math.min((now - last) / 1000, 1 / 30)
        if (document.hidden) return
        this.update(dt)
    }

    update(dt) {
        // the shop pauses the world but keeps drawing it
        if (this.paused) {
            this.renderer.render(this.scene, this.camera)
            return
        }
        // hit-stop: hold the frame for a split second on heavy impacts
        if (this.freezeT > 0) {
            this.freezeT -= dt
            this.renderer.render(this.scene, this.camera)
            return
        }
        this.time += dt
        this.frameDt = dt
        this.trackPerf(dt)
        if (this.rectsDirty || this.time - (this.rectT || -9) > 0.6) {
            this.refreshRects()
            this.platformList = this.platforms()
            this.rectT = this.time
            this.rectsDirty = false
            this.updateCracks()
        }

        if (this.rewind) this.updateRewind(dt)
        else if (this.player) {
            if (this.state === 'intro') {
                this.stateTimer -= dt
                if (this.stateTimer <= 0) this.state = 'play'
            }
            this.updatePlayer(dt)
            this.updateAbility(dt)
            if (this.state === 'play') {
                this.updateSpawner(dt)
                this.updatePace(dt)
                this.updateHearts(dt)
                this.updateEvents(dt)
            }
            this.updateBugs(dt)
            this.updateEnemyUi(dt)
            this.updateBullets(dt)
            this.updateThrown(dt)
            this.updateDebuffs && this.updateDebuffs(dt)
            this.updateSiteFx && this.updateSiteFx(dt)
            this.updatePerks && this.updatePerks(dt)
            this.updateAlly && this.updateAlly(dt)
            this.updateOrbs(dt)
            this.updateMissiles(dt)
            this.updateTokens(dt)
        }
        this.updateStones(dt)
        this.updateFx(dt)
        if (this.floor && this.stoneTex) this.updateGround()
        this.updateLoadout(dt)
        this.updateGunAnim(dt)
        this.updateCorpses(dt)
        this.updateArmor(dt)
        this.updatePieces(dt)
        this.updateCamera(dt)
        this.updateSlashes(dt)
        this.updateWaves(dt)
        this.updateParticles(dt)
        if (this.mixer) this.mixer.update(dt)

        if (this.stats.comboTimer > 0) {
            this.stats.comboTimer -= dt
            if (this.stats.comboTimer <= 0) this.stats.combo = 0
        }

        this.hudTimer -= dt
        if (this.hudTimer <= 0) this.emitHud()
        this.renderer.render(this.scene, this.camera)
    }

    emitHud(force) {
        this.hudTimer = 0.1
        const broken = this.elements.filter(e => e.broken).length
        const p = this.player
        this.onHud({
            state: this.state,
            loading: !this.actions,
            hp: p ? p.hp : 6,
            maxHp: p ? p.maxHp : 6,
            score: this.stats.score,
            kills: this.stats.kills,
            combo: this.stats.combo,
            best: this.stats.best,
            power: Math.round(this.stats.power),
            dual: this.isDual(),
            metal: this.isMetal(),
            dash: this.dashCd > 0 ? 1 - this.dashCd / this.dashStats().cd : 1,
            dashCharges: this.dashCharges === undefined ? this.dashStats().charges : this.dashCharges,
            perks: this.perkHud ? this.perkHud() : [],
            superOn: !this.isDual(),
            ammo: this.stats.ammo || 0,
            infinite: this.progress && this.weapon ? this.infiniteAmmo() : false,
            heat: this.heat || 0,
            overheated: !!this.overheated,
            heats: this.progress && this.weapon ? this.gunHeat() > 0 : false,
            armor: Math.ceil(this.stats.armor || 0),
            armorOn: (this.stats.armor || 0) > 0,
            destroyed: this.totalElements ? Math.round((broken / this.totalElements) * 100) : 0,
            boss: this.boss ? {hp: Math.max(0, this.boss.hp), max: this.boss.maxHp, name: BUG_TYPES[this.boss.type].title} : null,
            coins: this.progress ? this.progress.coins : 0,
            runCoins: this.runCoins || 0,
            level: this.level || 1,
            wonLevel: this.wonLevel || 0,
            levelBonus: this.levelBonus || 0,
            gun: this.weapon ? {id: this.weapon, ...WEAPONS[this.weapon], lv: this.progress.lv[this.weapon] || 1} : null,
            melee: this.progress ? this.meleeStats() : null,
            paused: !!this.paused,
            event: this.event ? {name: this.event.name, left: Math.ceil(this.event.left)} : null,
            muted: this.sfx ? this.sfx.muted : false,
            ability: this.player ? this.abilityHud() : null,
            rewinding: !!this.rewind,
            force,
        })
    }

    // ------------------------------------------------------------------ player
    updatePlayer(dt) {
        const p = this.player
        const I = this.input
        const halfW = 16
        const canAct = this.state === 'play' || this.state === 'intro'

        p.inv = Math.max(0, p.inv - dt)
        p.dropTimer = Math.max(0, p.dropTimer - dt)
        if (p.dropTimer === 0) p.dropIgnore = null

        if (p.dead) {
            p.deadTimer += dt
            p.vx *= 0.9
            if (p.deadTimer > 2.2 && this.state !== 'dead') {
                this.state = 'dead'
                this.saveProgress()
                this.sfx && this.sfx.play('lose')
                this.emitHud(true)
            }
        } else if (canAct) {
            const dir = (I.right ? 1 : 0) - (I.left ? 1 : 0)
            let target = dir * RUN * (this.moveMul ? this.moveMul() : 1) * (p.onGround ? 1 : AIR_RUN) * (1 + 0.12 * (this.perk ? this.perk('swift') : 0)) * (1 + 0.1 * (this.growthLv ? this.growthLv() : 0))
            if (p.attack && p.onGround) target *= 0.35
            p.vx += (target - p.vx) * Math.min(1, dt * (p.onGround ? 14 : 11))
            if (dir) p.facing = dir

            // jumping / dropping
            // S / ↓ on a block drops straight through it
            const wantDrop = this.dropPressedAt >= 0 && this.time - this.dropPressedAt < 0.14
            if (wantDrop && p.onGround && p.ground && !p.ground.floor) {
                p.dropIgnore = p.ground
                p.dropTimer = 0.32
                p.onGround = false
                p.vy = 160
                this.dropPressedAt = -1
            }
            const wantJump = this.jumpPressedAt >= 0 && this.time - this.jumpPressedAt < 0.14
            if (wantJump) {
                if (I.down && p.onGround && !p.ground.floor) {
                    p.dropIgnore = p.ground
                    p.dropTimer = 0.32
                    p.onGround = false
                    p.vy = 160
                    this.jumpPressedAt = -1
                } else if (p.onGround || p.coyote > 0) {
                    p.vy = -JUMP
                    this.sfx && this.sfx.play('jump')
                    // a puff of dust as the hero pushes off
                    this.dust(p.x, p.y, 8, 46)
                    p.onGround = false
                    p.coyote = 0
                    p.jumps = 1
                    this.jumpPressedAt = -1
                } else if (p.jumps < 2 + (this.perk ? this.perk('swift') : 0)) {
                    p.vy = -AIR_JUMP
                    this.sfx && this.sfx.play('jump')
                    p.jumps++
                    p.flip = 0
                    p.flipDir = p.facing
                    this.jumpPressedAt = -1
                    this.burst(p.x, p.y, 14, 0x8cffbf, 260)
                }
            }

            // attacks
            // the Gunslinger has no melee: his dual pistols fire on the attack button
            if (this.isDual()) this.updatePistols(dt, canAct)
            this.updateFerrum(dt, canAct)
            const wantAttack = !this.customKit() && (I.attack || (this.attackPressedAt >= 0 && this.time - this.attackPressedAt < 0.2))
            if (p.attack) {
                p.attack.t += dt
                const a = p.attack
                // a swing can land several hits (axe combo, katana lunge)
                while (a.hitIdx < a.hitTimes.length && a.t >= a.hitTimes[a.hitIdx]) {
                    a.hitIdx++
                    if (a.super) this.superBlast()
                    else this.performHit()
                }
                if (!a.super && a.t >= a.chainAt && wantAttack) this.startAttack()
                else if (a.t >= a.dur) p.attack = null
            } else if (wantAttack) {
                this.startAttack()
            }
        }
        this.updateShooting(dt, canAct)
        this.updateCharge()

        // a grown hero (Growth upgrade) stomps: every running step hurts monsters standing by his feet
        const gl = this.growthLv ? this.growthLv() : 0
        if (gl > 0 && p.onGround && !p.dead && Math.abs(p.vx) > 160) {
            p.stepT = (p.stepT || 0) - dt * (Math.abs(p.vx) / RUN)
            if (p.stepT <= 0) {
                p.stepT = 0.34
                const R = this.playerH * (0.45 + 0.15 * gl)
                this.dust(p.x + p.facing * 8, p.y, 4 + gl * 2, 30 + gl * 14)
                this.shake = Math.max(this.shake, 1.5 + 2 * gl)
                this.sfx && this.sfx.play('stomp', {volume: 0.35 + 0.22 * gl})
                // the ground cracks under the heavy steps
                if (p.ground && this.crackAt) this.crackAt(p.x + p.facing * 6, p.ground.floor ? p.y : p.ground.t, this.playerH * (0.35 + 0.18 * gl), p.ground)
                for (const b of this.bugs) {
                    const big = this.isBoss(b)
                    if (b.dead || Math.abs(b.x - p.x) > R + (big ? b.size * 0.4 : 0) || Math.abs(b.y - p.y) > 26) continue
                    // bosses feel it too, at half strength
                    this.damageBug(b, this.meleeStats().dmg * 0.15 * gl * (big ? 0.5 : 1), Math.sign(b.x - p.x) || p.facing, false, 'thrown')
                }
            }
        }

        // a soft glowing trail behind the hero's feet while jumping
        if (!p.onGround && !p.dead && Math.abs(p.vy) > 250 && Math.random() < 0.6) {
            this.spray(1, p.x + rand(-8, 8), p.y - 6, p.jumps >= 2 ? 0x8cffbf : 0xe0f2fe, () => [-p.vx * 0.1 + rand(-20, 20), rand(10, 50)], [0.18, 0.32], 0)
        }

        // dash (Shift, or the katana lunge)
        // dash charges refill one by one
        if (this.dashCd > 0) {
            this.dashCd -= dt
            if (this.dashCd <= 0) {
                const D = this.dashStats()
                this.dashCharges = Math.min(D.charges, (this.dashCharges || 0) + 1)
                this.dashCd = this.dashCharges < D.charges ? D.cd : 0
                this.emitHud(true)
            }
        }
        if (p.dash) {
            p.dash.t -= dt
            p.vx = p.dash.v
            if (p.vy > 0) p.vy *= 0.5
            if (p.dash.ghost) {
                // afterimages and speed lines along the path
                p.dash.g = (p.dash.g || 0) - dt
                if (p.dash.g <= 0) {
                    p.dash.g = 0.035
                    this.flash(p.x - Math.sign(p.dash.v) * 18, p.y - this.playerH * 0.5, 0x9ff3c8, this.playerH * 0.42, 0.18)
                }
                if (Math.random() < 0.7) {
                    const yy = p.y - this.playerH * (0.2 + Math.random() * 0.7)
                    this.addBeam(p.x - Math.sign(p.dash.v) * 30, yy, p.x - Math.sign(p.dash.v) * 110, yy, 0xe0f2fe, 0.8, 3, 0.1)
                }
            }
            for (const b of this.bugs) {
                if (b.dead || p.dash.hit.has(b)) continue
                if (Math.abs(b.x - p.x) < b.size * 0.5 + 30 && Math.abs(b.y - b.size * 0.42 - (p.y - this.playerH * 0.5)) < b.size * 0.5 + 50) {
                    p.dash.hit.add(b)
                    this.damageBug(b, this.meleeStats().dmg * (p.dash.dmg || 1.5), Math.sign(p.dash.v) || p.facing, false)
                    this.flash(b.x, b.y - b.size * 0.42, 0x22d3ee, b.size, 0.22)
                }
            }
            if (p.dash.t <= 0) p.dash = null
        }

        // physics
        p.coyote = Math.max(0, p.coyote - dt)
        const stick = p.onGround && p.ground && (p.ground.floor || !p.ground.broken) &&
            p.x + halfW > p.ground.l && p.x - halfW < p.ground.r && Math.abs(p.y - p.ground.t) < 28
        if (stick && p.vy >= 0) {
            p.y = p.ground.t
            p.vy = 0
        } else {
            if (p.onGround) p.coyote = 0.1
            p.onGround = false
            p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * HERO_GRAVITY * dt * (I.down && !p.dead ? 1.6 : 1))
        }
        const prevY = p.y
        p.y += p.vy * dt
        p.x = clamp(p.x + p.vx * dt, halfW + 4, this.vw - halfW - 4)
        // ceiling: never fly above the top of the page (jetpack, double jumps)
        const ceiling = this.playerH + 80
        if (p.y < ceiling) {
            p.y = ceiling
            if (p.vy < 0) p.vy = 0
        }
        if (!p.onGround && p.vy >= 0) {
            const pl = this.land(p.x, halfW, prevY, p.y, p.dropIgnore)
            if (pl) {
                if (p.vy > 900) this.burst(p.x, pl.t, 10, 0xccffe6, 200)
                if (p.vy > 500) {
                    this.sfx && this.sfx.play('land', {volume: Math.min(1, p.vy / 1400)})
                    this.dust(p.x, pl.t, Math.round(p.vy / 90), 90)
                    if (p.vy > 1100) this.ring(p.x, pl.t, 0x9ff3c8, 60, 0.3, 0.9)
                }
                p.y = pl.t
                p.vy = 0
                p.onGround = true
                p.ground = pl
                p.jumps = 0
            }
        }

        // visuals
        p.faceAngle += (p.facing - p.faceAngle) * Math.min(1, dt * 16)
        this.playerRoot.position.set(p.x, -p.y, 0)
        // sword clips turn the hips ~55° (bladed stance); a near-profile base keeps them readable
        this.playerFacing.rotation.y = p.faceAngle * (Math.PI / 2 - 0.15)
        // Mixamo "Running Forward Flip" on the double jump (airborne part only, cut short on landing)
        if (p.flip != null) {
            p.flip += dt
            if (p.flip >= FLIP.dur || p.onGround) p.flip = null
        }
        // no hurt-blink while a super keeps him invulnerable on purpose
        const flash = p.inv > 0 && !this.ironWings && Math.floor(p.inv * 14) % 2 === 0
        for (const m of this.playerMats) m.emissive.setHex(flash ? 0x661111 : 0x000000)

        // animation state
        if (p.dead) this.playAnim('death', {once: true, fade: 0.2})
        else if (p.attack) { /* attack clip already playing */ }
        else if (p.flip != null) this.playFlip()
        else if (!p.onGround) this.playAnim('block', {once: true, fade: 0.1, ts: 0.8})
        else if (Math.abs(p.vx) > 40) this.playAnim('run', {ts: clamp(Math.abs(p.vx) / RUN, 0.5, 1.1) * 1.05})
        else this.playAnim('idle')
    }

    playFlip() {
        if (this.curAnim === 'flip' || !this.actions.flip) return
        this.playAnim('flip', {once: true, ts: FLIP.ts, fade: 0.06, restart: true})
        this.actions.flip.time = FLIP.from
    }

    startAttack() {
        const p = this.player
        const chain = this.attackChain()
        const spec = chain[p.chain % chain.length]
        p.chain++
        const clip = this.actions[spec.clip]
        const len = clip ? clip.getClip().duration : 1
        const ts = spec.ts * this.meleeStats().speed
        // a cut attack plays only its own part of the clip (from…end)
        const from = spec.from || 0
        const end = spec.end || 1
        const full = len / ts
        const dur = full * (end - from)
        p.attack = {t: 0, dur, hitTimes: spec.hits.map(h => full * (h - from)), hitIdx: 0, chainAt: dur * spec.chain}
        this.attackPressedAt = -1
        this.playAnim(spec.clip, {once: true, ts, fade: 0.06, restart: true})
        if (from && clip) clip.time = from * len
        if (!this.input.attack) this.chainReset = this.time
        // Energy Katana: the lunge dashes forward through the monsters
        if (this.progress.melee === 'katana' && spec.clip === 'kat1') {
            p.dash = {t: 0.2, v: p.facing * 1350, hit: new Set()}
            p.inv = Math.max(p.inv, 0.3)
            this.flash(p.x, p.y - this.playerH * 0.5, 0x22d3ee, 70, 0.22)
        }
    }

    // Shift: a quick dash with a moment of invulnerability (cuts lightly through monsters on the way)
    // the Dash upgrade (0…4): cooldown, distance, damage, invulnerability; level 4 = two charges
    dashStats() {
        const lv = (this.progress && this.progress.stats && this.progress.stats.dash) || 0
        return {
            cd: [1.2, 1.0, 0.85, 0.7, 0.7][lv],
            speed: 1500 * (1 + 0.15 * lv),
            dmg: [0.4, 0.4, 0.6, 0.6, 0.8][lv],
            inv: [0.28, 0.28, 0.3, 0.36, 0.36][lv],
            charges: lv >= 4 ? 2 : 1,
        }
    }

    tryDash() {
        const p = this.player
        const D = this.dashStats()
        if (this.dashCharges === undefined) this.dashCharges = D.charges
        if (!p || p.dead || this.state !== 'play' || this.paused || p.dash || this.dashCharges <= 0) return
        const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0) || p.facing
        p.facing = dir
        p.faceAngle = dir
        p.dash = {t: 0.2, v: dir * D.speed, hit: new Set(), dmg: D.dmg, ghost: true}
        p.inv = Math.max(p.inv, D.inv)
        if (p.vy > 0) p.vy = 0
        this.dashCharges--
        if (this.dashCd <= 0) this.dashCd = D.cd
        this.dust(p.x, p.y, 8, 50)
        this.flash(p.x, p.y - this.playerH * 0.5, 0xffffff, this.playerH * 0.5, 0.12)
        this.sfx && this.sfx.play('boomerang', {volume: 0.6})
        this.emitHud(true)
    }

    // holding the sword button with a full meter charges the super strike
    updateCharge() {
        const p = this.player
        if (this.attackHoldStart == null || !this.input.attack || p.dead || this.stats.power < 100) return
        const held = this.time - this.attackHoldStart
        if (held > 0.2 && Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2
            const r = this.playerH * 0.7
            this.burst(p.x + Math.cos(a) * r, p.y - this.playerH * 0.5 + Math.sin(a) * r, 1, 0x14e956, 30)
        }
        if (held >= SUPER_CHARGE) {
            this.attackHoldStart = null
            this.trySuper()
        }
    }

    // the Super Strike is a move of its own now: every hero (but the Gunslinger) with any melee weapon;
    // the Super Strike upgrade charges it faster and makes it bigger; the sword still charges it twice as fast
    superLv() {
        return (this.progress && this.progress.stats && this.progress.stats.super) || 0
    }

    gainPower(v) {
        if (this.isDual && this.isDual()) return
        v *= (1 + 0.25 * this.superLv()) * (this.progress && this.progress.melee === 'sword' ? 2 : 1)
        // Ferrum's Iron Wings is the strongest super in the game, so it charges at half speed
        if (this.isMetal()) v *= 0.5
        const s = this.stats
        const was = s.power >= 100
        s.power = Math.min(100, s.power + v)
        if (!was && s.power >= 100) this.toast(this.isMetal() ? '⚡ IRON WINGS READY — press L' : '⚡ SUPER READY — hold Space', 'super')
    }

    trySuper() {
        const p = this.player
        if (!p || p.dead || this.isDual() || this.state !== 'play' || this.stats.power < 100 || (p.attack && p.attack.super)) return
        // Ferrum's own super: Iron Wings
        if (this.isMetal()) {
            if (this.ironWings) return
            this.stats.power = 0
            this.ferrumSuper()
            this.emitHud(true)
            return
        }
        this.stats.power = 0
        const clip = this.actions.attack1
        const ts = 1.9
        const dur = (clip ? clip.getClip().duration : 2) / ts
        p.attack = {t: 0, dur, hitTimes: [dur * 0.38], hitIdx: 0, chainAt: dur, super: true}
        p.inv = Math.max(p.inv, dur + 0.3)
        p.vy = Math.min(p.vy, -420)
        p.onGround = false
        this.playAnim('attack1', {once: true, ts, fade: 0.05, restart: true})
        this.burst(p.x, p.y - this.playerH * 0.5, 40, 0x14e956, 300)
        this.emitHud(true)
    }

    superBlast() {
        const p = this.player
        const cx = p.x
        const cy = p.y - this.playerH * 0.5
        const lv = this.superLv()
        const R = SUPER_RADIUS * (1 + 0.12 * lv)
        const R2 = R * R
        const blow = this.meleeStats().dmg
        const dmgFor = b => (this.isBoss(b) ? 8 + blow * 2 : Math.max(99, blow * 6)) * (1 + 0.3 * lv)
        const targets = this.bugs.filter(b => !b.dead && (b.x - cx) ** 2 + (b.y - b.size * 0.4 - cy) ** 2 <= R2)
        const id = this.progress.melee
        // every melee weapon has its own Super Strike (supers.js); the sword keeps the classic shockwave
        const styled = this.superStyle && this.superStyle(id, {cx, cy, R, targets, dmgFor})
        if (!styled) for (const b of targets) this.damageBug(b, dmgFor(b), Math.sign(b.x - cx) || 1, true)
        for (const o of this.orbs) {
            if ((o.x - cx) ** 2 + (o.y - cy) ** 2 < R2) o.life = 0
        }
        for (const e of this.platformList) {
            if (e.stone) continue
            const nx = clamp(cx, e.l, e.r)
            const ny = clamp(cy, e.t, e.b)
            if ((nx - cx) ** 2 + (ny - cy) ** 2 > R2) continue
            this.damageElement(e, 2, nx, ny)
        }
        // expanding shockwave rings (the sword's classic super)
        for (let i = 0; i < (styled ? 0 : 3); i++) {
            const mesh = new THREE.Mesh(this.geo.ring, this.mats.wave.clone())
            mesh.position.set(cx, -cy, 70)
            mesh.renderOrder = 12
            this.scene.add(mesh)
            this.waves.push({mesh, t: -i * 0.08, R})
        }
        this.burst(cx, cy, 160, 0x14e956, 1100)
        this.sfx && this.sfx.play('super')
        this.hitStop(120)
        this.burst(cx, cy, 80, 0xeafff3, 700)
        this.burst(cx, cy, 60, 0x22d3ee, 900)
        this.shake = 34
        this.toast(`⚡ ${SUPER_NAMES[id] || 'SUPER STRIKE'}`, 'super')
        this.onHud({flash: Math.random()})
    }

    updateWaves(dt) {
        for (const w of this.waves) {
            w.t += dt
            const k = clamp(w.t / 0.5, 0, 1)
            const r = Math.max(1, ease(k) * (w.R || SUPER_RADIUS))
            w.mesh.scale.set(r, r, 1)
            w.mesh.material.opacity = w.t < 0 ? 0 : 0.9 * (1 - k)
        }
        this.waves = this.waves.filter(w => {
            if (w.t < 0.5) return true
            this.scene.remove(w.mesh)
            w.mesh.material.dispose()
            return false
        })
    }

    performHit() {
        const p = this.player
        const f = p.facing
        const melee = this.meleeStats()
        const reach = this.playerH * melee.reach
        const box = {
            l: f > 0 ? p.x - 20 : p.x - reach,
            r: f > 0 ? p.x + reach : p.x + 20,
            t: p.y - this.playerH * 1.05,
            b: p.y + 10,
        }
        // the arc grows with the weapon's reach so upgrades are visible
        const arc = melee.reach / 1.15
        // each weapon swings in its own style (chop, cuts, ground slam, sweep, stab, flames, splash…)
        this.swingFx(this.progress.melee, f, arc)
        let hitSomething = false
        let hitBug = false
        // Battle Axe: every 3rd swing is a critical blow
        let crit = 1
        if (this.progress.melee === 'axe') {
            this.axeSwings = (this.axeSwings || 0) + 1
            if (this.axeSwings % 3 === 0) crit = 2.5
        }
        for (const b of this.bugs) {
            if (b.dead) continue
            const s = b.size
            if (b.x + s * 0.45 < box.l || b.x - s * 0.45 > box.r || b.y < box.t || b.y - s * 0.8 > box.b) continue
            // Hunter Knife: a stab in the back of a monster walking away from you hits ×3
            const backstab = this.progress.melee === 'knife' && b.dir === f
            this.damageBug(b, melee.dmg * crit * (backstab ? 3 : 1), f)
            if (backstab) this.floatText(b.x, b.y - b.size - 10, 'BACKSTAB', 'hot')
            if (this.progress.melee === 'torch') {
                b.burn = 3
                this.statusLabel(b, 'burn', 'BURNING', 'hot')
            }
            if (this.progress.melee === 'mug') {
                b.slow = 2.5
                this.statusLabel(b, 'slow', 'SLOWED ☕', 'ammo')
                this.burst(b.x, b.y - b.size * 0.5, 12, 0x8b5a2b, 220)
            }
            this.hitFx(this.progress.melee, b, crit > 1)
            if (crit > 1) this.floatText(b.x, b.y - b.size - 10, 'CRIT', 'hot')
            hitSomething = true
            hitBug = true
        }
        this.parryOrbs(box)
        this.parryMissiles(box)
        for (const e of this.platformList) {
            if (e.r < box.l || e.l > box.r || e.b < box.t || e.t > box.b) continue
            if (e.stone) {
                this.burst(clamp(p.x + f * reach * 0.6, e.l, e.r), clamp(p.y - this.playerH * 0.5, e.t, e.b), 6, 0xd6dde5, 200)
                continue
            }
            // only the part of a block that the blade actually reaches
            const hx = clamp(p.x + f * reach * 0.6, e.l, e.r)
            const hy = clamp(p.y - this.playerH * 0.5, e.t, e.b)
            // Miner Pickaxe: blocks shatter at once and pay out coins
            if (this.progress.melee === 'pickaxe') {
                this.damageElement(e, 99, hx, hy)
                const coins = 5 * this.coinMult()
                this.addCoins(coins)
                this.coinFly(hx, hy, coins)
            } else this.damageElement(e, 1, hx, hy)
            hitSomething = true
        }
        if (hitSomething) this.shake = Math.max(this.shake, 5)
        if (hitBug) this.sfx && this.sfx.play(crit > 1 ? 'crit' : 'hit')
        if (hitBug && this.perkOnMeleeHit) this.perkOnMeleeHit(f)
        if (hitBug) this.hitStop(crit > 1 ? 110 : this.progress.melee === 'axe' || this.progress.melee === 'hammer' ? 55 : 32)
        if (crit > 1 && hitBug) this.shake = Math.max(this.shake, 18)
        // Thunder Hammer: every blow sends a shockwave along the ground
        if (melee.quake && p.onGround) {
            const fx = p.x + f * this.playerH * 0.7
            this.dust(fx, p.y, 14, 160)
            this.shake = Math.max(this.shake, 12)
            for (const b of this.bugs) {
                if (b.dead || Math.abs(b.x - fx) > 220 || Math.abs(b.y - p.y) > 60) continue
                this.damageBug(b, melee.dmg * 0.5, Math.sign(b.x - p.x) || f, false)
            }
        }
    }

    hurtPlayer(fromX, src) {
        const p = this.player
        if (p.inv > 0 || p.dead || this.hidden || this.state !== 'play') return
        // a Bubble perk eats the hit completely
        if (this.perkBlock && this.perkBlock()) return
        this.perkOnHurt && this.perkOnHurt(src)
        // slow / jam / burn — these land even when the armor soaks the hit
        this.applyHitEffects && this.applyHitEffects(src)
        this.onHud({hurt: {id: Math.random(), armor: (this.stats.armor || 0) > 0}})
        if (this.absorbHit()) {
            this.sfx && this.sfx.play('shield')
            // the armor soaks the hit: shorter knockback, no heart lost
            p.inv = 0.8
            p.vx = Math.sign(p.x - fromX || 1) * 300
            p.vy = -380
            p.onGround = false
            this.shake = Math.max(this.shake, 8)
            this.emitHud(true)
            return
        }
        const dmg = (this.diff && this.diff.dmg) || 1
        p.hp -= dmg
        if (dmg > 1) this.floatText(p.x, p.y - this.playerH - 20, `-${dmg} ❤`, 'warn')
        this.sfx && this.sfx.play('hurt')
        p.inv = (this.diff && this.diff.inv) || 1.2
        p.vx = Math.sign(p.x - fromX || 1) * 460
        p.vy = -560
        p.onGround = false
        this.shake = 14
        this.burst(p.x, p.y - this.playerH * 0.5, 18, 0xff4060, 300)
        this.stats.combo = 0
        if (p.hp <= 0) {
            p.dead = true
            p.attack = null
        }
        this.emitHud(true)
    }

    // ------------------------------------------------------------------ animation
    playAnim(name, {once = false, ts = 1, fade = 0.15, restart = false} = {}) {
        if (!this.actions) return
        const a = this.actions[name]
        if (!a) return
        if (this.curAnim === name && !restart) {
            a.timeScale = ts
            return
        }
        const prev = this.curAnim && this.actions[this.curAnim]
        a.reset()
        a.timeScale = ts
        a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
        a.clampWhenFinished = once
        a.setEffectiveWeight(1)
        a.fadeIn(fade).play()
        if (prev && prev !== a) prev.fadeOut(fade)
        this.curAnim = name
    }

    // ------------------------------------------------------------------ camera
    updateCamera(dt) {
        const p = this.player
        if (p) {
            const target = clamp(p.y - this.vh * 0.58, 0, Math.max(0, this.docH - this.vh))
            this.scroll += (target - this.scroll) * (1 - Math.exp(-dt * 7))
            if (Math.abs(window.scrollY - this.scroll) > 0.5) window.scrollTo({top: this.scroll, behavior: 'instant'})
        }
        this.shake *= Math.exp(-dt * 10)
        const sx = (Math.random() - 0.5) * this.shake
        const sy = (Math.random() - 0.5) * this.shake
        this.camera.position.set(-sx, -window.scrollY + sy, 2000)
        this.fx.style.translate = this.shake > 0.5 ? `${sx}px ${sy}px` : ''
    }

    // ------------------------------------------------------------------ bugs
    buildBug(type) {
        const T = BUG_TYPES[type]
        const M = this.bugMats[type]
        const root = new THREE.Group()
        const tilt = new THREE.Group()
        const face = new THREE.Group()
        root.add(tilt)
        tilt.add(face)
        tilt.rotation.x = 0.5

        const body = new THREE.Mesh(this.geo.sphere, M.body)
        body.scale.set(0.55, 0.34, 0.42)
        body.position.set(-0.08, 0.44, 0)
        const head = new THREE.Mesh(this.geo.sphere, M.head)
        head.scale.setScalar(0.25)
        head.position.set(0.44, 0.44, 0)
        face.add(body, head)
        for (const z of [-0.11, 0.11]) {
            const eye = new THREE.Mesh(this.geo.sphere, M.eye)
            eye.scale.setScalar(0.075)
            eye.position.set(0.62, 0.52, z)
            face.add(eye)
            const ant = new THREE.Mesh(this.geo.leg, M.head)
            ant.scale.set(1, 0.4, 1)
            ant.position.set(0.52, 0.64, z * 0.7)
            ant.rotation.set(z * 3, 0, Math.PI * 0.78)
            face.add(ant)
        }
        // shell stripes
        for (let i = 0; i < 2; i++) {
            const stripe = new THREE.Mesh(this.geo.sphere, M.head)
            stripe.scale.set(0.05, 0.3, 0.4)
            stripe.position.set(-0.22 + i * 0.22, 0.5, 0)
            face.add(stripe)
        }
        const legs = []
        for (let i = 0; i < 3; i++) {
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group()
                pivot.position.set(-0.3 + i * 0.24, 0.38, side * 0.26)
                pivot.rotation.x = -side * 0.95
                const leg = new THREE.Mesh(this.geo.leg, M.head)
                leg.scale.set(1.3, 0.62, 1.3)
                pivot.add(leg)
                face.add(pivot)
                legs.push({pivot, phase: i * 2.1 + (side > 0 ? Math.PI : 0)})
            }
        }
        root.scale.setScalar(T.size)
        this.scene.add(root)
        return {root, tilt, face, body, legs}
    }

    spawnBug(type, opts) {
        const T = BUG_TYPES[type]
        const parts = this.buildEnemy(type)
        const b = {
            maxHp: 0, type, ...parts, size: T.size * (this.unit || 1), hp: Math.ceil(T.hp * (this.diff ? this.diff.hp : 1)),
            speed: T.speed * rand(0.85, 1.2) * (this.diff ? this.diff.speed : 1),
            x: 0, y: 0, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, onGround: false, ground: null,
            state: 'air', climb: null, chew: 0, hopTimer: rand(0.8, 2), flash: 0, appear: 0, walk: rand(0, 10),
            spawnT: this.time, baseMat: parts.body ? parts.body.material : null,
            ...opts,
        }
        b.maxHp = b.hp
        if (!(opts && opts.noElite)) this.maybeElite(b)
        if (T.kind === 'archer' && b.face) this.giveBow(b)
        if (T.kind === 'bomber' && b.face) this.giveBomb(b)
        this.bugs.push(b)
        if (!BUG_TYPES[type].boss && type !== 'slimelet' && this.ring) {
            this.flash(b.x, b.y - b.size * 0.4, 0xa855f7, b.size * 1.2, 0.4)
            this.burst(b.x, b.y - b.size * 0.4, 10, 0xc084fc, 160)
        }
        return b
    }

    updateSpawner(dt) {
        const p = this.player
        if (p.dead || this.clearing) return
        const progress = clamp(p.y / this.docH, 0, 1)
        const alive = this.bugs.filter(b => !b.dead).length
        // small screens (phones) get fewer monsters at once and a calmer spawn rate
        const area = clamp((this.vw * this.vh) / (1400 * 800), 0.35, 1)
        const maxAlive = Math.round(Math.min(this.lowFx ? 22 : 30, 9 + progress * 24 + this.stats.kills * 0.08 + this.diff.extra) * area * this.paceStat('alive'))
        // the horde before the boss: one big rush, then a breather, then the usual trickle
        if (this.updateHorde(dt, progress, area, alive)) return
        this.spawnTimer -= dt
        if (this.spawnTimer <= 0 && alive < maxAlive) {
            this.spawnTimer = Math.max(0.12, (1.05 - progress * 0.7 - this.stats.kills * 0.005) / this.diff.spawn / this.spawnRateMult()) / Math.sqrt(area) / this.paceStat('spawn')
            this.spawnOne(this.pickEnemyType(progress))
        }
        // boss when the knight reaches the contact section…
        if (!this.bossSpawned && this.contactTop && p.y > this.contactTop - this.vh * 0.2 && this.time > (this.bossNotBefore || 0) &&
            (!this.horde || this.horde.phase === 'done')) {
            this.bossSpawned = true
            this.spawnBoss()
        }
        // …and again in endless mode, a little stronger every time
        if (this.nextBossAt && !this.boss && this.time > this.nextBossAt) {
            this.nextBossAt = 0
            this.spawnBoss()
        }
    }

    spawnBoss() {
        const p = this.player
        const level = this.bossLevel || 1
        const type = this.bossTypeForLevel(this.level || 1)
        const T = BUG_TYPES[type]
        const boss = this.spawnBug(type, {
            x: p.x < this.vw / 2 ? this.vw * 0.78 : this.vw * 0.22, y: p.y - this.vh * 0.45, vy: 200,
            dir: p.x < this.vw / 2 ? -1 : 1, hopTimer: 2.5, summon: 3,
        })
        boss.hp = Math.round(boss.hp * (1 + (level - 1) * 0.5))
        boss.maxHp = boss.hp
        this.boss = boss
        this.shake = 22
        this.toast(level > 1 ? `⚠ BOSS LV ${level}: ${T.title}` : `⚠ BOSS: ${T.title}`, 'boss')
        this.sfx && this.sfx.play('roar')
        this.sfx && this.sfx.setMusicIntensity(true)
    }

    // "Keep playing" after the win: endless waves, a new (stronger) dragon every 45 s
    continueEndless() {
        if (this.state !== 'win') return
        this.state = 'play'
        this.clearing = false
        this.bossLevel = (this.bossLevel || 1) + 1
        this.nextBossAt = this.time + 45
        this.toast('ENDLESS MODE — next dragon in 45 s', 'super')
        this.emitHud(true)
    }

    spawnOne(type) {
        const kind = BUG_TYPES[type].kind
        if (kind === 'bat') this.spawnFlyer(type)
        else if (kind === 'sentinel' || kind === 'slime' || kind === 'archer' || kind === 'bomber') this.spawnOnLedge(type) || this.spawnFromCorner(type)
        else if (Math.random() < 0.62) this.spawnFromCard(type) || this.spawnFromCorner(type)
        else this.spawnFromCorner(type)
    }

    // returns true while the horde owns the spawner (normal spawning paused)
    updateHorde(dt, progress, area, alive) {
        const p = this.player
        if (!this.horde) {
            if (this.bossSpawned || !this.contactTop || p.y < this.contactTop - this.vh * 1.25) return false
            const n = Math.round((12 + 1.2 * (this.level || 1)) * Math.max(0.5, area))
            this.horde = {phase: 'wave', left: n, t: 0}
            this.toast('⚠ HORDE INCOMING', 'boss')
            this.sfx && this.sfx.play('horde')
            this.sfx && this.sfx.setMusicIntensity(true)
            this.shake = Math.max(this.shake, 14)
            return true
        }
        const H = this.horde
        if (H.phase === 'wave') {
            H.t -= dt
            if (H.t <= 0 && H.left > 0) {
                H.t = 0.22
                if (alive < 45) {
                    // the rush leans to the tougher monsters
                    const type = Math.random() < 0.35 ? pick(['tank', 'orc', 'stingbee', 'archer', 'bomber', 'dragon']) : this.pickEnemyType(Math.max(progress, 0.5))
                    this.spawnOne(type)
                    H.left--
                }
            }
            if (H.left <= 0) {
                H.phase = 'calm'
                H.t = 7
            }
            return true
        }
        if (H.phase === 'calm') {
            H.t -= dt
            // the breather starts once most of the horde is down (or after a while anyway)
            if (H.t <= 0 || (alive <= 3 && H.t < 5)) {
                H.phase = 'done'
                this.toast('the horde is broken — the boss is near…', 'super')
                setTimeout(() => !this.disposed && this.offerPerks('Horde defeated!'), 600)
                this.sfx && this.sfx.setMusicIntensity(false)
                this.spawnTimer = 2.5
                // a little normal fighting before the boss shows up
                this.bossNotBefore = this.time + 8
            }
            return true
        }
        return false
    }

    pickEnemyType(progress) {
        const table = [
            ['crawler', 26], ['orc', progress > 0.05 ? 14 : 4], ['jumper', progress > 0.08 ? 12 : 0],
            ['tank', progress > 0.3 ? 8 : 0], ['bat', progress > 0.04 ? 14 : 6], ['dragon', progress > 0.25 ? 6 : 0],
            ['stingbee', progress > 0.12 ? 6 + Math.min(8, (this.level || 1)) : 0],
            ['slime', progress > 0.12 ? 12 : 4], ['sentinel', progress > 0.18 ? 10 : 0],
            ['archer', progress > 0.1 ? 9 : 0], ['bomber', progress > 0.2 ? 8 : 0],
        ]
        const total = table.reduce((a, [, w]) => a + w, 0)
        let r = Math.random() * total
        for (const [t, w] of table) {
            if ((r -= w) <= 0) return t
        }
        return 'crawler'
    }

    // bats fly in from the sides of the screen
    spawnFlyer(type) {
        const sy = window.scrollY
        // come in from the side away from the hero
        const left = this.player.x > this.vw * 0.65 ? true : this.player.x < this.vw * 0.35 ? false : Math.random() < 0.5
        this.spawnBug(type, {
            x: left ? 24 : this.vw - 24, y: sy + rand(110, this.vh * 0.45),
            vx: (left ? 1 : -1) * 260, vy: 0, state: 'hover', dir: left ? 1 : -1,
        })
        return true
    }

    // monsters never appear right on top of the hero
    farFromPlayer(x, y, r = SAFE_SPAWN) {
        const p = this.player
        return Math.hypot(x - p.x, y - (p.y - this.playerH * 0.5)) > r
    }

    // slimes & sentinels drop onto a visible block a little away from the knight
    spawnOnLedge(type) {
        const sy = window.scrollY
        const p = this.player
        const cands = this.platformList.filter(e =>
            e.w > 70 && e.t > sy + 130 && e.t < sy + this.vh - 30 && Math.abs((e.l + e.r) / 2 - p.x) > 220 &&
            this.farFromPlayer((e.l + e.r) / 2, e.t),
        )
        if (!cands.length) return false
        const e = pick(cands)
        this.spawnBug(type, {x: rand(e.l + 20, e.r - 20), y: e.t - rand(180, 320), vy: 0, state: 'air'})
        return true
    }

    spawnFromCard(type) {
        const sy = window.scrollY
        const cands = this.platformList.filter(e =>
            e.w > 90 && e.b > sy + 40 && e.b < sy + this.vh - 10 && e.t > sy + 30 &&
            Math.abs(e.t - this.player.y) < this.vh * 0.9,
        )
        if (!cands.length) return false
        const e = pick(cands)
        // crawl out on the side that is farther from the hero; give up if both are too close
        let side = Math.random() < 0.5 ? -1 : 1
        if (!this.farFromPlayer(side < 0 ? e.l : e.r, e.b)) side = -side
        if (!this.farFromPlayer(side < 0 ? e.l : e.r, e.b)) return false
        const T = BUG_TYPES[type]
        const edge = side < 0 ? e.l : e.r
        // crawl out from under the card, up its side, then over the top edge
        this.spawnBug(type, {
            x: edge + side * T.size * 0.28, y: e.b + T.size * 0.4, state: 'climb',
            climb: {el: e, side}, dir: -side,
        })
        this.burst(edge, e.b, 8, 0xb366ff, 120)
        return true
    }

    spawnFromCorner(type) {
        const sy = window.scrollY
        const p = this.player
        let left = Math.random() < 0.5
        let top = Math.random() < 0.5
        // pick the corner farthest from the hero if the random one is too close
        if (!this.farFromPlayer(left ? 20 : this.vw - 20, top ? sy + 30 : sy + this.vh)) {
            left = p.x > this.vw / 2
            top = p.y - sy > this.vh / 2
        }
        const x = left ? 20 : this.vw - 20
        this.spawnBug(type, {
            x, y: top ? sy + 30 : sy + this.vh + 20,
            vx: (left ? 1 : -1) * rand(140, 260), vy: top ? 0 : -rand(1100, 1400),
            dir: left ? 1 : -1, state: 'air',
        })
        return true
    }

    updateBugs(dt) {
        const p = this.player
        const sy = window.scrollY
        for (const b of this.bugs) {
            if (b.dead) continue
            b.appear = Math.min(1, b.appear + dt * 4)
            b.flash = Math.max(0, b.flash - dt)
            b.walk += dt * (b.state === 'climb' ? 14 : Math.abs(b.vx) / 9 + 2)
            // status effects from weapon perks
            if (b.burn > 0) {
                b.burn -= dt
                b.hp -= 0.9 * dt * (this.gunMul ? this.gunMul() : 1)
                if (Math.random() < dt * 18) this.burst(b.x + rand(-8, 8), b.y - b.size * rand(0.2, 0.8), 1, 0xff7a1a, 90)
                if (b.hp <= 0) {
                    this.killBug(b)
                    continue
                }
            }
            const stunned = b.stun > 0 && !this.isBoss(b)
            // coffee: slowed monsters move at 45%
            if (b.slow > 0) {
                b.slow -= dt
                b.slowMul = 0.45
            } else b.slowMul = 1
            if (b.stun > 0) {
                b.stun -= dt
                if (Math.random() < dt * 10) this.burst(b.x, b.y - b.size * 1.05, 1, 0xfde047, 60)
            }

            if (b.state === 'climb') {
                const e = b.climb.el
                if (e.broken) {
                    b.state = 'air'
                } else {
                    b.y -= 150 * dt
                    b.x = (b.climb.side < 0 ? e.l : e.r) + b.climb.side * b.size * 0.28
                    if (b.y <= e.t + 2) {
                        b.state = 'walk'
                        b.y = e.t
                        b.x = (b.climb.side < 0 ? e.l + 6 : e.r - 6)
                        b.onGround = true
                        b.ground = e
                    }
                }
            } else if (BUG_TYPES[b.type].kind === 'bat') {
                if (stunned) {
                    b.vx *= 0.9
                    b.vy = Math.min(b.vy + 500 * dt, 240)
                    b.x += b.vx * dt
                    b.y += b.vy * dt
                } else this.updateBat(b, dt)
                this.contactDamage(b)
            } else if (BUG_TYPES[b.type].kind === 'dragonboss') {
                this.updateDragonBoss(b, dt)
                this.contactDamage(b)
            } else if (BUG_TYPES[b.type].kind === 'wizardboss') {
                this.updateWizardBoss(b, dt)
                this.contactDamage(b)
            } else {
                // brain
                const kind = BUG_TYPES[b.type].kind
                const dx = p.x - b.x
                const dy = p.y - b.y
                const chase = this.canTarget() && Math.abs(dy) < 170 && !this.isPassive(b)
                if (stunned) {
                    if (b.onGround) b.vx *= 0.7
                } else if (b.onGround && kind === 'slime') this.slimeBrain(b, dt, dx)
                else if (b.onGround && kind === 'sentinel') this.sentinelBrain(b, dt, dx, dy)
                else if (b.onGround && BUG_TYPES[b.type].flee) this.goldenBrain(b, dt, dx)
                else if (b.onGround && kind === 'archer') this.archerBrain(b, dt, dx, dy)
                else if (b.onGround && kind === 'bomber') this.bomberBrain(b, dt, dx)
                else if (b.onGround && kind === 'yetiboss') this.yetiBrain(b, dt, dx)
                else if (b.onGround && kind === 'shroomboss') this.shroomBrain(b, dt, dx)
                else if (b.onGround) {
                    if (chase || dy > 60) b.dir = Math.sign(dx) || b.dir
                    let speed = b.speed * (chase ? 1.25 : 0.8)
                    b.vx = b.dir * speed
                    // turn around at edges unless the knight is below
                    const g = b.ground
                    if (g && !g.floor && dy <= 60) {
                        if (b.x + b.vx * dt > g.r - 4 || b.x + b.vx * dt < g.l + 4) {
                            b.dir *= -1
                            b.vx = b.dir * speed
                        }
                    }
                    b.hopTimer -= dt
                    const hopper = b.type === 'jumper' || b.type === 'boss'
                    if ((hopper && b.hopTimer <= 0) || (dy < -90 && Math.abs(dx) < 260 && b.hopTimer <= 0)) {
                        b.hopTimer = b.type === 'boss' ? rand(2.2, 3.4) : rand(0.9, 1.9)
                        b.vy = b.type === 'boss' ? -1150 : -rand(780, 980)
                        b.vx = clamp(dx * 1.1, -320, 320)
                        b.onGround = false
                        b.bigJump = b.type === 'boss'
                    }
                    // chew the block it stands on
                    if (g && !g.floor && !g.stone) {
                        b.chew += dt
                        if (b.chew > 2.4) {
                            b.chew = 0
                            this.damageElement(g, 1, b.x, g.t, true)
                        }
                    } else b.chew = 0
                    // boss summons minions
                    if (b.type === 'boss') {
                        b.summon -= dt
                        if (b.summon <= 0) {
                            b.summon = rand(2.6, 3.8)
                            for (let i = 0; i < 2; i++) {
                                this.spawnBug('crawler', {
                                    x: b.x + rand(-40, 40), y: b.y - b.size * 0.5,
                                    vx: rand(-260, 260), vy: -rand(600, 900), state: 'air',
                                })
                            }
                        }
                    }
                }

                // physics
                const halfW = b.size * 0.3
                const g = b.ground
                const stick = b.onGround && g && (g.floor || !g.broken) && b.x + halfW > g.l && b.x - halfW < g.r &&
                    Math.abs(b.y - g.t) < 30 && b.vy >= 0
                if (stick) {
                    b.y = g.t
                    b.vy = 0
                } else {
                    b.onGround = false
                    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt)
                }
                const prevY = b.y
                b.y += b.vy * dt
                b.x += b.vx * dt * (b.slowMul || 1) * (b.windT ? 0.05 : 1) * this.paceStat('speed')
                if (b.x < halfW) { b.x = halfW; b.dir = 1; b.vx = Math.abs(b.vx) }
                if (b.x > this.vw - halfW) { b.x = this.vw - halfW; b.dir = -1; b.vx = -Math.abs(b.vx) }
                if (!b.onGround && b.vy >= 0) {
                    const pl = this.land(b.x, halfW * 0.6, prevY, b.y, null)
                    if (pl) {
                        b.y = pl.t
                        b.vy = 0
                        b.onGround = true
                        b.ground = pl
                        b.state = 'walk'
                        if (kind === 'slime') b.squash = 1
                        if (b.slam) this.yetiSlam(b, pl.t)
                        if (b.bigJump) {
                            b.bigJump = false
                            this.shake = 16
                            this.burst(b.x, pl.t, 26, 0xff4d33, 380)
                            for (const e of this.platformList) {
                                if (e.stone) continue
                                if (Math.abs((e.l + e.r) / 2 - b.x) < 260 && Math.abs(e.t - pl.t) < 220) {
                                    this.damageElement(e, 1, clamp(b.x, e.l, e.r), e.t, true)
                                }
                            }
                        }
                    }
                }

                this.contactDamage(b)
            }

            // despawn when far away
            if (this.isBoss(b)) {
                // never lose the boss: drop it back next to the knight
                if (b.y > this.docH + 200 || Math.abs(b.y - p.y) > this.vh * 1.6) {
                    b.x = clamp(p.x + (p.x < this.vw / 2 ? 300 : -300), 80, this.vw - 80)
                    b.y = p.y - this.vh * 0.8
                    b.vy = 0
                    b.onGround = false
                }
            } else if (b.y > sy + this.vh * 2.2 || b.y < sy - this.vh * 1.4) {
                b.dead = true
                b.silent = true
            }

            this.poseBug(b)
        }
        // cleanup
        if (this.bugs.some(b => b.dead)) {
            this.bugs = this.bugs.filter(b => {
                if (b.dead) {
                    // real monsters play their death animation first
                    if (b.model && !b.silent) this.toCorpse(b)
                    else this.removeEnemy(b)
                    return false
                }
                return true
            })
        }
    }

    poseBug(b) {
        if (b.model) {
            this.poseModel(b)
            return
        }
        if (this.poseCreature(b)) return
        const k = b.appear < 1 ? ease(b.appear) : 1
        b.root.scale.setScalar(b.size * k)
        b.root.position.set(b.x, -b.y, this.isBoss(b) ? -40 : 30)
        if (b.state === 'climb') {
            b.tilt.rotation.x = 0
            b.root.rotation.z = b.climb.side < 0 ? Math.PI / 2 : -Math.PI / 2
            b.face.rotation.y = b.climb.side < 0 ? 0 : Math.PI
        } else {
            b.tilt.rotation.x = 0.5
            b.root.rotation.z = b.onGround ? 0 : clamp(-b.vy / 3000, -0.4, 0.4) * b.dir
            const want = b.dir > 0 ? -0.25 : Math.PI + 0.25
            b.face.rotation.y += (want - b.face.rotation.y) * 0.25
        }
        for (const L of b.legs) L.pivot.rotation.z = Math.sin(b.walk + L.phase) * 0.55
        b.body.material = b.flash > 0 ? this.mats.hit : this.bugMats[b.type].body
        b.body.scale.y = 0.34 * (1 + Math.sin(b.walk * 0.5) * 0.04)
    }

    damageBug(b, dmg, dir, bySuper, src) {
        if (this.perkDamage) dmg = this.perkDamage(dmg, b)
        b.hp -= this.eliteSoak(b, dmg)
        const bullet = src === 'bullet'
        const thrown = src === 'thrown'
        if (!bySuper) this.gainPower(bullet || thrown ? 1 : 2.5)
        b.flash = 0.12
        if (!bullet && !bySuper) this.hitNumber(b, dmg, false)
        // only a strong direct melee blow (≥ 25% of its HP) breaks a monster's wind-up; elites can't be broken
        if (!bullet && !thrown && !bySuper && !b.elite && dmg >= b.maxHp * 0.25) this.interruptWindup(b)
        const heavy = this.isBoss(b) || b.type === 'tank' || b.type === 'sentinel' || !!b.elite
        // monsters shrug off knockback more and more at higher levels, and barely move while winding up
        const L = (this.level || 1) - 1
        const resist = Math.max(0.35, 1 - 0.035 * L) * (b.windT ? 0.25 : 1)
        const knock = (thrown ? 0.25 : bullet ? 0.7 : 1) * resist
        b.vx = dir * (heavy ? 140 : 380) * knock
        // a light push only slides the monster; a real blow lifts it off the ground
        if (knock >= 0.3) {
            b.vy = (heavy ? -200 : -420) * knock
            b.onGround = false
        }
        if (b.state === 'climb') b.state = 'air'
        this.burst(b.x, b.y - b.size * 0.45, 8, 0xffffff, 220)
        if (b.model && b.hp > 0) this.enemyGesture(b, 'hit')
        if (b.hp <= 0) this.killBug(b)
        else if (b === this.boss) this.emitHud(true)
    }

    killBug(b) {
        b.dead = true
        this.perkOnKill && this.perkOnKill()
        this.sfx && this.sfx.play(this.isBoss(b) ? 'boom' : 'pop', {volume: b.size > 70 ? 1 : 0.7})
        const T = BUG_TYPES[b.type]
        const big = this.isBoss(b)
        this.burst(b.x, b.y - b.size * 0.45, big ? 160 : 26, T.color, big ? 900 : 420)
        this.burst(b.x, b.y - b.size * 0.45, big ? 80 : 12, 0x14e956, big ? 700 : 300)
        const s = this.stats
        s.kills++
        // Reaper Scythe: every 5 kills harvest a heart
        if (this.progress.melee === 'scythe' && !this.isBoss(b) && this.player && !this.player.dead) {
            this.souls = (this.souls || 0) + 1
            this.burst(b.x, b.y - b.size * 0.5, 10, 0xa855f7, 160)
            if (this.souls % 5 === 0 && this.player.hp < this.player.maxHp) {
                this.player.hp++
                this.floatText(this.player.x, this.player.y - this.playerH - 18, 'SOUL +1 ❤', 'heart')
            }
        }
        let coins = Math.max(1, Math.round(T.score / 10))
        if (b.golden) {
            coins = 150 * (this.level || 1)
            this.toast(`GOLDEN BUG! +${coins * this.coinMult()} coins`, 'ammo')
            this.burst(b.x, b.y - b.size * 0.5, 60, 0xfacc15, 520)
        }
        if (b.elite) {
            coins *= 4
            this.floatText(b.x, b.y - b.size - 30, 'ELITE DOWN', 'combo')
            this.dropToken(b.x, b.y - b.size * 0.6, Math.random() < 0.5 ? 'heart' : 'armor')
        }
        coins *= this.coinMult()
        this.addCoins(coins)
        this.coinFly(b.x, b.y - b.size * 0.5, b.golden ? 60 : coins)
        this.flash(b.x, b.y - b.size * 0.45, T.color, b.size * (big ? 2.6 : 1.3), big ? 0.6 : 0.28)
        if (b.type === 'tank' || this.isBoss(b) || b.type === 'dragon') this.hitStop(big ? 140 : 60)
        s.combo++
        if (!this.isBoss(b)) this.gainPower(b.type === 'tank' ? 12 : 7)
        s.best = Math.max(s.best, s.combo)
        s.comboTimer = 2.6
        const mult = 1 + Math.floor(s.combo / 10)
        const pts = T.score * mult * (b.elite ? 3 : 1)
        s.score += pts
        this.floatText(b.x, b.y - b.size, `+${pts}`, mult > 1 ? 'hot' : '')
        if (s.combo > 0 && s.combo % 10 === 0) this.floatText(b.x, b.y - b.size - 34, `COMBO x${s.combo}`, 'combo')
        const heartChance = b.type === 'tank' ? 0.12 : 0.02
        const ammoChance = b.type === 'sentinel' ? 0.3 : 0.04
        const armorChance = b.type === 'tank' || b.type === 'sentinel' ? 0.1 : 0.025
        const r = Math.random()
        if (!big && r < heartChance) this.dropToken(b.x, b.y - b.size * 0.6, 'heart')
        else if (!big && r < heartChance + armorChance) this.dropToken(b.x, b.y - b.size * 0.6, 'armor')
        else if (!big && r < heartChance + ammoChance) this.dropToken(b.x, b.y - b.size * 0.6, 'ammo')
        else if (Math.random() < (big ? 1 : 0.16)) this.dropToken(b.x, b.y - b.size * 0.6)
        if (b.type === 'slime' && !this.clearing) {
            for (const side of [-1, 1]) {
                this.spawnBug('slimelet', {
                    x: b.x + side * 12, y: b.y - 10, vx: side * rand(180, 260), vy: -rand(520, 700), state: 'air', dir: side,
                })
            }
        }
        this.shake = Math.max(this.shake, big ? 30 : 6)
        if (big) {
            this.boss = null
            this.sfx && this.sfx.setMusicIntensity(false)
            // the dragon is down: every monster on screen pops with it
            this.clearing = true
            if (!this.levelWon && (this.bossLevel || 1) === 1) {
                this.levelWon = true
                this.winLevel()
            }
            for (const o of this.bugs) {
                if (o === b || o.dead) continue
                setTimeout(() => { if (!o.dead && !this.disposed) this.killBug(o) }, rand(100, 900))
            }
            for (const o of this.orbs) o.life = 0
            const endless = (this.bossLevel || 1) > 1
            setTimeout(() => {
                if (this.disposed || this.player.dead) return
                if (endless) {
                    // endless mode: a bonus, then the waves continue and the next boss comes stronger
                    const bonus = 200 * this.bossLevel
                    this.addCoins(bonus)
                    this.toast(`BOSS DOWN · +${bonus} coins`, 'ammo')
                    this.clearing = false
                    this.bossLevel++
                    this.nextBossAt = this.time + 45
                    this.sfx && this.sfx.play('event')
                } else {
                    this.state = 'win'
                    this.sfx && this.sfx.play('win')
                    this.saveProgress()
                }
                this.emitHud(true)
            }, 1400)
        }
        this.emitHud(true)
    }

    // ------------------------------------------------------------------ skill tokens
    dropToken(x, y, kind = 'skill', vy, persist = false) {
        const node = document.createElement('span')
        node.className = `game-token game-token--${kind}`
        if (kind === 'heart') node.textContent = '❤'
        else if (kind === 'armor') node.innerHTML = '<b></b>+' + ARMOR_PLATE + '%'
        else if (kind === 'ammo') node.innerHTML = '<i></i><i></i><i></i>+' + this.magSize()
        else node.textContent = pick(SKILL_NAMES)
        this.fx.appendChild(node)
        const tok = {
            node, kind, x, y, vx: vy === undefined ? rand(-160, 160) : 0, vy: vy === undefined ? -rand(500, 750) : vy,
            t: 0, onGround: false, persist,
        }
        this.tokens.push(tok)
        return tok
    }

    // loot resting on a stone ledge from the start
    placeToken(x, ledge, kind) {
        const tok = this.dropToken(x, ledge.t, kind, 0, true)
        tok.onGround = true
        tok.ground = ledge
    }

    // a heart falls from the sky now and then while the knight is hurt
    updateHearts(dt) {
        const p = this.player
        // only when really hurt, and rarely
        if (p.dead || p.hp > 2) return
        this.heartTimer -= dt
        if (this.heartTimer <= 0) {
            this.heartTimer = rand(35, 50)
            const x = clamp(p.x + rand(-260, 260), 60, this.vw - 60)
            this.dropToken(x, window.scrollY + 70, 'heart', 0)
        }
    }

    updateTokens(dt) {
        const p = this.player
        for (const k of this.tokens) {
            k.t += dt
            if (!k.onGround) {
                k.vy = Math.min(MAX_FALL, k.vy + GRAVITY * 0.8 * dt)
                const prevY = k.y
                k.y += k.vy * dt
                k.x = clamp(k.x + k.vx * dt, 30, this.vw - 30)
                if (k.vy > 0) {
                    const pl = this.land(k.x, 10, prevY, k.y, null)
                    if (pl) {
                        k.y = pl.t
                        k.vy = -k.vy * 0.35
                        k.vx *= 0.6
                        if (Math.abs(k.vy) < 80) {
                            k.onGround = true
                            k.ground = pl
                        }
                    }
                }
            } else if (k.ground && !k.ground.floor && k.ground.broken) k.onGround = false
            k.node.style.transform = `translate(${k.x}px, ${k.y}px) translate(-50%, -100%) translateY(${Math.sin(k.t * 5) * 3}px)`
            if (!p.dead && Math.abs(p.x - k.x) < 46 && Math.abs(p.y - this.playerH * 0.4 - k.y) < this.playerH * 0.7) {
                k.taken = true
                if (k.kind === 'armor') {
                    this.sfx && this.sfx.play('armor')
                    const got = this.addArmor(ARMOR_PLATE)
                    this.floatText(k.x, k.y - 20, got ? `+${got}% armor` : 'armor full', 'armor')
                    this.burst(k.x, k.y - 10, 20, 0x38e8ff, 280)
                    this.emitHud(true)
                } else if (k.kind === 'ammo') {
                    this.sfx && this.sfx.play('coin')
                    const before = this.stats.ammo
                    this.stats.ammo = Math.min(this.ammoMax(), this.stats.ammo + this.magSize())
                    this.floatText(k.x, k.y - 20, `+${this.stats.ammo - before} shells`, 'ammo')
                    if (!before) this.toast('Ammo loaded — press K', 'ammo')
                    this.burst(k.x, k.y - 10, 18, 0xfacc15, 260)
                    this.emitHud(true)
                } else if (k.kind === 'heart') {
                    this.sfx && this.sfx.play('heart')
                    if (p.hp < p.maxHp) {
                        p.hp++
                        this.floatText(k.x, k.y - 20, '+1 ❤', 'heart')
                    } else {
                        this.stats.score += 100
                        this.floatText(k.x, k.y - 20, '+100', '')
                    }
                    this.burst(k.x, k.y - 10, 18, 0xff3b6b, 260)
                    this.emitHud(true)
                } else {
                    this.stats.score += 250
                    this.sfx && this.sfx.play('coin')
                    this.gainPower(10)
                    this.floatText(k.x, k.y - 20, `+${k.node.textContent}`, 'skill')
                    this.burst(k.x, k.y - 10, 16, 0x22d3ee, 260)
                }
            }
            if (!k.persist && k.t > (k.kind === 'skill' ? 14 : 22)) k.taken = true
        }
        if (this.tokens.some(k => k.taken)) {
            this.tokens = this.tokens.filter(k => {
                if (k.taken) k.node.remove()
                return !k.taken
            })
        }
    }

    // ------------------------------------------------------------------ page destruction
    damageElement(e, dmg, hx, hy, byBug, light) {
        if (e.stone || e.broken || this.rewind) return
        e.hp -= dmg
        if (light) {
            e.lightHits = (e.lightHits || 0) + 1
            this.burst(hx, hy, 3, 0xfff1a8, 160)
            if (e.hp <= 0.01) this.shatter(e, hx, hy)
            else if (e.lightHits % 3 === 0) this.addCrack(e, hx - e.l, hy - e.t)
            return
        }
        try {
            e.el.animate(
                [{translate: '0 0'}, {translate: `${rand(-5, 5)}px ${rand(-4, 2)}px`}, {translate: `${rand(-3, 3)}px 0`}, {translate: '0 0'}],
                {duration: 200, composite: 'add'},
            )
        } catch (err) { /* older browsers */ }
        this.burst(hx, hy, byBug ? 4 : 9, byBug ? 0xe666ff : 0xd9fff2, 260)
        this.addCrack(e, hx - e.l, hy - e.t)
        if (!byBug) this.gainPower(1.5)
        if (e.hp <= 0.01) this.shatter(e, hx, hy)
    }

    addCrack(e, cx, cy) {
        if (!e.crack) {
            const node = document.createElement('div')
            node.className = 'game-crack'
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            svg.setAttribute('viewBox', `0 0 ${Math.round(e.w)} ${Math.round(e.h)}`)
            svg.setAttribute('preserveAspectRatio', 'none')
            node.appendChild(svg)
            this.fx.appendChild(node)
            e.crack = {node, svg}
        }
        const level = 1 - e.hp / e.maxHp
        const rays = 3 + Math.round(level * 4)
        let d = ''
        for (let i = 0; i < rays; i++) {
            let x = cx
            let y = cy
            let a = rand(0, Math.PI * 2)
            d += `M${x.toFixed(1)} ${y.toFixed(1)}`
            const steps = 3 + ((Math.random() * 3) | 0)
            const len = clamp(Math.min(e.w, e.h) * (0.7 + level * 0.9), 24, 150)
            for (let s = 0; s < steps; s++) {
                a += rand(-0.6, 0.6)
                x += Math.cos(a) * (len / steps)
                y += Math.sin(a) * (len / steps)
                d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
            }
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        path.setAttribute('d', d)
        e.crack.svg.appendChild(path)
        e.crack.node.style.opacity = String(0.55 + level * 0.45)
    }

    updateCracks() {
        for (const e of this.elements) {
            if (!e.crack || e.broken) continue
            const s = e.crack.node.style
            s.transform = `translate(${e.l}px, ${e.t}px)`
            s.width = e.w + 'px'
            s.height = e.h + 'px'
        }
    }

    shatter(e, hx, hy) {
        e.broken = true
        this.rectsDirty = true
        const el = e.el
        const sy = window.scrollY
        const made = []
        const room = () => this.pieces.length + made.length < PIECE_LIMIT

        // 1) images break like glass
        const imgs = el.tagName === 'IMG' ? [el] : [...el.querySelectorAll('img')]
        for (const img of imgs) {
            const r = img.getBoundingClientRect()
            if (r.width < 20 || r.height < 20) continue
            const cs = getComputedStyle(img)
            const cols = 5
            const rows = 4
            const pts = []
            for (let j = 0; j <= rows; j++) {
                for (let i = 0; i <= cols; i++) {
                    const edge = i === 0 || j === 0 || i === cols || j === rows
                    pts.push([
                        clamp((i / cols) * 100 + (edge ? 0 : rand(-8, 8)), 0, 100),
                        clamp((j / rows) * 100 + (edge ? 0 : rand(-8, 8)), 0, 100),
                    ])
                }
            }
            const P = (i, j) => pts[j * (cols + 1) + i]
            for (let j = 0; j < rows; j++) {
                for (let i = 0; i < cols; i++) {
                    const tris = Math.random() < 0.5
                        ? [[P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]]
                        : [[P(i, j), P(i + 1, j), P(i, j + 1)], [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]]
                    for (const tri of tris) {
                        if (!room()) break
                        const node = document.createElement('div')
                        node.className = 'game-piece'
                        node.style.cssText = `left:${r.left}px;top:${r.top + sy}px;width:${r.width}px;height:${r.height}px;` +
                            `clip-path:polygon(${tri.map(q => `${q[0]}% ${q[1]}%`).join(',')});border-radius:${cs.borderRadius}`
                        const im = document.createElement('img')
                        im.src = img.currentSrc || img.src
                        im.alt = ''
                        im.style.cssText = `width:100%;height:100%;object-fit:${cs.objectFit};object-position:${cs.objectPosition}`
                        node.appendChild(im)
                        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
                        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
                        node.style.transformOrigin = `${cx}% ${cy}%`
                        made.push({node, ox: r.left + (cx / 100) * r.width, oy: r.top + sy + (cy / 100) * r.height, kind: 'shard'})
                    }
                }
            }
        }

        // 2) the card's own glass / background
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor
        const hasBg = bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)
        const hasBorder = parseFloat(cs.borderTopWidth) > 0
        if ((hasBg || hasBorder) && !imgs.length) {
            const r = el.getBoundingClientRect()
            const n = 4
            const xs = [0, ...Array.from({length: n - 1}, (_, i) => ((i + 1) / n) * 100 + rand(-6, 6)), 100]
            for (let i = 0; i < n; i++) {
                const mid = rand(35, 65)
                const tris = [
                    [[xs[i], 0], [xs[i + 1], 0], [(xs[i] + xs[i + 1]) / 2, mid]],
                    [[xs[i], 0], [(xs[i] + xs[i + 1]) / 2, mid], [xs[i], 100]],
                    [[xs[i + 1], 0], [xs[i + 1], 100], [(xs[i] + xs[i + 1]) / 2, mid]],
                    [[xs[i], 100], [(xs[i] + xs[i + 1]) / 2, mid], [xs[i + 1], 100]],
                ]
                for (const tri of tris) {
                    if (!room()) break
                    const node = document.createElement('div')
                    node.className = 'game-piece game-piece--glass'
                    node.style.cssText = `left:${r.left}px;top:${r.top + sy}px;width:${r.width}px;height:${r.height}px;` +
                        `background:${hasBg ? bg : 'rgba(255,255,255,0.03)'};border:${cs.borderTopWidth} solid ${cs.borderTopColor};` +
                        `border-radius:${cs.borderRadius};clip-path:polygon(${tri.map(q => `${q[0]}% ${q[1]}%`).join(',')})`
                    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3
                    const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3
                    node.style.transformOrigin = `${cx}% ${cy}%`
                    made.push({node, ox: r.left + (cx / 100) * r.width, oy: r.top + sy + (cy / 100) * r.height, kind: 'shard'})
                }
            }
        }

        // 3) text falls apart into letters
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        const range = document.createRange()
        let letters = 0
        let node
        while ((node = walker.nextNode()) && letters < 100) {
            const text = node.textContent
            const parent = node.parentElement
            if (!parent || !text.trim()) continue
            const ps = getComputedStyle(parent)
            let color = ps.color
            if (/rgba\(0, 0, 0, 0\)/.test(color) || ps.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || ps.webkitTextFillColor === 'transparent') {
                color = '#14e956'
            }
            for (let i = 0; i < text.length && letters < 100; i++) {
                const ch = text[i]
                if (!ch.trim()) continue
                range.setStart(node, i)
                range.setEnd(node, i + 1)
                const r = range.getBoundingClientRect()
                if (r.width < 1 || r.height < 1) continue
                if (!room()) break
                const span = document.createElement('span')
                span.className = 'game-letter'
                span.textContent = ps.textTransform === 'uppercase' ? ch.toUpperCase() : ch
                span.style.cssText = `left:${r.left}px;top:${r.top + sy}px;width:${r.width}px;height:${r.height}px;` +
                    `font-family:${ps.fontFamily};font-size:${ps.fontSize};font-weight:${ps.fontWeight};color:${color};` +
                    `line-height:${r.height}px;text-shadow:${ps.textShadow}`
                made.push({node: span, ox: r.left + r.width / 2, oy: r.top + sy + r.height / 2, kind: 'letter'})
                letters++
            }
        }

        el.style.visibility = 'hidden'
        if (e.crack) {
            e.crack.node.remove()
            e.crack = null
        }

        for (const m of made) {
            this.fx.appendChild(m.node)
            const dx = m.ox - hx
            const dy = m.oy - hy
            const d = Math.hypot(dx, dy) || 1
            const power = rand(220, 620)
            m.x = 0
            m.y = 0
            m.vx = (dx / d) * power + rand(-80, 80)
            m.vy = (dy / d) * power * 0.6 - rand(250, 560)
            m.rot = 0
            m.vr = rand(-520, 520)
            m.settled = false
            m.el = e
            m.node.style.willChange = 'transform'
            this.pieces.push(m)
        }
        // pieces resting on other blocks may now need to fall
        for (const p of this.pieces) {
            if (p.settled && p.restOn === e) {
                p.settled = false
                p.node.style.willChange = 'transform'
            }
        }
        // keep the DOM light: the oldest fragments disappear once there are too many
        const cap = this.lowFx ? 160 : 320
        if (this.pieces.length > cap) for (const m of this.pieces.splice(0, this.pieces.length - cap)) m.node.remove()
        this.burst(hx, hy, 30, 0x99ffcc, 520)
        this.shake = Math.max(this.shake, 12)
        this.stats.score += 50
        this.emitHud(true)
    }

    updatePieces(dt) {
        if (this.rewind) return
        for (const m of this.pieces) {
            if (m.settled) {
                if (m.restOn && !m.restOn.floor && m.restOn.broken) {
                    m.settled = false
                    m.node.style.willChange = 'transform'
                } else continue
            }
            m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * 0.85 * dt)
            const prevY = m.oy + m.y
            m.y += m.vy * dt
            m.x += m.vx * dt
            m.rot += m.vr * dt
            const cx = m.ox + m.x
            if (cx < 6 || cx > this.vw - 6) {
                m.vx *= -0.5
                m.x = clamp(cx, 6, this.vw - 6) - m.ox
            }
            const y = m.oy + m.y
            if (m.vy > 0) {
                const pl = this.land(cx, 2, prevY, y, null)
                if (pl) {
                    m.y = pl.t - m.oy - (m.kind === 'letter' ? 6 : 2)
                    m.vy = -m.vy * 0.32
                    m.vx *= 0.7
                    m.vr = m.kind === 'letter' ? m.vx * 2.2 : m.vr * 0.5
                    if (Math.abs(m.vy) < 70) {
                        m.vy = 0
                        m.vx *= 0.6
                        if (Math.abs(m.vx) < 20) {
                            m.settled = true
                            m.restOn = pl
                            // a resting fragment no longer needs its own compositor layer
                            m.node.style.willChange = 'auto'
                        }
                    }
                }
            }
            m.node.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px) rotate(${m.rot.toFixed(1)}deg)`
        }
    }

    // rewind: every fragment flies back home and the page is whole again
    startRewind() {
        if (this.rewind || (!this.pieces.length && !this.elements.some(e => e.crack))) return
        for (const m of this.pieces) {
            m.fx0 = m.x
            m.fy0 = m.y
            m.fr0 = m.rot
            m.delay = rand(0, 0.35)
            m.node.style.willChange = 'transform'
        }
        this.rewind = {t: 0, dur: 1.1}
        this.toast('⟲ Rebuilding the site…')
        this.emitHud(true)
    }

    updateRewind(dt) {
        const R = this.rewind
        R.t += dt
        for (const m of this.pieces) {
            const k = ease(clamp((R.t - m.delay) / (R.dur - 0.35), 0, 1))
            m.x = m.fx0 * (1 - k)
            m.y = m.fy0 * (1 - k)
            m.rot = m.fr0 * (1 - k)
            m.node.style.transform = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px) rotate(${m.rot.toFixed(1)}deg)`
        }
        if (R.t >= R.dur + 0.05) {
            this.instantRebuild()
            this.rewind = null
            this.emitHud(true)
        }
    }

    instantRebuild() {
        this.rectsDirty = true
        this.clearSiteFx && this.clearSiteFx()
        for (const m of this.pieces) m.node.remove()
        this.pieces = []
        for (const e of this.elements) {
            if (e.crack) e.crack.node.remove()
            e.crack = null
            if (e.broken) e.el.style.visibility = e.vis || ''
            e.broken = false
            e.hp = e.maxHp
        }
    }

    // ------------------------------------------------------------------ effects
    // colour of the melee weapon's effects (arc, rings, sparks)
    meleeColor() {
        const M = this.progress && MELEE[this.progress.melee]
        return M ? M.glow : 0x14e956
    }

    spawnSlash(x, y, dir, scale = 1, rot, sweep = false, color) {
        const mat = this.mats.slash.clone()
        mat.color.setHex(color !== undefined ? color : this.meleeColor())
        if (sweep && !this.geo.sweep) this.geo.sweep = crescentGeometry(48, -2.2, 4.4)
        const mesh = new THREE.Mesh(sweep ? this.geo.sweep : this.geo.slash, mat)
        mesh.position.set(x, -y, 60)
        mesh.rotation.z = rot !== undefined ? rot : dir > 0 ? rand(-0.5, 0.2) : Math.PI + rand(-0.2, 0.5)
        mesh.renderOrder = 11
        this.scene.add(mesh)
        this.slashes.push({mesh, t: 0, dir, scale})
    }

    updateSlashes(dt) {
        for (const s of this.slashes) {
            s.t += dt
            const k = s.t / 0.2
            const size = this.playerH * (0.7 + k * 0.35) * (s.scale || 1)
            s.mesh.scale.set(size, size, 1)
            s.mesh.material.opacity = Math.max(0, 0.95 * (1 - k))
        }
        this.slashes = this.slashes.filter(s => {
            if (s.t < 0.2) return true
            this.scene.remove(s.mesh)
            s.mesh.material.dispose()
            return false
        })
    }

    burst(x, y, n, color, power) {
        // switched off: the round dots bursting out of every hit, shot and death and raining down
        // cluttered the screen (flashes, numbers and the weapon effects carry the feedback instead)
        if (NO_BURSTS) return
        if (this.lowFx) n = Math.ceil(n * 0.45)
        const rgb = this.tmpColor.set(color)
        for (let i = 0; i < n; i++) {
            const p = this.particles[this.pIndex]
            this.pIndex = (this.pIndex + 1) % this.particles.length
            p.grav = 1
            const a = rand(0, Math.PI * 2)
            const v = rand(0.25, 1) * power
            p.x = x
            p.y = y
            p.vx = Math.cos(a) * v
            p.vy = Math.sin(a) * v - power * 0.3
            p.life = p.max = rand(0.35, 0.8)
            p.r = rgb.r
            p.g = rgb.g
            p.b = rgb.b
        }
    }

    updateParticles(dt) {
        const P = this.pPos
        const C = this.pCol
        this.particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= dt
                // each particle has its own gravity: flames and steam float, only real debris falls
                p.vy += GRAVITY * 0.5 * (p.grav === undefined ? 1 : p.grav) * dt
                p.x += p.vx * dt
                p.y += p.vy * dt
                const k = Math.max(0, p.life / p.max)
                P[i * 3] = p.x
                P[i * 3 + 1] = -p.y
                P[i * 3 + 2] = 80
                C[i * 3] = p.r * k
                C[i * 3 + 1] = p.g * k
                C[i * 3 + 2] = p.b * k
            } else {
                P[i * 3 + 2] = -9999
            }
        })
        this.points.geometry.attributes.position.needsUpdate = true
        this.points.geometry.attributes.color.needsUpdate = true
    }

    floatText(x, y, text, kind = '') {
        // too many popups at once only cost layout time
        if (this.fx.childElementCount > (this.lowFx ? 24 : 48) && kind === 'dmg') return
        const n = document.createElement('span')
        n.className = `game-float ${kind ? 'game-float--' + kind : ''}`
        n.textContent = text
        n.style.left = x + 'px'
        n.style.top = y + 'px'
        this.fx.appendChild(n)
        const anim = n.animate(
            [{transform: 'translate(-50%, 0) scale(0.6)', opacity: 0}, {transform: 'translate(-50%, -18px) scale(1.1)', opacity: 1, offset: 0.2},
                {transform: 'translate(-50%, -60px) scale(1)', opacity: 0}],
            {duration: 900, easing: 'ease-out'},
        )
        anim.onfinish = () => n.remove()
    }

    toast(text, kind = '') {
        this.onHud({toast: {text, kind, id: Math.random()}})
    }

    // adaptive quality: if frames get slow, render at 1× pixel ratio and thin out the effects
    trackPerf(dt) {
        this.perfAvg = this.perfAvg ? this.perfAvg * 0.95 + dt * 0.05 : dt
        // judged over a longer stretch, so one heavy moment (start of a run, a big explosion) doesn't switch it on
        if (!this.lowFx && this.perfAvg > 1 / 38 && this.time > 8) {
            this.lowFx = true
            this.renderer.setPixelRatio(1)
            if (this.emberPoints) this.emberPoints.visible = false
        }
    }

    // remove a monster from the scene and free its own (cloned) materials
    removeEnemy(b) {
        this.scene.remove(b.root)
        if (b.mats) b.mats.forEach(m => m.dispose())
        if (b.visor && b.visor.material) b.visor.material.dispose()
    }

    // monsters can see / hit the hero (not dead, not vanished in stealth)
    canTarget() {
        return !!this.player && !this.player.dead && !this.hidden
    }

    toggleMute() {
        this.sfx.setMuted(!this.sfx.muted)
        this.emitHud(true)
    }

    // every boss type counts as "the boss" (dragon, yeti king, dark wizard, shroom giant)
    isBoss(b) {
        return !!(b && BUG_TYPES[b.type] && BUG_TYPES[b.type].boss)
    }

    setPaused(v) {
        this.paused = !!v
        for (const k in this.input) this.input[k] = false
        this.lastT = performance.now()
        this.emitHud(true)
    }

    // compile every shader once at load, so the first monster / effect of a kind doesn't stutter the game
    warmShaders() {
        try {
            const grp = new THREE.Group()
            const mats = []
            const take = o => { if (o) for (const m of Object.values(o)) if (m && m.isMaterial) mats.push(m) }
            take(this.wMats)
            take(this.uiMats)
            take(this.auraMats)
            take(this.misMats)
            take(this.mats)
            if (this.pistolKit) {
                this.pistolKit()
                take(this.pistolMats)
            }
            for (const m of mats) grp.add(m.isSpriteMaterial ? new THREE.Sprite(m) : new THREE.Mesh(this.geo.sphere, m))
            this.scene.add(grp)
            // one of each monster (kept hidden afterwards so their shader programs stay alive)
            const roots = []
            for (const type of Object.keys(BUG_TYPES)) {
                const parts = this.buildEnemy(type)
                if (parts && parts.root) roots.push(parts.root)
            }
            this.renderer.compile(this.scene, this.camera)
            grp.visible = false
            for (const r of roots) r.visible = false
            this.warmRoots = roots
        } catch (e) {
            console.warn('shader warm-up skipped', e)
        }
    }

    // ------------------------------------------------------------------ teardown
    dispose() {
        this.disposed = true
        clearTimeout(this.saveTimer)
        if (this.progress) this.saveProgress()
        window.removeEventListener('focus', this.onFocus)
        this.removeAlly && this.removeAlly()
        if (this.sfx) this.sfx.dispose()
        cancelAnimationFrame(this.raf)
        window.removeEventListener('keydown', this.onKey)
        window.removeEventListener('keyup', this.onKey)
        window.removeEventListener('pointerdown', this.onPointerDown, true)
        window.removeEventListener('pointerup', this.onPointerUp, true)
        window.removeEventListener('click', this.onClick, true)
        window.removeEventListener('wheel', this.onWheel)
        window.removeEventListener('touchmove', this.onWheel)
        window.removeEventListener('contextmenu', this.onClick, true)
        window.removeEventListener('resize', this.onResize)
        window.removeEventListener('blur', this.onBlur)
        document.removeEventListener('visibilitychange', this.onVis)
        this.instantRebuild()
        for (const t of this.tokens) t.node.remove()
        document.documentElement.classList.remove('game-on')
        if (this.spacer) this.spacer.remove()
        if (this.scene) {
            this.scene.traverse(o => {
                if (o.geometry) o.geometry.dispose()
                if (o.material) [].concat(o.material).forEach(m => {
                    if (m.map) m.map.dispose()
                    if (m.normalMap) m.normalMap.dispose()
                    m.dispose()
                })
            })
        }
        if (this.renderer) this.renderer.dispose()
    }
}

Object.assign(GameEngine.prototype, creatureMethods, weaponMethods, stoneMethods, armorMethods, modelMethods, loadoutMethods, meleeMethods, abilityMethods, fxMethods, bossMethods, eventMethods, missileMethods, meleeFxMethods, enemyUiMethods, pistolMethods, signatureMethods, debuffMethods, pacingMethods, siteFxMethods, perkMethods, allyMethods, superMethods, ferrumMethods)
