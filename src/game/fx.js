// Game "juice": hit-stop, impact rings, blade trail, landing/running dust, floating embers, coin fly-ups.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp, rand} from './util';
import {MELEE_LENGTH} from './melee';

const TRAIL_N = 14
const TRAIL_ON = false
const EMBERS = 90

export const fxMethods = {
    buildFxKit() {
        this.rings = []
        this.freezeT = 0
        // blade trail: a triangle strip between the blade tip and its middle, fading towards the tail
        const pos = new Float32Array(TRAIL_N * 2 * 3)
        const col = new Float32Array(TRAIL_N * 2 * 3)
        const idx = []
        for (let i = 0; i < TRAIL_N - 1; i++) {
            const o = i * 2
            idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        g.setIndex(idx)
        this.trail = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            depthTest: false, depthWrite: false, toneMapped: false,
        }))
        this.trail.frustumCulled = false
        this.trail.renderOrder = 11
        this.scene.add(this.trail)
        this.trailPts = []
        this.trailColor = new THREE.Color()

        // floating embers in the air (screen-space, with a little parallax)
        const ep = new Float32Array(EMBERS * 3)
        const ec = new Float32Array(EMBERS * 3)
        this.embers = Array.from({length: EMBERS}, () => ({
            x: Math.random(), y: Math.random(), vx: rand(-0.004, 0.004), vy: rand(-0.02, -0.006),
            depth: rand(0.3, 1), tw: rand(0, 6), hue: Math.random(),
        }))
        const eg = new THREE.BufferGeometry()
        eg.setAttribute('position', new THREE.BufferAttribute(ep, 3))
        eg.setAttribute('color', new THREE.BufferAttribute(ec, 3))
        this.emberPoints = new THREE.Points(eg, new THREE.PointsMaterial({
            size: 5, map: this.dotTex, vertexColors: true, transparent: true, depthTest: false, depthWrite: false,
            blending: THREE.AdditiveBlending, sizeAttenuation: false, toneMapped: false,
        }))
        this.emberPoints.frustumCulled = false
        this.emberPoints.renderOrder = -1
        // switched off: the drifting, twinkling dots distracted from the fight
        this.emberPoints.visible = false
        this.scene.add(this.emberPoints)
    },

    // freeze the world for a few frames on heavy impacts
    hitStop(ms) {
        this.freezeT = Math.max(this.freezeT, ms / 1000)
    },

    ring(x, y, color, radius, dur = 0.3, width = 0.86) {
        if (this.lowFx && this.rings.length > 10) return
        // ring geometries are shared per thickness
        this.ringGeos = this.ringGeos || {}
        const key = width.toFixed(2)
        const geo = this.ringGeos[key] || (this.ringGeos[key] = new THREE.RingGeometry(width, 1, 40))
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            depthTest: false, depthWrite: false, toneMapped: false,
        }))
        mesh.position.set(x, -y, 75)
        mesh.renderOrder = 12
        this.scene.add(mesh)
        this.rings.push({mesh, t: 0, dur, radius})
    },

    // a soft round burst of light (no hard ring): bright core that swells and fades fast
    flash(x, y, color, radius, dur = 0.22) {
        if (this.lowFx && this.rings.length > 10) return
        if (!this.flashGeo) this.flashGeo = new THREE.PlaneGeometry(2, 2)
        const mesh = new THREE.Mesh(this.flashGeo, new THREE.MeshBasicMaterial({
            map: this.dotTex, color, transparent: true, blending: THREE.AdditiveBlending,
            depthTest: false, depthWrite: false, toneMapped: false,
        }))
        mesh.position.set(x, -y, 76)
        mesh.renderOrder = 12
        this.scene.add(mesh)
        this.rings.push({mesh, t: 0, dur, radius, soft: true})
    },

    dust(x, y, n, spread = 60) {
        for (let i = 0; i < n; i++) {
            const q = this.particles[this.pIndex]
            this.pIndex = (this.pIndex + 1) % this.particles.length
            q.grav = 1
            q.x = x + rand(-spread * 0.3, spread * 0.3)
            q.y = y - 2
            q.vx = rand(-spread, spread)
            q.vy = -rand(40, 140)
            q.life = q.max = rand(0.3, 0.6)
            const c = this.tmpColor.set(0x6b7f78)
            q.r = c.r * 0.55
            q.g = c.g * 0.55
            q.b = c.b * 0.55
        }
    },

    // a little coin icon flies from the kill to the coin counter in the HUD
    coinFly(x, y, n) {
        const target = document.querySelector('.game-coins')
        if (!target || !this.fx) return
        const tr = target.getBoundingClientRect()
        const sx = x
        const sy = y - window.scrollY
        const ui = document.querySelector('.game-ui')
        if (!ui) return
        const count = Math.min(3, Math.max(1, Math.round(n / 15)))
        for (let i = 0; i < count; i++) {
            const c = document.createElement('i')
            c.className = 'game-coin-fly'
            c.style.left = sx + 'px'
            c.style.top = sy + 'px'
            ui.appendChild(c)
            const dx = tr.left + 10 - sx
            const dy = tr.top + 8 - sy
            const a = c.animate([
                {transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0},
                {transform: `translate(calc(-50% + ${rand(-40, 40)}px), calc(-50% - ${rand(30, 70)}px)) scale(1.1)`, opacity: 1, offset: 0.3},
                {transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`, opacity: 0.9},
            ], {duration: 650 + i * 90, easing: 'cubic-bezier(.5,0,.6,1)'})
            a.onfinish = () => {
                c.remove()
                target.classList.remove('is-bump')
                void target.offsetWidth
                target.classList.add('is-bump')
            }
        }
    },

    // world-space blade points (tip and middle) for the trail
    bladePoints() {
        if (!this.sword) return null
        const inner = this.sword.userData.inner
        const model = inner && inner.children[0]
        if (!model) return null
        if (!this._tip) {
            this._tip = new THREE.Vector3()
            this._mid = new THREE.Vector3()
        }
        const len = MELEE_LENGTH[this.progress.melee] || 1.2
        this._tip.set(0, len, 0)
        this._mid.set(0, len * 0.45, 0)
        model.localToWorld(this._tip)
        model.localToWorld(this._mid)
        return [this._tip, this._mid]
    },

    updateFx(dt) {
        // blade trail is switched off (it smeared over the real weapon models); swing styles do the job
        const p = this.player
        const swinging = TRAIL_ON && p && p.attack && !p.dead
        if (swinging) {
            const pts = this.bladePoints()
            if (pts) {
                this.trailPts.unshift([pts[0].x, pts[0].y, pts[1].x, pts[1].y])
                if (this.trailPts.length > TRAIL_N) this.trailPts.length = TRAIL_N
            }
        } else if (this.trailPts.length) {
            this.trailPts.pop()
            if (this.trailPts.length) this.trailPts.pop()
        }
        const glow = this.meleeColor()
        this.trailColor.setHex(glow)
        const P = this.trail.geometry.attributes.position.array
        const C = this.trail.geometry.attributes.color.array
        const n = this.trailPts.length
        for (let i = 0; i < TRAIL_N; i++) {
            const q = this.trailPts[Math.min(i, n - 1)]
            const k = n ? Math.pow(1 - i / TRAIL_N, 1.6) : 0
            const o = i * 6
            if (q) {
                P[o] = q[0]; P[o + 1] = q[1]; P[o + 2] = 65
                P[o + 3] = q[2]; P[o + 4] = q[3]; P[o + 5] = 65
            }
            const tip = i < n ? k : 0
            C[o] = (0.6 + this.trailColor.r * 0.4) * tip
            C[o + 1] = (0.6 + this.trailColor.g * 0.4) * tip
            C[o + 2] = (0.6 + this.trailColor.b * 0.4) * tip
            C[o + 3] = this.trailColor.r * tip * 0.25
            C[o + 4] = this.trailColor.g * tip * 0.25
            C[o + 5] = this.trailColor.b * tip * 0.25
        }
        this.trail.geometry.attributes.position.needsUpdate = true
        this.trail.geometry.attributes.color.needsUpdate = true
        this.trail.visible = n > 1

        // impact rings
        for (const r of this.rings) {
            r.t += dt
            const k = clamp(r.t / r.dur, 0, 1)
            const s = r.soft
                ? r.radius * (0.45 + (1 - Math.pow(1 - k, 2)) * 0.55)
                : r.radius * (0.25 + (1 - Math.pow(1 - k, 3)) * 0.75)
            r.mesh.scale.set(s, s, 1)
            r.mesh.material.opacity = r.soft ? Math.pow(1 - k, 1.6) : 1 - k
        }
        this.rings = this.rings.filter(r => {
            if (r.t < r.dur) return true
            this.scene.remove(r.mesh)
            r.mesh.material.dispose()
            return false
        })

        // running dust
        if (p && p.onGround && Math.abs(p.vx) > 200 && Math.random() < dt * 14) this.dust(p.x - p.facing * 10, p.y, 2, 40)

        // embers: slow drift, wrap around the viewport, slight parallax against the scroll
        if (!this.emberPoints.visible) return
        const E = this.emberPoints.geometry.attributes.position.array
        const EC = this.emberPoints.geometry.attributes.color.array
        const sy = window.scrollY
        this.embers.forEach((e, i) => {
            e.x = (e.x + e.vx * dt + 1) % 1
            e.y = (e.y + e.vy * dt + 1) % 1
            e.tw += dt * 2.4
            const py = ((e.y * this.vh - sy * 0.15 * e.depth) % this.vh + this.vh) % this.vh
            E[i * 3] = e.x * this.vw
            E[i * 3 + 1] = -(sy + py)
            E[i * 3 + 2] = -60
            const b = (0.35 + Math.sin(e.tw) * 0.25) * e.depth
            const c = this.tmpColor.set(e.hue < 0.7 ? (this.theme ? this.theme.accent : 0x14e956) : (this.theme ? this.theme.accent2 : 0x22d3ee))
            EC[i * 3] = c.r * b
            EC[i * 3 + 1] = c.g * b
            EC[i * 3 + 2] = c.b * b
        })
        this.emberPoints.geometry.attributes.position.needsUpdate = true
        this.emberPoints.geometry.attributes.color.needsUpdate = true
    },
}
