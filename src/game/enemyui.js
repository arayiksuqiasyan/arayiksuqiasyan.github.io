// Readable combat: monsters telegraph their attacks (wind-up + "!"), damaged monsters show an HP bar,
// hits pop numbers and weapon perks (slow, burn, crit…) are visible on the monster.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {ENEMY_TYPES, rand} from './util';

const WINDUP = 0.45      // seconds between the "!" and the strike
const ATTACK_CD = 0.95   // rest after a strike
const TRIGGER = 46       // px beyond the body where a monster starts its wind-up
const STRIKE = 64        // px beyond the body the strike (with its lunge) reaches

// elite monsters: bigger, ×2 HP, a coloured aura, one special trait and a fat reward
export const ELITES = {
    armored: {name: 'ARMORED', color: 0x60a5fa, emissive: 0x0b2a55},
    swift: {name: 'SWIFT', color: 0xfacc15, emissive: 0x3d3000},
    rage: {name: 'RAGING', color: 0xef4444, emissive: 0x3d0000},
}

export const enemyUiMethods = {
    buildEnemyUiKit() {
        const mk = color => new THREE.MeshBasicMaterial({color, transparent: true, depthTest: false, depthWrite: false, toneMapped: false})
        this.uiMats = {back: mk(0x0b0f14), fill: mk(0x4ade80), mid: mk(0xfacc15), low: mk(0xef4444), warnBody: new THREE.MeshBasicMaterial({color: 0xff3b3b})}
        this.uiMats.back.opacity = 0.75
        this.uiGeo = {
            plane: new THREE.PlaneGeometry(1, 1),
            fill: new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0),
        }
        // a red "!" for the wind-up
        const c = document.createElement('canvas')
        c.width = c.height = 64
        const x = c.getContext('2d')
        x.fillStyle = '#ff3b3b'
        x.beginPath()
        x.arc(32, 32, 28, 0, Math.PI * 2)
        x.fill()
        x.fillStyle = '#fff'
        x.font = 'bold 44px sans-serif'
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText('!', 32, 34)
        this.uiMats.warn = new THREE.SpriteMaterial({map: new THREE.CanvasTexture(c), depthTest: false, depthWrite: false, toneMapped: false})
        this.uiMats.shield = mk(0x60a5fa)
        this.auraMats = {}
        for (const [id, E] of Object.entries(ELITES)) {
            this.auraMats[id] = new THREE.MeshBasicMaterial({
                color: E.color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending,
                depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
            })
        }
        this.auraGeo = new THREE.RingGeometry(0.9, 1, 48)
        this.enemyUi = new Set()
    },

    // ---------------------------------------------------------------- elites
    maybeElite(b) {
        const T = ENEMY_TYPES[b.type]
        if (T.boss || T.flee || b.type === 'slimelet' || this.boss || this.state !== 'play') return
        const L = this.level || 1
        const D = this.diff || {}
        if (this.bugs.filter(o => o.elite && !o.dead).length >= (D.elites || 2)) return
        if (Math.random() > (D.elite || Math.min(0.12, 0.04 + 0.008 * (L - 1)))) return
        const ids = Object.keys(ELITES)
        this.makeElite(b, ids[(Math.random() * ids.length) | 0])
    },

    makeElite(b, id) {
        const E = ELITES[id]
        b.elite = {id, ...E}
        b.size *= 1.35
        if (b.model && b.face) b.face.scale.setScalar(1.35)
        b.hp = b.maxHp = Math.ceil(b.maxHp * 2)
        if (id === 'armored') b.shield = b.shieldMax = Math.ceil(b.maxHp * 0.4)
        if (id === 'swift') b.speed *= 1.6
        b.aura = new THREE.Mesh(this.auraGeo, this.auraMats[id])
        b.aura.renderOrder = 8
        this.scene.add(b.aura)
        this.enemyUi.add(b)
        this.floatText(b.x, b.y - b.size - 20, `${E.name} ${b.type.toUpperCase()}`, 'hot')
        this.sfx && this.sfx.play('warn')
    },

    // the armored elite's shield soaks damage first; returns what is left for the HP
    eliteSoak(b, dmg) {
        if (b.elite && b.elite.id === 'rage' && !b.enraged && b.hp - dmg < b.maxHp * 0.5 && b.hp - dmg > 0) {
            b.enraged = true
            b.speed *= 1.5
            this.statusLabel(b, 'rage', 'ENRAGED!', 'warn')
            this.burst(b.x, b.y - b.size * 0.5, 24, 0xef4444, 320)
        }
        if (!(b.shield > 0)) return dmg
        const a = Math.min(b.shield, dmg)
        b.shield -= a
        this.burst(b.x, b.y - b.size * 0.5, 6, 0x93c5fd, 200)
        if (b.shield <= 0) {
            this.statusLabel(b, 'shield', 'SHIELD BROKEN', 'armor')
            this.flash(b.x, b.y - b.size * 0.5, 0x60a5fa, b.size * 1.3, 0.25)
            this.sfx && this.sfx.play('shield')
        }
        return dmg - a
    },

    windupMul(b) {
        const e = b.elite && b.elite.id
        return ((this.diff && this.diff.windup) || 1) * (b.type === 'tank' ? 1.3 : 1) * (e === 'swift' ? 0.65 : b.enraged ? 0.7 : 1)
    },

    // ordinary monsters attack with a visible wind-up instead of hurting on touch
    telegraphs(b) {
        const T = ENEMY_TYPES[b.type]
        return !T.boss && T.kind !== 'bat' && !T.flee
    },

    contactDamage(b) {
        const p = this.player
        const s = b.size
        // a fresh monster needs a moment before it can hurt
        if (this.time - b.spawnT < 0.6 || b.appear < 1) return
        const inBox = extra => Math.abs(p.x - b.x) < s * 0.42 + 14 + extra && p.y > b.y - s * 0.75 - extra * 0.4 && p.y - this.playerH * 0.9 < b.y
        if (!this.telegraphs(b)) {
            if (this.canTarget() && inBox(0)) {
                if (b.model) this.enemyGesture(b, 'attack')
                this.hurtPlayer(b.x, b)
            }
            return
        }
        if (b.windT) {
            b.dir = b.windDir
            if (this.time < b.windT) return
            // strike: a short lunge towards where the hero stood
            b.windT = 0
            b.atkReady = this.time + ATTACK_CD * ((this.diff && this.diff.rest) || 1) * (b.enraged || (b.elite && b.elite.id === 'swift') ? 0.6 : 1)
            b.vx = b.windDir * 420
            if (b.onGround) {
                b.vy = -220
                b.onGround = false
            }
            if (b.model) this.enemyGesture(b, 'attack')
            this.sfx && this.sfx.play('swing', {volume: 0.45})
            this.spawnSlash(b.x + b.windDir * s * 0.5, b.y - s * 0.45, b.windDir, 0.55 + s / 160)
            if (this.canTarget() && inBox(STRIKE) && Math.sign(p.x - b.x || b.windDir) === b.windDir) this.hurtPlayer(b.x, b)
            return
        }
        if (this.time < (b.atkReady || 0) || !this.canTarget() || b.stun > 0) return
        if (inBox(TRIGGER)) {
            b.windDir = Math.sign(p.x - b.x) || b.dir
            b.windT = this.time + WINDUP * this.windupMul(b)
            b.windStart = this.time
            b.vx = 0
            this.sfx && this.sfx.play('warn')
        }
    },

    // a melee hit during the wind-up interrupts the attack
    interruptWindup(b) {
        if (!b.windT) return
        b.windT = 0
        b.atkReady = this.time + 0.6
        this.floatText(b.x, b.y - b.size - 26, 'INTERRUPTED', 'armor')
    },

    // damage numbers + perk labels
    hitNumber(b, dmg, crit) {
        const n = Math.max(1, Math.round(dmg * 10))
        this.floatText(b.x + rand(-10, 10), b.y - b.size - 4, crit ? `${n}!` : String(n), crit ? 'hot' : 'dmg')
    },

    statusLabel(b, key, text, kind) {
        if (this.time - (b['lbl_' + key] || -9) < 1.2) return
        b['lbl_' + key] = this.time
        this.floatText(b.x, b.y - b.size - 30, text, kind)
    },

    updateEnemyUi(dt) {
        for (const b of this.bugs) {
            if (b.dead) continue
            const T = ENEMY_TYPES[b.type]
            // ---- wind-up: freeze, pulse red, "!" over the head
            if (b.windT) {
                const k = (this.time - b.windStart) / Math.max(0.01, b.windT - b.windStart)
                if (!b.warnMark) {
                    b.warnMark = new THREE.Sprite(this.uiMats.warn)
                    b.warnMark.renderOrder = 21
                    this.scene.add(b.warnMark)
                    this.enemyUi.add(b)
                }
                const pop = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.35
                b.warnMark.visible = true
                b.warnMark.scale.setScalar(26 * Math.max(0.7, this.unit || 1) * pop)
                b.warnMark.position.set(b.x, -(b.y - b.size * 1.05 - 22), 92)
                const on = Math.sin(this.time * 40) > 0
                if (!b.model && b.body) b.body.material = on ? this.uiMats.warnBody : b.body.material
                if (b.model && b.mats) for (const m of b.mats) m.emissive.setHex(on ? 0xff1a1a : 0x550000)
            } else if (b.warnMark) b.warnMark.visible = false

            // ---- elite aura
            if (b.aura) {
                const pulse = 1 + Math.sin(this.time * 5 + b.walk * 0.1) * 0.06
                b.aura.position.set(b.x, -(b.y - b.size * 0.5), 25)
                b.aura.scale.setScalar(b.size * 0.72 * pulse * (b.enraged ? 1.15 : 1))
                b.aura.rotation.z += dt * (b.enraged ? 4 : 1.2)
                b.aura.material = b.elite.id === 'armored' && !(b.shield > 0) ? this.auraMats.swift : this.auraMats[b.elite.id]
                if (b.elite.id === 'armored' && !(b.shield > 0)) b.aura.visible = false
                if (b.model && b.mats && !b.windT && !(b.flash > 0)) for (const m of b.mats) m.emissive.setHex(b.enraged ? 0x7a0000 : b.elite.emissive)
            }

            // ---- status effects you can see
            if (b.slow > 0 && Math.random() < dt * 10) {
                this.burst(b.x + rand(-b.size * 0.3, b.size * 0.3), b.y - b.size * rand(0.3, 0.9), 1, 0x7c4a21, 50)
            }

            // ---- HP bar once a monster is hurt (bosses have the big bar in the HUD)
            if (!T.boss && b.maxHp > 1 && (b.elite || b.hp < b.maxHp)) {
                if (!b.hpBar) {
                    const g = new THREE.Group()
                    const back = new THREE.Mesh(this.uiGeo.plane, this.uiMats.back)
                    const fill = new THREE.Mesh(this.uiGeo.fill, this.uiMats.fill)
                    back.renderOrder = 20
                    fill.renderOrder = 21
                    const shield = new THREE.Mesh(this.uiGeo.fill, this.uiMats.shield)
                    shield.renderOrder = 22
                    g.add(back, fill, shield)
                    this.scene.add(g)
                    b.hpBar = {g, back, fill, shield, shown: 0}
                    this.enemyUi.add(b)
                }
                const w = Math.max(36, Math.min(90, b.size * 0.85))
                const f = Math.max(0, b.hp / b.maxHp)
                const bar = b.hpBar
                bar.shown += (f - bar.shown) * Math.min(1, dt * 12) || f
                bar.back.scale.set(w + 4, 7, 1)
                bar.fill.scale.set(Math.max(0.001, w * Math.min(1, bar.shown)), 4, 1)
                bar.fill.position.x = -w / 2
                const sf = b.shieldMax ? Math.max(0, b.shield) / b.shieldMax : 0
                bar.shield.visible = sf > 0
                bar.shield.scale.set(Math.max(0.001, w * sf), 2, 1)
                bar.shield.position.set(-w / 2, 2.5, 0)
                bar.back.material = this.uiMats.back
                bar.fill.material = f > 0.55 ? this.uiMats.fill : f > 0.25 ? this.uiMats.mid : this.uiMats.low
                bar.g.position.set(b.x, -(b.y - b.size * 1.05 - (b.windT ? 2 : 6)), 91)
            }
        }
        // drop the UI of monsters that are gone
        for (const b of this.enemyUi) {
            if (!b.dead) continue
            if (b.hpBar) this.scene.remove(b.hpBar.g)
            if (b.warnMark) this.scene.remove(b.warnMark)
            if (b.aura) this.scene.remove(b.aura)
            b.hpBar = b.warnMark = b.aura = null
            this.enemyUi.delete(b)
        }
    },

    clearEnemyUi() {
        if (!this.enemyUi) return
        for (const b of this.enemyUi) {
            if (b.hpBar) this.scene.remove(b.hpBar.g)
            if (b.warnMark) this.scene.remove(b.warnMark)
            if (b.aura) this.scene.remove(b.aura)
            b.hpBar = b.warnMark = b.aura = null
        }
        this.enemyUi.clear()
    },
}
