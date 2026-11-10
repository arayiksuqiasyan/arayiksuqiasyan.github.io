// A different Super Strike for every melee weapon (the meter charges the same way for all of them).
// superStyle() does the damage and the show; the sword keeps the classic shockwave (in engine.superBlast).
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {rand} from './util';

export const SUPER_NAMES = {
    sword: 'SHOCKWAVE', axe: 'EARTHSPLITTER', katana: 'THOUSAND CUTS', hammer: 'THUNDERSTORM', scythe: 'HARVEST',
    pickaxe: 'CAVE-IN', torch: 'INFERNO', knife: 'SHADOW FLURRY', mug: 'COFFEE FLOOD',
}

export const superMethods = {
    // returns false for the sword (the engine draws the classic shockwave itself)
    superStyle(id, S) {
        const {cx, cy, R, targets, dmgFor} = S
        const p = this.player
        const H = this.playerH
        const later = (ms, fn) => setTimeout(() => { if (!this.disposed && this.player && !this.player.dead) fn() }, ms)
        const hit = (b, mul = 1, dir) => {
            if (!b.dead) this.damageBug(b, dmgFor(b) * mul, dir || Math.sign(b.x - cx) || 1, true)
        }
        switch (id) {
            case 'axe': {
                // a giant chop: a burning fissure races along the ground both ways
                const gy = p.y
                this.flash(cx, gy, 0xffb36b, H, 0.3)
                for (let step = 1; step <= 7; step++) {
                    later(step * 45, () => {
                        for (const s of [-1, 1]) {
                            const x = cx + s * step * (R / 7)
                            this.flash(x, gy - 10, 0xff6a00, H * 0.5, 0.25)
                            this.spray(5, x, gy, 0xff7a1a, () => [rand(-40, 40), -rand(220, 420)], [0.3, 0.5], 0.15)
                            this.crackAt && this.crackAt(x, gy, H * 0.7, p.ground)
                            for (const b of targets) if (Math.abs(b.x - x) < R / 7 && Math.abs(b.y - gy) < H * 1.2) hit(b, 1, s)
                        }
                        this.shake = Math.max(this.shake, 10)
                    })
                }
                return true
            }
            case 'katana': {
                // a storm of cuts: every monster around gets slashed, one after another
                targets.forEach((b, i) => later(i * 55, () => {
                    for (let k = 0; k < 3; k++) {
                        const a = rand(0, Math.PI)
                        const l = b.size * 0.8
                        const y = b.y - b.size * 0.45
                        this.addBeam(b.x - Math.cos(a) * l, y - Math.sin(a) * l, b.x + Math.cos(a) * l, y + Math.sin(a) * l, 0x22d3ee, 1.8, 10, 0.16)
                    }
                    this.flash(b.x, b.y - b.size * 0.45, 0xe0fbff, b.size, 0.14)
                    this.sfx && this.sfx.play('slice', {volume: 0.6})
                    hit(b)
                }))
                this.flash(cx, cy, 0x22d3ee, R * 0.6, 0.3)
                return true
            }
            case 'hammer': {
                // lightning strikes every monster around
                targets.forEach((b, i) => later(i * 70, () => {
                    if (b.dead) return
                    this.boltAt(b.x, b.y - b.size * 0.4, dmgFor(b), Math.sign(b.x - cx) || 1)
                }))
                this.flash(cx, cy, 0x93c5fd, R * 0.7, 0.35)
                return true
            }
            case 'scythe': {
                // a huge reaper's sweep around the hero that drains a heart from the harvest
                const mesh = new THREE.Mesh(this.geo.slash, this.sigMat ? this.sigMat(0xa855f7, 0.85).clone() : this.mats.slash.clone())
                mesh.position.set(cx, -cy, 70)
                mesh.renderOrder = 12
                this.scene.add(mesh)
                const t0 = this.time
                const spin = () => {
                    if (this.disposed) return
                    const k = (this.time - t0) / 0.55
                    mesh.rotation.z = -k * Math.PI * 2.2
                    mesh.scale.setScalar(R * (0.4 + 0.6 * Math.min(1, k * 1.6)))
                    mesh.material.opacity = 0.9 * (1 - Math.max(0, k - 0.6) / 0.4)
                    if (k < 1) requestAnimationFrame(spin)
                    else this.scene.remove(mesh)
                }
                spin()
                for (const b of targets) hit(b)
                if (targets.length && p.hp < p.maxHp) {
                    p.hp++
                    this.floatText(p.x, p.y - H - 18, '☠ +1 ❤', 'heart')
                }
                this.flash(cx, cy, 0xa855f7, R * 0.8, 0.4)
                return true
            }
            case 'pickaxe': {
                // the ceiling caves in: a hail of rocks over the area
                const top = window.scrollY + 10
                for (let i = 0; i < (this.lowFx ? 10 : 18); i++) {
                    later(i * 40, () => {
                        const x = cx + rand(-R, R)
                        const s = H * rand(0.12, 0.2)
                        const rock = new THREE.Mesh(this.geo.box, this.rockMat())
                        rock.scale.set(s, s * 0.8, s)
                        this.thrown = this.thrown || []
                        this.throwObject({
                            mesh: rock, x, y: top, vx: rand(-60, 60), vy: rand(200, 420), grav: 1800, spin: rand(-10, 10),
                            size: s * 1.6, dmg: dmgFor({}) * 0.35, breaks: true, kind: 'rock', pierce: 2, life: 2,
                        })
                    })
                }
                for (const b of targets) later(300, () => hit(b, 0.5))
                return true
            }
            case 'torch': {
                // a fire nova: everything around burns, the page too
                for (const b of targets) {
                    hit(b)
                    b.burn = 4
                }
                for (let i = 0; i < 14; i++) {
                    const a = (i / 14) * Math.PI * 2
                    const x = cx + Math.cos(a) * R * 0.75
                    const y = cy + Math.sin(a) * R * 0.5
                    later(i * 18, () => {
                        this.flash(x, y, 0xff6a00, H * 0.6, 0.35)
                        this.spray(4, x, y, 0xff7a1a, () => [rand(-40, 40), -rand(160, 320)], [0.35, 0.6], 0.15)
                    })
                }
                this.flash(cx, cy, 0xfff1c2, R * 0.5, 0.2)
                this.flash(cx, cy, 0xff6a00, R * 1.1, 0.5)
                this.igniteAt && this.igniteAt(cx, p.y)
                this.sfx && this.sfx.play('grenade')
                return true
            }
            case 'knife': {
                // the hunter blinks from monster to monster and stabs each one
                const order = targets.slice(0, 10)
                const start = {x: p.x, y: p.y}
                p.inv = Math.max(p.inv, 0.25 + order.length * 0.08)
                order.forEach((b, i) => later(i * 80, () => {
                    if (b.dead) return
                    this.flash(p.x, p.y - H * 0.5, 0x9ca3af, H * 0.5, 0.15)
                    p.x = b.x - Math.sign(b.x - start.x || 1) * b.size * 0.4
                    p.y = Math.min(p.y, b.y)
                    p.vx = 0
                    p.vy = 0
                    this.addBeam(b.x - 30, b.y - b.size * 0.6, b.x + 30, b.y - b.size * 0.3, 0xffffff, 2, 8, 0.12)
                    this.flash(b.x, b.y - b.size * 0.45, 0xffffff, b.size * 0.7, 0.12)
                    this.sfx && this.sfx.play('swish', {volume: 0.7})
                    hit(b, 1.4)
                }))
                return true
            }
            case 'mug': {
                // a flood of coffee: everything around is splashed and slowed, mugs rain down
                for (const b of targets) {
                    hit(b)
                    b.slow = 4
                }
                for (let i = 0; i < 16; i++) {
                    const a = (i / 16) * Math.PI * 2
                    const x = cx + Math.cos(a) * R * 0.7
                    const y = cy + Math.sin(a) * R * 0.45
                    later(i * 15, () => this.spray(4, x, y, 0x6b3a1a, () => [Math.cos(a) * 120, Math.sin(a) * 80 - 60], [0.4, 0.7], 0.1))
                }
                for (let i = 0; i < 6; i++) {
                    later(80 + i * 70, () => {
                        this.throwObject({
                            mesh: this.propMesh('mug', H * 0.3), x: cx + rand(-R * 0.8, R * 0.8), y: window.scrollY + 10,
                            vx: rand(-50, 50), vy: 300, grav: 1500, spin: rand(-8, 8), size: H * 0.3, dmg: dmgFor({}) * 0.2,
                            breaks: true, kind: 'mug',
                        })
                    })
                }
                this.flash(cx, cy, 0x9a5b2e, R * 0.9, 0.4)
                this.sfx && this.sfx.play('splash')
                return true
            }
            default:
                return false
        }
    },
}
