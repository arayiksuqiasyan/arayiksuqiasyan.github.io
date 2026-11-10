// Random events during a level: Golden Bug, Bug Rain, Double Coins, Supply Drop.
// Mixed into GameEngine.prototype — `this` is the engine.
import {clamp, rand} from './util';

export const EVENTS = {
    golden: {name: 'GOLDEN BUG — catch it!', dur: 14},
    rain: {name: 'BUG RAIN', dur: 12},
    double: {name: 'DOUBLE COINS', dur: 30},
    supply: {name: 'SUPPLY DROP', dur: 4},
}

export const eventMethods = {
    resetEvents() {
        this.eventCd = rand(28, 40)
        this.event = null
    },

    updateEvents(dt) {
        if (this.state !== 'play' || this.boss || this.clearing) return
        if (this.event) {
            this.event.left -= dt
            if (this.event.id === 'golden' && this.event.bug && this.event.bug.dead && !this.event.done) {
                this.event.done = true
                this.event.left = Math.min(this.event.left, 1.5)
            }
            if (this.event.left <= 0) {
                if (this.event.id === 'golden' && this.event.bug && !this.event.bug.dead) {
                    // it got away
                    this.burst(this.event.bug.x, this.event.bug.y - 20, 30, 0xfacc15, 300)
                    this.event.bug.dead = true
                    this.event.bug.silent = true
                    this.toast('the Golden Bug escaped…', '')
                }
                this.event = null
                this.eventCd = rand(30, 45)
                this.emitHud(true)
            }
            return
        }
        this.eventCd -= dt
        if (this.eventCd > 0) return
        const ids = Object.keys(EVENTS)
        this.startEvent(ids[(Math.random() * ids.length) | 0])
    },

    startEvent(id) {
        const E = EVENTS[id]
        const p = this.player
        this.event = {id, name: E.name, left: E.dur, dur: E.dur}
        this.toast(`★ ${E.name}`, 'super')
        this.sfx && this.sfx.play('event')
        if (id === 'golden') {
            const left = p.x > this.vw / 2
            const b = this.spawnBug('golden', {
                x: left ? 60 : this.vw - 60, y: p.y - this.vh * 0.3, state: 'air', dir: left ? 1 : -1,
            })
            b.golden = true
            this.event.bug = b
        } else if (id === 'supply') {
            const sy = window.scrollY
            for (let i = 0; i < 3; i++) {
                this.dropToken(clamp(p.x + rand(-300, 300), 60, this.vw - 60), sy + 80, 'ammo', 0)
            }
            this.dropToken(clamp(p.x + rand(-200, 200), 60, this.vw - 60), sy + 80, 'heart', 0)
        }
        this.emitHud(true)
    },

    coinMult() {
        return this.event && this.event.id === 'double' ? 2 : 1
    },

    spawnRateMult() {
        return this.event && this.event.id === 'rain' ? 3 : 1
    },

    // the golden bug runs away from the hero
    goldenBrain(b, dt, dx) {
        b.dir = -Math.sign(dx) || b.dir
        b.vx = b.dir * b.speed
        // trapped at the screen edge: jump over the hero
        if ((b.x < 80 && b.dir < 0) || (b.x > this.vw - 80 && b.dir > 0)) {
            b.dir *= -1
            b.vy = -1050
            b.vx = b.dir * b.speed * 1.4
            b.onGround = false
        }
        if (Math.random() < dt * 8) this.burst(b.x, b.y - b.size * 0.5, 1, 0xfde047, 80)
    },
}
