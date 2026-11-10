// Ferrum — the master of metal. His own kit only (like the Gunslinger): no melee weapons, no guns.
//   passive  — iron blades orbit him (3 + Blades upgrade)
//   attack   — Iron Blades: the blades leave the orbit one by one, pierce monsters and fly back
//   K        — Magnetic Pulse: a wave that throws monsters back and tears enemy arrows, bombs and orbs apart
//   E        — Iron Storm: dozens of blades swirl around him for 3 s, then strike every monster on screen
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {OBJLoader} from 'three/examples/jsm/loaders/OBJLoader.js';
import {GUN_STAT_MAX, powerMul} from './loadout';
import {rand} from './util';

const FLY_SPEED = 1400
const BLADES_MAX = 9 // orbit upgrade levels: 3 → 12 daggers
const BLADE_RATE = 0.2

export const ferrumMethods = {
    isMetal() {
        return !!(this.heroTrait && this.progress && this.heroTrait() === 'metal')
    },

    // a hero with a kit of its own (no melee, no guns): the Gunslinger or Ferrum
    customKit() {
        return (this.isDual && this.isDual()) || this.isMetal()
    },

    // rage: the fewer hearts Ferrum has left, the stronger he gets (5 ❤ → I, 4 → II, 3 or less → III)
    ferrumRage() {
        const p = this.player
        if (!p || !this.isMetal() || p.maxHp <= 5) return 0
        return p.hp <= 3 ? 3 : p.hp <= 4 ? 2 : p.hp <= 5 ? 1 : 0
    },

    ferrumRageMul() {
        return 1 + 0.4 * this.ferrumRage()
    },

    ferrumStats() {
        const rage = this.ferrumRage()
        const t = this.meleeTracks('ferrum')
        const d = t.dmg || 0
        const dmgMul = (1 + 0.25 * Math.min(d, GUN_STAT_MAX)) * Math.pow(1.1, Math.max(0, d - GUN_STAT_MAX))
        return {
            dmg: 4 * dmgMul * powerMul(this.progress.stats.power),
            blades: 3 + Math.min(BLADES_MAX, t.blades || 0) + rage,
            speed: (1 + 0.15 * Math.min(GUN_STAT_MAX, t.speed || 0)) * (1 + 0.2 * rage),
            pulse: Math.min(GUN_STAT_MAX, t.pulse || 0),
            range: 1 + 0.15 * rage,
            rage,
        }
    },

    bladeMesh(scale = 1) {
        if (!this.ferrumMats) {
            this.ferrumMats = {
                steel: new THREE.MeshStandardMaterial({color: 0xf1f5f9, metalness: 0.8, roughness: 0.2, emissive: 0x000000, emissiveIntensity: 0}),
                glow: new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}),
            }
        }
        const M = this.ferrumMats
        const H = this.playerH
        // the real dagger model (Quaternius LowPoly Medieval Weapons, CC0), all steel with a violet glow
        if (this.daggerGeo) {
            const g = new THREE.Group()
            const d = new THREE.Mesh(this.daggerGeo, M.steel)
            d.scale.setScalar(H * 0.46)
            d.renderOrder = 14
            const glow = new THREE.Mesh(this.geo.sphere, M.glow)
            glow.scale.set(H * 0.2, H * 0.03, H * 0.02)
            glow.position.x = H * 0.04
            g.add(glow, d)
            g.scale.setScalar(scale)
            g.renderOrder = 13
            this.scene.add(g)
            return g
        }
        if (!this.daggerLoading) this.loadDagger()
        // fallback while the model loads: an iron arrow (pointing along +X)
        const g = new THREE.Group()
        const shaft = new THREE.Mesh(this.geo.cyl, M.steel)
        shaft.scale.set(H * 0.012, H * 0.38, H * 0.012)
        shaft.rotation.z = -Math.PI / 2
        const head = new THREE.Mesh(this.geo.cone, M.steel)
        head.scale.set(H * 0.035, H * 0.08, H * 0.035)
        head.rotation.z = -Math.PI / 2
        head.position.x = H * 0.19
        const collar = new THREE.Mesh(this.geo.cyl, M.steel)
        collar.scale.set(H * 0.02, H * 0.02, H * 0.02)
        collar.rotation.z = -Math.PI / 2
        collar.position.x = H * 0.185
        g.add(shaft, head, collar)
        for (const s of [-1, 1]) {
            const fin = new THREE.Mesh(this.geo.box, M.steel)
            fin.scale.set(H * 0.07, H * 0.035, H * 0.006)
            fin.position.set(-H * 0.16, s * H * 0.018, 0)
            fin.rotation.z = s * 0.35
            g.add(fin)
        }
        const glow = new THREE.Mesh(this.geo.sphere, M.glow)
        glow.scale.set(H * 0.26, H * 0.035, H * 0.03)
        g.add(glow)
        g.scale.setScalar(scale)
        g.renderOrder = 13
        this.scene.add(g)
        return g
    },

    loadDagger() {
        this.daggerLoading = true
        new OBJLoader().load(this.assetUrl.replace(/[^/]+$/, 'ferrum-dagger.obj'), obj => {
            let geo = null
            obj.traverse(o => { if (!geo && o.isMesh) geo = o.geometry })
            if (!geo) return
            geo = geo.clone()
            // the tip points to -Z in the file: turn it to +X, blade face towards the camera, length 1, centred
            geo.rotateY(-Math.PI / 2)
            geo.rotateX(Math.PI / 2)
            geo.computeBoundingBox()
            const b = geo.boundingBox
            const c = new THREE.Vector3()
            b.getCenter(c)
            geo.translate(-c.x, -c.y, -c.z)
            const len = b.max.x - b.min.x || 1
            geo.scale(1 / len, 1 / len, 1 / len)
            geo.computeVertexNormals()
            this.daggerGeo = geo
            // swap the placeholder arrows for daggers
            for (const bl of this.blades || []) {
                this.scene.remove(bl.mesh)
                bl.mesh = this.bladeMesh()
            }
        }, undefined, () => { this.daggerLoading = false })
    },

    resetFerrum() {
        for (const b of this.blades || []) this.scene.remove(b.mesh)
        for (const b of this.stormBlades || []) this.scene.remove(b.mesh)
        for (const w of (this.ironWings && this.ironWings.wings) || []) this.scene.remove(w.mesh)
        this.ironWings = null
        this.blades = []
        this.stormBlades = []
        this.lastRage = 0
        if (this.ferrumMats) {
            this.ferrumMats.steel.emissive.setHex(0x000000)
            this.ferrumMats.steel.emissiveIntensity = 0
            this.ferrumMats.glow.color.setHex(0xffffff)
            this.ferrumMats.glow.opacity = 0.08
        }
        this.bladeCd = 0
        this.pulseCd = 0
    },

    // keep the orbit filled with the right number of blades
    syncBlades() {
        const want = this.ferrumStats().blades
        this.blades = this.blades || []
        while (this.blades.length < want) {
            this.blades.push({state: 'orbit', mesh: this.bladeMesh(), x: this.player.x, y: this.player.y, vx: 0, vy: 0, hits: new Set()})
        }
        while (this.blades.length > want) this.scene.remove(this.blades.pop().mesh)
    },

    ferrumTarget(x, y, range, f) {
        let best = null
        let bd = range
        for (const b of this.bugs) {
            if (b.dead || b.appear < 0.5) continue
            const d = Math.hypot(b.x - x, b.y - b.size * 0.45 - y) + ((b.x - x) * f < 0 ? 140 : 0)
            if (d < bd) {
                bd = d
                best = b
            }
        }
        return best
    },

    updateFerrum(dt, canAct) {
        if (!this.isMetal()) {
            if (this.blades && this.blades.length) this.resetFerrum()
            return
        }
        const p = this.player
        if (!p) return
        const S = this.ferrumStats()
        // rage tier changed: announce it and recolour the metal (violet → magenta → red)
        if (S.rage !== (this.lastRage || 0)) {
            if (S.rage > (this.lastRage || 0)) {
                this.toast(`RAGE ${['', 'I', 'II', 'III'][S.rage]}`, 'boss')
                this.flash(p.x, p.y - this.playerH * 0.5, 0xef4444, this.playerH * 1.2, 0.35)
                this.shake = Math.max(this.shake, 12)
                this.sfx && this.sfx.play('roar', {volume: 0.6})
                // breaking free: a free Magnetic Pulse and a moment of invulnerability
                this.magneticPulse(S)
                p.inv = Math.max(p.inv, 1.2)
            }
            this.lastRage = S.rage
            if (this.ferrumMats) {
                // plain steel at rest; rage heats the metal red
                this.ferrumMats.steel.emissive.setHex(S.rage ? 0xef4444 : 0x000000)
                this.ferrumMats.steel.emissiveIntensity = 0.15 * S.rage
                this.ferrumMats.glow.color.setHex(S.rage ? 0xff3b3b : 0xffffff)
                this.ferrumMats.glow.opacity = S.rage ? 0.12 + 0.06 * S.rage : 0.08
            }
        }
        this.syncBlades()
        const H = this.playerH
        const cx = p.x
        const cy = p.y - H * 0.55
        this.bladeCd = Math.max(0, (this.bladeCd || 0) - dt)
        this.pulseCd = Math.max(0, (this.pulseCd || 0) - dt)
        const orbiting = this.blades.filter(b => b.state === 'orbit')
        // ---- attack: send the next blade
        if (canAct && !p.dead && this.input.attack && this.bladeCd <= 0 && orbiting.length) {
            const target = this.ferrumTarget(cx, cy, 700 * S.range, p.facing)
            const bl = orbiting[0]
            const tx = target ? target.x : cx + p.facing * 600
            const ty = target ? target.y - target.size * 0.45 : cy
            const d = Math.hypot(tx - bl.x, ty - bl.y) || 1
            bl.state = 'fly'
            bl.vx = ((tx - bl.x) / d) * FLY_SPEED * S.speed
            bl.vy = ((ty - bl.y) / d) * FLY_SPEED * S.speed
            bl.life = 0.55 * S.range
            bl.pierce = 2 + S.rage
            bl.hits.clear()
            // rage: blades leave much faster (+50% per tier on top of their speed)
            this.bladeCd = BLADE_RATE / S.speed / (1 + 0.5 * S.rage)
            if (target && (target.x - p.x) * p.facing < 0 && !this.input.left && !this.input.right) {
                p.facing = Math.sign(target.x - p.x)
                p.faceAngle = p.facing
            }
            this.sfx && this.sfx.play('swish', {volume: 0.5})
        }
        // ---- K: magnetic pulse
        if (canAct && !p.dead && this.input.shoot && this.pulseCd <= 0) this.magneticPulse(S)
        // ---- blades
        let oi = 0
        const n = Math.max(1, orbiting.length)
        // more than 8: an inner and an outer ring spinning opposite ways
        const two = n > 8
        const nIn = two ? Math.floor(n / 2) : n
        for (const bl of this.blades) {
            if (bl.state === 'orbit') {
                const idx = oi++
                const inner = !two || idx < nIn
                const m = inner ? nIn : n - nIn
                const j = inner ? idx : idx - nIn
                const a = (inner ? 1 : -0.8) * this.time * 2.6 + (j / m) * Math.PI * 2
                const r = H * (inner ? 0.62 : 0.92)
                const tx = cx + Math.cos(a) * r
                const ty = cy + Math.sin(a) * r * 0.55
                bl.x += (tx - bl.x) * Math.min(1, dt * 14)
                bl.y += (ty - bl.y) * Math.min(1, dt * 14)
                bl.mesh.rotation.z = -a - Math.PI / 2
            } else {
                if (bl.state === 'fly') {
                    bl.life -= dt
                    if (bl.life <= 0) bl.state = 'back'
                }
                if (bl.state === 'back') {
                    const dx = cx - bl.x
                    const dy = cy - bl.y
                    const d = Math.hypot(dx, dy) || 1
                    const sp = FLY_SPEED * 1.1 * S.speed
                    bl.vx += ((dx / d) * sp - bl.vx) * Math.min(1, dt * 10)
                    bl.vy += ((dy / d) * sp - bl.vy) * Math.min(1, dt * 10)
                    if (d < H * 0.5) bl.state = 'orbit'
                }
                bl.x += bl.vx * dt
                bl.y += bl.vy * dt
                bl.mesh.rotation.z = Math.atan2(-bl.vy, bl.vx)
                if (Math.random() < 0.5) this.spray(1, bl.x, bl.y, 0xe5e7eb, () => [rand(-20, 20), rand(-20, 20)], [0.1, 0.2], 0)
                for (const b of this.bugs) {
                    if (b.dead || bl.hits.has(b)) continue
                    if (Math.abs(b.x - bl.x) < b.size * 0.45 + 10 && Math.abs(b.y - b.size * 0.45 - bl.y) < b.size * 0.5 + 10) {
                        bl.hits.add(b)
                        this.damageBug(b, S.dmg, Math.sign(bl.vx) || 1, false, 'thrown')
                        this.flash(bl.x, bl.y, 0xf1f5f9, b.size * 0.5, 0.1)
                        // RAGE III: every 15 blade hits give a heart back
                        if (S.rage >= 3 && (this.rageHits = (this.rageHits || 0) + 1) % 15 === 0 && p.hp < p.maxHp) {
                            p.hp++
                            this.floatText(p.x, p.y - H - 18, '+1 ❤', 'heart')
                            this.emitHud(true)
                        }
                        if (bl.state === 'fly' && --bl.pierce < 0) bl.state = 'back'
                    }
                }
            }
            bl.mesh.position.set(bl.x, -bl.y, 87)
        }
        this.updateIronStorm(dt, S)
        this.updateIronWings(dt)
    },

    magneticPulse(S) {
        const p = this.player
        const H = this.playerH
        const cx = p.x
        const cy = p.y - H * 0.5
        const R = H * 2.2 * (1 + 0.15 * S.pulse)
        this.pulseCd = (3 - 0.35 * S.pulse) * (1 - 0.2 * (S.rage || 0))
        // a magnetic burst: three thin rings one after another, field lines, iron filings, a bright core
        this.flash(cx, cy, 0xffffff, H * 0.5, 0.12)
        this.flash(cx, cy, 0xa78bfa, R * 0.55, 0.3)
        ;[[0xede9fe, 0.62, 0], [0xc4b5fd, 0.85, 70], [0x7c3aed, 1, 140]].forEach(([c, k, ms]) => {
            setTimeout(() => !this.disposed && this.ring(cx, cy, c, R * k, 0.38, 0.95), ms)
        })
        // a cloud of iron filings bursting out in a ring
        this.spray(this.lowFx ? 10 : 22, cx, cy, 0xc4b5fd, () => {
            const a = rand(0, Math.PI * 2)
            const v = rand(300, 600)
            return [Math.cos(a) * v, Math.sin(a) * v * 0.7]
        }, [0.25, 0.45], 0)
        this.spray(this.lowFx ? 14 : 30, cx, cy, 0xe5e7eb, () => {
            const a = rand(0, Math.PI * 2)
            const v = rand(500, 900)
            return [Math.cos(a) * v, Math.sin(a) * v * 0.7]
        }, [0.18, 0.32], 0)
        this.shake = Math.max(this.shake, 10)
        this.sfx && this.sfx.play('zap')
        for (const b of this.bugs) {
            if (b.dead) continue
            const dx = b.x - cx
            const dy = b.y - b.size * 0.45 - cy
            const d = Math.hypot(dx, dy)
            if (d > R) continue
            this.damageBug(b, S.dmg * (0.6 + 0.2 * S.pulse), Math.sign(dx) || 1, false)
            this.flash(b.x, b.y - b.size * 0.45, 0xa78bfa, b.size * 0.7, 0.18)
            if (!this.isBoss(b)) {
                b.vx = Math.sign(dx || 1) * (700 + 120 * S.pulse)
                b.vy = -420
                b.onGround = false
                b.stun = Math.max(b.stun || 0, 0.4)
            }
        }
        // enemy projectiles are torn apart
        for (const o of this.orbs) if (Math.hypot(o.x - cx, o.y - cy) < R) o.life = 0
        for (const m of this.missiles || []) {
            if (Math.hypot(m.x - cx, m.y - cy) < R) {
                m.life = 0
                this.flash(m.x, m.y, 0xc4b5fd, 30, 0.12)
            }
        }
    },

    // ---- E: Iron Storm
    startIronStorm() {
        const p = this.player
        this.stormBlades = this.stormBlades || []
        const n = this.lowFx ? 14 : 24
        for (let i = 0; i < n; i++) {
            this.stormBlades.push({mesh: this.bladeMesh(0.9), a: (i / n) * Math.PI * 2, r: this.playerH * 0.4, x: p.x, y: p.y, t: 0, phase: 'swirl', hits: new Set()})
        }
        this.stormT = 3
        this.toast('⚔ IRON STORM', 'super')
        this.sfx && this.sfx.play('horde', {volume: 0.6})
    },

    updateIronStorm(dt, S) {
        if (!this.stormBlades || !this.stormBlades.length) return
        const p = this.player
        const H = this.playerH
        const cx = p.x
        const cy = p.y - H * 0.55
        this.stormT = this.stormT === undefined ? Infinity : this.stormT - dt
        const launch = this.stormT <= 0
        for (const s of this.stormBlades) {
            if (s.phase === 'swirl') {
                s.a += dt * 6
                s.r = Math.min(H * 2, s.r + dt * H * 1.5)
                s.x = cx + Math.cos(s.a) * s.r
                s.y = cy + Math.sin(s.a) * s.r * 0.6
                s.mesh.rotation.z = -s.a - Math.PI / 2
                // the swirl itself cuts what it touches
                for (const b of this.bugs) {
                    if (b.dead || s.hits.has(b)) continue
                    if (Math.abs(b.x - s.x) < b.size * 0.45 && Math.abs(b.y - b.size * 0.45 - s.y) < b.size * 0.5) {
                        s.hits.add(b)
                        this.damageBug(b, S.dmg * 0.5, Math.sign(b.x - cx) || 1, false, 'thrown')
                    }
                }
                if (launch) {
                    const alive = this.bugs.filter(b => !b.dead)
                    const t = alive.length ? alive[(Math.random() * alive.length) | 0] : null
                    const tx = t ? t.x : s.x + Math.cos(s.a) * 400
                    const ty = t ? t.y - t.size * 0.45 : s.y + Math.sin(s.a) * 400
                    const d = Math.hypot(tx - s.x, ty - s.y) || 1
                    s.vx = ((tx - s.x) / d) * 1700
                    s.vy = ((ty - s.y) / d) * 1700
                    s.phase = 'strike'
                    s.t = 0.8
                    s.target = t
                    s.hits.clear()
                }
            } else {
                s.t -= dt
                s.x += s.vx * dt
                s.y += s.vy * dt
                s.mesh.rotation.z = Math.atan2(-s.vy, s.vx)
                for (const b of this.bugs) {
                    if (b.dead || s.hits.has(b)) continue
                    if (Math.abs(b.x - s.x) < b.size * 0.45 + 8 && Math.abs(b.y - b.size * 0.45 - s.y) < b.size * 0.5 + 8) {
                        s.hits.add(b)
                        this.damageBug(b, s.dmg || S.dmg * 1.5, Math.sign(s.vx) || 1, false, 'thrown')
                        this.flash(s.x, s.y, 0xddd6fe, b.size * 0.6, 0.12)
                    }
                }
            }
            s.mesh.position.set(s.x, -s.y, 87)
        }
        if (launch) this.stormT = Infinity
        this.stormBlades = this.stormBlades.filter(s => {
            if (s.phase === 'swirl' || s.t > 0) return true
            this.scene.remove(s.mesh)
            return false
        })
    },

    // ---- L: IRON WINGS — wings of steel daggers, a flight to the top of the screen and a meteor dive
    ferrumSuper() {
        const p = this.player
        const H = this.playerH
        const S = this.ferrumStats()
        const lv = this.superLv ? this.superLv() : 0
        // the Wings upgrade: 10 daggers per wing, +5 per level (20 → 60 in total)
        const perWing = 10 + 5 * Math.min(4, this.meleeTracks('ferrum').wings || 0)
        const wings = []
        for (const side of [-1, 1]) {
            for (let i = 0; i < perWing; i++) wings.push({mesh: this.bladeMesh(perWing > 10 ? 1 : 1.15), side, i, n: perWing})
        }
        this.ironWings = {
            phase: 'rise', t: 0, wings, open: 0,
            top: window.scrollY + H * 1.4,
            dmg: b => (this.isBoss(b) ? 12 + S.dmg * 4 : Math.max(99, S.dmg * 9)) * (1 + 0.3 * lv),
        }
        p.inv = Math.max(p.inv, 4)
        this.toast('⚡ IRON WINGS', 'super')
        this.onHud({flash: Math.random()})
        this.sfx && this.sfx.play('boomerang')
        this.flash(p.x, p.y - H * 0.6, 0xf1f5f9, H * 1.4, 0.3)
    },

    updateIronWings(dt) {
        const W = this.ironWings
        if (!W) return
        const p = this.player
        const H = this.playerH
        W.t += dt
        W.open = Math.min(1, W.open + dt * 3)
        p.inv = Math.max(p.inv, 0.3)
        // the wings: two fans of daggers behind the hero, beating slowly
        const beat = Math.sin(W.t * (W.phase === 'dive' ? 3 : 9)) * 0.12
        for (const w of W.wings) {
            const k = w.i / Math.max(1, w.n - 1)
            const a = (-0.25 + k * 1.25 + beat) * W.open
            // bigger wings reach further, and every other dagger sits on a second, inner row
            const len = H * (0.5 + k * (0.9 + 0.1 * (w.n - 10) / 5)) * W.open * (w.i % 2 && w.n > 10 ? 0.78 : 1)
            const x = p.x + w.side * Math.cos(a) * len
            const y = p.y - H * 0.65 - Math.sin(a) * len * 0.9
            w.mesh.position.set(x, -y, 86)
            w.mesh.rotation.z = w.side > 0 ? a : Math.PI - a
            w.x = x
            w.y = y
        }
        if (W.phase === 'rise') {
            p.vx *= 0.8
            p.vy = -1700
            p.onGround = false
            if (Math.random() < 0.6) this.spray(1, p.x + rand(-20, 20), p.y, 0xe5e7eb, () => [rand(-30, 30), rand(80, 200)], [0.2, 0.35], 0)
            if (p.y <= W.top || W.t > 0.9) {
                W.phase = 'hover'
                W.t = 0
            }
        } else if (W.phase === 'hover') {
            p.vy = 0
            p.vx = 0
            if (W.t > 0.28) {
                W.phase = 'dive'
                W.t = 0
                this.sfx && this.sfx.play('boomerang', {volume: 1})
            }
        } else if (W.phase === 'dive') {
            p.vy = 2600
            p.vx = 0
            // a comet tail: soft glow and fading sparks above the diving hero
            W.trail = (W.trail || 0) - dt
            if (W.trail <= 0) {
                W.trail = 0.03
                this.flash(p.x, p.y - H * 0.9, 0x8b5cf6, H * 0.7, 0.28)
            }
            this.spray(2, p.x + rand(-H * 0.25, H * 0.25), p.y - H * rand(0.6, 1.2), Math.random() < 0.5 ? 0xc4b5fd : 0xede9fe,
                () => [rand(-40, 40), -rand(60, 160)], [0.25, 0.45], 0)
            if ((p.onGround && W.t > 0.06) || W.t > 2) this.ironWingsImpact(W)
        }
    },

    ironWingsImpact(W) {
        const p = this.player
        const H = this.playerH
        const x = p.x
        const y = p.y - H * 0.3
        const R = H * 4.2
        this.flash(x, y, 0xffffff, H * 1.3, 0.16)
        this.flash(x, y, 0x8b5cf6, R * 0.9, 0.5)
        ;[[0xede9fe, 0.55, 0], [0xa78bfa, 0.8, 70], [0x6d28d9, 1, 140]].forEach(([c, k, ms]) => {
            setTimeout(() => !this.disposed && this.ring(x, y, c, R * k, 0.45, 0.94), ms)
        })
        for (const b of this.bugs) {
            if (b.dead || Math.hypot(b.x - x, b.y - b.size * 0.45 - y) > R) continue
            this.damageBug(b, W.dmg(b), Math.sign(b.x - x) || 1, true)
        }
        if (this.crackAt && p.ground) this.crackAt(x, p.ground.floor ? p.y : p.ground.t, H * 1.6, p.ground)
        this.dust(x, p.y, 20, 140)
        this.shake = Math.max(this.shake, 34)
        this.hitStop && this.hitStop(120)
        this.sfx && this.sfx.play('grenade')
        // the wings burst into daggers flying out in every direction
        this.stormBlades = this.stormBlades || []
        for (const w of W.wings) {
            const a = Math.atan2(-(w.y - y), w.x - x) + rand(-0.15, 0.15)
            this.stormBlades.push({mesh: w.mesh, x: w.x, y: w.y, phase: 'strike', t: 0.7, hits: new Set(),
                vx: Math.cos(a) * 1500, vy: -Math.sin(a) * 1500})
        }
        const extra = this.lowFx ? 10 : 20
        for (let i = 0; i < extra; i++) {
            const a = (i / extra) * Math.PI * 2
            this.stormBlades.push({mesh: this.bladeMesh(1), x, y, phase: 'strike', t: 0.6, hits: new Set(),
                vx: Math.cos(a) * 1500, vy: Math.sin(a) * 1500})
        }
        this.ironWings = null
        p.inv = Math.max(p.inv, 0.6)
    },

    ferrumShopItem() {
        const t = this.meleeTracks('ferrum')
        const rows = [
            {key: 'dmg', label: 'Damage', desc: '+25% damage · then +10% forever', endless: true},
            {key: 'blades', label: 'Blades', desc: '+1 dagger in orbit (3 → 12)', max: BLADES_MAX},
            {key: 'speed', label: 'Speed', desc: '+15% blade speed and launch rate'},
            {key: 'pulse', label: 'Pulse', desc: 'Magnetic Pulse: bigger, stronger, faster to recharge'},
            {key: 'wings', label: 'Wings', desc: 'Iron Wings: +10 daggers (20 → 60)'},
        ]
        return {
            id: 'ferrum', slot: 'melee', name: 'Iron Blades', price: 0, owned: true, equipped: true, lv: 1,
            desc: 'Ferrum’s own weapon · Space: blades · K: magnetic pulse · E: Iron Storm',
            gunRows: rows.map(r => ({...r, lv: t[r.key] || 0, max: r.max || GUN_STAT_MAX, cost: this.ferrumCost(r.key, t[r.key] || 0)})),
        }
    },

    ferrumCost(key, lv) {
        if (key === 'wings') return lv < 4 ? [3000, 7000, 14000, 25000][lv] : null
        // every extra dagger in orbit is a real investment
        if (key === 'blades') return lv < BLADES_MAX ? Math.round(3000 * Math.pow(1.55, lv) / 100) * 100 : null
        if (key === 'dmg') return lv < GUN_STAT_MAX ? 300 * (lv + 1) : Math.round(2000 * Math.pow(1.35, lv - GUN_STAT_MAX) / 100) * 100
        if (lv >= GUN_STAT_MAX) return null
        return (key === 'blades' ? 1500 : 800) * (lv + 1)
    },

    upgradeFerrum(key) {
        const P = this.progress
        const t = this.meleeTracks('ferrum')
        const lv = t[key] || 0
        const cost = this.ferrumCost(key, lv)
        if (cost == null || P.coins < cost) return false
        P.coins -= cost
        t[key] = lv + 1
        this.saveProgress()
        this.emitHud(true)
        return true
    },
}
