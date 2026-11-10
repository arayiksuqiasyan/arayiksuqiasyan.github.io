// What monsters do to the hero besides taking hearts:
//  - every hit slows you down for a moment
//  - blue sting bees jam your gun for 3 s
//  - fire (red dragons, the dragon boss's fireballs) sets you on fire: hearts burn away, armor doesn't help
// Mixed into GameEngine.prototype — `this` is the engine.
import {ENEMY_TYPES, rand} from './util';

const SLOW_TIME = 1.2
const SLOW_MUL = 0.6
const JAM_TIME = 3
const BURN_TICK = 1

export const debuffMethods = {
    resetDebuffs() {
        this.debuff = {slow: 0, jam: 0, burn: 0, burnT: 0}
    },

    // called by hurtPlayer when a hit lands (armor or not); src = the monster / projectile info
    applyHitEffects(src) {
        const D = this.debuff || (this.resetDebuffs(), this.debuff)
        const p = this.player
        D.slow = SLOW_TIME
        const T = src && src.type ? ENEMY_TYPES[src.type] : null
        const jam = (T && T.jam) || (src && src.jam)
        const burn = (T && T.burn) || (src && src.burn)
        if (jam) {
            if (!(D.jam > 0)) this.floatText(p.x, p.y - this.playerH - 34, 'GUN JAMMED', 'warn')
            D.jam = JAM_TIME
            this.burst(p.x, p.y - this.playerH * 0.55, 14, 0x60a5fa, 220)
            this.sfx && this.sfx.play('jam')
        }
        if (burn) {
            if (!(D.burn > 0)) this.floatText(p.x, p.y - this.playerH - 34, 'ON FIRE 🔥', 'hot')
            D.burn = Math.max(D.burn, (this.level || 1) >= 10 ? 3 : 2) // ticks
            D.burnT = BURN_TICK
        }
        this.emitHud(true)
    },

    updateDebuffs(dt) {
        const D = this.debuff
        const p = this.player
        if (!D || !p) return
        D.slow = Math.max(0, D.slow - dt)
        const wasJammed = D.jam > 0
        D.jam = Math.max(0, D.jam - dt)
        if (wasJammed && !D.jam) this.emitHud(true)
        if (D.slow > 0 && Math.random() < dt * 8) this.burst(p.x + rand(-14, 14), p.y - 6, 1, 0x93c5fd, 40)
        if (D.jam > 0 && Math.random() < dt * 10) {
            const [mx, my] = this.muzzlePos ? this.muzzlePos() : [p.x, p.y - this.playerH * 0.55]
            this.burst(mx, my, 1, 0x60a5fa, 80)
        }
        if (D.burn > 0 && !p.dead) {
            // flames on the hero
            if (Math.random() < dt * 30) {
                this.spray(1, p.x + rand(-16, 16), p.y - this.playerH * rand(0.1, 0.9), Math.random() < 0.5 ? 0xff7a1a : 0xfde047,
                    () => [rand(-30, 30), -rand(80, 200)], [0.25, 0.45], 0)
            }
            D.burnT -= dt
            if (D.burnT <= 0) {
                D.burnT = BURN_TICK
                D.burn--
                // burning ignores the armor
                p.hp -= 1
                this.floatText(p.x, p.y - this.playerH - 18, '🔥 -1 ❤', 'warn')
                this.onHud({hurt: {id: Math.random(), armor: false}})
                this.sfx && this.sfx.play('hurt', {volume: 0.6})
                if (p.hp <= 0) {
                    p.dead = true
                    p.attack = null
                }
                this.emitHud(true)
            }
        }
    },

    moveMul() {
        return this.debuff && this.debuff.slow > 0 ? SLOW_MUL : 1
    },

    gunJammed() {
        return !!(this.debuff && this.debuff.jam > 0)
    },
}
