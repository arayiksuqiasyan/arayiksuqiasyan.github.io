// Enemy archers (arrows) and bombers (bouncing bombs) — plus the projectiles themselves.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp, rand} from './util';

const ARROW_SPEED = 950
const ARROW_GRAVITY = 520
const BOMB_GRAVITY = 1500
const BOMB_FUSE = 1.25
const BOMB_RADIUS = 125

export const missileMethods = {
    buildMissileKit() {
        this.missiles = []
        this.misMats = {
            shaft: new THREE.MeshStandardMaterial({color: 0x8b5a2b, roughness: 0.7}),
            head: new THREE.MeshStandardMaterial({color: 0xcbd5e1, metalness: 0.9, roughness: 0.25}),
            feather: new THREE.MeshStandardMaterial({color: 0xef4444, roughness: 0.8, side: THREE.DoubleSide}),
            bomb: new THREE.MeshStandardMaterial({color: 0x111827, metalness: 0.4, roughness: 0.35}),
            fuse: new THREE.MeshBasicMaterial({color: 0xff3b1f, toneMapped: false}),
            bow: new THREE.MeshStandardMaterial({color: 0x6b3f1f, roughness: 0.6}),
            string: new THREE.MeshBasicMaterial({color: 0xe5e7eb}),
        }
    },

    // a wooden bow in front of an archer (follows its facing group)
    giveBow(b) {
        const g = new THREE.Group()
        const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(0, -0.42, 0), new THREE.Vector3(0.28, 0, 0), new THREE.Vector3(0, 0.42, 0),
        )
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 6), this.misMats.bow))
        const string = new THREE.Mesh(this.geo.cyl, this.misMats.string)
        string.scale.set(0.006, 0.84, 0.006)
        g.add(string)
        g.position.set(0.32, 0.55, 0.18)
        g.rotation.y = Math.PI / 2
        b.face.add(g)
        b.bow = {g, string}
    },

    // a fizzing bomb held above a bomber's head
    giveBomb(b) {
        const g = new THREE.Group()
        const ball = new THREE.Mesh(this.geo.sphere, this.misMats.bomb)
        ball.scale.setScalar(0.16)
        const spark = new THREE.Mesh(this.geo.sphere, this.misMats.fuse)
        spark.scale.setScalar(0.05)
        spark.position.set(0.06, 0.17, 0)
        g.add(ball, spark)
        g.position.set(0.1, 1.08, 0)
        b.face.add(g)
        b.heldBomb = g
    },

    // keeps its distance, draws the bow (string glows), fires a leading arrow
    archerBrain(b, dt, dx, dy) {
        const p = this.player
        const g = b.ground
        b.dir = Math.sign(dx) || b.dir
        const dist = Math.abs(dx)
        // back off if the hero is close, step in if far
        b.vx = dist < 300 ? -b.dir * b.speed : dist > 620 ? b.dir * b.speed : 0
        if (g && !g.floor && (b.x + b.vx * dt > g.r - 12 || b.x + b.vx * dt < g.l + 12)) b.vx = 0
        b.fireT = (b.fireT === undefined ? rand(0.8, 1.6) : b.fireT) - dt
        if (!b.charging && b.fireT <= 0 && dist < 820 && Math.abs(dy) < 360 && this.canTarget() && !this.isPassive(b)) b.charging = 0.55
        if (b.charging > 0) {
            b.vx = 0
            b.charging -= dt
            if (b.bow) b.bow.string.material = this.misMats.fuse
            if (b.charging <= 0) {
                b.charging = 0
                b.fireT = rand(1.4, 2.2)
                if (b.bow) b.bow.string.material = this.misMats.string
                const ox = b.x + b.dir * b.size * 0.45
                const oy = b.y - b.size * 0.55
                // lead the hero and compensate for the drop
                const tx = p.x + p.vx * 0.3
                const ty = p.y - this.playerH * 0.55
                const d = Math.hypot(tx - ox, ty - oy)
                const t = d / ARROW_SPEED
                this.fireArrow(ox, oy, tx, ty - 0.5 * ARROW_GRAVITY * t * t)
                if (b.model) this.enemyGesture(b, 'attack')
            }
        }
    },

    // keeps a medium distance and lobs bouncing bombs at the hero
    bomberBrain(b, dt, dx) {
        const p = this.player
        const g = b.ground
        b.dir = Math.sign(dx) || b.dir
        const dist = Math.abs(dx)
        b.vx = dist < 220 ? -b.dir * b.speed : dist > 520 ? b.dir * b.speed : 0
        if (g && !g.floor && (b.x + b.vx * dt > g.r - 12 || b.x + b.vx * dt < g.l + 12)) b.vx = 0
        b.fireT = (b.fireT === undefined ? rand(1, 2) : b.fireT) - dt
        if (b.heldBomb) b.heldBomb.visible = b.fireT < 1.2
        if (b.fireT <= 0 && dist < 700 && this.canTarget() && !this.isPassive(b)) {
            b.fireT = rand(2.2, 3.2)
            const ox = b.x
            const oy = b.y - b.size * 1.05
            // ballistic lob: fixed flight time, solve the launch velocity
            const T = clamp(dist / 520, 0.6, 1.1)
            const tx = p.x + p.vx * T * 0.5
            const ty = p.y - 10
            this.throwBomb(ox, oy, (tx - ox) / T, (ty - oy - 0.5 * BOMB_GRAVITY * T * T) / T)
            if (b.model) this.enemyGesture(b, 'attack')
        }
    },

    fireArrow(ox, oy, tx, ty) {
        const dx = tx - ox
        const dy = ty - oy
        const d = Math.hypot(dx, dy) || 1
        const g = new THREE.Group()
        const shaft = new THREE.Mesh(this.geo.cyl, this.misMats.shaft)
        shaft.scale.set(1.2, 34, 1.2)
        shaft.rotation.z = Math.PI / 2
        const head = new THREE.Mesh(this.geo.cone, this.misMats.head)
        head.scale.set(3, 8, 3)
        head.rotation.z = -Math.PI / 2
        head.position.x = 17
        const fl = new THREE.Mesh(this.geo.box, this.misMats.feather)
        fl.scale.set(8, 5, 0.6)
        fl.position.x = -15
        g.add(shaft, head, fl)
        g.renderOrder = 12
        this.scene.add(g)
        this.missiles.push({kind: 'arrow', mesh: g, x: ox, y: oy, vx: (dx / d) * ARROW_SPEED, vy: (dy / d) * ARROW_SPEED, life: 2.2})
        this.sfx && this.sfx.play('swing', {volume: 0.5})
    },

    throwBomb(ox, oy, vx, vy, friendly = false) {
        const g = new THREE.Group()
        const ball = new THREE.Mesh(this.geo.sphere, this.misMats.bomb)
        ball.scale.setScalar(11)
        const spark = new THREE.Mesh(this.geo.sphere, this.misMats.fuse)
        spark.scale.setScalar(3.5)
        spark.position.set(4, 11, 4)
        g.add(ball, spark)
        g.renderOrder = 12
        this.scene.add(g)
        this.missiles.push({kind: 'bomb', mesh: g, spark, x: ox, y: oy, vx, vy, fuse: BOMB_FUSE, friendly, life: 6})
    },

    explodeBomb(m) {
        m.life = 0
        const p = this.player
        this.flash(m.x, m.y, 0xff9f43, BOMB_RADIUS * 1.2, 0.3)
        this.flash(m.x, m.y, 0xfff1c2, BOMB_RADIUS * 0.5, 0.14)
        this.burst(m.x, m.y, 50, 0xff9f43, 520)
        this.burst(m.x, m.y, 24, 0x6b7280, 240)
        this.dust(m.x, m.y, 12, 140)
        this.shake = Math.max(this.shake, 14)
        this.sfx && this.sfx.play('boom', {volume: 0.7})
        const R = BOMB_RADIUS
        if (m.friendly) {
            // a bomb batted back by the sword hurts the monsters
            for (const b of this.bugs.slice()) {
                if (!b.dead && Math.hypot(b.x - m.x, b.y - b.size * 0.42 - m.y) < R + b.size * 0.3) this.damageBug(b, 5, Math.sign(b.x - m.x) || 1, false)
            }
        } else if (this.canTarget() && Math.hypot(p.x - m.x, p.y - this.playerH * 0.5 - m.y) < R + 20) {
            this.hurtPlayer(m.x)
        }
        for (const e of this.platformList) {
            if (e.stone) continue
            const nx = clamp(m.x, e.l, e.r)
            const ny = clamp(m.y, e.t, e.b)
            if ((nx - m.x) ** 2 + (ny - m.y) ** 2 < R * R * 0.5) this.damageElement(e, 1, nx, ny)
        }
    },

    updateMissiles(dt) {
        const p = this.player
        for (const m of this.missiles) {
            m.life -= dt
            const prevY = m.y
            if (m.kind === 'arrow') {
                m.vy += ARROW_GRAVITY * dt
                m.x += m.vx * dt
                m.y += m.vy * dt
                m.mesh.position.set(m.x, -m.y, 90)
                m.mesh.rotation.z = Math.atan2(-m.vy, m.vx)
                if (p && this.canTarget() && Math.abs(p.x - m.x) < 20 && m.y > p.y - this.playerH * 0.95 && m.y < p.y) {
                    this.hurtPlayer(m.x)
                    m.life = 0
                    this.burst(m.x, m.y, 12, 0xfecaca, 220)
                }
                // arrows stick into stone / blocks
                if (m.vy > 0 && this.land(m.x, 2, prevY, m.y, null)) m.life = Math.min(m.life, 0.01)
            } else {
                m.vy = Math.min(1600, m.vy + BOMB_GRAVITY * dt)
                m.x += m.vx * dt
                m.y += m.vy * dt
                if (m.vy > 0) {
                    const pl = this.land(m.x, 8, prevY, m.y, null)
                    if (pl) {
                        m.y = pl.t - 10
                        m.vy = -Math.abs(m.vy) * 0.45
                        m.vx *= 0.6
                    }
                }
                if (m.x < 12 || m.x > this.vw - 12) m.vx *= -0.6
                m.fuse -= dt
                m.spark.visible = Math.floor(m.fuse * (m.fuse < 0.5 ? 16 : 6)) % 2 === 0
                m.mesh.position.set(m.x, -m.y, 90)
                m.mesh.rotation.z += m.vx * dt * -0.02
                if (Math.random() < 0.5) this.burst(m.x + 4, m.y - 12, 1, 0xffb347, 40)
                if (m.fuse <= 0) this.explodeBomb(m)
                else if (!m.friendly && p && this.canTarget() && Math.hypot(p.x - m.x, p.y - this.playerH * 0.4 - m.y) < 34) this.explodeBomb(m)
                else if (m.friendly) {
                    for (const b of this.bugs) {
                        if (!b.dead && Math.hypot(b.x - m.x, b.y - b.size * 0.42 - m.y) < b.size * 0.5) {
                            this.explodeBomb(m)
                            break
                        }
                    }
                }
            }
            if (m.x < -60 || m.x > this.vw + 60) m.life = 0
        }
        if (this.missiles.some(m => m.life <= 0)) {
            this.missiles = this.missiles.filter(m => {
                if (m.life > 0) return true
                this.scene.remove(m.mesh)
                return false
            })
        }
    },

    // the sword: arrows break, bombs are batted back at the monsters
    parryMissiles(box) {
        const p = this.player
        for (const m of this.missiles) {
            if (m.life <= 0 || m.x < box.l || m.x > box.r || m.y < box.t || m.y > box.b) continue
            if (m.kind === 'arrow') {
                m.life = 0
                this.burst(m.x, m.y, 12, 0xffffff, 240)
                this.floatText(m.x, m.y - 20, 'PARRY', 'skill')
            } else if (!m.friendly) {
                m.friendly = true
                m.vx = p.facing * 760
                m.vy = -520
                m.fuse = Math.max(m.fuse, 0.9)
                this.floatText(m.x, m.y - 20, 'RETURN!', 'hot')
                this.sfx && this.sfx.play('hit')
            }
        }
    },

    clearMissiles() {
        for (const m of this.missiles || []) this.scene.remove(m.mesh)
        this.missiles = []
    },
}
