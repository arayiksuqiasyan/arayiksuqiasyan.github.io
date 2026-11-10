// Signature moves: on top of its swing, every melee weapon throws or casts its own thing —
// sword waves, spinning axes, wind blades, thunder, reaper blades, rocks, fireballs, knives and mini mugs.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {rand} from './util';

// seconds between two signature moves of the same weapon (multi-hit combos would spam them otherwise)
const CD = {sword: 0.3, axe: 0, katana: 0.3, hammer: 0.55, scythe: 0.7, pickaxe: 0.35, torch: 0.4, knife: 0.25, mug: 1.0}
const MAX_THROWN = 40

export const signatureMethods = {
    // how much the melee weapon is upgraded: damage + reach levels (the damage track is endless)
    sigTier() {
        const t = this.meleeTracks ? this.meleeTracks() : {}
        return Math.min(14, (t.dmg || 0) + (t.reach || 0))
    },

    signatureMove(id, f) {
        if (this.customKit && this.customKit()) return
        // exactly once per attack: combo clips land several hits, but the signature move fires only once
        const atk = this.player && this.player.attack
        if (atk && atk.sigDone) return
        // only the combo finisher (every 3rd swing) throws — the other swings are plain, readable blows
        if (id !== 'axe' && this.player && this.player.chain % 3 !== 0) return
        this.sigCd = this.sigCd || {}
        if (this.time < (this.sigCd[id] || 0)) return
        // a more upgraded weapon throws more, more often and bigger — like a maxed gun
        const tier = this.sigTier()
        // the Barrage perk adds one projectile per stack
        const extra = Math.floor(tier / 2) + (this.perk ? this.perk('barrage') : 0)
        const big = 1 + 0.05 * tier
        // the Battle Axe throws on its critical (every 3rd) swing — on every swing from upgrade tier 4
        // (the swing effect runs just before performHit counts this swing, hence +1)
        const axeCrit = ((this.axeSwings || 0) + 1) % 3 === 0
        if (id === 'axe' && !axeCrit && tier < 4) return
        if (atk) atk.sigDone = true
        this.sigCd[id] = this.time + (CD[id] || 0.3) * Math.max(0.35, 1 - 0.07 * tier)
        this.thrown = this.thrown || []
        if (this.thrown.length >= MAX_THROWN) return
        const p = this.player
        const H = this.playerH
        const x = p.x + f * H * 0.35
        const y = p.y - H * 0.55
        const dmg = this.meleeStats().dmg
        const fan = (n, i, spread) => (n > 1 ? (i / (n - 1) - 0.5) * spread : 0)
        const cap = n => Math.min(n, this.lowFx ? 3 : 4)
        switch (id) {
            case 'mug': {
                // mugs are big and busy on screen: fewer of them, growing slower with upgrades
                const n = Math.min(this.lowFx ? 3 : 5, 2 + Math.floor(tier / 3))
                for (let i = 0; i < n; i++) {
                    // an even fan: from a low, long throw to a high lob
                    const t = n > 1 ? i / (n - 1) : 0.4
                    const a = 0.08 + 1.05 * t + rand(-0.05, 0.05)
                    const sp = 600 - 230 * t
                    this.throwObject({
                        mesh: this.propMesh('mug', H * 0.24 * big), x: x + f * 12, y: y - 4,
                        vx: f * Math.cos(a) * sp, vy: -Math.sin(a) * sp, grav: 950, spin: f * (5 + 4 * t),
                        size: H * 0.24 * big, dmg: dmg * 0.8 / n, breaks: true, kind: 'mug', pop: 0,
                        wait: i * 0.07, // they leave the hand one after another
                    })
                }
                break
            }
            case 'knife': {
                const n = cap(1 + extra)
                for (let i = 0; i < n; i++) {
                    const a = fan(n, i, 0.5)
                    this.throwObject({
                        mesh: this.propMesh('knife', H * 0.32 * big, true), x, y: y + 4,
                        vx: f * 1300 * Math.cos(a), vy: 1300 * Math.sin(a), grav: 0,
                        face: true, size: H * 0.2 * big, dmg: dmg * 0.9 / n, life: 0.45, kind: 'knife',
                    })
                }
                break
            }
            case 'axe': {
                const n = cap(1 + Math.floor(extra / 2) + (axeCrit && tier >= 4 ? 1 : 0))
                for (let i = 0; i < n; i++) {
                    this.throwObject({
                        mesh: this.propMesh('axe', H * 0.5 * big), x, y: y - 10, vx: f * (760 - i * 90), vy: -260 - i * 120, grav: 700,
                        spin: f * 18, size: H * 0.4 * big, dmg: dmg / n, pierce: 3, life: 1.1, breaks: true, kind: 'axe',
                    })
                }
                break
            }
            case 'pickaxe': {
                const n = cap(3 + extra)
                for (let i = 0; i < n; i++) {
                    const sz = H * rand(0.09, 0.14) * big
                    const rock = new THREE.Mesh(this.geo.box, this.rockMat())
                    rock.scale.set(sz, sz * 0.8, sz)
                    this.throwObject({
                        mesh: rock, x, y: y + 10, vx: f * rand(380, 660), vy: -rand(280, 600), grav: 1500,
                        spin: rand(-14, 14), size: sz * 1.4, dmg: dmg * 0.7 / n, breaks: true, kind: 'rock',
                    })
                }
                break
            }
            case 'torch': {
                // always one fire grenade — upgrades add shrapnel instead
                const n = 1
                for (let i = 0; i < n; i++) {
                    const g = new THREE.Group()
                    const core = new THREE.Mesh(this.geo.sphere, this.sigMat(0xfff3b0))
                    core.scale.setScalar(H * 0.12 * big)
                    const glow = new THREE.Mesh(this.geo.sphere, this.sigMat(0xff6a00, 0.55))
                    glow.scale.setScalar(H * 0.24 * big)
                    const halo = new THREE.Mesh(this.geo.sphere, this.sigMat(0xff3d00, 0.22))
                    halo.scale.setScalar(H * 0.36 * big)
                    g.add(halo, glow, core)
                    // a fire grenade: explodes on impact and throws burning shrapnel
                    this.throwObject({
                        mesh: g, x, y, vx: f * 640, vy: -220 + fan(n, i, 420), grav: 700, size: H * 0.3 * big, dmg: dmg * 0.4 / n,
                        life: 1.1, breaks: true, kind: 'fireball', blast: dmg * 0.7 / n, shards: Math.min(10, 6 + Math.floor(tier / 3)),
                    })
                }
                break
            }
            case 'scythe': {
                // spinning reaper blades thrown like boomerangs: out, back to the hero, cutting everything twice
                const n = cap(1 + Math.floor(extra / 2))
                for (let i = 0; i < n; i++) {
                    const a = fan(n, i, 0.9)
                    this.throwObject({
                        mesh: this.propMesh('scythe', H * 0.55 * big), x, y: y - 6,
                        vx: f * 820 * Math.cos(a), vy: 820 * Math.sin(a), grav: 0, spin: f * 16,
                        size: H * 0.45 * big, dmg: dmg * 0.6 / n, pierce: 99, life: 2.2, kind: 'reaper',
                        boomerang: true, outT: 0.38 + 0.02 * tier,
                    })
                }
                this.sfx && this.sfx.play('boomerang')
                break
            }
            case 'sword':
            case 'katana': {
                // flying blade waves (crescents)
                const cfg = {
                    sword: {n: 1, color: 0x4ade80, speed: 950, scale: 0.55, life: 0.38, dmg: 0.5, spin: 0},
                    katana: {n: 2, color: 0x22d3ee, speed: 1250, scale: 0.42, life: 0.3, dmg: 0.4, spin: 0},
                }[id]
                const n = cap(cfg.n + Math.floor(extra / 2))
                for (let i = 0; i < n; i++) {
                    const mesh = new THREE.Mesh(this.geo.slash, this.sigMat(cfg.color, 0.9).clone())
                    const sc = H * cfg.scale * big
                    mesh.scale.set(sc, sc * (id === 'katana' ? 0.7 : 1), 1)
                    mesh.rotation.z = f > 0 ? 0 : Math.PI
                    this.throwObject({
                        mesh, x: x + f * i * 18, y: y + fan(n, i, H * 0.28 * (n - 1)), vx: f * cfg.speed, vy: 0, grav: 0, // straight lines, stacked
                        spin: cfg.spin * f, keepRot: !cfg.spin, size: sc * 0.8, dmg: dmg * cfg.dmg / n,
                        pierce: 99, life: cfg.life * big, fade: true, kind: 'wave', color: cfg.color,
                    })
                }
                break
            }
            case 'hammer': {
                // spinning mini hammers fly in an arc; where one lands, lightning strikes from the sky
                const n = cap(1 + Math.floor(extra / 2))
                for (let i = 0; i < n; i++) {
                    this.throwObject({
                        mesh: this.propMesh('hammer', H * 0.42 * big), x, y: y - 8,
                        vx: f * rand(520, 700) * (1 - i * 0.12), vy: -rand(420, 560) + i * 40, grav: 1500, spin: f * 15,
                        size: H * 0.34 * big, dmg: dmg * 0.35 / n, breaks: true, life: 1.6, kind: 'hammer', boltDmg: dmg * 0.55 / n,
                    })
                }
                break
            }
            default:
        }
    },

    // lightning from the sky at (tx, ty): damages and briefly stuns everything close
    boltAt(tx, ty, dmg, f) {
        const p = this.player
        const H = this.playerH
        const top = window.scrollY - 20
        this.addBolt([tx + rand(-30, 30), top], [tx, ty])
        this.addBolt([tx + rand(-40, 40), top], [tx + rand(-12, 12), ty])
        this.flash(tx, ty, 0xbfdbfe, H * 0.8, 0.22)
        this.scorchBolt && this.scorchBolt(tx, ty + H * 0.2)
        this.spray(16, tx, ty, 0xe0f2fe, () => [rand(-320, 320), -rand(60, 360)], [0.15, 0.35], 0.4)
        this.shake = Math.max(this.shake, 10)
        this.sfx && this.sfx.play('thunder', {volume: 0.8})
        for (const b of this.bugs) {
            if (b.dead || Math.hypot(b.x - tx, b.y - b.size * 0.4 - ty) > H * 0.9) continue
            this.damageBug(b, dmg, Math.sign(b.x - p.x) || f, false, 'thrown')
            if (!b.elite) b.stun = Math.max(b.stun || 0, 0.25)
        }
    },

    // ---------------------------------------------------------------- thrown objects
    throwObject(o) {
        o.life = o.life || 1.6
        o.max = o.life
        o.rot = 0
        o.pierce = o.pierce || 0
        o.hits = new Set()
        if (o.wait > 0) o.mesh.visible = false
        o.mesh.renderOrder = 13
        this.scene.add(o.mesh)
        this.thrown.push(o)
        this.placeThrown(o)
    },

    placeThrown(o) {
        o.mesh.position.set(o.x, -o.y, 86)
        if (o.face) o.mesh.rotation.z = Math.atan2(-o.vy, o.vx)
        else if (!o.keepRot) o.mesh.rotation.z = -o.rot
        if (o.kind === 'mug') {
            // side-on so the handle and the coffee show; it "pops" to full size as it leaves the hand
            o.mesh.rotation.x = 0.35
            o.mesh.rotation.y = 0.6
            o.pop = Math.min(1, (o.pop || 0) + 0.12)
            const k = 0.4 + 0.6 * (1 - Math.pow(1 - o.pop, 3))
            o.baseScale = o.baseScale || o.mesh.scale.x
            o.mesh.scale.setScalar(o.baseScale * k)
        }
        if (o.fade && o.mesh.material) o.mesh.material.opacity = 0.9 * Math.min(1, o.life / (o.max * 0.6))
    },

    updateThrown(dt) {
        if (!this.thrown || !this.thrown.length) return
        for (const o of this.thrown) {
            if (o.wait > 0) {
                o.wait -= dt
                o.mesh.visible = o.wait <= 0
                continue
            }
            o.life -= dt
            // boomerang: after flying out it turns around and comes back to the hero; it may hit everyone again
            if (o.boomerang) {
                o.age = (o.age || 0) + dt
                if (o.age > o.outT) {
                    if (!o.back) {
                        o.back = true
                        o.hits.clear()
                    }
                    const p = this.player
                    const tx = p.x
                    const ty = p.y - this.playerH * 0.55
                    const dx = tx - o.x
                    const dy = ty - o.y
                    const d = Math.hypot(dx, dy) || 1
                    const s = Math.min(1500, Math.max(850, Math.hypot(o.vx, o.vy) + 2600 * dt))
                    const k = Math.min(1, dt * 12)
                    o.vx += ((dx / d) * s - o.vx) * k
                    o.vy += ((dy / d) * s - o.vy) * k
                    if (d < this.playerH * 0.35) o.life = -1 // caught
                } else {
                    // slows down before turning
                    o.vx *= 1 - dt * 1.6
                    o.vy *= 1 - dt * 1.6
                }
            }
            o.vy += (o.grav || 0) * dt
            const prevY = o.y
            o.x += o.vx * dt
            o.y += o.vy * dt
            o.rot += (o.spin || 0) * dt
            this.placeThrown(o)
            this.thrownTrail(o)
            for (const b of this.bugs) {
                if (b.dead || b.appear < 0.5 || o.hits.has(b)) continue
                if (Math.abs(b.x - o.x) < b.size * 0.45 + o.size * 0.4 && Math.abs(b.y - b.size * 0.45 - o.y) < b.size * 0.5 + o.size * 0.45) {
                    o.hits.add(b)
                    this.damageBug(b, o.dmg, Math.sign(o.vx) || 1, false, 'thrown')
                    this.thrownHit(o, b)
                    if (--o.pierce < 0) {
                        o.life = 0
                        break
                    }
                }
            }
            if (o.life > 0 && o.breaks && o.vy > 0 && this.land(o.x, 4, prevY, o.y, null)) o.life = 0
            if (o.x < -60 || o.x > this.vw + 60) o.life = -1
            if (o.life <= 0 && o.life > -1) this.thrownEnd(o)
        }
        this.thrown = this.thrown.filter(o => {
            if (o.life > 0) return true
            this.scene.remove(o.mesh)
            if (o.fade && o.mesh.material) o.mesh.material.dispose()
            return false
        })
    },

    thrownTrail(o) {
        const r = Math.random()
        if (o.kind === 'mug') {
            // coffee spilling out of the tumbling mug, and a wisp of steam
            if (r < 0.55) this.spray(1, o.x + rand(-4, 4), o.y, r < 0.3 ? 0x6b3a1a : 0x8b5a2b, () => [o.vx * 0.15 + rand(-20, 20), rand(-20, 40)], [0.35, 0.6], 1.1)
            if (r > 0.82) this.spray(1, o.x, o.y - 6, 0xe7e5e4, () => [rand(-15, 15), -rand(30, 70)], [0.4, 0.6], 0)
        }
        else if (o.kind === 'fireball') {
            this.spray(3, o.x, o.y, r < 0.5 ? 0xff7a1a : 0xfde047, () => [rand(-60, 60), -rand(40, 160)], [0.25, 0.45], 0)
            if (r < 0.3) this.spray(1, o.x, o.y, 0x57534e, () => [rand(-30, 30), -rand(40, 100)], [0.5, 0.8], 0)
        } else if (o.kind === 'ember' && r < 0.7) {
            this.spray(1, o.x, o.y, r < 0.35 ? 0xff7a1a : 0xfde047, () => [rand(-20, 20), -rand(20, 60)], [0.15, 0.3], 0)
        } else if (o.kind === 'axe' && r < 0.5) this.spray(1, o.x, o.y, 0xff8a2a, () => [rand(-40, 40), rand(-40, 40)], [0.15, 0.3], 0)
        else if (o.kind === 'hammer' && r < 0.6) this.spray(1, o.x, o.y, r < 0.3 ? 0x60a5fa : 0xe0f2fe, () => [rand(-50, 50), rand(-50, 50)], [0.12, 0.25], 0)
        else if (o.kind === 'reaper') {
            if (r < 0.7) this.spray(1, o.x + rand(-o.size, o.size) * 0.4, o.y + rand(-o.size, o.size) * 0.4, r < 0.35 ? 0xa855f7 : 0xd8b4fe, () => [rand(-40, 40), -rand(20, 90)], [0.25, 0.5], 0)
        } else if (o.kind === 'knife' && r < 0.4) this.spray(1, o.x, o.y, 0xe2e8f0, () => [-o.vx * 0.05, rand(-10, 10)], [0.08, 0.15], 0)
    },

    thrownHit(o, b) {
        if (o.kind === 'mug') {
            b.slow = 2.5
            this.statusLabel && this.statusLabel(b, 'slow', 'SLOWED ☕', 'ammo')
        } else if (o.kind === 'fireball' || o.kind === 'ember') {
            b.burn = 3
            this.statusLabel && this.statusLabel(b, 'burn', 'BURNING', 'hot')
        } else if (o.kind === 'reaper') {
            this.flash(b.x, b.y - b.size * 0.45, 0xa855f7, b.size * 0.7, 0.14)
            this.spray(6, b.x, b.y - b.size * 0.45, 0xd8b4fe, () => [rand(-200, 200), -rand(60, 240)], [0.25, 0.45], 0)
        }
    },

    thrownEnd(o) {
        const {x, y} = o
        const H = this.playerH
        if (o.kind === 'mug') {
            this.spray(10, x, y, 0xf5f5f4, () => [rand(-260, 260), -rand(120, 420)], [0.35, 0.7], 1.2)
            this.spray(14, x, y, 0x6b3a1a, () => [rand(-300, 300), -rand(60, 340)], [0.3, 0.6], 1.1)
            this.spray(5, x, y - 6, 0xe7e5e4, () => [rand(-40, 40), -rand(60, 140)], [0.5, 0.9], 0)
            this.flash(x, y, 0x9a5b2e, H * 0.3, 0.14)
            this.coffeeAt && this.coffeeAt(x, y)
            this.sfx && this.sfx.play('shatter', {volume: 0.8})
        } else if (o.kind === 'fireball') {
            // the fire grenade goes off: a big blast that burns everything around, then burning shrapnel
            const R = H * 1.05
            this.flash(x, y, 0xfff1c2, H * 0.6, 0.12)
            this.flash(x, y, 0xff6a00, R * 1.2, 0.32)
            this.spray(26, x, y, 0xff7a1a, () => [rand(-420, 420), -rand(80, 480)], [0.3, 0.6], 0.4)
            this.spray(12, x, y, 0xfde047, () => [rand(-300, 300), -rand(60, 360)], [0.15, 0.3], 0.2)
            this.spray(10, x, y, 0x44403c, () => [rand(-120, 120), -rand(60, 200)], [0.6, 1.1], 0)
            this.shake = Math.max(this.shake, 12)
            // the site catches fire where it went off
            this.igniteAt && this.igniteAt(x, y + H * 0.2)
            for (const b of this.bugs) {
                if (b.dead || Math.hypot(b.x - x, b.y - b.size * 0.45 - y) > R) continue
                this.damageBug(b, o.blast, Math.sign(b.x - x) || 1, false, 'thrown')
                b.burn = 3
            }
            for (let i = 0; i < o.shards && this.thrown.length < MAX_THROWN; i++) {
                const a = -Math.PI * (0.1 + 0.8 * (i / Math.max(1, o.shards - 1))) + rand(-0.15, 0.15)
                const sp = rand(380, 620)
                const core = new THREE.Mesh(this.geo.sphere, this.sigMat(0xffd27a))
                core.scale.setScalar(H * 0.035)
                const glow = new THREE.Mesh(this.geo.sphere, this.sigMat(0xff6a00, 0.5))
                glow.scale.setScalar(H * 0.07)
                const m = new THREE.Group()
                m.add(glow, core)
                this.throwObject({
                    mesh: m, x, y: y - 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 1300,
                    size: H * 0.12, dmg: o.blast * 0.35, breaks: true, life: 1.2, kind: 'ember',
                })
            }
            this.sfx && this.sfx.play('grenade')
        } else if (o.kind === 'rock') {
            this.dust(x, y, 6, 40)
            this.spray(6, x, y, 0x78716c, () => [rand(-200, 200), -rand(100, 300)], [0.3, 0.5], 1.2)
            this.spray(3, x, y, 0xfde047, () => [rand(-200, 200), -rand(100, 300)], [0.15, 0.3], 1)
        } else if (o.kind === 'hammer') {
            this.boltAt(x, y, o.boltDmg, Math.sign(o.vx) || 1)
        } else if (o.kind === 'axe') {
            this.spray(10, x, y, 0xff8a2a, () => [rand(-260, 260), -rand(80, 320)], [0.25, 0.5], 1)
            this.flash(x, y, 0xffb36b, H * 0.4, 0.15)
        }
    },

    clearThrown() {
        for (const o of this.thrown || []) this.scene.remove(o.mesh)
        this.thrown = []
    },

    // ---------------------------------------------------------------- props
    // a normalized, centred copy of a melee weapon model, `size` px tall; `flat` lays it along +X (thrown knife)
    propMesh(id, size, flat = false) {
        this.propTpl = this.propTpl || {}
        if (!this.propTpl[id]) {
            const model = this.buildMeleeModel(id)
            const holder = new THREE.Group()
            const pivot = new THREE.Group()
            pivot.add(model)
            if (flat) pivot.rotation.z = -Math.PI / 2
            holder.add(pivot)
            holder.updateMatrixWorld(true)
            const box = new THREE.Box3().setFromObject(holder)
            const c = box.getCenter(new THREE.Vector3())
            pivot.position.sub(c)
            holder.userData.k = 1 / Math.max(0.001, box.max.y - box.min.y, box.max.x - box.min.x)
            this.propTpl[id] = holder
        }
        const tpl = this.propTpl[id]
        const mesh = tpl.clone(true)
        mesh.scale.setScalar(size * tpl.userData.k)
        return mesh
    },

    sigMat(color, opacity = 1) {
        this.sigMats = this.sigMats || {}
        const key = color + '_' + opacity
        return this.sigMats[key] || (this.sigMats[key] = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
            toneMapped: false, side: THREE.DoubleSide,
        }))
    },

    rockMat() {
        return this.rockMaterial || (this.rockMaterial = new THREE.MeshStandardMaterial({color: 0x78716c, roughness: 0.9, flatShading: true}))
    },
}
