// Pacing: the pressure comes in waves instead of a constant stream —
//   normal  — the usual flow
//   surge   — "⚡ SURGE": twice the monsters, faster and angrier
//   calm    — a breather: almost no new monsters, the old ones lose interest (unless you walk right up to them)
// The order and lengths are random, so it never feels the same. Paused during the pre-boss horde and the boss.
// Mixed into GameEngine.prototype — `this` is the engine.
import {rand} from './util';

const PHASES = {
    normal: {dur: [12, 20], spawn: 1, alive: 1, speed: 1},
    surge: {dur: [7, 11], spawn: 2.2, alive: 1.5, speed: 1.2},
    calm: {dur: [6, 10], spawn: 0.12, alive: 0.6, speed: 0.85},
}
const PASSIVE_RANGE = 230 // in a calm, monsters only fight you when you come this close

export const pacingMethods = {
    resetPace() {
        this.pace = {phase: 'normal', t: rand(10, 16)}
    },

    paceFrozen() {
        return !!(this.boss || (this.horde && this.horde.phase !== 'done') || this.state !== 'play')
    },

    updatePace(dt) {
        if (!this.pace) this.resetPace()
        const P = this.pace
        if (this.paceFrozen()) {
            if (P.phase !== 'normal') this.setPace('normal')
            return
        }
        P.t -= dt
        if (P.t > 0) return
        if (P.phase === 'normal') {
            const r = Math.random()
            this.setPace(r < 0.45 ? 'calm' : r < 0.8 ? 'surge' : 'normal')
        } else this.setPace('normal')
    },

    setPace(phase) {
        const P = this.pace
        const was = P.phase
        P.phase = phase
        P.t = rand(...PHASES[phase].dur)
        if (phase === was) return
        if (phase === 'surge') {
            this.toast('⚡ SURGE — here they come!', 'boss')
            this.sfx && this.sfx.play('surge')
            this.sfx && this.sfx.setMusicIntensity(true)
        } else if (phase === 'calm') {
            this.toast('…a moment of calm', '')
            this.sfx && this.sfx.play('calm')
            // the monsters wander off from where they are
            for (const b of this.bugs) {
                b.homeX = b.x
                b.homeY = b.y
            }
        }
        if (was === 'surge' && !this.boss) {
            this.sfx && this.sfx.setMusicIntensity(false)
            // survived the surge: pick a power-up
            setTimeout(() => !this.disposed && this.offerPerks && this.offerPerks('Surge survived!'), 500)
        }
        this.emitHud(true)
    },

    paceStat(key) {
        const P = this.pace
        return P ? PHASES[P.phase][key] : 1
    },

    // a calm monster leaves you alone unless you come close
    isPassive(b) {
        const P = this.pace
        if (!P || P.phase !== 'calm' || this.isBoss(b)) return false
        const p = this.player
        return Math.hypot(b.x - p.x, b.y - p.y) > PASSIVE_RANGE
    },
}
