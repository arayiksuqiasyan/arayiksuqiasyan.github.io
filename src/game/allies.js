// Allies bought in the lobby: one friend follows the hero through the run and fights on its own.
//   Squire — a paladin with a sword: runs after you and cuts the closest monster
//   Gunner — a soldier: stays a bit behind and shoots the closest monster (auto-aim)
//   Shadow — a kunoichi: very fast, dashes at monsters and strikes in quick bursts
// Allies have their own models (never one of the heroes you can play).
// Allies can't die and monsters don't target them; a friend left far behind teleports back to you.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {clamp} from './util';

export const ALLIES = {
    squire: {name: 'Squire', price: 8000, file: 'heroes/ally-paladin.glb', style: 'melee', speed: 380, rate: 0.75, dmg: 0.45, reach: 135,
        desc: 'a paladin with a sword — runs after you and cuts the closest monster'},
    gunner: {name: 'Gunner', price: 12000, file: 'heroes/ally-steve.glb', style: 'gun', speed: 360, rate: 0.55, dmg: 0.34, reach: 600,
        desc: 'a soldier with two pistols — stays behind you and shoots the closest monster'},
    shadow: {name: 'Shadow', price: 15000, file: 'heroes/ally-kachujin.glb', style: 'melee', speed: 560, rate: 0.32, dmg: 0.28, reach: 85,
        desc: 'a kunoichi with a katana — very fast, dashes at monsters and strikes in quick bursts'},
}
const ALLY_SCALE = 0.84 // a bit smaller than the hero

export const allyMethods = {
    // load (once), clone and place the equipped ally; called at the start of every run
    async spawnAlly() {
        this.removeAlly()
        const id = this.progress && this.progress.ally
        const A = id && ALLIES[id]
        if (!A || !this.player) return
        let src = this.knightScene
        if (A.file) {
            this.heroCache = this.heroCache || {}
            if (!this.heroCache[A.file]) {
                try {
                    const gltf = await new GLTFLoader().loadAsync(this.assetUrl.replace(/[^/]+$/, A.file))
                    this.heroCache[A.file] = gltf.scene
                } catch (e) {
                    console.warn('ally failed to load', e)
                    return
                }
            }
            src = this.heroCache[A.file]
        }
        if (this.disposed || !this.player || (this.progress && this.progress.ally !== id)) return
        const model = cloneSkinned(src)
        model.scale.setScalar(1)
        model.position.set(0, 0, 0)
        model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(model)
        // as tall as the hero (Growth included)
        const H = this.playerH * ALLY_SCALE * (this.growthScale ? this.growthScale() : 1)
        const k = H / Math.max(0.001, box.max.y - box.min.y)
        model.scale.setScalar(k)
        model.position.y = -box.min.y * k
        model.traverse(o => {
            if (o.isMesh) {
                o.frustumCulled = false
                o.material = o.material.clone()
                // the same light rim as the hero, so the friend stands out from the page too
                o.material.onBeforeCompile = shader => {
                    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
                        '#include <emissivemap_fragment>\n' +
                        'float heroRim = pow(1.0 - abs(normalize(normal).z), 2.6);\n' +
                        'totalEmissiveRadiance += vec3(0.62, 1.0, 0.82) * heroRim * 0.75;')
                }
                o.material.customProgramCacheKey = () => 'hero-rim'
                o.material.needsUpdate = true
            }
        })
        const root = new THREE.Group()
        const face = new THREE.Group()
        face.add(model)
        root.add(face)
        // and a light of its own, like the hero's
        const light = new THREE.PointLight(0xffffff, 1.6, H * 3.2, 0)
        light.position.set(H * 0.2, H * 0.9, 220)
        root.add(light)
        this.scene.add(root)
        // weapons in the hands
        const hand = name => {
            let h = null
            model.traverse(o => { if (!h && new RegExp(name + '$').test(o.name)) h = o })
            return h
        }
        // their own weapons — nothing the hero can buy
        const mount = (h, obj, side = 1, gun = false) => {
            if (!h) return
            const ws = new THREE.Vector3()
            h.getWorldScale(ws)
            const holder = new THREE.Group()
            holder.scale.setScalar((H * 0.62) / ws.x)
            if (gun) {
                obj.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0)
                obj.position.set(0.02 * side, 0.07, 0)
            } else {
                obj.rotation.set(0, 0, -Math.PI / 2)
                obj.position.set(0, 0.06, 0)
            }
            holder.add(obj)
            h.add(holder)
        }
        const muzzles = []
        if (id === 'squire') {
            mount(hand('RightHand'), this.allyWeapon('spear'))
            const shield = this.allyWeapon('shield')
            mount(hand('LeftHand'), shield)
            shield.rotation.set(0, Math.PI / 2, 0)
            shield.position.set(0, 0.05, 0.06)
        } else if (id === 'gunner') {
            const {group, muzzle} = this.allyWeapon('crossbow')
            mount(hand('RightHand'), group, 1, true)
            muzzles.push(muzzle)
        } else if (id === 'shadow') {
            mount(hand('RightHand'), this.allyWeapon('sai'))
            mount(hand('LeftHand'), this.allyWeapon('sai'))
        }
        // animations: the same Mixamo clips as the hero
        const mixer = new THREE.AnimationMixer(model)
        const actions = {}
        for (const clip of this.clipSource || []) actions[clip.name] = mixer.clipAction(clip)
        const p = this.player
        this.ally = {
            id, A, root, face, model, mixer, actions, cur: null, muzzles, side: 0,
            x: p.x - p.facing * 70, y: p.y, vx: 0, vy: 0, dir: p.facing, onGround: false, ground: null,
            cd: 1, attackT: 0, H,
        }
        this.burst(this.ally.x, this.ally.y - H * 0.5, 30, 0x86efac, 300)
        this.flash(this.ally.x, this.ally.y - H * 0.5, 0x86efac, H, 0.3)
    },

    // ---- ally-only weapons (weapon space: points along +Y, grip around y = 0…0.2)
    allyWeapon(kind) {
        const G = this.geo
        const M = this.allyMats || (this.allyMats = {
            wood: new THREE.MeshStandardMaterial({color: 0x5b3a1e, roughness: 0.7}),
            steel: new THREE.MeshStandardMaterial({color: 0xd8dee9, metalness: 0.9, roughness: 0.25}),
            gold: new THREE.MeshStandardMaterial({color: 0xd4a017, metalness: 0.9, roughness: 0.3}),
            holy: new THREE.MeshBasicMaterial({color: 0xfef3c7, toneMapped: false}),
            shield: new THREE.MeshStandardMaterial({color: 0x1e3a8a, metalness: 0.5, roughness: 0.4}),
            dark: new THREE.MeshStandardMaterial({color: 0x111827, roughness: 0.6, metalness: 0.4}),
        })
        const g = new THREE.Group()
        const part = (geo, m, sx, sy, sz, x, y, z = 0, rz = 0) => {
            const mesh = new THREE.Mesh(geo, m)
            mesh.scale.set(sx, sy, sz)
            mesh.position.set(x, y, z)
            mesh.rotation.z = rz
            g.add(mesh)
            return mesh
        }
        if (kind === 'spear') {
            part(G.cyl, M.wood, 0.022, 1.5, 0.022, 0, 0.45)                  // long shaft
            part(G.cyl, M.gold, 0.03, 0.05, 0.03, 0, 1.2)                     // collar
            part(this.geo.cone, M.steel, 0.05, 0.26, 0.05, 0, 1.22)          // blade
            part(this.geo.cone, M.holy, 0.022, 0.14, 0.022, 0, 1.3)          // glowing tip
        } else if (kind === 'shield') {
            const disc = part(G.cyl, M.shield, 0.26, 0.04, 0.26, 0, 0)
            disc.rotation.x = Math.PI / 2
            const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.022, 8, 28), M.gold)
            g.add(rim)
            const boss = part(G.sphere, M.gold, 0.07, 0.07, 0.04, 0, 0, 0.03)
            boss.rotation.x = 0
            part(G.box, M.holy, 0.03, 0.34, 0.01, 0, 0, 0.03)              // a glowing cross
            part(G.box, M.holy, 0.22, 0.03, 0.01, 0, 0.05, 0.03)
        } else if (kind === 'sai') {
            part(G.cyl, M.dark, 0.016, 0.14, 0.016, 0, 0.05)                 // grip
            part(G.cyl, M.steel, 0.012, 0.42, 0.012, 0, 0.33)                // middle prong
            for (const s of [-1, 1]) {
                part(G.cyl, M.steel, 0.009, 0.1, 0.009, s * 0.045, 0.15, 0, s * 1.2) // guard
                part(G.cyl, M.steel, 0.009, 0.1, 0.009, s * 0.085, 0.2, 0, 0)       // side prong
            }
        } else if (kind === 'crossbow') {
            // the gun frame: barrel along +X
            part(G.box, M.wood, 0.42, 0.06, 0.05, 0.08, 0)                   // stock
            part(G.box, M.dark, 0.06, 0.12, 0.05, -0.06, -0.07, 0, 0.3)     // grip
            const limbs = part(G.box, M.steel, 0.03, 0.46, 0.03, 0.27, 0.02) // the bow
            limbs.rotation.x = 0
            part(G.cyl, M.holy, 0.004, 0.44, 0.004, 0.2, 0.02)              // string
            part(G.cyl, M.steel, 0.01, 0.3, 0.01, 0.22, 0.05, 0, -Math.PI / 2) // loaded bolt
            const muzzle = new THREE.Object3D()
            muzzle.position.set(0.32, 0.04, 0)
            g.add(muzzle)
            return {group: g, muzzle}
        }
        return g
    },

    // a crossbow bolt or a spinning shuriken (both use the bullet system)
    allyProjectile(kind, ox, oy, tx, ty, dmg) {
        const d = Math.hypot(tx - ox, ty - oy) || 1
        const speed = kind === 'bolt' ? 1500 : 1100
        const mesh = new THREE.Group()
        const M = this.allyMats
        if (kind === 'bolt') {
            const shaft = new THREE.Mesh(this.geo.box, M.wood)
            shaft.scale.set(30, 2.4, 2.4)
            const head = new THREE.Mesh(this.geo.box, M.steel)
            head.scale.set(8, 5, 3)
            head.position.x = 17
            const glow = new THREE.Mesh(this.geo.sphere, this.sigMat ? this.sigMat(0xfef3c7, 0.5) : M.holy)
            glow.scale.set(22, 5, 5)
            mesh.add(glow, shaft, head)
            mesh.rotation.z = Math.atan2(-(ty - oy), tx - ox)
        } else {
            if (!this.shurikenGeo) {
                const s = new THREE.Shape()
                for (let i = 0; i < 8; i++) {
                    const r = i % 2 ? 0.28 : 1
                    const a = (i / 8) * Math.PI * 2
                    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
                    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
                }
                this.shurikenGeo = new THREE.ExtrudeGeometry(s, {depth: 0.12, bevelEnabled: false})
            }
            const star = new THREE.Mesh(this.shurikenGeo, M.steel)
            star.scale.setScalar(13)
            mesh.add(star)
        }
        mesh.renderOrder = 12
        this.scene.add(mesh)
        this.bullets.push({mesh, x: ox, y: oy, vx: ((tx - ox) / d) * speed, vy: ((ty - oy) / d) * speed, life: 0.7, dmg, pistol: true, spin: kind === 'star' ? 22 : 0})
        this.sfx && this.sfx.play(kind === 'bolt' ? 'swish' : 'boomerang', {volume: 0.4})
    },

    removeAlly() {
        if (!this.ally) return
        this.scene.remove(this.ally.root)
        this.ally.mixer.stopAllAction()
        this.ally = null
    },

    allyAnim(name, {once = false, ts = 1} = {}) {
        const a = this.ally
        if (!a || a.cur === name) return
        const next = a.actions[name] || a.actions.idle
        if (!next) return
        const prev = a.actions[a.cur]
        next.reset()
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
        next.clampWhenFinished = once
        next.timeScale = ts
        next.play()
        if (prev) prev.crossFadeTo(next, 0.12, false)
        a.cur = name
    },

    allyTarget(range) {
        const a = this.ally
        let best = null
        let bd = range
        for (const b of this.bugs) {
            if (b.dead || b.appear < 0.5) continue
            const d = Math.hypot(b.x - a.x, b.y - b.size * 0.45 - (a.y - a.H * 0.55))
            if (d < bd) {
                bd = d
                best = b
            }
        }
        return best
    },

    updateAlly(dt) {
        const a = this.ally
        const p = this.player
        if (!a || !p) return
        const A = a.A
        const up = this.allyMul ? this.allyMul(a.id) : {dmg: 1, speed: 1}
        a.cd -= dt * up.speed
        a.attackT = Math.max(0, a.attackT - dt)
        // teleport back when far behind (another screen, fell off…)
        if (Math.hypot(a.x - p.x, a.y - p.y) > this.vh * 0.9) {
            a.x = p.x - p.facing * 60
            a.y = p.y - 20
            a.vx = a.vy = 0
            this.flash(a.x, a.y - a.H * 0.5, 0x86efac, a.H, 0.25)
        }
        // pick a target near the hero; otherwise follow the hero
        const target = p.dead ? null : this.allyTarget(A.style === 'gun' ? A.reach : this.playerH * 4)
        let goalX = p.x - p.facing * (A.style === 'gun' ? 110 : 60)
        if (target && A.style === 'melee') goalX = target.x - Math.sign(target.x - a.x || 1) * A.reach * 0.6
        const dx = goalX - a.x
        const want = Math.abs(dx) > 18 ? Math.sign(dx) * A.speed * up.speed : 0
        a.vx += (want - a.vx) * Math.min(1, dt * 10)
        if (Math.abs(a.vx) > 20) a.dir = Math.sign(a.vx)
        if (target && Math.abs(want) < 1) a.dir = Math.sign(target.x - a.x) || a.dir
        // jump up to the hero's (or the target's) level
        const ty = target && A.style === 'melee' ? target.y : p.y
        if (a.onGround && ty < a.y - 60 && Math.abs(dx) < 260) {
            a.vy = -1250
            a.onGround = false
        }
        // physics on the page blocks
        const prevY = a.y
        a.vy = Math.min(1800, a.vy + 2600 * dt)
        a.x = clamp(a.x + a.vx * dt, 20, this.vw - 20)
        a.y += a.vy * dt
        const halfW = a.H * 0.18
        if (a.onGround && a.ground && !(a.x + halfW > a.ground.l && a.x - halfW < a.ground.r) && !a.ground.floor) a.onGround = false
        if (a.vy >= 0) {
            const pl = this.land(a.x, halfW, prevY, a.y, null)
            if (pl) {
                a.y = pl.t
                a.vy = 0
                a.onGround = true
                a.ground = pl
            } else a.onGround = false
        }
        // attacks
        // allies hit as a share of your own melee blow (so Power and upgrades make them stronger too)
        const dmgBase = (this.meleeStats ? this.meleeStats().dmg : 1) * up.dmg
        if (target && a.cd <= 0) {
            const d = Math.hypot(target.x - a.x, target.y - target.size * 0.45 - (a.y - a.H * 0.55))
            if (A.style === 'melee' && d < A.reach + target.size * 0.4) {
                a.cd = A.rate
                a.attackT = 0.3
                this.damageBug(target, dmgBase * A.dmg, Math.sign(target.x - a.x) || 1, false, 'thrown')
                this.allyAnim(id2clip(a), {once: true, ts: 2.2})
                this.flash(target.x, target.y - target.size * 0.45, 0xbbf7d0, target.size * 0.6, 0.12)
                this.sfx && this.sfx.play('hit', {volume: 0.5})
                if (a.id === 'shadow') {
                    // a short dash through the target
                    a.vx = Math.sign(target.x - a.x) * 900
                }
            } else if (a.id === 'shadow' && d < 440 && (a.stars = (a.stars || 0) + 1) % 3 === 0) {
                // the kunoichi throws a shuriken at monsters out of reach
                a.cd = A.rate * 1.5
                a.attackT = 0.25
                this.allyProjectile('star', a.x + a.dir * 20, a.y - a.H * 0.6, target.x, target.y - target.size * 0.45, dmgBase * A.dmg * 1.2)
            } else if (A.style === 'gun' && d < A.reach) {
                a.cd = A.rate
                a.attackT = 0.25
                this.allyShoot(target, dmgBase * A.dmg)
            }
        }
        // pose
        a.root.position.set(a.x, -a.y, 28)
        const wantRot = a.dir > 0 ? Math.PI / 2 - 0.3 : -Math.PI / 2 + 0.3
        a.face.rotation.y += (wantRot - a.face.rotation.y) * Math.min(1, dt * 12)
        if (a.attackT <= 0) {
            if (a.onGround && Math.abs(a.vx) > 40) this.allyAnim('run', {ts: clamp(Math.abs(a.vx) / 390, 0.6, 1.3)})
            else this.allyAnim('idle')
        }
        a.mixer.update(dt)
    },

    allyShoot(target, dmg) {
        const a = this.ally
        const m = a.muzzles[0]
        let ox = a.x + a.dir * a.H * 0.3
        let oy = a.y - a.H * 0.6
        if (m) {
            m.getWorldPosition(this.tmpV)
            if (Math.abs(this.tmpV.x - a.x) < a.H) {
                ox = this.tmpV.x
                oy = -this.tmpV.y
            }
        }
        this.allyProjectile('bolt', ox, oy, target.x, target.y - target.size * 0.45, dmg)
        a.dir = Math.sign(target.x - a.x) || a.dir
        this.flash(ox, oy, 0xfef3c7, 12, 0.06)
    },

}

// the attack clip an ally uses
function id2clip(a) {
    if (a.id === 'shadow') return a.actions.kat2 ? 'kat2' : 'attack1'
    return a.actions.attack2 ? 'attack2' : 'attack1'
}

