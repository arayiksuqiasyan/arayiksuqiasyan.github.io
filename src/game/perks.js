// Run perks: after every SURGE and after the pre-boss horde the game pauses and offers 3 random cards.
// The pick lasts for the rest of the run (a new run from the lobby starts clean); many stack.
// Mixed into GameEngine.prototype — `this` is the engine.
import {rand} from './util';

export const PERKS = {
    fury: {icon: '🔥', svg: 'pk_fury', color: '#f97316', name: 'Fury', desc: '+20% damage with everything', max: 5},
    frenzy: {icon: '⚡', svg: 'pk_frenzy', color: '#facc15', name: 'Frenzy', desc: '+15% attack & fire speed', max: 4},
    barrage: {icon: '🎯', svg: 'pk_barrage', color: '#38bdf8', name: 'Barrage', desc: 'melee signature moves throw +1 projectile', max: 4},
    thunder: {icon: '🌩', svg: 'pk_thunder', color: '#60a5fa', name: 'Thunderstruck', desc: 'every 4th melee hit calls down lightning', max: 3},
    vamp: {icon: '🩸', svg: 'pk_vamp', color: '#ef4444', name: 'Vampirism', desc: '+1 ❤ for every 10 kills (faster when stacked)', max: 3},
    vitality: {icon: '❤', svg: 'pk_vitality', color: '#f43f5e', name: 'Vitality', desc: '+2 max hearts and heal 2', max: 3},
    plating: {icon: '🛡', svg: 'pk_plating', color: '#22d3ee', name: 'Plating', desc: '+30% armor now, armor slowly regenerates', max: 3},
    quarter: {icon: '📦', svg: 'pk_quarter', color: '#eab308', name: 'Quartermaster', desc: '+50 ammo, ammo boxes give twice as much', max: 2},
    swift: {icon: '💨', svg: 'pk_swift', color: '#a3e635', name: 'Swift', desc: '+12% run speed and +1 jump in the air', max: 2},
    spikes: {icon: '🌵', svg: 'pk_spikes', color: '#4ade80', name: 'Spikes', desc: 'monsters that hit you take damage back', max: 3},
    lucky: {icon: '🍀', svg: 'pk_lucky', color: '#34d399', name: 'Lucky', desc: '10% chance for a ×3 critical hit', max: 3},
    bubble: {icon: '🫧', svg: 'pk_bubble', color: '#7dd3fc', name: 'Bubble', desc: 'a bubble blocks one hit, comes back in 12 s', max: 1},
}

export const perkMethods = {
    resetPerks() {
        this.perks = {}
        this.perkKills = 0
        this.perkHits = 0
        this.bubbleAt = 0
        this.perkChoice = null
    },

    perk(id) {
        return (this.perks && this.perks[id]) || 0
    },

    // pause and show 3 cards (skipped if nothing can be offered)
    offerPerks(reason) {
        if (this.perkChoice || !this.player || this.player.dead) return
        const pool = Object.keys(PERKS).filter(id => this.perk(id) < PERKS[id].max)
        const pick = []
        while (pick.length < 3 && pool.length) pick.push(pool.splice((Math.random() * pool.length) | 0, 1)[0])
        if (!pick.length) return
        this.perkChoice = pick
        this.setPaused(true)
        this.sfx && this.sfx.play('event')
        this.onHud({perkChoice: {ids: pick, reason, id: Math.random()}})
    },

    pickPerk(id) {
        if (!this.perkChoice || !this.perkChoice.includes(id)) return
        this.perkChoice = null
        this.perks[id] = this.perk(id) + 1
        const p = this.player
        if (id === 'vitality') {
            p.maxHp += 2
            p.hp = Math.min(p.maxHp, p.hp + 2)
        } else if (id === 'plating') {
            this.stats.armor = Math.min(100, (this.stats.armor || 0) + 30)
            this.stats.armorOn = true
        } else if (id === 'quarter') {
            this.stats.ammo = Math.min(this.ammoMax(), this.stats.ammo + 50)
        } else if (id === 'bubble') {
            this.bubbleAt = 0
        }
        this.onHud({perkChoice: null})
        this.setPaused(false)
        this.floatText(p.x, p.y - this.playerH - 24, PERKS[id].name, 'combo')
        this.sfx && this.sfx.play('perk')
        this.burst(p.x, p.y - this.playerH * 0.5, 30, 0xfacc15, 320)
        this.emitHud(true)
    },

    perkHud() {
        return Object.entries(this.perks || {}).map(([id, n]) => ({id, n, icon: PERKS[id].icon, svg: PERKS[id].svg, color: PERKS[id].color, name: PERKS[id].name}))
    },

    // ---- effects (called from the engine)
    perkDamage(dmg, b) {
        let d = dmg * (1 + 0.2 * this.perk('fury'))
        if (this.perk('lucky') && Math.random() < 0.1 * this.perk('lucky')) {
            d *= 3
            this.floatText(b.x, b.y - b.size - 22, 'LUCKY ×3', 'hot')
        }
        return d
    },

    perkSpeed() {
        return 1 + 0.15 * this.perk('frenzy')
    },

    perkOnKill() {
        const v = this.perk('vamp')
        if (!v) return
        this.perkKills++
        const need = Math.max(4, 10 - 3 * (v - 1))
        const p = this.player
        if (this.perkKills >= need && p.hp < p.maxHp && !p.dead) {
            this.perkKills = 0
            p.hp++
            this.floatText(p.x, p.y - this.playerH - 18, '🩸 +1 ❤', 'heart')
            this.emitHud(true)
        }
    },

    perkOnMeleeHit(f) {
        const t = this.perk('thunder')
        if (!t || !this.boltAt) return
        this.perkHits++
        if (this.perkHits % 4 !== 0) return
        const p = this.player
        let best = null
        let bd = this.playerH * 3
        for (const b of this.bugs) {
            if (b.dead) continue
            const d = Math.hypot(b.x - p.x, b.y - p.y)
            if (d < bd) {
                bd = d
                best = b
            }
        }
        const tx = best ? best.x : p.x + f * this.playerH
        const ty = best ? best.y - best.size * 0.4 : p.y
        this.boltAt(tx, ty, this.meleeStats().dmg * 0.6 * t, f)
    },

    // returns true when the bubble eats the hit
    perkBlock() {
        if (!this.perk('bubble') || this.time < this.bubbleAt) return false
        const p = this.player
        this.bubbleAt = this.time + 12
        p.inv = 0.6
        this.flash(p.x, p.y - this.playerH * 0.5, 0x7dd3fc, this.playerH * 0.9, 0.3)
        this.burst(p.x, p.y - this.playerH * 0.5, 24, 0xbae6fd, 300)
        this.floatText(p.x, p.y - this.playerH - 18, '🫧 BLOCKED', 'armor')
        this.sfx && this.sfx.play('bubble')
        return true
    },

    perkOnHurt(src) {
        const s = this.perk('spikes')
        if (!s || !src || !src.type || src.dead || !this.damageBug) return
        this.damageBug(src, this.meleeStats().dmg * 0.5 * s, Math.sign(src.x - this.player.x) || 1, false, 'thrown')
        this.burst(src.x, src.y - src.size * 0.5, 10, 0x86efac, 220)
    },

    updatePerks(dt) {
        if (this.perk('plating') && this.stats && this.stats.armor < 100) {
            this.stats.armor = Math.min(100, this.stats.armor + dt * 1.5 * this.perk('plating'))
            this.stats.armorOn = true
        }
        // the bubble shimmers around the hero while it is up
        if (this.perk('bubble') && this.time >= this.bubbleAt && this.player && Math.random() < dt * 6) {
            const p = this.player
            const a = rand(0, Math.PI * 2)
            this.burst(p.x + Math.cos(a) * this.playerH * 0.45, p.y - this.playerH * 0.5 + Math.sin(a) * this.playerH * 0.5, 1, 0x7dd3fc, 20)
        }
    },
}
