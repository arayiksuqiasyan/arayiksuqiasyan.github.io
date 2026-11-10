// The site itself reacts to the weapons:
//  - fire (torch grenade) sets the block on fire for a few seconds: flames, a charred mark, the block burns down
//  - coffee (shattered mugs) leaves a stain with steam
// Purely the site's reaction — none of it makes the weapons stronger.
//  - lightning (thunder hammer) leaves a scorched blue mark
// Marks are DOM decals in the fx layer; "Rebuild the site" wipes everything.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {rand} from './util';

const MAX_DECALS = 60

export const siteFxMethods = {
    // the block (or the floor) whose top is right at / under (x, y)
    surfaceAt(x, y) {
        let best = null
        let bestD = 70
        for (const e of this.platformList || []) {
            if (x < e.l || x > e.r) continue
            const d = Math.abs(y - e.t)
            if (y > e.t - 70 && y < e.b + 10 && d < bestD) {
                bestD = d
                best = e
            }
        }
        if (!best && this.floor && Math.abs(y - this.floor.t) < 90) best = this.floor
        return best
    },

    addDecal(x, y, w, h, cls, rot = 0, e = null) {
        this.decals = this.decals || []
        const n = document.createElement('div')
        n.className = `game-decal ${cls}`
        n.style.left = (x - w / 2).toFixed(0) + 'px'
        n.style.top = (y - h / 2).toFixed(0) + 'px'
        n.style.width = w.toFixed(0) + 'px'
        n.style.height = h.toFixed(0) + 'px'
        if (rot) n.style.transform = `rotate(${rot.toFixed(0)}deg)`
        n._surface = e
        this.fx.appendChild(n)
        this.decals.push(n)
        while (this.decals.length > (this.lowFx ? 30 : MAX_DECALS)) this.decals.shift().remove()
        return n
    },

    // ---------------------------------------------------------------- fire
    igniteAt(x, y) {
        const e = this.surfaceAt(x, y)
        const H = this.playerH
        if (!e) return
        const top = e.t
        const w = Math.min(H * 2.2, e.floor ? H * 2.2 : e.r - e.l)
        const cx = e.floor ? x : Math.max(e.l + w / 2, Math.min(e.r - w / 2, x))
        this.addDecal(cx, top + 4, w * 0.8, Math.max(18, H * 0.28), 'game-decal--scorch', rand(-6, 6), e)
        this.groundFires = this.groundFires || []
        this.groundFires.push({x: cx, top, w, t: 4.5, e, tick: 0})
    },

    // ---------------------------------------------------------------- coffee
    coffeeAt(x, y) {
        const e = this.surfaceAt(x, y)
        const H = this.playerH
        if (!e) return // broke on a monster in mid-air: no mark
        const top = e.t
        const w = Math.min(H * 1.4, e.floor ? H * 1.4 : e.r - e.l)
        const cx = e.floor ? x : Math.max(e.l + w / 2, Math.min(e.r - w / 2, x))
        this.addDecal(cx, top + 3, w * 0.85, Math.max(12, H * 0.16), 'game-decal--coffee', rand(-4, 4), e)
        // a few splashes on the block's face
        for (let i = 0; i < 3; i++) {
            const s = H * rand(0.06, 0.12)
            this.addDecal(cx + rand(-w * 0.45, w * 0.45), top + rand(6, 28), s, s, 'game-decal--drop', 0, e)
        }
        this.puddles = this.puddles || []
        this.puddles.push({x: cx, top, w: w * 0.85, t: 7, e})
    },

    // ---------------------------------------------------------------- stomp cracks (Growth)
    // a crack in whatever the hero stands on (stone ledges and the floor too); it fades after a while
    crackAt(x, top, size, e) {
        // drawn in the 3D scene (on top of the stone ledges, which a DOM decal would sit under)
        if (!this.crackTex) this.crackTex = this.makeCrackTexture()
        this.stompCracks = this.stompCracks || []
        const mat = new THREE.MeshBasicMaterial({map: this.crackTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false})
        const m = new THREE.Mesh(this.uiGeo ? this.uiGeo.plane : new THREE.PlaneGeometry(1, 1), mat)
        m.scale.set(size, size * 0.42, 1)
        m.position.set(x, -(top + size * 0.1), 84)
        m.rotation.z = rand(-0.2, 0.2)
        m.renderOrder = 9
        this.scene.add(m)
        this.stompCracks.push({m, t: 2.6})
        if (this.stompCracks.length > 24) {
            const old = this.stompCracks.shift()
            this.scene.remove(old.m)
            old.m.material.dispose()
        }
        // plain page blocks really crack a little
        if (e && !e.floor && !e.stone) this.damageElement(e, 0.12, x, top + 4, false, true)
    },

    // ---------------------------------------------------------------- lightning
    scorchBolt(x, y) {
        const e = this.surfaceAt(x, y)
        if (!e) return
        const H = this.playerH
        this.addDecal(x, e.t + 3, H * 0.9, Math.max(14, H * 0.2), 'game-decal--bolt', rand(-8, 8), e)
    },

    updateSiteFx(dt) {
        if (this.stompCracks && this.stompCracks.length) {
            for (const k of this.stompCracks) {
                k.t -= dt
                k.m.material.opacity = Math.min(1, k.t / 0.8)
            }
            this.stompCracks = this.stompCracks.filter(k => {
                if (k.t > 0) return true
                this.scene.remove(k.m)
                k.m.material.dispose()
                return false
            })
        }
        // marks go away with the block they were on
        this.decalCheck = (this.decalCheck || 0) - dt
        if (this.decalCheck <= 0 && this.decals && this.decals.length) {
            this.decalCheck = 0.3
            this.decals = this.decals.filter(n => {
                if (!n._surface || n._surface.floor || !n._surface.broken) return true
                n.remove()
                return false
            })
        }
        if (this.groundFires && this.groundFires.length) {
            for (const f of this.groundFires) {
                f.t -= dt
                if (f.e && !f.e.floor && f.e.broken) f.t = 0
                // flames dancing along the burning stretch
                const n = this.lowFx ? 2 : 4
                for (let i = 0; i < n; i++) {
                    if (Math.random() > dt * 30) continue
                    const px = f.x + rand(-f.w / 2, f.w / 2)
                    this.spray(1, px, f.top - 2, Math.random() < 0.5 ? 0xff7a1a : 0xfde047, () => [rand(-25, 25), -rand(120, 260)], [0.25, 0.5], 0)
                    if (Math.random() < 0.15) this.spray(1, px, f.top - 10, 0x44403c, () => [rand(-20, 20), -rand(50, 110)], [0.7, 1.1], 0)
                }
                f.tick -= dt
                if (f.tick <= 0) {
                    f.tick = 0.5
                    // the block itself burns down
                    if (f.e && !f.e.floor) this.damageElement(f.e, 0.25, f.x + rand(-f.w / 3, f.w / 3), f.top + 6, false, true)
                }
            }
            this.groundFires = this.groundFires.filter(f => f.t > 0)
        }
        if (this.puddles && this.puddles.length) {
            for (const q of this.puddles) {
                q.t -= dt
                if (q.e && !q.e.floor && q.e.broken) q.t = 0
                if (Math.random() < dt * 4) this.spray(1, q.x + rand(-q.w / 2, q.w / 2), q.top - 4, 0xe7e5e4, () => [rand(-10, 10), -rand(30, 70)], [0.6, 1], 0)
            }
            this.puddles = this.puddles.filter(q => q.t > 0)
        }
    },

    makeCrackTexture() {
        const c = document.createElement('canvas')
        c.width = 256
        c.height = 108
        const x = c.getContext('2d')
        const line = (pts, w, color) => {
            x.beginPath()
            x.moveTo(pts[0][0], pts[0][1])
            for (const [px, py] of pts.slice(1)) x.lineTo(px, py)
            x.lineWidth = w
            x.strokeStyle = color
            x.lineCap = 'round'
            x.lineJoin = 'round'
            x.stroke()
        }
        const S = [256 / 100, 108 / 40]
        const paths = [
            [[50, 4], [46, 12], [52, 18], [44, 26], [48, 36]],
            [[47, 12], [34, 10], [24, 16], [12, 14]],
            [[52, 18], [64, 15], [72, 21], [88, 19]],
            [[44, 26], [32, 30], [22, 28]],
            [[51, 18], [58, 28], [68, 31]],
        ].map(p => p.map(([a, b]) => [a * S[0], b * S[1]]))
        // a dark split with a bright, slightly glowing edge — readable on the dark page and on stone
        for (const p of paths) line(p, 9, 'rgba(255,210,150,0.18)')
        for (const p of paths) line(p, 5, 'rgba(0,0,0,0.9)')
        for (const p of paths) line(p.map(([a, b]) => [a + 2, b - 2]), 2.5, 'rgba(255,236,210,0.7)')
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        return t
    },

    clearSiteFx() {
        for (const k of this.stompCracks || []) {
            this.scene.remove(k.m)
            k.m.material.dispose()
        }
        this.stompCracks = []
        for (const n of this.decals || []) n.remove()
        this.decals = []
        this.groundFires = []
        this.puddles = []
    },
}
