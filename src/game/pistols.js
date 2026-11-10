// Gunslinger (SWAT): dual pistols instead of a melee weapon. They need no ammo and aim at the closest
// monster in any direction by themselves, so the hero can't be cornered. E = Bullet Storm (3× fire rate).
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {GUN_STAT_MAX, powerMul} from './loadout';

const PISTOL_RATE = 0.17   // seconds between shots (hands alternate)
const PISTOL_RANGE = 600
const PISTOL_SPEED = 1900
const PISTOL_DMG = 0.65

export const pistolMethods = {
    isDual() {
        return !!(this.heroTrait && this.progress && this.heroTrait() === 'dual')
    },

    // a compact pistol; barrel along +X, grip down (-Y) — same frame as the guns
    buildPistol() {
        const G = this.geo
        const M = this.wMats
        const g = new THREE.Group()
        const part = (geo, m, sx, sy, sz, x, y, rz = 0) => {
            const mesh = new THREE.Mesh(geo, m)
            mesh.scale.set(sx, sy, sz)
            mesh.position.set(x, y, 0)
            mesh.rotation.z = rz
            g.add(mesh)
        }
        part(G.box, M.gunBody, 0.26, 0.075, 0.055, 0.1, 0.02)             // slide
        part(G.box, M.gunMetal, 0.2, 0.03, 0.05, 0.12, -0.02)              // frame
        part(G.box, M.gunBody, 0.07, 0.14, 0.05, -0.0, -0.08, 0, 0.22)     // grip
        part(G.cyl, M.gunMetal, 0.018, 0.06, 0.018, 0.25, 0.025, -Math.PI / 2) // muzzle
        part(G.box, M.gunGlow, 0.18, 0.01, 0.06, 0.1, 0.06)                // neon line
        const muzzle = new THREE.Object3D()
        muzzle.position.set(0.28, 0.025, 0)
        g.add(muzzle)
        return {group: g, muzzle}
    },

    // right hand: a pistol instead of the melee weapon; left hand: a second pistol shown while firing
    attachPistols(hand, leftHand) {
        this.pistols = null
        if (!hand || !leftHand) return
        if (this.sword) this.sword.visible = false
        const mk = (h, side) => {
            const ws = new THREE.Vector3()
            h.getWorldScale(ws)
            const holder = new THREE.Group()
            holder.scale.setScalar((this.playerH * 0.62 * (this.growthScale ? this.growthScale() : 1)) / ws.x)
            const {group, muzzle} = this.buildPistol()
            group.rotation.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0)
            group.position.set(0.02 * side, 0.07, 0)
            holder.add(group)
            h.add(holder)
            return {holder, muzzle}
        }
        this.pistols = {r: mk(hand, 1), l: mk(leftHand, -1), side: 0}
        this.pistols.l.holder.visible = false
    },

    pistolStats() {
        const t = this.meleeTracks('pistols')
        const d = t.dmg || 0
        const dmg = (1 + 0.25 * Math.min(d, GUN_STAT_MAX)) * Math.pow(1.1, Math.max(0, d - GUN_STAT_MAX))
        return {
            dmg: PISTOL_DMG * dmg * powerMul(this.progress.stats.power),
            rate: PISTOL_RATE * (1 - 0.1 * Math.min(t.rate || 0, GUN_STAT_MAX)),
        }
    },

    // closest monster in any direction (no facing preference — that's the point)
    nearestMonster(x, y) {
        let best = null
        let bestD = PISTOL_RANGE
        for (const b of this.bugs) {
            if (b.dead || b.appear < 0.5) continue
            const d = Math.hypot(b.x - x, b.y - b.size * 0.45 - y)
            if (d < bestD) {
                bestD = d
                best = b
            }
        }
        return best
    },

    pistolKit() {
        if (this.pistolMats) return
        const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false,
        })
        this.pistolMats = {
            core: add(0xffffff),
            glow: add(0x38bdf8, 0.45),
            brass: new THREE.MeshStandardMaterial({color: 0xd4a017, metalness: 0.9, roughness: 0.3, emissive: 0x3d2a00}),
        }
    },

    // flying casings + the tracer trail (runs every frame)
    updatePistolFx(dt) {
        if (this.casings && this.casings.length) {
            for (const c of this.casings) {
                c.life -= dt
                c.vy += 1500 * dt
                c.x += c.vx * dt
                c.y += c.vy * dt
                c.mesh.rotation.z += c.spin * dt
                c.mesh.position.set(c.x, -c.y, 84)
                c.mesh.scale.y = 4.5 * Math.min(1, c.life * 4)
            }
            this.casings = this.casings.filter(c => {
                if (c.life > 0) return true
                this.scene.remove(c.mesh)
                return false
            })
        }
        // sparks trailing behind every pistol round
        for (const u of this.bullets) {
            if (!u.pistol || u.life <= 0 || Math.random() > 0.6) continue
            this.spray && this.spray(1, u.x - u.vx * 0.01, u.y - u.vy * 0.01, 0x7dd3fc, () => [(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60], [0.08, 0.16], 0)
        }
    },

    updatePistols(dt, canAct) {
        this.updatePistolFx(dt)
        const P = this.pistols
        const p = this.player
        this.pistolCd = Math.max(0, (this.pistolCd || 0) - dt)
        // the second pistol replaces the gun in the left hand while the pistols are firing
        const firing = this.time - (this.lastPistolShot || -9) < 0.45
        if (P) {
            P.l.holder.visible = firing
            if (this.gun) this.gun.visible = !firing
        }
        if (!this.wantsAttack() || !canAct || p.dead || this.pistolCd > 0) return
        const S = this.pistolStats()
        const storm = this.ab && this.ab.active > 0
        this.pistolCd = S.rate / (storm ? 3 : 1)
        this.lastPistolShot = this.time
        // alternate hands
        const side = P ? (P.side = 1 - P.side) : 0
        let ox = p.x + p.facing * this.playerH * 0.35
        let oy = p.y - this.playerH * 0.6
        const muzzle = P && (side ? P.l : P.r).muzzle
        if (muzzle) {
            muzzle.getWorldPosition(this.tmpV)
            if (Math.abs(this.tmpV.x - p.x) < this.playerH && Math.abs(-this.tmpV.y - (p.y - this.playerH * 0.5)) < this.playerH) {
                ox = this.tmpV.x
                oy = -this.tmpV.y
            }
        }
        const b = this.nearestMonster(ox, oy)
        let vx = p.facing * PISTOL_SPEED
        let vy = 0
        if (b) {
            const ty = b.y - b.size * 0.45
            const t = Math.min(0.3, Math.hypot(b.x - ox, ty - oy) / PISTOL_SPEED)
            const dx = b.x + (b.vx || 0) * t - ox
            const dy = ty + (b.vy || 0) * t * 0.5 - oy
            const d = Math.hypot(dx, dy) || 1
            vx = (dx / d) * PISTOL_SPEED
            vy = (dy / d) * PISTOL_SPEED
            // turn towards the target unless the player is steering
            if (!this.input.left && !this.input.right && Math.abs(dx) > 20) {
                p.facing = Math.sign(dx)
                p.faceAngle = p.facing
            }
        }
        this.pistolKit()
        const K = this.pistolMats
        // tracer: a white-hot core inside a long cyan glow
        const mesh = new THREE.Group()
        const glow = new THREE.Mesh(this.geo.sphere, K.glow)
        glow.scale.set(26, 6.5, 6.5)
        glow.position.x = -8
        const core = new THREE.Mesh(this.geo.sphere, K.core)
        core.scale.set(13, 2.2, 2.2)
        mesh.add(glow, core)
        mesh.rotation.z = Math.atan2(-vy, vx)
        mesh.renderOrder = 12
        this.scene.add(mesh)
        this.bullets.push({mesh, x: ox, y: oy, vx, vy, life: PISTOL_RANGE / PISTOL_SPEED, dmg: S.dmg, pistol: true})
        // muzzle flash: a bright pop + a few sparks along the shot
        const f = Math.sign(vx) || p.facing
        this.flash(ox, oy, 0xe0f2fe, 18 * (this.unit || 1), 0.07)
        this.spray && this.spray(5, ox, oy, 0x7dd3fc, () => [vx * 0.25 + (Math.random() - 0.5) * 160, vy * 0.25 + (Math.random() - 0.5) * 160], [0.06, 0.14], 0)
        // a brass casing flies out of the side and tumbles down
        this.casings = this.casings || []
        if (this.casings.length < 40) {
            const c = new THREE.Mesh(this.geo.cyl, K.brass)
            c.scale.set(1.6, 4.5, 1.6)
            c.renderOrder = 11
            this.scene.add(c)
            this.casings.push({mesh: c, x: ox - f * 6, y: oy - 4, vx: -f * (120 + Math.random() * 140), vy: -(260 + Math.random() * 160), spin: (Math.random() - 0.5) * 40, life: 0.7})
        }
        this.sfx && this.sfx.play('laser', {volume: 0.3})
    },
}
