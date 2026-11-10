// Non-bug enemies: Glitch Bat (flies & dives), Jelly Slime (bounces, splits), Sentinel (shoots orbs).
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp, ease, ENEMY_TYPES, rand} from './util';

export const creatureMethods = {
    buildCreatureKit() {
        const side = THREE.DoubleSide
        this.cMats = {
            batBody: new THREE.MeshStandardMaterial({color: 0x161b2e, roughness: 0.45, metalness: 0.2}),
            batWing: new THREE.MeshStandardMaterial({
                color: 0x1e293b, roughness: 0.6, emissive: 0x0891b2, emissiveIntensity: 0.45, side,
            }),
            batEye: new THREE.MeshStandardMaterial({color: 0xe0fbff, emissive: 0x22d3ee, emissiveIntensity: 2.4}),
            pupil: new THREE.MeshBasicMaterial({color: 0x050505}),
            slime: new THREE.MeshStandardMaterial({
                color: 0x2dd4bf, roughness: 0.12, transparent: true, opacity: 0.8,
                emissive: 0x0f766e, emissiveIntensity: 0.6,
            }),
            slimeCore: new THREE.MeshStandardMaterial({color: 0xccfbf1, emissive: 0x5eead4, emissiveIntensity: 1.4}),
            eyeWhite: new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.3}),
            metal: new THREE.MeshStandardMaterial({color: 0xb6c2d1, roughness: 0.32, metalness: 0.55, emissive: 0x1e293b, emissiveIntensity: 0.6}),
            metalDark: new THREE.MeshStandardMaterial({color: 0x3b4656, roughness: 0.45, metalness: 0.5}),
            visor: new THREE.MeshStandardMaterial({color: 0xff2d55, emissive: 0xff2d55, emissiveIntensity: 2}),
        }
        // bat wing membrane in the xy plane, spreading backwards (-x) and up from the shoulder
        const s = new THREE.Shape()
        s.moveTo(0, 0)
        s.lineTo(-0.12, 0.6)
        s.quadraticCurveTo(-0.3, 0.44, -0.42, 0.52)
        s.quadraticCurveTo(-0.5, 0.3, -0.66, 0.32)
        s.quadraticCurveTo(-0.46, 0.06, -0.18, -0.06)
        s.lineTo(0, 0)
        this.geo.wing = new THREE.ShapeGeometry(s, 8)
        this.geo.cone = new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0)
    },

    buildEnemy(type) {
        const T = ENEMY_TYPES[type]
        if (T.model && this.monsterModels && this.monsterModels[T.model]) return this.buildModelEnemy(type)
        const kind = T.boss ? null : T.kind
        if (kind === 'bat') return this.buildBat(type)
        if (kind === 'slime') return this.buildSlime(type)
        if (kind === 'sentinel') return this.buildSentinel(type)
        return this.buildBug(type)
    },

    rig(tiltX) {
        const root = new THREE.Group()
        const tilt = new THREE.Group()
        const face = new THREE.Group()
        root.add(tilt)
        tilt.add(face)
        tilt.rotation.x = tiltX
        return {root, tilt, face}
    },

    buildBat(type) {
        const M = this.cMats
        const G = this.geo
        const {root, tilt, face} = this.rig(0.28)
        const body = new THREE.Mesh(G.sphere, M.batBody)
        body.scale.set(0.3, 0.27, 0.27)
        body.position.set(0, 0.5, 0)
        const eye = new THREE.Mesh(G.sphere, M.batEye)
        eye.scale.setScalar(0.16)
        eye.position.set(0.15, 0.54, 0.1)
        const pupil = new THREE.Mesh(G.sphere, M.pupil)
        pupil.scale.setScalar(0.075)
        pupil.position.set(0.27, 0.55, 0.15)
        face.add(body, eye, pupil)
        for (const z of [-0.1, 0.1]) {
            const ear = new THREE.Mesh(G.cone, M.batBody)
            ear.scale.set(0.07, 0.22, 0.07)
            ear.position.set(-0.02, 0.7, z)
            ear.rotation.z = 0.25
            face.add(ear)
        }
        // tiny fangs
        for (const z of [-0.05, 0.05]) {
            const fang = new THREE.Mesh(G.cone, M.eyeWhite)
            fang.scale.set(0.025, 0.07, 0.025)
            fang.position.set(0.22, 0.4, z)
            fang.rotation.z = Math.PI
            face.add(fang)
        }
        const wings = []
        for (const s of [-1, 1]) {
            const pivot = new THREE.Group()
            pivot.position.set(-0.02, 0.58, s * 0.12)
            const w = new THREE.Mesh(G.wing, M.batWing)
            w.scale.set(1.3, 1.3, 1)
            pivot.add(w)
            face.add(pivot)
            wings.push({pivot, side: s})
        }
        root.scale.setScalar(ENEMY_TYPES[type].size)
        this.scene.add(root)
        return {root, tilt, face, body, legs: [], wings, side: Math.random() < 0.5 ? -1 : 1, diveCd: rand(1, 2.2), t: 0}
    },

    buildSlime(type) {
        const M = this.cMats
        const G = this.geo
        const {root, tilt, face} = this.rig(0.35)
        const core = new THREE.Mesh(G.sphere, M.slimeCore)
        core.scale.setScalar(0.13)
        core.position.set(-0.06, 0.36, 0)
        const body = new THREE.Mesh(G.sphere, M.slime)
        body.scale.set(0.5, 0.42, 0.46)
        body.position.set(0, 0.42, 0)
        body.renderOrder = 2
        face.add(core, body)
        for (const z of [-0.14, 0.14]) {
            const eye = new THREE.Mesh(G.sphere, M.eyeWhite)
            eye.scale.setScalar(0.105)
            eye.position.set(0.3, 0.56, z)
            const pupil = new THREE.Mesh(G.sphere, M.pupil)
            pupil.scale.setScalar(0.05)
            pupil.position.set(0.39, 0.57, z * 1.08)
            face.add(eye, pupil)
        }
        root.scale.setScalar(ENEMY_TYPES[type].size)
        this.scene.add(root)
        return {root, tilt, face, body, legs: [], squash: 0}
    },

    buildSentinel(type) {
        const M = this.cMats
        const G = this.geo
        const {root, tilt, face} = this.rig(0.3)
        const body = new THREE.Mesh(G.box, M.metal)
        body.scale.set(0.6, 0.4, 0.48)
        body.position.set(0, 0.42, 0)
        const head = new THREE.Mesh(G.sphere, M.metalDark)
        head.scale.set(0.26, 0.2, 0.26)
        head.position.set(0, 0.68, 0)
        const visor = new THREE.Mesh(G.box, M.visor.clone())
        visor.scale.set(0.16, 0.06, 0.3)
        visor.position.set(0.17, 0.7, 0)
        const antenna = new THREE.Mesh(G.cyl, M.metalDark)
        antenna.scale.set(0.015, 0.18, 0.015)
        antenna.position.set(-0.08, 0.92, 0)
        const tip = new THREE.Mesh(G.sphere, visor.material)
        tip.scale.setScalar(0.04)
        tip.position.set(-0.08, 1.02, 0)
        face.add(body, head, visor, antenna, tip)
        const legs = []
        for (const [x, phase] of [[-0.18, 0], [0.18, Math.PI]]) {
            const pivot = new THREE.Group()
            pivot.position.set(x, 0.24, 0)
            const leg = new THREE.Mesh(G.box, M.metalDark)
            leg.scale.set(0.12, 0.24, 0.14)
            leg.position.y = -0.12
            pivot.add(leg)
            face.add(pivot)
            legs.push({pivot, phase})
        }
        // shoulder cannon on the near side
        const cannon = new THREE.Group()
        cannon.position.set(0.12, 0.48, 0.3)
        const barrel = new THREE.Mesh(G.cyl, M.metalDark)
        barrel.scale.set(0.07, 0.4, 0.07)
        barrel.rotation.z = -Math.PI / 2
        barrel.position.x = 0.2
        const muzzle = new THREE.Mesh(G.sphere, visor.material)
        muzzle.scale.setScalar(0.06)
        muzzle.position.x = 0.41
        cannon.add(barrel, muzzle)
        face.add(cannon)
        root.scale.setScalar(ENEMY_TYPES[type].size)
        this.scene.add(root)
        return {root, tilt, face, body, legs, cannon, visor, fireT: rand(1, 2), charging: 0}
    },

    // ---------------------------------------------------------------- brains
    updateBat(b, dt) {
        const p = this.player
        b.t += dt
        if (b.state === 'dive') {
            b.diveT += dt
            if (b.diveT > 0.75) {
                b.state = 'hover'
                b.diveCd = rand(1.4, 2.6)
            }
        } else {
            b.state = 'hover'
            if (Math.random() < dt * 0.25) b.side *= -1
            // in a calm the bee drifts around its own spot instead of following you
            const passive = this.isPassive && this.isPassive(b)
            const tx = passive ? (b.homeX || b.x) + Math.sin(b.t * 0.7) * 120 : p.x + b.side * 170
            const ty = passive ? (b.homeY || b.y) + Math.sin(b.t * 1.3) * 40 : p.y - this.playerH - 40 + Math.sin(b.t * 2.2) * 35
            const k = Math.min(1, dt * 2.5)
            b.vx += ((tx - b.x) * 2.4 - b.vx) * k
            b.vy += ((ty - b.y) * 2.4 - b.vy) * k
            const sp = Math.hypot(b.vx, b.vy)
            const max = b.speed * 2
            if (sp > max) {
                b.vx *= max / sp
                b.vy *= max / sp
            }
            b.diveCd -= dt
            const dx = p.x - b.x
            const dy = p.y - this.playerH * 0.4 - b.y
            const dist = Math.hypot(dx, dy) || 1
            if (b.diveCd <= 0 && dist < 460 && this.canTarget() && !passive) {
                b.state = 'dive'
                b.diveT = 0
                b.vx = (dx / dist) * 640
                b.vy = (dy / dist) * 640
            }
        }
        b.x = clamp(b.x + b.vx * dt, 20, this.vw - 20)
        b.y += b.vy * dt
        b.dir = Math.sign(p.x - b.x) || b.dir
    },

    slimeBrain(b, dt, dx) {
        b.vx *= Math.max(0, 1 - dt * 10)
        b.hopTimer -= dt
        if (b.hopTimer <= 0) {
            b.hopTimer = rand(0.45, 1.0)
            b.dir = Math.sign(dx) || b.dir
            b.vy = -rand(620, 860)
            b.vx = b.dir * rand(160, 260)
            b.onGround = false
            b.squash = 0.6
        }
    },

    sentinelBrain(b, dt, dx, dy) {
        const g = b.ground
        b.dir = Math.sign(dx) || b.dir
        const far = Math.abs(dx) > 520
        b.vx = far && !b.charging ? b.dir * b.speed : 0
        if (g && !g.floor && (b.x + b.vx * dt > g.r - 10 || b.x + b.vx * dt < g.l + 10)) b.vx = 0
        b.fireT -= dt
        if (!b.charging && b.fireT <= 0 && Math.abs(dy) < 300 && Math.abs(dx) < 760 && this.canTarget() && !this.isPassive(b)) {
            b.charging = 0.45
        }
        if (b.charging > 0) {
            b.charging -= dt
            if (b.charging <= 0) {
                b.charging = 0
                b.fireT = rand(1.5, 2.4)
                const ox = b.x + b.dir * b.size * 0.55
                const oy = b.y - b.size * 0.48
                this.fireOrb(ox, oy, this.player.x, this.player.y - this.playerH * 0.55)
                if (b.model) this.enemyGesture(b, 'attack')
            }
        }
    },

    // ---------------------------------------------------------------- poses
    poseCreature(b) {
        const kind = ENEMY_TYPES[b.type].kind
        if (!kind || ENEMY_TYPES[b.type].boss) return false
        const k = b.appear < 1 ? ease(b.appear) : 1
        b.root.position.set(b.x, -b.y, 30)
        const want = b.dir > 0 ? -0.3 : Math.PI + 0.3
        b.face.rotation.y += (want - b.face.rotation.y) * 0.2
        b.body.material = b.flash > 0 ? this.mats.hit : b.baseMat
        if (kind === 'bat') {
            b.root.scale.setScalar(b.size * k)
            const f = Math.sin(this.time * 22 + b.walk)
            for (const w of b.wings) {
                w.pivot.rotation.x = w.side * f * 0.95
                w.pivot.rotation.z = f * 0.3
            }
            b.root.rotation.z = b.state === 'dive'
                ? clamp(-b.vy / 900, -0.7, 0.7) * b.dir
                : Math.sin(this.time * 3 + b.walk) * 0.12
        } else if (kind === 'slime') {
            if (b.onGround) b.squash = Math.max(0, b.squash - 0.06)
            const air = b.onGround ? 0 : clamp(-b.vy / 1700, -0.25, 0.32)
            const sy = 1 - b.squash * 0.35 + air
            const sx = 1 + b.squash * 0.3 - air * 0.45
            const wob = 1 + Math.sin(this.time * 9 + b.walk) * 0.025
            b.root.scale.set(b.size * k * sx * wob, b.size * k * sy / wob, b.size * k * sx)
        } else if (kind === 'sentinel') {
            b.root.scale.setScalar(b.size * k)
            for (const L of b.legs) L.pivot.rotation.z = Math.abs(b.vx) > 5 ? Math.sin(b.walk * 1.4 + L.phase) * 0.5 : 0
            const p = this.player
            const oy = b.y - b.size * 0.48
            const ang = Math.atan2(oy - (p.y - this.playerH * 0.55), Math.abs(p.x - b.x) + 1)
            b.cannon.rotation.z = clamp(ang, -0.9, 0.9)
            const charge = b.charging > 0 ? 1 - b.charging / 0.45 : 0
            b.visor.material.emissiveIntensity = 2 + charge * 8
            b.body.position.y = 0.42 - charge * 0.03
        }
        return true
    },
}
