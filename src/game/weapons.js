// Ranged combat: the knight's pump shotgun (needs shell boxes) and the sentinels' energy orbs.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {rand} from './util';

export const AMMO_MAX = 99
export const MAGAZINE = 10 // shells per box
export const START_AMMO = 20
const PELLETS = 7
const SPREAD = 0.32 // radians, total cone
const PELLET_SPEED = 1700
const PELLET_LIFE = 0.27 // ≈ 460px of reach
const AIM_RANGE = 640
const clampAngle = a => Math.max(-1.25, Math.min(1.25, a))

// every gun the knight can unlock; `rate` = seconds between shots, `cost` = shells per shot
export const WEAPONS = {
    // starter gun: arrows come from the same ammo boxes; endless once the Ammo track is maxed
    bow: {name: 'Hunter Bow', rate: 0.5, cost: 1, glow: 0xfbbf24, desc: 'perk: arrows pierce 2 monsters'},
    shotgun: {name: 'Shotgun', icon: '💥', rate: 0.42, cost: 1, glow: 0x14e956, desc: 'perk: pellets stagger monsters'},
    laser: {name: 'Laser Rifle', icon: '🔵', rate: 0.24, cost: 1, glow: 0x22d3ee, desc: 'perk: pierces every monster in a line'},
    rocket: {name: 'Rocket Launcher', icon: '🚀', rate: 0.75, cost: 2, glow: 0xf97316, desc: 'perk: explosion hits everything around'},
    lightning: {name: 'Lightning', icon: '⚡', rate: 0.5, cost: 1, glow: 0xa855f7, desc: 'perk: chains to 4 more and stuns for 1 s'},
    minigun: {name: 'Minigun', icon: '🔥', rate: 0.06, cost: 1, heat: 0.035, glow: 0xfacc15, desc: 'perk: a storm of bullets'},
    // late-game guns (unlock with the game level)
    flamer: {name: 'Flamethrower', rate: 0.1, cost: 0.5, heat: 0.06, glow: 0xff6a00, unlock: 3, desc: 'perk: sets monsters on fire for 3 s'},
    railgun: {name: 'Railgun', rate: 1.0, cost: 3, glow: 0xc084fc, unlock: 5, desc: 'perk: pierces monsters and stone'},
    blackhole: {name: 'Black Hole', rate: 1.8, cost: 5, glow: 0x818cf8, unlock: 8, desc: 'perk: a vortex pulls monsters in'},
}
export const WEAPON_ORDER = ['bow', 'shotgun', 'laser', 'rocket', 'lightning', 'minigun', 'flamer', 'railgun', 'blackhole']

export const weaponMethods = {
    buildWeaponKit() {
        this.wMats = {
            bullet: new THREE.MeshBasicMaterial({
                color: 0xfff3b0, transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
                depthWrite: false, toneMapped: false,
            }),
            orb: new THREE.MeshBasicMaterial({
                color: 0xff4466, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
            }),
            orbGlow: new THREE.MeshBasicMaterial({
                color: 0xff1f4b, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending,
                depthWrite: false, toneMapped: false,
            }),
            gunBody: new THREE.MeshStandardMaterial({color: 0x1c232d, roughness: 0.45, metalness: 0.7}),
            gunMetal: new THREE.MeshStandardMaterial({color: 0x8b98a8, roughness: 0.25, metalness: 0.9}),
            gunGlow: new THREE.MeshStandardMaterial({color: 0x14e956, emissive: 0x14e956, emissiveIntensity: 2}),
            gunMag: new THREE.MeshStandardMaterial({color: 0xfacc15, roughness: 0.4, metalness: 0.5}),
            wood: new THREE.MeshStandardMaterial({color: 0x7a4a24, roughness: 0.7, metalness: 0.05}),
            arrowShaft: new THREE.MeshBasicMaterial({color: 0xc08a4a, toneMapped: false}),
            arrowHead: new THREE.MeshBasicMaterial({color: 0xfde68a, toneMapped: false}),
        }
        this.bullets = []
        this.orbs = []
        this.tmpV = new THREE.Vector3()
    },

    // pump shotgun; barrel along the group's +X, wooden stock behind
    // a different model for every gun; barrel along the group's +X, grip down (-Y)
    buildGun(id = (this.progress && this.progress.gun) || 'bow') {
        const M = this.wMats
        const G = this.geo
        const g = new THREE.Group()
        const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.35, metalness: 0.7, ...opts})
        const glowMat = color => new THREE.MeshBasicMaterial({color, toneMapped: false})
        const part = (geo, m, sx, sy, sz, x, y, z = 0, rz = 0, parent = g) => {
            const mesh = new THREE.Mesh(geo, m)
            mesh.scale.set(sx, sy, sz)
            mesh.position.set(x, y, z)
            mesh.rotation.z = rz
            parent.add(mesh)
            return mesh
        }
        const tube = (m, r, len, x, y, z = 0, parent = g) => part(G.cyl, m, r, len, r, x, y, z, -Math.PI / 2, parent)
        const ring = (m, r, t, x, y = 0, parent = g) => {
            const mesh = new THREE.Mesh(this.gunTorus(r, t), m)
            mesh.rotation.y = Math.PI / 2
            mesh.position.set(x, y, 0)
            parent.add(mesh)
            return mesh
        }
        let tip = 0.8
        this.gunSpinner = null
        if (id === 'bow') {
            // wooden recurve bow held upright, string towards the hero, a nocked arrow
            const wood = mat(0x7a4a24, {metalness: 0.05, roughness: 0.65})
            const curve = new THREE.QuadraticBezierCurve3(
                new THREE.Vector3(0.02, -0.4, 0), new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(0.02, 0.4, 0),
            )
            g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.022, 6), wood))
            part(G.box, mat(0x3f2a14, {metalness: 0.1}), 0.05, 0.12, 0.05, 0.16, 0)          // grip wrap
            part(G.cyl, mat(0xe5e7eb, {metalness: 0}), 0.005, 0.8, 0.005, 0.02, 0)           // string
            this.bowArrow = new THREE.Group()
            part(G.cyl, wood, 0.012, 0.5, 0.012, 0.25, 0, 0, -Math.PI / 2, this.bowArrow)     // shaft
            part(G.box, M.gunGlow, 0.05, 0.035, 0.01, 0.0, 0, 0, 0, this.bowArrow)           // fletching
            part(G.cone || G.box, M.gunMetal, 0.03, 0.06, 0.03, 0.52, 0, 0, -Math.PI / 2, this.bowArrow) // head
            g.add(this.bowArrow)
            tip = 0.5
        } else if (id === 'laser') {
            const white = mat(0xe5e7eb, {metalness: 0.3, roughness: 0.2})
            const cyan = glowMat(0x22d3ee)
            part(G.box, white, 0.46, 0.11, 0.09, 0.12, 0)
            part(G.box, white, 0.18, 0.07, 0.07, -0.18, -0.01)
            part(G.box, M.gunBody, 0.06, 0.13, 0.06, -0.02, -0.1, 0, 0.3)
            tube(M.gunBody, 0.045, 0.14, 0.42, 0.01)
            tube(cyan, 0.03, 0.06, 0.5, 0.01)
            part(G.box, cyan, 0.36, 0.014, 0.095, 0.12, 0.05)
            part(G.box, M.gunBody, 0.14, 0.04, 0.04, 0.12, 0.09)                 // scope
            tip = 0.56
        } else if (id === 'rocket') {
            const olive = mat(0x3f4a2a, {metalness: 0.3, roughness: 0.6})
            tube(olive, 0.075, 0.9, 0.15, 0.04)
            ring(glowMat(0xf97316), 0.078, 0.014, 0.58, 0.04)
            ring(M.gunBody, 0.08, 0.02, -0.28, 0.04)
            part(G.box, M.gunBody, 0.06, 0.14, 0.06, 0.05, -0.08, 0, 0.2)
            part(G.box, M.gunBody, 0.1, 0.05, 0.03, 0.2, 0.13)                   // sight
            tip = 0.62
        } else if (id === 'lightning') {
            const copper = mat(0xb45309, {metalness: 0.9, roughness: 0.25})
            const violet = glowMat(0xc084fc)
            part(G.box, M.gunBody, 0.24, 0.1, 0.08, -0.02, 0)
            part(G.box, M.gunBody, 0.06, 0.13, 0.06, -0.06, -0.1, 0, 0.3)
            tube(M.gunMetal, 0.018, 0.5, 0.33, 0.01)
            for (const x of [0.16, 0.28, 0.4]) ring(copper, 0.05, 0.012, x, 0.01)
            const orb = part(G.sphere, violet, 0.05, 0.05, 0.05, 0.6, 0.01)
            this.gunSpinner = {obj: orb, pulse: true}
            tip = 0.62
        } else if (id === 'minigun') {
            const barrels = new THREE.Group()
            barrels.position.set(0.32, 0.01, 0)
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2
                tube(M.gunMetal, 0.012, 0.52, 0, Math.cos(a) * 0.035, Math.sin(a) * 0.035, barrels)
            }
            ring(M.gunBody, 0.05, 0.012, 0.18, 0, barrels)
            ring(M.gunBody, 0.05, 0.012, -0.16, 0, barrels)
            g.add(barrels)
            part(G.box, M.gunBody, 0.2, 0.13, 0.11, -0.04, 0)                    // motor
            part(G.box, M.gunMag, 0.12, 0.09, 0.1, -0.02, -0.1)                  // ammo box
            part(G.box, M.gunGlow, 0.16, 0.014, 0.115, -0.04, 0.07)
            this.gunSpinner = {obj: barrels, axis: 'x', spinWhenFiring: true}
            tip = 0.6
        } else if (id === 'flamer') {
            const red = mat(0xb91c1c, {metalness: 0.5, roughness: 0.4})
            part(G.box, M.gunBody, 0.3, 0.1, 0.08, 0.04, 0.01)
            tube(M.gunMetal, 0.03, 0.34, 0.36, 0.02)
            part(this.geo.cone, M.gunMetal, 0.05, 0.08, 0.05, 0.54, 0.02, 0, -Math.PI / 2)
            tube(red, 0.05, 0.3, 0.06, -0.09)                                    // fuel tank
            ring(M.gunMetal, 0.052, 0.01, 0.12, -0.09)
            part(G.box, M.gunBody, 0.06, 0.12, 0.06, -0.06, -0.08, 0.06, 0.3)
            const pilot = part(G.sphere, glowMat(0xff8a2a), 0.018, 0.018, 0.018, 0.6, -0.02)
            this.gunSpinner = {obj: pilot, pulse: true}
            tip = 0.6
        } else if (id === 'railgun') {
            const purple = glowMat(0xc084fc)
            part(G.box, M.gunBody, 0.3, 0.12, 0.1, -0.06, 0)
            part(G.box, M.gunMetal, 0.72, 0.02, 0.05, 0.36, 0.045)
            part(G.box, M.gunMetal, 0.72, 0.02, 0.05, 0.36, -0.03)
            for (const x of [0.12, 0.26, 0.4, 0.54]) part(G.box, purple, 0.025, 0.09, 0.07, x, 0.008)
            part(G.box, M.gunBody, 0.06, 0.13, 0.06, -0.08, -0.11, 0, 0.3)
            tip = 0.74
        } else if (id === 'blackhole') {
            const indigo = glowMat(0x818cf8)
            part(G.box, M.gunBody, 0.3, 0.13, 0.11, -0.02, 0)
            part(G.box, M.gunBody, 0.06, 0.13, 0.06, -0.06, -0.11, 0, 0.3)
            tube(M.gunMetal, 0.03, 0.18, 0.2, 0.01)
            part(G.sphere, new THREE.MeshBasicMaterial({color: 0x07030f}), 0.065, 0.065, 0.065, 0.36, 0.01)
            const halo = ring(indigo, 0.09, 0.01, 0.36, 0.01)
            this.gunSpinner = {obj: halo, axis: 'z2'}
            tip = 0.42
        } else {
            // pump shotgun (default)
            part(G.box, M.gunBody, 0.26, 0.11, 0.08, 0.05, 0)                       // receiver
            part(G.cyl, M.gunMetal, 0.03, 0.62, 0.03, 0.48, 0.03, 0, -Math.PI / 2)  // barrel
            part(G.cyl, M.gunBody, 0.024, 0.5, 0.024, 0.42, -0.025, 0, -Math.PI / 2) // magazine tube
            part(G.box, M.wood, 0.17, 0.07, 0.075, 0.42, -0.035)                    // pump
            part(G.box, M.wood, 0.3, 0.1, 0.07, -0.22, -0.04, 0, 0.18)              // stock
            part(G.box, M.gunBody, 0.06, 0.12, 0.06, -0.04, -0.09, 0, 0.35)         // grip
            part(G.box, M.gunGlow, 0.2, 0.012, 0.085, 0.05, 0.06)                   // neon accent
        }
        const muzzle = new THREE.Object3D()
        muzzle.position.set(tip, 0.03, 0)
        g.add(muzzle)
        return {group: g, muzzle}
    },

    gunTorus(r, t) {
        this.torusGeos = this.torusGeos || {}
        const key = r + '_' + t
        return this.torusGeos[key] || (this.torusGeos[key] = new THREE.TorusGeometry(r, t, 8, 24))
    },

    // put the model of the equipped gun into the hero's left hand
    setGunLook() {
        if (!this.gunHolder) return
        const old = this.gun
        const {group, muzzle} = this.buildGun(this.weapon)
        group.rotation.copy(old.rotation)
        group.position.copy(old.position)
        this.gunHolder.remove(old)
        this.gunHolder.add(group)
        this.gun = group
        this.muzzle = muzzle
    },

    // spinning barrels, pulsing orbs
    updateGunAnim(dt) {
        const s = this.gunSpinner
        if (!s) return
        if (s.pulse) s.obj.scale.setScalar(s.obj.userData.base || (s.obj.userData.base = s.obj.scale.x))
        if (s.pulse) s.obj.scale.multiplyScalar(1 + Math.sin(this.time * 18) * 0.25)
        if (s.axis === 'x') {
            const firing = this.input.shoot && !this.overheated && (this.stats.ammo > 0 || this.infiniteAmmo())
            s.speed = (s.speed || 0) + ((firing ? 30 : 0) - (s.speed || 0)) * Math.min(1, dt * 4)
            s.obj.rotation.x += s.speed * dt
        }
        if (s.axis === 'z2') s.obj.rotation.x += dt * 4
    },

    updateShooting(dt, canAct) {
        // Ferrum has no gun: K is his Magnetic Pulse
        if (this.isMetal && this.isMetal()) return
        const p = this.player
        p.fireCd = Math.max(0, (p.fireCd || 0) - dt)
        // overheating guns cool down all the time; an overheated gun waits until it is cool again
        this.heat = Math.max(0, (this.heat || 0) - dt * (this.input.shoot && !this.overheated ? 0.1 : 0.5))
        if (this.overheated && this.heat < 0.3) {
            this.overheated = false
            this.emitHud(true)
        }
        if (!this.input.shoot || p.dead || !canAct) {
            this.shootHeld = false
            return
        }
        if (this.overheated) {
            if (this.time - (this.hotMsgAt || -9) > 1) {
                this.hotMsgAt = this.time
                this.floatText(p.x, p.y - this.playerH - 16, 'OVERHEATED', 'warn')
            }
            return
        }
        // a sting bee jammed the gun
        if (this.gunJammed && this.gunJammed()) {
            if (this.time - (this.jamMsgAt || -9) > 1) {
                this.jamMsgAt = this.time
                this.floatText(p.x, p.y - this.playerH - 16, `JAMMED ${this.debuff.jam.toFixed(1)}s`, 'warn')
            }
            return
        }
        const id = this.weapon || 'bow'
        const W = WEAPONS[id]
        const infinite = this.infiniteAmmo && this.infiniteAmmo()
        if (!infinite && this.stats.ammo < W.cost - 1e-6) {
            if (this.time - (this.noAmmoAt || -9) > 1.1) {
                this.noAmmoAt = this.time
                this.floatText(p.x, p.y - this.playerH - 16, 'NO AMMO — find a box', 'warn')
            }
            return
        }
        if (p.fireCd > 0) return
        // auto-aim: prefer targets in front; turn around only when nothing is in front,
        // the player isn't steering, not in the middle of a continuous burst, and not too often
        const [ax, ay] = this.muzzlePos()
        let target = this.findTarget(ax, ay, true)
        if (!target) {
            const back = this.findTarget(ax, ay)
            const steering = this.input.left || this.input.right
            const continuous = W.rate < 0.15 && this.shootHeld
            if (back && !steering && !continuous && this.time - (this.lastAutoTurn || -9) > 0.6) {
                p.facing = Math.sign(back.x - p.x) || p.facing
                p.faceAngle = p.facing
                this.lastAutoTurn = this.time
                target = back
            }
        }
        this.aimTarget = target
        this.shootHeld = true
        p.fireCd = this.gunRate ? this.gunRate() : W.rate
        if (!infinite) this.stats.ammo -= W.cost
        const heat = this.gunHeat ? this.gunHeat() : 0
        if (heat) {
            this.heat += heat
            if (this.heat >= 1) {
                this.heat = 1
                this.overheated = true
                this.burst(p.x + p.facing * this.playerH * 0.4, p.y - this.playerH * 0.56, 14, 0x9ca3af, 160)
                this.emitHud(true)
            }
        }
        // the Bigger shots upgrade: every projectile of this shot is drawn bigger and hits wider
        const k = this.shotScaleFor ? this.shotScaleFor(id) : 1
        const n0 = this.bullets.length
        this.shotScale = k
        this['fire_' + id]()
        this.shotScale = 1
        if (k > 1) {
            for (let i = n0; i < this.bullets.length; i++) {
                this.bullets[i].mesh.scale.multiplyScalar(k)
                this.bullets[i].hitR = (k - 1) * 10
            }
        }
        this.aimTarget = null
    },

    // muzzle position in world (document) coordinates, kept in front of the body
    muzzlePos() {
        const p = this.player
        const f = p.facing
        let mx = p.x + f * this.playerH * 0.4
        let my = p.y - this.playerH * 0.56
        if (this.muzzle) {
            this.muzzle.getWorldPosition(this.tmpV)
            if ((this.tmpV.x - p.x) * f > 0) {
                mx = this.tmpV.x
                my = -this.tmpV.y
            }
        }
        return [mx, my, f]
    },

    // best target for the guns: close, in front, not too steep; leads moving monsters
    findTarget(mx, my, frontOnly = false) {
        const p = this.player
        let best = null
        let bestScore = 1e9
        for (const b of this.bugs) {
            if (b.dead || b.appear < 0.5) continue
            const dx = b.x - mx
            const dy = b.y - b.size * 0.42 - my
            const d = Math.hypot(dx, dy)
            if (d > AIM_RANGE * (this.rangeMul ? this.rangeMul() : 1)) continue
            const ang = Math.abs(Math.atan2(dy, Math.abs(dx) + 1))
            if (ang > 1.25) continue
            const front = dx * p.facing > 0
            if (frontOnly && !front) continue
            const score = d * (front ? 1 : 1.5) + ang * 140
            if (score < bestScore) {
                bestScore = score
                best = b
            }
        }
        return best
    },

    // aim angle (relative to facing f) towards the target, with lead for moving monsters
    aimAngle(mx, my, f, speed = PELLET_SPEED) {
        const b = this.aimTarget && !this.aimTarget.dead ? this.aimTarget : this.findTarget(mx, my)
        if (!b) return 0
        const cy = b.y - b.size * 0.42
        const t = Math.min(0.35, Math.hypot(b.x - mx, cy - my) / speed)
        const tx = b.x + (b.vx || 0) * t
        const ty = cy + (b.vy || 0) * t * 0.5
        const dx = (tx - mx) * f
        if (dx < 5) return 0
        return clampAngle(Math.atan2(ty - my, dx))
    },

    fire_bow() {
        const [mx, my, f] = this.muzzlePos()
        const speed = 1500
        const aim = this.aimAngle(mx, my, f, speed)
        const top = this.mastery()
        const angles = top ? [aim - 0.09, aim, aim + 0.09] : [aim]
        for (const a of angles) {
            const mesh = new THREE.Group()
            const shaft = new THREE.Mesh(this.geo.box, this.wMats.arrowShaft)
            shaft.scale.set(34, 2.2, 2.2)
            const head = new THREE.Mesh(this.geo.box, this.wMats.arrowHead)
            head.scale.set(8, 5, 3)
            head.position.x = 18
            const tail = new THREE.Mesh(this.geo.box, this.wMats.gunGlow || this.wMats.arrowHead)
            tail.scale.set(8, 6, 1)
            tail.position.x = -15
            mesh.add(shaft, head, tail)
            mesh.rotation.z = f > 0 ? -a : Math.PI + a
            mesh.renderOrder = 12
            this.scene.add(mesh)
            this.bullets.push({
                mesh, x: mx, y: my, vx: f * Math.cos(a) * speed, vy: Math.sin(a) * speed, arrow: true, pierce: top ? 4 : 2,
                life: (top ? 0.75 : 0.6) * this.rangeMul(), dmg: (top ? 2 : 1.6) * this.gunMul(),
            })
        }
        // the nocked arrow disappears for a moment
        if (this.bowArrow) {
            this.bowArrow.visible = false
            clearTimeout(this.bowNockT)
            this.bowNockT = setTimeout(() => { if (this.bowArrow) this.bowArrow.visible = true }, 260)
        }
        this.sfx && this.sfx.play('swish')
        this.burst(mx + f * 8, my, 6, 0xfde68a, 160)
    },

    fire_shotgun() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const aim = this.aimAngle(mx, my, f)
        const n = this.mastery && this.mastery() ? 11 : PELLETS
        const spread = n > PELLETS ? SPREAD * 1.25 : SPREAD
        for (let i = 0; i < n; i++) {
            const a = aim + (i / (n - 1) - 0.5) * spread + rand(-0.03, 0.03)
            const speed = PELLET_SPEED * rand(0.9, 1.08)
            // heavy buckshot: thick, bright slugs (much bigger than minigun rounds)
            if (!this.wMats.buck) {
                this.wMats.buck = new THREE.MeshBasicMaterial({
                    color: 0xffc46b, transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
                    depthWrite: false, toneMapped: false,
                })
            }
            const mesh = new THREE.Mesh(this.geo.sphere, this.wMats.buck)
            mesh.scale.set(13, 5.5, 5.5)
            mesh.rotation.z = -a * f
            mesh.renderOrder = 12
            this.scene.add(mesh)
            this.bullets.push({
                mesh, x: mx, y: my, vx: f * Math.cos(a) * speed, vy: Math.sin(a) * speed,
                life: PELLET_LIFE * rand(0.85, 1.1) * (this.rangeMul ? this.rangeMul() : 1), dmg: this.gunMul ? this.gunMul() : 1,
            })
        }
        // muzzle blast
        this.sfx && this.sfx.play('shotgun')
        this.burst(mx + f * 10, my, 22, 0xfff1a8, 420)
        this.burst(mx + f * 10, my, 10, 0xff9f43, 260)
        p.vx -= f * 170
        this.shake = Math.max(this.shake, 9)
    },

    updateBullets(dt) {
        for (const u of this.bullets) {
            u.life -= dt
            // sub-steps so fast tracers cannot skip over thin enemies
            for (let s = 0; s < 3 && u.life > 0; s++) {
                u.x += (u.vx * dt) / 3
                u.y += ((u.vy || 0) * dt) / 3
                for (const b of this.bugs) {
                    if (b.dead) continue
                    const cy = b.y - b.size * 0.42
                    if (Math.abs(b.x - u.x) < b.size * 0.5 + 4 + (u.hitR || 0) && Math.abs(cy - u.y) < b.size * 0.48 + 4 + (u.hitR || 0)) {
                        if (u.arrow) {
                            if (!u.hitBugs) u.hitBugs = new Set()
                            if (u.hitBugs.has(b)) continue
                            u.hitBugs.add(b)
                            this.damageBug(b, u.dmg || 1, Math.sign(u.vx), false, 'bullet')
                            if (--u.pierce < 0) u.life = 0
                            if (u.life <= 0) break
                            continue
                        }
                        this.damageBug(b, u.dmg || 1, Math.sign(u.vx), false, 'bullet')
                        // shotgun pellets stagger
                        // pistol rounds burst into sparks on impact
                        if (u.pistol) {
                            this.burst(u.x, u.y, 10, 0x7dd3fc, 300)
                            this.flash(u.x, u.y, 0xe0f2fe, 14 * (this.unit || 1), 0.06)
                        }
                        if (this.weapon === 'shotgun' && !u.pistol) b.stun = Math.max(b.stun || 0, 0.35)
                        u.life = 0
                        break
                    }
                }
                if (u.life <= 0) break
                for (const o of this.orbs) {
                    if (o.life > 0 && Math.abs(o.x - u.x) < 16 && Math.abs(o.y - u.y) < 16) {
                        o.life = 0
                        u.life = 0
                        this.burst(o.x, o.y, 14, 0xff4466, 260)
                        break
                    }
                }
                if (u.life <= 0) break
                // pellets tear through page text (damaging it once each) but stop at stone
                for (const e of this.platformList) {
                    if (u.x > e.l && u.x < e.r && u.y > e.t && u.y < e.b) {
                        if (e.stone) {
                            this.burst(u.x, u.y, 5, 0xd6dde5, 180)
                            u.life = 0
                            break
                        }
                        if (!u.hit) u.hit = new Set()
                        if (!u.hit.has(e)) {
                            u.hit.add(e)
                            this.damageElement(e, 0.2, u.x, u.y, false, true)
                        }
                    }
                }
            }
            if (u.x < -60 || u.x > this.vw + 60) u.life = 0
            u.mesh.position.set(u.x - Math.sign(u.vx) * 8, -u.y, 85)
            if (u.spin) u.mesh.rotation.z += u.spin * (this.frameDt || 0.016)
            if (u.mesh.material) u.mesh.material.opacity = 1
        }
        if (this.bullets.some(u => u.life <= 0)) {
            this.bullets = this.bullets.filter(u => {
                if (u.life > 0) return true
                this.scene.remove(u.mesh)
                return false
            })
        }
    },

    fireOrb(ox, oy, tx, ty, color = 0xff4466) {
        const dx = tx - ox
        const dy = ty - oy
        const d = Math.hypot(dx, dy) || 1
        const speed = 460
        // orb materials are cached per colour (red sentinels, blue snowballs, green spores, purple magic)
        this.orbMats = this.orbMats || {}
        if (!this.orbMats[color]) {
            const core = this.wMats.orb.clone()
            core.color.setHex(color)
            const glowMat = this.wMats.orbGlow.clone()
            glowMat.color.setHex(color)
            this.orbMats[color] = {core, glow: glowMat}
        }
        const OM = this.orbMats[color]
        const mesh = new THREE.Group()
        const core = new THREE.Mesh(this.geo.sphere, OM.core)
        core.scale.setScalar(8)
        const glow = new THREE.Mesh(this.geo.sphere, OM.glow)
        glow.scale.setScalar(17)
        mesh.add(glow, core)
        mesh.renderOrder = 12
        this.scene.add(mesh)
        // orange orbs are fireballs: they set the hero on fire
        this.orbs.push({mesh, x: ox, y: oy, vx: (dx / d) * speed, vy: (dy / d) * speed, life: 3.2, color, burn: color === 0xff7a1a})
        this.burst(ox, oy, 8, color, 140)
    },

    updateOrbs(dt) {
        const p = this.player
        for (const o of this.orbs) {
            o.life -= dt
            o.x += o.vx * dt
            o.y += o.vy * dt
            o.mesh.position.set(o.x, -o.y, 90)
            o.mesh.scale.setScalar(1 + Math.sin(this.time * 30 + o.x) * 0.12)
            if (Math.random() < 0.6) this.burst(o.x, o.y, 1, o.color || 0xff4466, 30)
            if (p && this.canTarget() && Math.abs(p.x - o.x) < 22 && o.y > p.y - this.playerH * 0.95 && o.y < p.y) {
                this.hurtPlayer(o.x, {burn: o.burn})
                o.life = 0
                this.burst(o.x, o.y, 16, 0xff4466, 280)
            }
            if (o.x < -40 || o.x > this.vw + 40) o.life = 0
        }
        if (this.orbs.some(o => o.life <= 0)) {
            this.orbs = this.orbs.filter(o => {
                if (o.life > 0) return true
                this.scene.remove(o.mesh)
                return false
            })
        }
    },

    // the sword parries orbs inside its swing
    parryOrbs(box) {
        for (const o of this.orbs) {
            if (o.life <= 0 || o.x < box.l || o.x > box.r || o.y < box.t || o.y > box.b) continue
            o.life = 0
            this.burst(o.x, o.y, 18, 0xffd0d8, 300)
            this.floatText(o.x, o.y - 20, 'PARRY', 'skill')
            this.gainPower(4)
        }
    },

    clearProjectiles() {
        for (const u of this.bullets) this.scene.remove(u.mesh)
        for (const o of this.orbs) this.scene.remove(o.mesh)
        this.bullets = []
        this.orbs = []
    },
}
