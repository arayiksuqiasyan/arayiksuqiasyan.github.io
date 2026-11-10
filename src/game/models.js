// Real animated monsters (Quaternius "Ultimate Monsters", CC0) used for the enemies.
// Each enemy type names a model; instances share geometry via SkeletonUtils.clone and get their own mixer.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {clamp, ENEMY_TYPES, rand} from './util';

const MODEL_NAMES = [...new Set(Object.values(ENEMY_TYPES).map(t => t.model).filter(Boolean))]

// which clip to use for each action, by availability
const CLIPS = {
    walk: ['Walk', 'Run', 'Flying_Idle'],
    run: ['Run', 'Walk', 'Fast_Flying'],
    idle: ['Idle', 'Flying_Idle', 'Walk'],
    fly: ['Flying_Idle', 'Fast_Flying', 'Idle'],
    dive: ['Fast_Flying', 'Flying_Idle'],
    jump: ['Jump', 'Idle'],
    attack: ['Punch', 'Headbutt', 'Bite_Front', 'Weapon'],
    hit: ['HitReact', 'HitRecieve'],
    death: ['Death'],
}

export const modelMethods = {
    async loadMonsterModels(baseUrl) {
        this.monsterModels = {}
        const loader = new GLTFLoader()
        await Promise.all(MODEL_NAMES.map(async name => {
            try {
                const gltf = await loader.loadAsync(`${baseUrl}/${name}.glb`)
                // measure the skinned (posed) mesh, not the raw geometry — the rigs carry their own scale
                gltf.scene.updateMatrixWorld(true)
                gltf.scene.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update() })
                const box = new THREE.Box3().setFromObject(gltf.scene, true)
                this.monsterModels[name] = {
                    scene: gltf.scene,
                    clips: Object.fromEntries(gltf.animations.map(c => [c.name, c])),
                    height: Math.max(0.001, box.max.y - box.min.y),
                    minY: box.min.y,
                }
            } catch (err) {
                // a missing model just falls back to the hand-made creature
                console.warn('monster model failed', name, err)
            }
        }))
    },

    buildModelEnemy(type) {
        const T = ENEMY_TYPES[type]
        const src = this.monsterModels[T.model]
        const model = SkeletonUtils.clone(src.scene)
        const mats = []
        model.traverse(o => {
            if (o.isMesh) {
                o.frustumCulled = false
                o.material = o.material.clone()
                o.material.emissive = new THREE.Color(0x000000)
                mats.push(o.material)
            }
        })
        if (T.tint) {
            const tint = new THREE.Color(T.tint)
            mats.forEach(m => m.color.multiply(tint))
        }
        // hue shift (e.g. the blue sting bee is the yellow bee turned blue)
        if (T.hue) {
            const hsl = {}
            mats.forEach(m => {
                // the colour lives in the texture: use a hue-shifted copy of it (made once per monster type)
                if (m.map) m.map = this.hueTexture(m.map, T.hue, type)
                else {
                    m.color.getHSL(hsl)
                    m.color.setHSL((hsl.h + T.hue + 1) % 1, hsl.s, hsl.l)
                }
            })
        }
        const k = (T.size * (this.unit || 1)) / src.height
        model.scale.setScalar(k)
        model.position.y = -src.minY * k
        const root = new THREE.Group()
        const face = new THREE.Group()
        face.add(model)
        root.add(face)
        this.scene.add(root)
        const mixer = new THREE.AnimationMixer(model)
        const actions = {}
        for (const [key, names] of Object.entries(CLIPS)) {
            const clip = names.map(n => src.clips[n]).find(Boolean)
            if (clip) actions[key] = mixer.clipAction(clip)
        }
        return {
            root, face, tilt: face, body: null, legs: [], model: true, mixer, actions, mats, cur: null,
            side: Math.random() < 0.5 ? -1 : 1, diveCd: rand(1, 2.2), t: 0, fireT: rand(1, 2), charging: 0, squash: 0,
        }
    },

    enemyAnim(b, key, {once = false, fade = 0.15, ts = 1} = {}) {
        const a = b.actions[key]
        if (!a) return
        if (b.cur === key && !once) {
            a.timeScale = ts
            return
        }
        if (b.cur === key && once && a.isRunning()) return
        const prev = b.cur && b.actions[b.cur]
        a.reset()
        a.timeScale = ts
        a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
        a.clampWhenFinished = once
        a.fadeIn(fade).play()
        if (prev && prev !== a) prev.fadeOut(fade)
        b.cur = key
        b.oneShot = once ? (a.getClip().duration / ts) : 0
    },

    // one-shot gesture (attack / hit) that returns to the base loop afterwards
    enemyGesture(b, key) {
        if (!b.model || b.dead) return
        if (b.gestureT > 0 && key !== 'hit') return
        const a = b.actions[key]
        if (!a) return
        this.enemyAnim(b, key, {once: true, fade: 0.08, ts: 1.4})
        b.gestureT = a.getClip().duration / 1.4
    },

    poseModel(b) {
        const dt = this.frameDt || 0.016
        const kind = ENEMY_TYPES[b.type].kind
        const k = b.appear < 1 ? b.appear * (2 - b.appear) : 1
        b.root.position.set(b.x, -b.y, this.isBoss(b) ? -40 : 30)
        b.root.scale.setScalar(Math.max(0.001, k))
        // facing: models look down +Z, turn them into a near-profile toward the walking direction
        if (b.state === 'climb') {
            b.root.rotation.z = b.climb.side < 0 ? Math.PI / 2 : -Math.PI / 2
            b.face.rotation.y = b.climb.side < 0 ? Math.PI / 2 : -Math.PI / 2
        } else {
            const want = b.dir * (Math.PI / 2 - 0.4)
            b.face.rotation.y += (want - b.face.rotation.y) * Math.min(1, dt * 10)
            const flyer = kind === 'bat' || kind === 'dragonboss' || kind === 'wizardboss'
            b.root.rotation.z = flyer && b.state === 'dive'
                ? clamp(-b.vy / 1400, -0.5, 0.5) * b.dir
                : b.onGround || flyer ? 0 : clamp(-b.vy / 3200, -0.3, 0.3) * b.dir
        }
        // hit flash / casting glow
        const flash = b.flash > 0
        const glow = b.charging > 0
        for (const m of b.mats) m.emissive.setHex(flash ? 0xffffff : glow ? 0x7c3aed : b.golden ? 0x6b4f00 : 0x000000)

        // base loop
        b.gestureT = Math.max(0, (b.gestureT || 0) - dt)
        if (!b.gestureT) {
            if (kind === 'bat' || kind === 'dragonboss') this.enemyAnim(b, b.state === 'dive' ? 'dive' : 'fly')
            else if (kind === 'wizardboss') this.enemyAnim(b, 'idle')
            else if (b.state === 'climb') this.enemyAnim(b, 'walk', {ts: 1.6})
            else if (!b.onGround) this.enemyAnim(b, 'jump', {ts: 1.2})
            else if (Math.abs(b.vx) > 12) {
                const fast = Math.abs(b.vx) > 110
                this.enemyAnim(b, fast ? 'run' : 'walk', {ts: clamp(Math.abs(b.vx) / (fast ? 200 : 90), 0.7, 1.6)})
            } else this.enemyAnim(b, 'idle')
        }
        b.mixer.update(dt)
    },

    // dead monsters play their death clip, then sink away
    updateCorpses(dt) {
        if (!this.corpses || !this.corpses.length) return
        for (const c of this.corpses) {
            c.t += dt
            c.mixer.update(dt)
            if (c.t > 0.8) c.root.scale.setScalar(Math.max(0.001, 1 - (c.t - 0.8) / 0.35))
        }
        this.corpses = this.corpses.filter(c => {
            if (c.t < 1.15) return true
            this.scene.remove(c.root)
            c.mats.forEach(m => m.dispose())
            return false
        })
    },

    toCorpse(b) {
        if (!this.corpses) this.corpses = []
        for (const m of b.mats) m.emissive.setHex(0x000000)
        if (b.actions.death) {
            this.enemyAnim(b, 'death', {once: true, fade: 0.05, ts: 1.5})
        }
        this.corpses.push({root: b.root, mixer: b.mixer, mats: b.mats, t: 0})
    },

    // the boss: a big dragon that hovers over the knight, breathes fireball volleys and dives
    hueTexture(tex, hue, key) {
        this.hueTex = this.hueTex || {}
        const k = key + '_' + tex.uuid
        if (this.hueTex[k]) return this.hueTex[k]
        const img = tex.image
        if (!img || !img.width) return tex
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')
        x.drawImage(img, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height)
        const px = d.data
        // plain sRGB hue rotation (no colour-space conversion: these are the texture's own pixels)
        for (let i = 0; i < px.length; i += 4) {
            const r = px[i] / 255
            const g = px[i + 1] / 255
            const b = px[i + 2] / 255
            const max = Math.max(r, g, b)
            const min = Math.min(r, g, b)
            const l = (max + min) / 2
            const dd = max - min
            if (dd < 0.08) continue // greys, black and white stay as they are
            const sat = dd / (1 - Math.abs(2 * l - 1))
            let h = max === r ? ((g - b) / dd) % 6 : max === g ? (b - r) / dd + 2 : (r - g) / dd + 4
            h = ((h / 6 + hue) % 1 + 1) % 1
            const cc = (1 - Math.abs(2 * l - 1)) * sat
            const xx = cc * (1 - Math.abs(((h * 6) % 2) - 1))
            const m = l - cc / 2
            const seg = Math.floor(h * 6)
            const [r1, g1, b1] = [[cc, xx, 0], [xx, cc, 0], [0, cc, xx], [0, xx, cc], [xx, 0, cc], [cc, 0, xx]][seg] || [cc, xx, 0]
            px[i] = (r1 + m) * 255
            px[i + 1] = (g1 + m) * 255
            px[i + 2] = (b1 + m) * 255
        }
        x.putImageData(d, 0, 0)
        const t = new THREE.CanvasTexture(c)
        t.flipY = tex.flipY
        t.colorSpace = tex.colorSpace
        t.wrapS = tex.wrapS
        t.wrapT = tex.wrapT
        t.needsUpdate = true
        this.hueTex[k] = t
        return t
    },

    updateDragonBoss(b, dt) {
        const p = this.player
        b.t += dt
        if (b.state === 'dive') {
            b.diveT += dt
            if (b.diveT > 0.9) {
                b.state = 'hover'
                b.diveCd = rand(4, 6)
            }
        } else {
            b.state = 'hover'
            if (Math.random() < dt * 0.15) b.side *= -1
            const tx = clamp(p.x + b.side * 280, 120, this.vw - 120)
            const ty = p.y - this.playerH - 150 + Math.sin(b.t * 1.6) * 40
            const k = Math.min(1, dt * 1.8)
            b.vx += ((tx - b.x) * 1.8 - b.vx) * k
            b.vy += ((ty - b.y) * 1.8 - b.vy) * k
            b.breath = (b.breath === undefined ? 2 : b.breath) - dt
            if (b.breath <= 0 && this.canTarget()) {
                b.breath = rand(2.2, 3.2)
                const ox = b.x + b.dir * b.size * 0.35
                const oy = b.y - b.size * 0.55
                const ty2 = p.y - this.playerH * 0.5
                for (const off of [-90, 0, 90]) this.fireOrb(ox, oy, p.x + off, ty2, 0xff7a1a)
                this.enemyGesture(b, 'attack')
            }
            b.summon = (b.summon === undefined ? 4 : b.summon) - dt
            if (b.summon <= 0) {
                b.summon = rand(4.5, 6.5)
                for (let i = 0; i < 2; i++) {
                    this.spawnBug(Math.random() < 0.5 ? 'bat' : 'crawler', {
                        x: b.x + rand(-60, 60), y: b.y - b.size * 0.3, vx: rand(-200, 200), vy: -rand(200, 400), state: 'air',
                    })
                }
            }
            b.diveCd -= dt
            const dx = p.x - b.x
            const dy = p.y - this.playerH * 0.4 - b.y
            const dist = Math.hypot(dx, dy) || 1
            if (b.diveCd <= 0 && dist < 520 && this.canTarget()) {
                b.state = 'dive'
                b.diveT = 0
                b.vx = (dx / dist) * 720
                b.vy = (dy / dist) * 720
            }
        }
        b.x = clamp(b.x + b.vx * dt, 60, this.vw - 60)
        b.y += b.vy * dt
        b.dir = Math.sign(p.x - b.x) || b.dir
    },
}
