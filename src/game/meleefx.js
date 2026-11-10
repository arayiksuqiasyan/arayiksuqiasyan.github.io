// Every melee weapon has its own swing trail, hit effect and sound.
// Mixed into GameEngine.prototype — `this` is the engine.
import {rand} from './util';

export const meleeFxMethods = {
    // particle helper: n particles from (x,y) with a velocity function
    spray(n, x, y, color, vel, life = [0.3, 0.6], grav = 1) {
        // no falling "balls": only floating effects (flames, steam, trails) are kept
        if (grav > 0.3) return
        if (this.lowFx) n = Math.ceil(n * 0.5)
        const c = this.tmpColor.set(color)
        for (let i = 0; i < n; i++) {
            const q = this.particles[this.pIndex]
            this.pIndex = (this.pIndex + 1) % this.particles.length
            const [vx, vy, ox = 0, oy = 0] = vel(i)
            q.x = x + ox
            q.y = y + oy
            q.vx = vx
            q.vy = vy
            q.life = q.max = rand(life[0], life[1])
            q.grav = grav
            q.r = c.r
            q.g = c.g
            q.b = c.b
        }
    },

    // the swing itself (called once per attack hit moment)
    swingFx(id, f) {
        // a short, thin swing trail in the weapon's colour (not the old big green crescent),
        // so every blow is visible; the bigger signature move comes on the combo finisher (signature.js)
        const p = this.player
        const H = this.playerH
        const reach = H * this.meleeStats().reach
        const rot = f > 0 ? rand(-0.45, 0.1) : Math.PI + rand(-0.1, 0.45)
        this.spawnSlash(p.x + f * reach * 0.45, p.y - H * 0.55, f, 0.55 + 0.25 * (reach / H), rot, false, this.meleeColor())
        const sound = {axe: 'heavySwing', hammer: 'thud', pickaxe: 'clink', katana: 'slice', knife: 'swish',
            torch: 'fireswing', mug: 'splash', scythe: 'reap'}[id] || 'swing'
        this.sfx && this.sfx.play(sound)
        this.signatureMove && this.signatureMove(id, f)
    },

    // what a hit looks like on a monster
    hitFx(id, b, crit) {
        const x = b.x
        const y = b.y - b.size * 0.45
        // a crisp impact on every melee hit: a bright cross-cut and a short white pop
        const l = b.size * (crit ? 0.6 : 0.42)
        const a = rand(0.5, 0.9)
        this.addBeam(x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l, 0xffffff, 2.2, 8, 0.1)
        this.addBeam(x - Math.cos(-a) * l * 0.8, y - Math.sin(-a) * l * 0.8, x + Math.cos(-a) * l * 0.8, y + Math.sin(-a) * l * 0.8, this.meleeColor(), 1.6, 7, 0.1)
        this.flash(x, y, 0xffffff, b.size * (crit ? 0.9 : 0.55), 0.09)
        const s = b.size
        switch (id) {
            case 'axe':
                this.flash(x, y, crit ? 0xffd08a : 0xf97316, s * (crit ? 1.6 : 1), 0.22)
                this.spray(14, x, y, 0xff8a2a, () => [rand(-320, 320), -rand(150, 480)], [0.3, 0.6])
                break
            case 'katana': {
                // a clean diagonal cut across the monster
                const a = rand(-0.8, 0.8)
                const l = s * 0.8
                this.addBeam(x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l, 0xffffff, 2, 6, 0.14)
                this.spray(6, x, y, 0x67e8f9, () => [rand(-200, 200), -rand(60, 240)], [0.2, 0.4])
                break
            }
            case 'hammer':
                this.flash(x, y, 0x93c5fd, s * 1.4, 0.24)
                this.spray(10, x, b.y, 0x9ca3af, () => [rand(-220, 220), -rand(150, 420)], [0.4, 0.7])
                break
            case 'scythe':
                this.flash(x, y, 0xa855f7, s * 0.9, 0.2)
                // soul wisps drift towards the reaper
                this.spray(6, x, y, 0xd8b4fe, () => [(this.player.x - x) * rand(1.2, 2), (this.player.y - this.playerH * 0.6 - y) * rand(1.2, 2)], [0.4, 0.6], 0)
                break
            case 'pickaxe':
                this.spray(12, x, y, 0x78716c, () => [rand(-260, 260), -rand(120, 420)], [0.4, 0.7])
                this.spray(8, x, y, 0xfde68a, () => [rand(-380, 380), -rand(200, 500)], [0.15, 0.3])
                break
            case 'torch':
                this.flash(x, y, 0xff7a1a, s, 0.24)
                this.spray(12, x, y, 0xff9f43, () => [rand(-120, 120), -rand(200, 420)], [0.3, 0.6], 0.3)
                break
            case 'knife':
                this.spray(10, x, y, 0xef4444, () => [this.player.facing * rand(100, 320), rand(-160, 60)], [0.2, 0.4])
                break
            case 'mug':
                this.spray(14, x, y, 0x7c4a21, () => [rand(-260, 260), -rand(100, 360)], [0.3, 0.6])
                break
            default:
                this.flash(x, y, crit ? 0xffd08a : this.meleeColor(), s * (crit ? 1.5 : 0.8), 0.2)
                this.burst(x, y, 8, this.meleeColor(), 260)
        }
    },
}
