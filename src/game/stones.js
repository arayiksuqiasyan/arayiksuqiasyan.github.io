// Stone ledges generated into the empty parts of the page so the knight always has somewhere to land.
// They are solid (never break) and often carry a heart or an ammo magazine.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {clamp, ease, rand} from './util';

const BAND = 170
const MIN_GAP = 280
const MIN_EDGE_GAP = 150 // narrow strips at the screen edges still get ledges
const STONE_H = 30
const MAX_STONES = 70
// extra room added under the page while playing, so the ground sits above the bottom UI
export const GROUND_SPACE = 200
export const GROUND_OFFSET = 40 // ground top, below the end of the page

function stoneTexture() {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 96
    const g = c.getContext('2d')
    g.fillStyle = '#353b44'
    g.fillRect(0, 0, 256, 96)
    // mottled rock
    for (let i = 0; i < 900; i++) {
        const v = 40 + Math.random() * 40
        g.fillStyle = `rgba(${v},${v + 4},${v + 10},${Math.random() * 0.5})`
        const r = Math.random() * 6 + 1
        g.beginPath()
        g.arc(Math.random() * 256, Math.random() * 96, r, 0, Math.PI * 2)
        g.fill()
    }
    // brick seams
    g.strokeStyle = 'rgba(10,12,16,0.75)'
    g.lineWidth = 3
    for (let x = 0; x <= 256; x += 64) {
        g.beginPath()
        g.moveTo(x + rand(-4, 4), 0)
        g.lineTo(x + rand(-4, 4), 96)
        g.stroke()
    }
    // hairline cracks
    g.strokeStyle = 'rgba(15,18,22,0.6)'
    g.lineWidth = 1.2
    for (let i = 0; i < 6; i++) {
        let x = Math.random() * 256
        let y = Math.random() * 96
        g.beginPath()
        g.moveTo(x, y)
        for (let s = 0; s < 4; s++) {
            x += rand(-18, 18)
            y += rand(-10, 10)
            g.lineTo(x, y)
        }
        g.stroke()
    }
    // light top edge
    const grad = g.createLinearGradient(0, 0, 0, 20)
    grad.addColorStop(0, 'rgba(200,215,225,0.35)')
    grad.addColorStop(1, 'rgba(200,215,225,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 20)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    return tex
}

const overlaps = (a, b, pad) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad

export const stoneMethods = {
    buildStoneKit() {
        this.stoneTex = stoneTexture()
        this.stoneGlow = new THREE.MeshBasicMaterial({color: 0x14e956, toneMapped: false})
        this.stones = []
    },

    clearStones() {
        for (const s of this.stones) {
            this.scene.remove(s.mesh)
            s.mesh.traverse(o => {
                if (o.geometry && o.geometry !== this.geo.box) o.geometry.dispose()
                if (o.material && o.material !== this.stoneGlow) {
                    if (o.material.map) o.material.map.dispose()
                    o.material.dispose()
                }
            })
        }
        this.stones = []
    },

    generateStones() {
        this.clearStones()
        const vw = this.vw
        const occupied = this.elements.filter(e => e.w > 0).map(e => ({l: e.l, r: e.r, t: e.t, b: e.b}))
        // keep the start area clear and stay below the fixed HUD at the top of the page
        occupied.push({l: 0, r: vw, t: -200, b: 120})
        const stones = []
        for (let y = 320; y < this.docH - 140 && stones.length < MAX_STONES; y += BAND) {
            const tops = [...this.elements.filter(e => !e.broken && e.ok), ...stones]
                .filter(e => e.t > y - BAND - 30 && e.t <= y + 10)
                .map(e => [e.l, e.r])
                .sort((a, b) => a[0] - b[0])
            const gaps = []
            let cursor = 8
            for (const [l, r] of tops) {
                if (l > cursor) gaps.push([cursor, l])
                cursor = Math.max(cursor, r)
            }
            if (cursor < vw - 8) gaps.push([cursor, vw - 8])
            for (const [g0, g1] of gaps) {
                const gw = g1 - g0
                const edge = g0 <= 8 || g1 >= vw - 8
                if (gw < (edge ? MIN_EDGE_GAP : MIN_GAP)) continue
                const count = gw > 760 ? 2 : 1
                const seg = gw / count
                for (let i = 0; i < count; i++) {
                    let w = clamp(seg * rand(0.45, 0.62), 96, 240)
                    let x = g0 + i * seg + (seg - w) / 2 + rand(-0.2, 0.2) * (seg - w)
                    // edge strips: hug the screen border and leave a clear margin to the content
                    if (edge && count === 1) {
                        w = clamp(gw - 40, 96, 200)
                        x = g0 <= 8 ? 8 : vw - 8 - w
                    }
                    const t = y - rand(30, 140)
                    const rect = {l: x, r: x + w, t, b: t + STONE_H}
                    if (occupied.some(o => overlaps(rect, o, 22)) || stones.some(o => overlaps(rect, o, 50))) continue
                    stones.push({stone: true, ok: true, broken: false, ...rect, w, h: STONE_H})
                }
            }
        }
        stones.forEach((s, i) => this.addStoneMesh(s, i))
        this.stones = stones
        // loot on the ledges
        for (const s of stones) {
            const r = Math.random()
            const kind = r < 0.05 ? 'heart' : r < 0.15 ? 'ammo' : r < 0.21 ? 'armor' : null
            if (kind) this.placeToken(rand(s.l + 24, s.r - 24), s, kind)
        }
    },

    addStoneMesh(s, i) {
        const depth = 64
        const geo = new RoundedBoxGeometry(s.w, s.h, depth, 2, 7)
        const tex = this.stoneTex.clone()
        tex.needsUpdate = true
        tex.repeat.set(s.w / 150, 1)
        const mat = new THREE.MeshStandardMaterial({map: tex, bumpMap: tex, bumpScale: 2.5, roughness: 0.92, metalness: 0.05})
        const group = new THREE.Group()
        const block = new THREE.Mesh(geo, mat)
        // neon rune line along the front edge, in the site's green
        const glow = new THREE.Mesh(this.geo.box, this.stoneGlow)
        glow.scale.set(s.w - 18, 2.2, 2)
        glow.position.set(0, s.h / 2 - 5, depth / 2 + 1)
        group.add(block, glow)
        group.rotation.x = 0.34
        group.position.set(s.l + s.w / 2, -(s.t + s.h / 2), -20)
        group.scale.setScalar(0.001)
        this.scene.add(group)
        s.mesh = group
        s.appear = -i * 0.025
    },

    // a solid stone ground across the whole width at the very bottom of the level
    updateGround() {
        const w = this.vw + 80
        if (!this.ground || this.ground.w !== w) {
            if (this.ground) this.scene.remove(this.ground.mesh)
            const depth = 90
            const h = 110
            const tex = this.stoneTex.clone()
            tex.needsUpdate = true
            tex.repeat.set(w / 160, 1)
            const block = new THREE.Mesh(
                new RoundedBoxGeometry(w, h, depth, 2, 10),
                new THREE.MeshStandardMaterial({map: tex, bumpMap: tex, bumpScale: 3, roughness: 0.95, metalness: 0.04}),
            )
            const glow = new THREE.Mesh(this.geo.box, this.stoneGlow)
            glow.scale.set(w, 3, 2)
            glow.position.set(0, h / 2 - 3, depth / 2 + 1)
            const group = new THREE.Group()
            group.add(block, glow)
            group.rotation.x = 0.3
            this.scene.add(group)
            this.ground = {mesh: group, w, h}
        }
        this.ground.mesh.position.set(this.vw / 2, -(this.floor.t + this.ground.h / 2 - 4), -30)
    },

    updateStones(dt) {
        for (const s of this.stones) {
            if (s.appear >= 1) continue
            s.appear = Math.min(1, s.appear + dt * 2.6)
            const k = s.appear > 0 ? ease(s.appear) : 0
            s.mesh.scale.set(1, Math.max(0.001, k), 1)
            s.mesh.position.y = -(s.t + s.h / 2) - (1 - k) * 18
        }
    },
}
