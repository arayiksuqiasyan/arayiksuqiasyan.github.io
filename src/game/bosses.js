// Boss rotation: Dragon (1), Yeti King (2), Dark Wizard (3), Shroom Giant (4), then again.
// Mixed into GameEngine.prototype — `this` is the engine.
import {clamp, rand} from './util';

export const BOSS_ORDER = ['boss', 'bossYeti', 'bossWizard', 'bossShroom']

export const bossMethods = {
    bossTypeForLevel(level) {
        return BOSS_ORDER[(Math.max(1, level) - 1) % BOSS_ORDER.length]
    },

    // ---- Yeti King: walks at you, leaps and slams the ground, throws snowballs
    yetiBrain(b, dt, dx) {
        const p = this.player
        b.dir = Math.sign(dx) || b.dir
        b.vx = b.dir * b.speed * (Math.abs(dx) > 140 ? 1 : 0.25)
        b.slamCd = (b.slamCd === undefined ? 2.5 : b.slamCd) - dt
        if (b.slamCd <= 0 && this.canTarget()) {
            b.slamCd = rand(2.6, 3.6)
            b.vy = -1250
            b.vx = clamp(dx * 1.2, -440, 440)
            b.onGround = false
            b.bigJump = true
            b.slam = true
            this.enemyGesture(b, 'jump')
        }
        b.throwCd = (b.throwCd === undefined ? 1.6 : b.throwCd) - dt
        if (b.throwCd <= 0 && this.canTarget()) {
            b.throwCd = rand(1.8, 2.8)
            const ox = b.x + b.dir * b.size * 0.3
            const oy = b.y - b.size * 0.75
            for (const off of [-60, 60]) this.fireOrb(ox, oy, p.x + off, p.y - this.playerH * 0.5, 0x93c5fd)
            this.enemyGesture(b, 'attack')
        }
    },

    // called when a slamming yeti lands
    yetiSlam(b, groundY) {
        const p = this.player
        b.slam = false
        this.ring(b.x, groundY, 0x93c5fd, 320, 0.45, 0.85)
        this.dust(b.x, groundY, 26, 260)
        this.shake = Math.max(this.shake, 24)
        this.sfx && this.sfx.play('boom')
        if (this.canTarget() && p.onGround && Math.abs(p.x - b.x) < 310 && Math.abs(p.y - groundY) < 90) this.hurtPlayer(b.x)
    },

    // ---- Shroom Giant: slow, spore fans, mushroom minions, small hops
    shroomBrain(b, dt, dx) {
        const p = this.player
        b.dir = Math.sign(dx) || b.dir
        b.vx = b.dir * b.speed * (Math.abs(dx) > 200 ? 1 : 0)
        b.sporeCd = (b.sporeCd === undefined ? 2 : b.sporeCd) - dt
        if (b.sporeCd <= 0 && this.canTarget()) {
            b.sporeCd = rand(2.2, 3)
            const ox = b.x
            const oy = b.y - b.size * 0.85
            const tx = p.x
            const ty = p.y - this.playerH * 0.5
            const base = Math.atan2(ty - oy, tx - ox)
            for (let i = -2; i <= 2; i++) {
                const a = base + i * 0.22
                this.fireOrb(ox, oy, ox + Math.cos(a) * 400, oy + Math.sin(a) * 400, 0x86efac)
            }
            this.enemyGesture(b, 'attack')
        }
        b.summon = (b.summon === undefined ? 4 : b.summon) - dt
        if (b.summon <= 0) {
            b.summon = rand(5, 7)
            for (const s of [-1, 1]) {
                this.spawnBug('crawler', {x: b.x + s * 40, y: b.y - b.size * 0.4, vx: s * 240, vy: -600, state: 'air'})
            }
        }
        b.hopTimer -= dt
        if (b.hopTimer <= 0) {
            b.hopTimer = rand(3.5, 5)
            b.vy = -820
            b.vx = clamp(dx * 0.8, -300, 300)
            b.onGround = false
            b.bigJump = true
        }
    },

    // ---- Dark Wizard: floats, teleports, rings of orbs, summons slimes
    updateWizardBoss(b, dt) {
        const p = this.player
        b.t = (b.t || 0) + dt
        if (b.homeX === undefined) b.homeX = b.x
        const tx = b.homeX
        const ty = p.y - this.playerH - 170 + Math.sin(b.t * 1.8) * 30
        const k = Math.min(1, dt * 2.2)
        b.vx += ((tx - b.x) * 2 - b.vx) * k
        b.vy += ((ty - b.y) * 2 - b.vy) * k
        b.x = clamp(b.x + b.vx * dt, 60, this.vw - 60)
        b.y += b.vy * dt
        b.dir = Math.sign(p.x - b.x) || b.dir
        b.portCd = (b.portCd === undefined ? 4 : b.portCd) - dt
        if (b.portCd <= 0) {
            b.portCd = rand(4, 5.5)
            this.burst(b.x, b.y - b.size * 0.5, 40, 0xa855f7, 420)
            this.flash(b.x, b.y - b.size * 0.5, 0xa855f7, 150, 0.35)
            // reappear far from the hero
            let nx = b.x
            for (let i = 0; i < 8; i++) {
                nx = rand(120, this.vw - 120)
                if (Math.abs(nx - p.x) > 280) break
            }
            b.x = b.homeX = nx
            b.vx = 0
            this.burst(b.x, b.y - b.size * 0.5, 40, 0xc084fc, 420)
            this.flash(b.x, b.y - b.size * 0.5, 0xc084fc, 150, 0.35)
        }
        b.ringCd = (b.ringCd === undefined ? 2 : b.ringCd) - dt
        if (b.ringCd <= 0 && this.canTarget()) {
            b.ringCd = rand(2, 2.8)
            const ox = b.x
            const oy = b.y - b.size * 0.5
            const n = 10
            const off = rand(0, Math.PI * 2)
            for (let i = 0; i < n; i++) {
                const a = off + (i / n) * Math.PI * 2
                this.fireOrb(ox, oy, ox + Math.cos(a) * 300, oy + Math.sin(a) * 300, 0xc084fc)
            }
            this.enemyGesture(b, 'attack')
            this.sfx && this.sfx.play('zap')
        }
        b.summon = (b.summon === undefined ? 5 : b.summon) - dt
        if (b.summon <= 0) {
            b.summon = rand(6, 8)
            for (const s of [-1, 1]) {
                this.spawnBug('slime', {x: b.x + s * 60, y: b.y, vx: s * 200, vy: 0, state: 'air'})
            }
        }
    },
}
