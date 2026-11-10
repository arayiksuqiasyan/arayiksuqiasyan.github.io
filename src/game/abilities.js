// Hero abilities. Each hero has one trait:
//  guardian (Knight)   — passive: starts with full armor, armor wears 2× slower
//  helper   (Michelle) — E: her drone leaves her back and fights for 30 s, then recharges
//  jetpack  (Vanguard) — double-tap W: fly while holding W; fuel drains and refills over time
//  stealth  (Ninja)    — E: vanish for 5 s — monsters lose track of you and can't hit you
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp, rand} from './util';
import {powerMul} from './loadout';

export const ABILITIES = {
    guardian: {label: 'Guardian', passive: true},
    helper: {label: 'Drone · E', charge: 40, active: 30},
    jetpack: {label: 'Jetpack · W W', fuel: true},
    stealth: {label: 'Stealth · E', charge: 20, active: 5},
    dual: {label: 'Bullet storm · E', charge: 25, active: 4},
    metal: {label: 'Iron Storm · E', charge: 25, active: 3},
}
const DRONE_RANGE = 560
const DRONE_RATE = 0.4
const JET_BURN = 1 / 3.2   // fuel per second while flying (≈3 s of flight)
const JET_REFILL = 1 / 6   // fuel per second while resting
const JET_THRUST = 4200
const JET_MAX_UP = -540

export const abilityMethods = {
    heroTrait() {
        const H = this.heroDefs && this.heroDefs[this.progress.hero]
        return (H && H.trait) || 'guardian'
    },

    resetAbility() {
        this.ab = {charge: 0, active: 0}
        this.fuel = 1
        this.jetOn = false
        this.jetIdle = 0
        this.hidden = false
        this.setHeroGhost(false)
    },

    // E / ability button
    useAbility() {
        const trait = this.heroTrait()
        const A = ABILITIES[trait]
        if (!A || A.passive || A.fuel || !this.player || this.player.dead) return
        if (this.ab.active > 0 || this.ab.charge < A.charge) {
            this.floatText(this.player.x, this.player.y - this.playerH - 16, 'charging…', 'warn')
            return
        }
        this.ab.active = A.active
        this.ab.charge = 0
        const p = this.player
        if (trait === 'stealth') {
            this.hidden = true
            this.setHeroGhost(true)
            this.burst(p.x, p.y - this.playerH * 0.5, 40, 0x6b7280, 320)
            this.toast('VANISHED — 5 s', 'super')
        } else if (trait === 'helper') {
            this.burst(p.x, p.y - this.playerH * 0.8, 30, 0xfacc15, 300)
            this.toast('DRONE DEPLOYED — 30 s', 'ammo')
        } else if (trait === 'metal') {
            this.startIronStorm()
        } else if (trait === 'dual') {
            this.burst(p.x, p.y - this.playerH * 0.6, 30, 0x7dd3fc, 320)
            this.toast('BULLET STORM — 4 s', 'super')
        }
        this.emitHud(true)
    },

    // W pressed: a quick second tap starts the jetpack (instead of the double jump)
    jetpackTap() {
        if (this.heroTrait() !== 'jetpack' || !this.player || this.player.dead) return false
        const quick = this.time - (this.lastJumpTap || -9) < 0.32
        this.lastJumpTap = this.time
        if (quick && this.fuel > 0.08 && !this.player.onGround) {
            this.jetOn = true
            return true
        }
        return false
    },

    updateAbility(dt) {
        const trait = this.heroTrait()
        const A = ABILITIES[trait]
        const p = this.player
        if (!A || !p) return
        if (A.charge) {
            if (this.ab.active > 0) {
                this.ab.active -= dt
                if (this.ab.active <= 0) {
                    this.ab.active = 0
                    if (trait === 'stealth') {
                        this.hidden = false
                        this.setHeroGhost(false)
                        this.burst(p.x, p.y - this.playerH * 0.5, 24, 0x9ca3af, 240)
                    }
                    this.emitHud(true)
                }
            } else if (this.ab.charge < A.charge) {
                const was = this.ab.charge
                // Ferrum's rage recharges Iron Storm faster
                const mul = trait === 'metal' && this.ferrumRageMul ? this.ferrumRageMul() : 1
                this.ab.charge = Math.min(A.charge, this.ab.charge + dt * mul)
                if (was < A.charge && this.ab.charge >= A.charge) {
                    this.toast(`${{helper: 'DRONE', stealth: 'STEALTH', dual: 'BULLET STORM', metal: 'IRON STORM'}[trait]} READY — press E`, 'super')
                }
            }
        }
        if (trait === 'jetpack') this.updateJetpack(dt)
        if (trait === 'helper') this.updateDrone(dt)
        if (this.hidden) {
            // a faint shimmer so the player still sees the ninja
            for (const m of this.playerMats) m.opacity = 0.18 + Math.sin(this.time * 14) * 0.06
        }
    },

    updateJetpack(dt) {
        const p = this.player
        if (!this.input.jump || p.dead) this.jetOn = false
        if (this.jetOn && this.fuel > 0) {
            this.fuel = Math.max(0, this.fuel - JET_BURN * dt)
            p.vy = Math.max(JET_MAX_UP, p.vy - JET_THRUST * dt)
            p.onGround = false
            this.jetIdle = 0
            // exhaust from the pack on the back
            const bx = p.x - p.facing * this.playerH * 0.12
            const by = p.y - this.playerH * 0.42
            for (let i = 0; i < 3; i++) {
                const q = this.particles[this.pIndex]
                this.pIndex = (this.pIndex + 1) % this.particles.length
                q.grav = 1
                q.x = bx + rand(-4, 4)
                q.y = by
                q.vx = rand(-50, 50)
                q.vy = rand(380, 620)
                q.life = q.max = rand(0.18, 0.35)
                const c = this.tmpColor.set(Math.random() < 0.5 ? 0xff9f43 : 0x7dd3fc)
                q.r = c.r
                q.g = c.g
                q.b = c.b
            }
            if (this.fuel <= 0) this.jetOn = false
        } else {
            this.jetIdle += dt
            if (this.jetIdle > 0.6) this.fuel = Math.min(1, this.fuel + JET_REFILL * dt)
        }
    },

    // ---- Michelle's drone
    buildDrone() {
        const g = new THREE.Group()
        const core = new THREE.Mesh(this.geo.sphere, new THREE.MeshStandardMaterial({
            color: 0x94a3b8, metalness: 0.6, roughness: 0.25, emissive: 0x334155, emissiveIntensity: 0.6,
        }))
        core.scale.setScalar(13)
        const lens = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({color: 0xfacc15, toneMapped: false}))
        lens.scale.setScalar(5.5)
        lens.position.set(8, 0, 6)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 2.4, 8, 32), new THREE.MeshStandardMaterial({
            color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.6,
        }))
        ring.rotation.x = Math.PI / 2.4
        const halo = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({
            color: 0xfacc15, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        }))
        halo.scale.setScalar(26)
        g.add(halo, core, lens, ring)
        g.userData = {ring, lens}
        return g
    },

    updateDrone(dt) {
        const p = this.player
        if (!this.drone) {
            this.drone = this.buildDrone()
            this.scene.add(this.drone)
            this.droneX = p.x
            this.droneY = p.y - this.playerH
            this.droneCd = 0
        }
        const active = this.ab.active > 0
        // docked on her back when resting; flies around her shoulder when deployed
        const tx = active ? p.x - p.facing * 46 + Math.sin(this.time * 2.4) * 22 : p.x - p.facing * this.playerH * 0.16
        const ty = active ? p.y - this.playerH * 1.12 + Math.cos(this.time * 3.1) * 14 : p.y - this.playerH * 0.66
        const k = Math.min(1, dt * (active ? 6 : 14))
        this.droneX += (tx - this.droneX) * k
        this.droneY += (ty - this.droneY) * k
        this.drone.position.set(this.droneX, -this.droneY, active ? 70 : -10)
        this.drone.scale.setScalar(active ? 1 : 0.55)
        this.drone.userData.ring.rotation.z += dt * (active ? 8 : 2)
        this.drone.visible = !p.dead
        if (!active) return
        this.droneCd -= dt
        if (this.droneCd > 0) return
        let best = null
        let bestD = DRONE_RANGE
        for (const b of this.bugs) {
            if (b.dead) continue
            const d = Math.hypot(b.x - this.droneX, b.y - b.size * 0.42 - this.droneY)
            if (d < bestD) {
                bestD = d
                best = b
            }
        }
        if (!best) return
        this.droneCd = DRONE_RATE
        const by = best.y - best.size * 0.42
        this.addBeam(this.droneX, this.droneY, best.x, by, 0xfacc15, 3, 10, 0.1)
        this.damageBug(best, 1.5 * powerMul(this.progress.stats.power), Math.sign(best.x - this.droneX) || 1, false, 'bullet')
        this.burst(best.x, by, 8, 0xfde047, 200)
    },

    removeDrone() {
        if (this.drone) this.scene.remove(this.drone)
        this.drone = null
    },

    // ---- Vanguard's jetpack, strapped to the spine
    attachJetpack(model) {
        let spine = null
        model.traverse(o => { if (!spine && /Spine2$/.test(o.name)) spine = o })
        if (!spine) return
        const ws = new THREE.Vector3()
        spine.getWorldScale(ws)
        const holder = new THREE.Group()
        holder.scale.setScalar(this.playerH / ws.x)
        const metal = new THREE.MeshStandardMaterial({color: 0x9ca3af, metalness: 0.85, roughness: 0.3})
        const dark = new THREE.MeshStandardMaterial({color: 0x1f2937, metalness: 0.6, roughness: 0.45})
        const glow = new THREE.MeshBasicMaterial({color: 0x7dd3fc, toneMapped: false})
        const plate = new THREE.Mesh(this.geo.box, dark)
        plate.scale.set(0.22, 0.22, 0.05)
        holder.add(plate)
        for (const x of [-0.06, 0.06]) {
            const tank = new THREE.Mesh(this.geo.cyl, metal)
            tank.scale.set(0.045, 0.24, 0.045)
            tank.position.set(x, 0, -0.06)
            const cap = new THREE.Mesh(this.geo.sphere, metal)
            cap.scale.setScalar(0.045)
            cap.position.set(x, 0.12, -0.06)
            const nozzle = new THREE.Mesh(this.geo.cone, dark)
            nozzle.scale.set(0.035, 0.06, 0.035)
            nozzle.rotation.x = Math.PI
            nozzle.position.set(x, -0.12, -0.06)
            const ring = new THREE.Mesh(this.geo.cyl, glow)
            ring.scale.set(0.028, 0.01, 0.028)
            ring.position.set(x, -0.175, -0.06)
            holder.add(tank, cap, nozzle, ring)
        }
        // the spine bone points up; the pack sits on the back (-Z of the character)
        holder.position.set(0, 0.05 * (ws.x ? 1 / ws.x : 1) * this.playerH, -0.12 * this.playerH / ws.x)
        spine.add(holder)
        this.jetpack = holder
    },

    // ---- Ninja's stealth look
    setHeroGhost(on) {
        for (const m of this.playerMats || []) {
            m.transparent = on
            m.opacity = on ? 0.2 : 1
            m.depthWrite = !on
            m.needsUpdate = true
        }
        if (this.sword) this.sword.visible = !on && !this.customKit()
        if (this.pistols) this.pistols.r.holder.visible = !on
        if (this.gunHolder) this.gunHolder.visible = !on && !this.isMetal()
    },

    abilityHud() {
        const trait = this.heroTrait()
        const A = ABILITIES[trait]
        if (!A) return null
        if (A.passive) return {trait, label: A.label, value: 1, active: true, ready: false, passive: true}
        if (A.fuel) return {trait, label: A.label, value: clamp(this.fuel, 0, 1), active: this.jetOn, ready: this.fuel > 0.99}
        const active = this.ab.active > 0
        return {
            trait, label: A.label, active, ready: !active && this.ab.charge >= A.charge,
            value: active ? this.ab.active / A.active : this.ab.charge / A.charge,
        }
    },
}
