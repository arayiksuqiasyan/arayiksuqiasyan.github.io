// The shop economy: kills earn coins; coins buy and upgrade melee weapons and guns.
// Progress (coins, owned items, levels, equipped items, game level) is kept in a cookie.
// Mixed into GameEngine.prototype — `this` is the engine.
import * as THREE from 'three';
import {clamp, rand} from './util';
import {MAGAZINE, WEAPON_ORDER, WEAPONS} from './weapons';
import {applyTheme} from './theme';
import {ALLIES} from './allies';

const COOKIE = 'fixbugs_progress'
export const MELEE = {
    sword: {name: 'Knight Sword', icon: '🗡️', price: 0, dmg: 3.0, reach: 1.15, speed: 1, glow: 0x14e956, desc: 'perk: charges the Super Strike twice as fast'},
    axe: {name: 'Battle Axe', icon: '🪓', price: 900, dmg: 4.5, reach: 1.35, speed: 0.78, glow: 0xf97316, desc: 'perk: every 3rd swing is a CRIT ×2.5'},
    katana: {name: 'Energy Katana', icon: '⚔️', price: 1600, dmg: 2.6, reach: 1.25, speed: 1.35, glow: 0x22d3ee, desc: 'perk: the lunge dashes through monsters'},
    pickaxe: {name: 'Miner Pickaxe', price: 1200, dmg: 5.4, reach: 1.2, speed: 0.85, glow: 0xfbbf24, desc: 'perk: breaks blocks in one hit — every block drops coins'},
    torch: {name: 'Blazing Torch', price: 1400, dmg: 3.0, reach: 1.1, speed: 1.2, glow: 0xff7a1a, desc: 'perk: sets monsters on fire'},
    knife: {name: 'Hunter Knife', price: 800, dmg: 1.7, reach: 0.9, speed: 1.6, glow: 0xe5e7eb, desc: 'perk: very fast · backstab ×3'},
    mug: {name: 'Coffee Mug', price: 1000, dmg: 4.7, reach: 0.95, speed: 1.1, glow: 0xb7794a, desc: 'perk: a coffee splash slows monsters ☕'},
    hammer: {name: 'Thunder Hammer', price: 2600, dmg: 6.0, reach: 1.3, speed: 0.68, glow: 0x60a5fa, unlock: 4, quake: true, desc: 'perk: every blow sends a ground shockwave'},
    scythe: {name: 'Reaper Scythe', price: 3600, dmg: 4.2, reach: 1.7, speed: 1.0, glow: 0xa855f7, unlock: 7, desc: 'perk: every 5 kills harvest +1 heart'},
}
export const HEROES = {
    knight: {name: 'Knight', price: 0, file: null, trait: 'guardian', desc: 'Guardian — starts with 100% armor, armor wears 2× slower'},
    michelle: {name: 'Michelle', price: 1500, file: 'heroes/michelle.glb', trait: 'helper', desc: 'Summoner — E: her drone flies out and fights for 30 s'},
    vanguard: {name: 'Vanguard', price: 2500, file: 'heroes/vanguard.glb', trait: 'jetpack', desc: 'Jetpack — double-tap W to fly; fuel refills over time'},
    ferrum: {name: 'Ferrum', price: 6000, file: 'heroes/ferrum.glb', trait: 'metal', desc: 'Master of metal — iron blades orbit him, K: Magnetic Pulse, E: Iron Storm · his own weapon only'},
    swat: {name: 'Gunslinger', price: 4000, file: 'heroes/swat.glb', trait: 'dual', desc: 'Dual pistols instead of melee — they aim at the closest monster by themselves · E: Bullet Storm'},
    ninja: {name: 'Ninja', price: 3000, file: 'heroes/ninja.glb', trait: 'stealth', desc: 'Assassin — E: vanish for 5 s, monsters can\'t see or hit you'},
}
export const GUN_PRICE = {bow: 0, shotgun: 500, laser: 700, rocket: 1200, lightning: 1600, minigun: 2200, flamer: 2000, railgun: 3200, blackhole: 4500}
export const MAX_LV = 5
const MELEE_POWER = 4.25
// all guns hit a little softer than their raw formulas (overall balance knob)
const GUN_POWER = 0.85
// what every gun gains at the top upgrade level
const MASTERY = {
    bow: '3 arrows, rapid fire, pierce 4', shotgun: '11 pellets', laser: 'double beam', rocket: '3 rockets at once', lightning: 'chains 9 monsters',
    minigun: 'twin barrels', flamer: 'long flame that sweeps up & down', railgun: '×1.6 damage, thicker beam',
    blackhole: 'bigger, longer vortex',
}
// hero upgrades bought in the shop (level 0 = not bought)
export const HERO_STATS = {
    hp: {name: 'Max hearts', icon: 'heart', max: 4, cost: lv => 400 * (lv + 1), desc: '+1 heart per level (6 → 10)'},
    aspd: {name: 'Attack speed', icon: 'bolt', max: 5, cost: lv => 300 * (lv + 1), desc: 'melee swings 10% faster per level'},
    armor: {name: 'Armor', icon: 'shield', max: 5, cost: lv => 300 * (lv + 1), desc: 'start with +10% armor per level (50% → 100%)'},
    // the Super Strike (hold Space / L once the meter is full)
    super: {name: 'Super Strike', icon: 'bolt', max: 4, cost: lv => [3000, 7000, 14000, 25000][lv], desc: 'charges 25% faster, +12% radius, +30% damage per level'},
    // Shift dash: faster cooldown, longer and harder dash; the last level gives two charges
    dash: {name: 'Dash', icon: 'bolt', max: 4, cost: lv => [2000, 5000, 10000, 20000][lv], desc: 'Shift dash: shorter cooldown, longer & harder dash · level 4: two dashes in a row'},
    // the hero grows: 3 pricey levels, each one bigger, quicker and tougher
    growth: {name: 'Growth', icon: 'hero', max: 3, cost: lv => [12000, 30000, 60000][lv], desc: 'the hero grows: +12% size, +10% run speed, +8% attack speed, +1 ❤ per level'},
    // endless upgrades: monsters keep getting stronger, so can you
    power: {name: 'Power', icon: 'sword', max: Infinity, cost: lv => Math.round(3000 * Math.pow(1.35, lv) / 100) * 100, desc: 'ALL damage +10% per level · endless'},
    tough: {name: 'Toughness', icon: 'shield', max: Infinity, cost: lv => Math.round(2500 * Math.pow(1.35, lv) / 100) * 100, desc: 'armor wears 7% slower per level · endless'},
}
// global multipliers from the endless upgrades
export const powerMul = lv => Math.pow(1.1, lv || 0)
export const toughMul = lv => Math.pow(0.93, lv || 0)
export const upgradeCost = lv => 250 * lv
export const GUN_STAT_MAX = 4
export const gunStatCost = lv => 300 * (lv + 1)
// the damage track never ends: past the 4 dots every level is +10% (compounding) and 35% pricier
export const ENDLESS_KEYS = ['dmg']
export const endlessCost = lv => lv < GUN_STAT_MAX ? gunStatCost(lv) : Math.round(2000 * Math.pow(1.35, lv - GUN_STAT_MAX) / 100) * 100
const trackCost = (key, lv) => ENDLESS_KEYS.includes(key) ? endlessCost(lv)
    : key === 'multi' ? (lv < 3 ? 1500 * (lv + 1) * (lv + 1) : null) // 1 500 / 6 000 / 13 500
        : lv < GUN_STAT_MAX ? gunStatCost(lv) : null
const trackMul = (lv, step) => (1 + step * Math.min(lv, GUN_STAT_MAX)) * Math.pow(1.1, Math.max(0, lv - GUN_STAT_MAX))
const GUN_STAT_ROWS = [
    {key: 'dmg', label: 'Damage', desc: '+20% damage · then +10% forever'},
    {key: 'rate', label: 'Fire rate', desc: '+12% faster, less overheating'},
    {key: 'ammo', label: 'Ammo', desc: '+40 max, +50% per box · max = infinite'},
    {key: 'range', label: 'Range', desc: '+15% range'},
    // (stored as "multi" for old saves) — bigger, harder-hitting shots, never more of them
    {key: 'multi', label: 'Bigger shots', desc: '+35% projectile size, +30% damage', max: 3},
]
const MELEE_STAT_ROWS = [
    {key: 'dmg', label: 'Damage', desc: '+25% damage · then +10% forever'},
    {key: 'reach', label: 'Reach', desc: '+10% swing reach'},
]
const DEFAULT_PROGRESS = {
    level: 1, coins: 0, melee: 'sword', gun: 'bow', hero: 'knight', ally: null, owned: ['sword', 'bow', 'knight'],
    lv: {sword: 1, bow: 1},
    maxHp: 6, best: 0, stats: {hp: 0, aspd: 0, armor: 0, power: 0, tough: 0, growth: 0, dash: 0, super: 0},
}
const LASER_RANGE = 950
const ROCKET_SPEED = 900
const ROCKET_RADIUS = 175
const CHAIN_RANGE = 540
const CHAIN_HOP = 270

// Progress is signed so it cannot be edited by hand: the cookie holds base64(JSON) plus a hash of it
// salted with a key baked into the game. A changed value breaks the hash and the save is thrown away.
const SALT = 'fb:7Qm#x2!Lr9@kV-progress'
const SIGNED_FLAG = 'fixbugs_signed'

function hash(str) {
    // cyrb53 — small, fast 53-bit string hash
    let h1 = 0xdeadbeef ^ str.length
    let h2 = 0x41c6ce57 ^ str.length
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ c, 2654435761)
        h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const sign = body => hash(SALT + body + SALT.length)

function readCookie() {
    try {
        const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'))
        if (!m) return null
        const raw = decodeURIComponent(m[1])
        if (raw.startsWith('v2.')) {
            const [, body, sig] = raw.split('.')
            if (!body || sig !== sign(body)) return null // edited by hand
            return sanitize(JSON.parse(decodeURIComponent(escape(atob(body)))))
        }
        // old unsigned save: accepted once, only if this browser never had a signed one
        let signedBefore = false
        try { signedBefore = localStorage.getItem(SIGNED_FLAG) === '1' } catch (e) { /* storage blocked */ }
        return signedBefore ? null : sanitize(JSON.parse(raw))
    } catch (e) {
        return null
    }
}

function writeCookie(value) {
    try {
        const body = btoa(unescape(encodeURIComponent(JSON.stringify(value))))
        document.cookie = `${COOKIE}=${encodeURIComponent('v2.' + body + '.' + sign(body))}; max-age=31536000; path=/; SameSite=Lax`
        try { localStorage.setItem(SIGNED_FLAG, '1') } catch (e) { /* storage blocked */ }
    } catch (e) { /* cookies blocked: progress just lasts this visit */ }
}

// basic sanity: numbers must be finite and non-negative
function sanitize(p) {
    if (!p || typeof p !== 'object') return null
    const num = (v, max = 1e12) => (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : 0)
    p.coins = num(p.coins)
    p.level = Math.max(1, Math.floor(num(p.level, 10000)))
    for (const key of ['lv', 'stats']) {
        if (p[key] && typeof p[key] === 'object') for (const k in p[key]) p[key][k] = Math.floor(num(p[key][k], 1000))
    }
    for (const key of ['gunStats', 'meleeStats', 'allyStats']) {
        if (p[key] && typeof p[key] === 'object') {
            for (const id in p[key]) for (const k in p[key][id]) p[key][id][k] = Math.floor(num(p[key][id][k], 1000))
        }
    }
    if (!Array.isArray(p.owned)) p.owned = []
    return p
}

// distance from point (px,py) to segment (ax,ay)-(bx,by)
function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax
    const dy = by - ay
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

export const loadoutMethods = {
    // ---------------------------------------------------------------- progress
    loadProgress() {
        const saved = readCookie() || {}
        const p = {
            ...DEFAULT_PROGRESS, ...saved, lv: {...DEFAULT_PROGRESS.lv, ...(saved.lv || {})},
            stats: {...DEFAULT_PROGRESS.stats, ...(saved.stats || {})},
        }
        p.owned = [...new Set(['sword', 'bow', 'knight', ...(p.owned || [])])]
        if (!p.owned.includes(p.hero) || !HEROES[p.hero]) p.hero = 'knight'
        if (!p.owned.includes(p.melee) || !MELEE[p.melee]) p.melee = 'sword'
        if (!p.owned.includes(p.gun) || !WEAPONS[p.gun]) p.gun = 'bow'
        if (p.ally && (!p.owned.includes(p.ally) || !ALLIES[p.ally])) p.ally = null
        this.progress = p
    },

    // only the tab you are playing in writes the save, so a second open tab can't overwrite it
    saveProgress(force = false) {
        if (!force && typeof document !== 'undefined' && document.hasFocus && !document.hasFocus()) return
        writeCookie(this.progress)
    },

    // back in this tab: pick up what another tab may have saved meanwhile
    syncProgress() {
        if (!this.progress) return
        this.loadProgress()
        this.emitHud(true)
    },

    resetProgress() {
        this.progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS))
        this.saveProgress()
        this.restart()
    },

    // harder every level: tougher, faster and more numerous monsters
    applyDifficulty() {
        const L = this.progress.level
        this.level = L
        // colour theme of this level for the site and the 3D neon (stones, ground, embers)
        this.theme = applyTheme(L)
        if (this.stoneGlow) this.stoneGlow.color.setHex(this.theme.accent)
        const n = L - 1
        this.diff = {
            hp: 1 + 0.3 * n + 0.022 * n * n,         // L8 ×4.2, L20 ×14.6
            speed: Math.min(1.9, 1 + 0.07 * n),
            spawn: 1 + 0.15 * n,
            extra: 3 * n,
            dmg: L >= 14 ? 3 : L >= 6 ? 2 : 1,      // hearts lost per hit
            rest: Math.max(0.45, 1 - 0.03 * n),      // monsters rest less between strikes
            inv: Math.max(0.7, 1.2 - 0.03 * n),      // shorter invulnerability after you're hit
            armor: 1 + 0.08 * n,                     // armor wears faster
            windup: Math.max(0.6, 1 - 0.022 * n),    // monsters strike sooner
            elite: Math.min(0.3, 0.04 + 0.013 * n),
            elites: 1 + Math.floor(L / 6),
        }
        this.weapon = this.progress.gun
        this.setGunLook()
        this.setGunGlow()
        this.setMeleeLook()
    },

    // called once when the level's dragon dies: bonus coins and the next (harder) level
    winLevel() {
        const P = this.progress
        P.best = Math.max(P.best || 0, this.stats.score)
        this.levelBonus = 250 * P.level
        P.coins += this.levelBonus
        this.wonLevel = P.level
        P.level += 1
        this.saveProgress()
    },

    addCoins(n) {
        this.progress.coins += n
        this.runCoins = (this.runCoins || 0) + n
        if (!this.saveTimer) {
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null
                this.saveProgress()
            }, 2000)
        }
    },

    // ---- weapon stats (with upgrade levels)
    // per-melee upgrade tracks: damage and reach (0…GUN_STAT_MAX)
    meleeTracks(id = this.progress.melee) {
        const P = this.progress
        if (!P.meleeStats) P.meleeStats = {}
        if (!P.meleeStats[id]) P.meleeStats[id] = {dmg: Math.max(0, (P.lv[id] || 1) - 1), reach: 0}
        return P.meleeStats[id]
    },

    meleeStats() {
        const id = this.progress.melee
        const M = MELEE[id]
        const t = this.meleeTracks(id)
        const aspd = (1 + 0.1 * ((this.progress.stats && this.progress.stats.aspd) || 0)) * (1 + 0.08 * this.growthLv())
        return {
            ...M, id, lv: t.dmg + 1,
            // melee is the risky close-range option: with the per-weapon dmg values above, every 4-dot melee
            // weapon does ~110–120 DPS on one target — level with the best maxed gun — plus its own perk
            dmg: MELEE_POWER * M.dmg * trackMul(t.dmg, 0.25) * powerMul(this.progress.stats.power), reach: M.reach * (1 + 0.1 * t.reach), speed: M.speed * aspd * (this.perkSpeed ? this.perkSpeed() : 1),
        }
    },

    upgradeMeleeStat(id, key) {
        const P = this.progress
        if (!P.owned.includes(id) && id !== 'pistols') return false
        const t = this.meleeTracks(id)
        const lv = t[key] || 0
        const cost = trackCost(key, lv)
        if (cost == null || P.coins < cost) return false
        P.coins -= cost
        t[key] = lv + 1
        this.saveProgress()
        if (key === 'reach' && id === P.melee) this.setMeleeLook()
        this.emitHud(true)
        return true
    },

    heroMaxHp() {
        return 6 + (this.progress.stats.hp || 0) + this.growthLv()
    },

    growthLv() {
        return (this.progress && this.progress.stats && this.progress.stats.growth) || 0
    },

    growthScale() {
        return 1 + 0.12 * this.growthLv()
    },

    heroStartArmor() {
        const guardian = this.progress.hero === 'knight' ? 50 : 0
        return Math.min(100, 50 + guardian + 10 * (this.progress.stats.armor || 0))
    },

    upgradeStat(id) {
        const S = HERO_STATS[id]
        const P = this.progress
        const lv = P.stats[id] || 0
        if (!S || lv >= S.max || P.coins < S.cost(lv)) return false
        P.coins -= S.cost(lv)
        P.stats[id] = lv + 1
        // apply right away to the running game
        if (this.player && id === 'growth') {
            this.player.maxHp = this.heroMaxHp()
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1)
            this.wearHero(P.hero).catch(() => {})
        }
        if (this.player && id === 'hp') {
            this.player.maxHp = this.heroMaxHp()
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1)
        }
        this.saveProgress()
        this.emitHud(true)
        return true
    },

    // ---- per-gun upgrade tracks: damage, fire rate, ammo (0…GUN_STAT_MAX each)
    gunStats(id = this.weapon) {
        const P = this.progress
        if (!P.gunStats) P.gunStats = {}
        if (!P.gunStats[id]) {
            // migrate the old single level into the three tracks
            const old = Math.max(0, (P.lv[id] || 1) - 1)
            P.gunStats[id] = {dmg: old, rate: old, ammo: old, range: old}
        }
        if (P.gunStats[id].range === undefined) P.gunStats[id].range = Math.max(0, (P.lv[id] || 1) - 1)
        return P.gunStats[id]
    },

    gunMul() {
        return GUN_POWER * trackMul(this.gunStats().dmg, 0.2) * (1 + 0.3 * Math.min(3, this.gunStats().multi || 0)) * powerMul(this.progress.stats.power)
    },

    // guns have a fixed range (reach upgrades are for melee weapons only)
    rangeMul() {
        return 1 + 0.15 * Math.min(this.gunStats().range || 0, GUN_STAT_MAX)
    },

    // the Bigger shots track: projectile size (damage is in gunMul)
    shotScaleFor(id = this.weapon) {
        return 1 + 0.35 * Math.min(3, this.gunStats(id).multi || 0)
    },

    ammoMax() {
        return 99 + 40 * this.gunStats().ammo
    },

    magSize() {
        return Math.round(MAGAZINE * (1 + 0.5 * this.gunStats().ammo) * (1 + (this.perk ? this.perk('quarter') : 0)))
    },

    startAmmo() {
        return 10 * this.gunStats().ammo
    },

    // all three tracks maxed = mastery perk (3 rockets, sweeping long flame, double laser…)
    mastery() {
        const s = this.gunStats()
        const endless = WEAPONS[this.weapon] && !WEAPONS[this.weapon].cost
        return s.dmg >= GUN_STAT_MAX && s.rate >= GUN_STAT_MAX && (endless || s.ammo >= GUN_STAT_MAX)
    },

    infiniteAmmo() {
        if (WEAPONS[this.weapon] && !WEAPONS[this.weapon].cost) return true
        return this.gunStats().ammo >= GUN_STAT_MAX
    },

    gunRate() {
        const r = WEAPONS[this.weapon].rate * (1 - 0.12 * this.gunStats().rate) / (this.perkSpeed ? this.perkSpeed() : 1)
        // the maxed bow becomes a rapid-fire volley bow
        return this.weapon === 'bow' && this.mastery() ? r * 0.55 : r
    },

    // heat per shot for guns that overheat (flamethrower, minigun); none at max fire rate
    gunHeat() {
        const W = WEAPONS[this.weapon]
        const r = this.gunStats().rate
        if (!W.heat || r >= GUN_STAT_MAX) return 0
        return W.heat * (1 - 0.2 * r)
    },

    upgradeGunStat(id, key) {
        const P = this.progress
        if (!P.owned.includes(id)) return false
        const s = this.gunStats(id)
        const lv = s[key] || 0
        const cost = trackCost(key, lv)
        if (cost == null || P.coins < cost) return false
        P.coins -= cost
        s[key] = lv + 1
        this.saveProgress()
        this.emitHud(true)
        return true
    },

    // ---- shop
    shopState() {
        const P = this.progress
        const item = (id, def, price, slot) => ({
            id, slot, name: def.name, icon: def.icon, price,
            unlock: def.unlock || 0, locked: (def.unlock || 0) > P.level,
            desc: slot === 'gun'
                ? `${def.desc} · all tracks maxed: ${MASTERY[id] || 'bonus'}`
                : def.desc,
            owned: P.owned.includes(id), lv: P.lv[id] || 0,
            equipped: slot === 'melee' ? P.melee === id : slot === 'hero' ? P.hero === id : slot === 'ally' ? P.ally === id : P.gun === id,
            upgrade: slot === 'hero' && P.owned.includes(id) && (P.lv[id] || 1) < MAX_LV ? upgradeCost(P.lv[id] || 1) : null,
            gunRows: (slot === 'gun' || slot === 'melee') && P.owned.includes(id)
                ? (slot === 'gun'
                    ? GUN_STAT_ROWS.filter(r => r.key !== 'ammo' || WEAPONS[id].cost)
                    : MELEE_STAT_ROWS).map(r => {
                    const lv = (slot === 'gun' ? this.gunStats(id) : this.meleeTracks(id))[r.key] || 0
                    const row = {...r, lv, max: r.max || GUN_STAT_MAX, endless: ENDLESS_KEYS.includes(r.key), cost: trackCost(r.key, lv)}
                    if (slot === 'gun' && id === 'rocket' && r.key === 'multi') {
                        Object.assign(row, {label: 'Bigger rockets', desc: '+35% rocket size and blast radius, +30% damage'})
                    }
                    return row
                })
                : null,
        })
        return {
            coins: P.coins,
            // the Gunslinger can't use melee weapons: his dual pistols take that tab
            // hero and melee are separate things: the melee list (with its upgrades) is always there;
            // the Gunslinger just gets his dual pistols on top of it
            // heroes with a kit of their own see only it: Ferrum his Iron Blades, the Gunslinger his dual pistols
            melee: this.isMetal && this.isMetal() ? [this.ferrumShopItem()]
                : this.isDual && this.isDual() ? [this.pistolShopItem()]
                    : Object.entries(MELEE).map(([id, d]) => item(id, d, d.price, 'melee')),
            locked: this.isMetal && this.isMetal() ? {gun: 'Ferrum fights with metal only — guns are locked while he is your hero.'} : {},
            gun: this.isMetal && this.isMetal() ? [] : WEAPON_ORDER.map(id => item(id, WEAPONS[id], GUN_PRICE[id], 'gun')),
            hero: Object.entries(HEROES).map(([id, d]) => ({...item(id, d, d.price, 'hero'), upgrade: null})),
            ally: Object.entries(ALLIES).map(([id, d]) => {
                const it = {...item(id, d, d.price, 'ally'), upgrade: null, gunRows: null}
                if (P.owned.includes(id)) {
                    const t = this.allyTracks(id)
                    it.gunRows = [
                        {key: 'dmg', label: 'Damage', desc: '+25% damage · then +10% forever'},
                        {key: 'rate', label: 'Speed', desc: '+12% attack & run speed'},
                    ].map(r => ({...r, lv: t[r.key] || 0, max: GUN_STAT_MAX, endless: ENDLESS_KEYS.includes(r.key), cost: trackCost(r.key, t[r.key] || 0)}))
                }
                return it
            }),
            stats: Object.entries(HERO_STATS).map(([id, d]) => {
                const lv = P.stats[id] || 0
                return {
                    id, slot: 'stat', name: d.name, statIcon: d.icon, desc: d.desc, owned: true, equipped: false,
                    lv, max: d.max, endless: d.max === Infinity, upgrade: lv < d.max ? d.cost(lv) : null,
                }
            }),
        }
    },

    // ---- ally upgrade tracks: damage (endless) and speed
    allyTracks(id) {
        const P = this.progress
        if (!P.allyStats) P.allyStats = {}
        if (!P.allyStats[id]) P.allyStats[id] = {dmg: 0, rate: 0}
        return P.allyStats[id]
    },

    allyMul(id) {
        const t = this.allyTracks(id)
        return {dmg: trackMul(t.dmg || 0, 0.25), speed: 1 + 0.12 * Math.min(t.rate || 0, GUN_STAT_MAX)}
    },

    upgradeAllyStat(id, key) {
        const P = this.progress
        if (!P.owned.includes(id)) return false
        const t = this.allyTracks(id)
        const lv = t[key] || 0
        const cost = trackCost(key, lv)
        if (cost == null || P.coins < cost) return false
        P.coins -= cost
        t[key] = lv + 1
        this.saveProgress()
        this.emitHud(true)
        return true
    },

    pistolShopItem() {
        const t = this.meleeTracks('pistols')
        const rows = [
            {key: 'dmg', label: 'Damage', desc: '+25% damage · then +10% forever'},
            {key: 'rate', label: 'Fire rate', desc: '+10% faster'},
        ]
        return {
            id: 'pistols', slot: 'melee', name: 'Dual Pistols', price: 0, owned: true, equipped: true, lv: 1,
            desc: 'auto-aim at the closest monster in any direction · no ammo · melee weapons are locked for the Gunslinger',
            gunRows: rows.map(r => {
                const lv = t[r.key] || 0
                return {...r, lv, max: GUN_STAT_MAX, endless: ENDLESS_KEYS.includes(r.key), cost: trackCost(r.key, lv)}
            }),
        }
    },

    buyItem(slot, id) {
        const P = this.progress
        const price = slot === 'melee' ? MELEE[id].price : slot === 'hero' ? HEROES[id].price : slot === 'ally' ? ALLIES[id].price : GUN_PRICE[id]
        const def = slot === 'melee' ? MELEE[id] : slot === 'gun' ? WEAPONS[id] : slot === 'ally' ? ALLIES[id] : HEROES[id]
        if ((def.unlock || 0) > P.level) return false
        if (P.owned.includes(id) || P.coins < price) return false
        P.coins -= price
        P.owned.push(id)
        P.lv[id] = 1
        this.equipItem(slot, id)
        return true
    },

    upgradeItem(id) {
        const P = this.progress
        const lv = P.lv[id] || 1
        if (!P.owned.includes(id) || lv >= MAX_LV || P.coins < upgradeCost(lv)) return false
        P.coins -= upgradeCost(lv)
        P.lv[id] = lv + 1
        this.saveProgress()
        this.emitHud(true)
        return true
    },

    equipItem(slot, id) {
        const P = this.progress
        if (!P.owned.includes(id)) return
        if (slot === 'melee') P.melee = id
        else if (slot === 'ally') {
            P.ally = id
            this.spawnAlly && this.spawnAlly()
        } else if (slot === 'hero') {
            P.hero = id
            this.wearHero(id).catch(err => console.warn('hero failed to load', err))
        } else {
            P.gun = id
            this.weapon = id
        }
        this.saveProgress()
        this.setGunLook()
        this.setGunGlow()
        this.setMeleeLook()
        this.emitHud(true)
    },

    // Q cycles between owned guns
    switchWeapon() {
        const list = WEAPON_ORDER.filter(w => this.progress.owned.includes(w))
        if (list.length < 2 || !this.player) return
        const i = list.indexOf(this.weapon)
        this.equipItem('gun', list[(i + 1) % list.length])
        const W = WEAPONS[this.weapon]
        this.floatText(this.player.x, this.player.y - this.playerH - 16, W.name, 'ammo')
    },

    // swap the model in the hand: sword / battle axe / energy katana
    setMeleeLook() {
        if (!this.sword || !this.progress) return
        const inner = this.sword.userData.inner
        while (inner.children.length) inner.remove(inner.children[0])
        const model = this.buildMeleeModel(this.progress.melee)
        // a longer reach shows as a slightly longer weapon
        // reach makes the weapon a bit bigger (uniformly, so real models keep their proportions)
        model.scale.setScalar(1 + 0.08 * (this.meleeTracks().reach || 0))
        inner.add(model)
    },

    setGunGlow() {
        if (!this.wMats) return
        const c = WEAPONS[this.weapon || 'bow'].glow
        this.wMats.gunGlow.color.setHex(c)
        this.wMats.gunGlow.emissive.setHex(c)
    },

    // ---------------------------------------------------------------- weapons
    fire_laser() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const a0 = this.aimAngle(mx, my, f, 1e6)
        const angles = this.mastery() ? [a0 - 0.07, a0 + 0.07] : [a0]
        for (const a of angles) this.laserBeam(mx, my, f, a)
        this.sfx && this.sfx.play('laser')
        this.burst(mx, my, 10, 0xa5f3fc, 240)
        p.vx -= f * 40
        this.shake = Math.max(this.shake, 4)
    },

    laserBeam(mx, my, f, a) {
        const ex = mx + f * Math.cos(a) * LASER_RANGE * this.rangeMul()
        const ey = my + Math.sin(a) * LASER_RANGE * this.rangeMul()
        for (const b of this.bugs) {
            if (b.dead) continue
            if (segDist(b.x, b.y - b.size * 0.42, mx, my, ex, ey) < b.size * 0.45 + 6) {
                this.damageBug(b, 2 * this.gunMul(), f, false, 'bullet')
                this.burst(b.x, b.y - b.size * 0.42, 10, 0x67e8f9, 260)
            }
        }
        for (const o of this.orbs) if (segDist(o.x, o.y, mx, my, ex, ey) < 18) o.life = 0
        for (const e of this.platformList) {
            if (e.stone) continue
            const cx = clamp((e.l + e.r) / 2, Math.min(mx, ex), Math.max(mx, ex))
            const cy = my + (cx - mx) * Math.tan(a) * f
            if (cx > e.l && cx < e.r && cy > e.t && cy < e.b) this.damageElement(e, 0.25, cx, cy, false, true)
        }
        this.addBeam(mx, my, ex, ey, 0x22d3ee, 6, 16, 0.14)
    },

    fire_rocket() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const a0 = this.aimAngle(mx, my, f, ROCKET_SPEED)
        const angles = this.mastery() ? [a0 - 0.2, a0, a0 + 0.2] : [a0]
        for (const a of angles) this.launchRocket(mx, my, f, a)
        this.sfx && this.sfx.play('rocket')
        this.burst(mx, my, 16, 0xffb347, 300)
        p.vx -= f * 220
        this.shake = Math.max(this.shake, 7)
    },

    // Bigger rockets (the rocket's "multi" track): size, blast radius and damage
    rocketSize() {
        return this.shotScaleFor('rocket')
    },

    launchRocket(mx, my, f, a) {
        const k = this.rocketSize()
        const mesh = new THREE.Group()
        mesh.scale.setScalar(k)
        const body = new THREE.Mesh(this.geo.cyl, this.loadoutMats.rocket)
        body.scale.set(5, 22, 5)
        body.rotation.z = -Math.PI / 2
        const tip = new THREE.Mesh(this.geo.cone, this.loadoutMats.rocketTip)
        tip.scale.set(5, 9, 5)
        tip.rotation.z = -Math.PI / 2
        tip.position.x = 11
        mesh.add(body, tip)
        mesh.renderOrder = 12
        this.scene.add(mesh)
        this.rockets.push({mesh, x: mx, y: my, vx: f * Math.cos(a) * ROCKET_SPEED, vy: Math.sin(a) * ROCKET_SPEED, life: 1.3 * this.rangeMul(), k})
    },

    explode(x, y, k = 1) {
        this.sfx && this.sfx.play('boom', {volume: Math.min(1, 0.7 + 0.1 * k)})
        const R = ROCKET_RADIUS * (0.85 + 0.3 * k)
        const R2 = R * R
        for (const b of this.bugs.slice()) {
            if (b.dead) continue
            const dx = b.x - x
            const dy = b.y - b.size * 0.42 - y
            if (dx * dx + dy * dy < R2) this.damageBug(b, 4 * this.gunMul(), Math.sign(dx) || 1, false)
        }
        for (const o of this.orbs) if ((o.x - x) ** 2 + (o.y - y) ** 2 < R2) o.life = 0
        for (const e of this.platformList) {
            if (e.stone) continue
            const nx = clamp(x, e.l, e.r)
            const ny = clamp(y, e.t, e.b)
            if ((nx - x) ** 2 + (ny - y) ** 2 < R2 * 0.6) this.damageElement(e, 2, nx, ny)
        }
        // a layered explosion: white-hot core, swelling fireball, shockwave, flames, smoke, floating embers
        this.flash(x, y, 0xffffff, R * 0.45, 0.12)
        this.flash(x, y, 0xffd27a, R * 0.8, 0.22)
        this.flash(x, y, 0xff6a00, R * 1.25, 0.42)
        this.ring(x, y, 0xffe8c2, R * 1.15, 0.32, 0.93)
        if (this.spray) {
            this.spray(this.lowFx ? 10 : 22, x, y, 0xff7a1a, () => {
                const a = rand(0, Math.PI * 2)
                const v = rand(80, 320)
                return [Math.cos(a) * v, Math.sin(a) * v * 0.6 - rand(80, 220)]
            }, [0.3, 0.6], 0.1)
            this.spray(this.lowFx ? 6 : 12, x, y, 0xfde047, () => [rand(-160, 160), -rand(120, 320)], [0.2, 0.4], 0.05)
            this.spray(this.lowFx ? 5 : 10, x, y - 10, 0x3f3a36, () => [rand(-70, 70), -rand(50, 140)], [0.8, 1.4], 0)
            this.spray(this.lowFx ? 4 : 8, x, y, 0xffa94d, () => [rand(-200, 200), -rand(20, 120)], [0.9, 1.5], 0)
        }
        // a charred mark on the block it went off next to
        const surf = this.surfaceAt && this.surfaceAt(x, y + 30)
        if (surf && this.addDecal) this.addDecal(x, surf.t + 4, R * 0.9, Math.max(20, R * 0.22), 'game-decal--scorch', rand(-6, 6), surf)
        // one freeze-frame per volley, not per rocket (several rockets froze the game in a row)
        if (this.time - (this.lastBlastStop || -9) > 0.3) {
            this.lastBlastStop = this.time
            this.hitStop(40)
        }
        this.burst(x, y, 40, 0xfff1a8, 420)
        this.burst(x, y, 30, 0x6b7280, 260)

        this.shake = Math.max(this.shake, 18)
    },

    fire_lightning() {
        const [mx, my, f] = this.muzzlePos()
        // first target: nearest monster in front, then hop to the nearest unhit one
        const hit = new Set()
        let from = [mx, my]
        let first = true
        const points = [[mx, my]]
        for (let n = 0, max = this.mastery() ? 9 : 5; n < max; n++) {
            let best = null
            let bestD = (first ? CHAIN_RANGE : CHAIN_HOP) * this.rangeMul()
            for (const b of this.bugs) {
                if (b.dead || hit.has(b)) continue
                const bx = b.x
                const by = b.y - b.size * 0.42
                if (first && (bx - mx) * f < -20) continue
                const d = Math.hypot(bx - from[0], by - from[1])
                if (d < bestD) {
                    bestD = d
                    best = b
                }
            }
            if (!best) break
            hit.add(best)
            first = false
            from = [best.x, best.y - best.size * 0.42]
            points.push(from)
        }
        if (points.length === 1) {
            // nothing in reach: a short crackle in front
            points.push([mx + f * 160, my + rand(-30, 30)])
        }
        for (let i = 1; i < points.length; i++) this.addBolt(points[i - 1], points[i])
        this.sfx && this.sfx.play('zap')
        for (const b of hit) {
            this.damageBug(b, 2 * this.gunMul(), f, false, 'bullet')
            b.stun = Math.max(b.stun || 0, 1)
            this.burst(b.x, b.y - b.size * 0.42, 14, 0xd8b4fe, 300)
        }
        this.shake = Math.max(this.shake, 5)
    },

    fire_minigun() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const a0 = this.aimAngle(mx, my, f, 1900)
        this.sfx && this.sfx.play('minigun')
        for (const off of this.mastery() ? [-0.04, 0.04] : [0]) {
            const a = a0 + off + rand(-0.06, 0.06)
            const mesh = new THREE.Mesh(this.geo.box, this.wMats.bullet)
            mesh.scale.set(18, 1.8, 1)
            mesh.rotation.z = -a * f
            mesh.renderOrder = 12
            this.scene.add(mesh)
            this.bullets.push({mesh, x: mx, y: my + off * 60, vx: f * Math.cos(a) * 1900, vy: Math.sin(a) * 1900, life: 0.42 * this.rangeMul(), dmg: this.gunMul()})
        }
        this.burst(mx + f * 6, my, 3, 0xfff1a8, 160)
        p.vx -= f * 12
        this.shake = Math.max(this.shake, 2)
    },

    // a cone of fire in front of the hero
    fire_flamer() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const master = this.mastery()
        const range = (master ? 500 : 290) * this.rangeMul()
        // the master flame sweeps up and down
        const axis = this.flameAxis = master ? Math.sin(this.time * 4.2) * 0.42 : 0
        for (const b of this.bugs) {
            if (b.dead) continue
            const dx = (b.x - mx) * f
            const dy = b.y - b.size * 0.42 - my
            if (dx < -10 || Math.hypot(dx, dy) > range + b.size * 0.4) continue
            if (Math.abs(Math.atan2(dy, Math.max(dx, 1)) - axis) > 0.5 && Math.abs(dy - Math.tan(axis) * dx) > b.size * 0.6) continue
            this.damageBug(b, 0.5 * this.gunMul(), f, false, 'bullet')
            b.burn = 3
        }
        for (const o of this.orbs) if ((o.x - mx) * f > 0 && (o.x - mx) * f < range && Math.abs(o.y - my) < 60) o.life = 0
        for (const e of this.platformList) {
            if (e.stone) continue
            const cx = clamp(mx + f * range * 0.6, e.l, e.r)
            if ((cx - mx) * f > 0 && (cx - mx) * f < range && my > e.t - 30 && my < e.b + 30) this.damageElement(e, 0.06, cx, clamp(my, e.t, e.b), false, true)
        }
        this.flameT = 0.16
        this.sfx && this.sfx.play('flamer')
        for (let i = 0; i < 4; i++) {
            const q = this.particles[this.pIndex]
            this.pIndex = (this.pIndex + 1) % this.particles.length
            q.grav = 1
            const a = axis + rand(-0.3, 0.3)
            const v = rand(600, 950) * (master ? 1.6 : 1)
            q.x = mx
            q.y = my
            q.vx = f * Math.cos(a) * v
            q.vy = Math.sin(a) * v - 120
            q.life = q.max = rand(0.22, 0.34)
            const c = this.tmpColor.set([0xff6a00, 0xffb347, 0xfff1a8, 0xff3b1f][(Math.random() * 4) | 0])
            q.r = c.r
            q.g = c.g
            q.b = c.b
        }
        p.vx -= f * 10
    },

    // a thick beam that goes through everything, stone included
    fire_railgun() {
        const p = this.player
        const [mx, my, f] = this.muzzlePos()
        const a = this.aimAngle(mx, my, f, 1e6)
        const L = 1500 * this.rangeMul()
        const ex = mx + f * Math.cos(a) * L
        const ey = my + Math.sin(a) * L
        for (const b of this.bugs) {
            if (b.dead) continue
            if (segDist(b.x, b.y - b.size * 0.42, mx, my, ex, ey) < b.size * 0.5 + 12) {
                this.damageBug(b, 6 * this.gunMul() * (this.mastery() ? 1.6 : 1), f, false)
                this.flash(b.x, b.y - b.size * 0.42, 0xc084fc, b.size * 1.1, 0.25)
            }
        }
        for (const o of this.orbs) if (segDist(o.x, o.y, mx, my, ex, ey) < 24) o.life = 0
        for (const e of this.platformList) {
            if (e.stone) continue
            const cx = clamp((e.l + e.r) / 2, Math.min(mx, ex), Math.max(mx, ex))
            const cy = my + (cx - mx) * Math.tan(a) * f
            if (cx > e.l && cx < e.r && cy > e.t - 10 && cy < e.b + 10) this.damageElement(e, 1, cx, clamp(cy, e.t, e.b))
        }
        this.addBeam(mx, my, ex, ey, 0xa855f7, this.mastery() ? 14 : 9, this.mastery() ? 46 : 30, 0.28)
        this.addBeam(mx, my, ex, ey, 0xffffff, 3, 8, 0.18)
        this.sfx && this.sfx.play('rail')
        this.burst(mx, my, 30, 0xe9d5ff, 420)
        this.flash(mx, my, 0xe9d5ff, 70, 0.18)
        p.vx -= f * 320
        this.shake = Math.max(this.shake, 16)
        this.hitStop(50)
    },

    // a slow orb that turns into a vortex
    fire_blackhole() {
        const [mx, my, f] = this.muzzlePos()
        const mesh = new THREE.Group()
        const core = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({color: 0x05010f}))
        core.scale.setScalar(10)
        const halo = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({
            color: 0x818cf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
            depthTest: false, depthWrite: false, toneMapped: false,
        }))
        halo.scale.setScalar(18)
        mesh.add(halo, core)
        mesh.renderOrder = 13
        this.scene.add(mesh)
        const big = this.mastery()
        this.holes.push({mesh, halo, x: mx, y: my, vx: f * 460, t: 0, travel: 0.85 * this.rangeMul(), life: big ? 3.4 : 2.4, R: big ? 420 : 300, open: false})
        this.burst(mx, my, 16, 0xa5b4fc, 260)
    },

    updateHoles(dt) {
        for (const h of this.holes) {
            h.t += dt
            if (!h.open) {
                h.x += h.vx * dt
                const hit = this.bugs.some(b => !b.dead && Math.abs(b.x - h.x) < b.size * 0.5 && Math.abs(b.y - b.size * 0.42 - h.y) < b.size * 0.5)
                if (hit || h.t > h.travel || h.x < 20 || h.x > this.vw - 20) {
                    h.open = true
                    h.t = 0
                    this.sfx && this.sfx.play('vortex')
                    this.flash(h.x, h.y, 0x818cf8, 160, 0.35)
                }
            } else {
                // pull and grind everything nearby
                const R = h.R || 300
                for (const b of this.bugs.slice()) {
                    if (b.dead) continue
                    const dx = h.x - b.x
                    const dy = h.y - (b.y - b.size * 0.42)
                    const d = Math.hypot(dx, dy)
                    if (d > R) continue
                    const pull = (this.isBoss(b) ? 0.6 : 3.2) * dt
                    b.x += dx * pull
                    b.y += dy * pull
                    b.vx *= 0.8
                    b.vy *= 0.8
                    b.onGround = false
                    b.hp -= 1.4 * this.gunMul() * dt
                    if (b.hp <= 0) this.killBug(b)
                }
                for (const o of this.orbs) if (Math.hypot(o.x - h.x, o.y - h.y) < R) o.life = 0
                for (let i = 0; i < 3; i++) {
                    const q = this.particles[this.pIndex]
                    this.pIndex = (this.pIndex + 1) % this.particles.length
                    q.grav = 1
                    const a = rand(0, Math.PI * 2)
                    const r = rand(120, 260)
                    q.x = h.x + Math.cos(a) * r
                    q.y = h.y + Math.sin(a) * r
                    q.vx = -Math.cos(a) * r * 3 - Math.sin(a) * 200
                    q.vy = -Math.sin(a) * r * 3 + Math.cos(a) * 200
                    q.life = q.max = 0.3
                    const c = this.tmpColor.set(Math.random() < 0.5 ? 0x818cf8 : 0xe9d5ff)
                    q.r = c.r
                    q.g = c.g
                    q.b = c.b
                }
                if (h.t > h.life) {
                    for (const b of this.bugs.slice()) {
                        if (!b.dead && Math.hypot(h.x - b.x, h.y - (b.y - b.size * 0.42)) < 220) this.damageBug(b, 4 * this.gunMul(), 1, false)
                    }
                    this.burst(h.x, h.y, 80, 0xa5b4fc, 700)
                    this.sfx && this.sfx.play('boom')
                    this.flash(h.x, h.y, 0xe9d5ff, 240, 0.4)
                    this.shake = Math.max(this.shake, 20)
                    h.done = true
                }
            }
            h.mesh.position.set(h.x, -h.y, 90)
            h.halo.rotation.z += dt * 6
            h.mesh.scale.setScalar(h.open ? 1.6 + Math.sin(this.time * 12) * 0.1 : 1)
        }
        this.holes = this.holes.filter(h => {
            if (!h.done) return true
            this.scene.remove(h.mesh)
            h.mesh.children.forEach(m => m.material.dispose())
            return false
        })
    },

    // ---------------------------------------------------------------- visuals
    // the flamethrower's living flame: a noise-driven shader cone that widens from the nozzle
    buildFlame() {
        const geo = new THREE.PlaneGeometry(1, 1, 1, 1).translate(0.5, 0, 0)
        const mat = new THREE.ShaderMaterial({
            uniforms: {uTime: {value: 0}, uAlpha: {value: 0}},
            vertexShader: `
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform float uAlpha; varying vec2 vUv;
                float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float noise(vec2 p) {
                    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
                }
                float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
                void main() {
                    float x = vUv.x;
                    float y = (vUv.y - 0.5) * 2.0;
                    float n = fbm(vec2(x * 5.0 - uTime * 7.0, y * 2.2 + uTime * 1.7));
                    float n2 = fbm(vec2(x * 9.0 - uTime * 11.0, y * 4.0 - uTime * 2.0));
                    float width = mix(0.1, 0.95, pow(x, 0.65));
                    float edge = abs(y) + (n - 0.5) * 0.55 * x + (n2 - 0.5) * 0.18;
                    float body = 1.0 - smoothstep(width * 0.35, width, edge);
                    float tip = smoothstep(1.02, 0.5, x + (n - 0.5) * 0.35) * smoothstep(0.0, 0.05, x);
                    float heat = clamp(body * tip * (0.75 + n2 * 0.6), 0.0, 1.0);
                    vec3 col = mix(vec3(0.75, 0.06, 0.0), vec3(1.0, 0.42, 0.04), smoothstep(0.05, 0.45, heat));
                    col = mix(col, vec3(1.0, 0.8, 0.25), smoothstep(0.45, 0.8, heat));
                    col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.9, 1.0, heat) * (1.0 - x) * 0.8);
                    float a = heat * uAlpha;
                    gl_FragColor = vec4(col * a * 1.15, a);
                }`,
            transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.renderOrder = 12
        mesh.visible = false
        mesh.frustumCulled = false
        this.scene.add(mesh)
        this.flame = mesh
        this.flameT = 0
        this.flameA = 0
    },

    updateFlame(dt) {
        if (!this.flame) return
        this.flameT = Math.max(0, this.flameT - dt)
        const target = this.flameT > 0 ? 1 : 0
        this.flameA += (target - this.flameA) * Math.min(1, dt * (target ? 22 : 9))
        const on = this.flameA > 0.02 && this.player && !this.player.dead
        this.flame.visible = on
        if (!on) return
        const [mx, my, f] = this.muzzlePos()
        this.flame.position.set(mx, -my, 88)
        const long = this.weapon === 'flamer' && this.mastery()
        const reach = this.weapon === 'flamer' ? this.rangeMul() : 1
        this.flame.scale.set(f * (long ? 540 : 320) * reach * (0.85 + this.flameA * 0.15), long ? 170 : 140, 1)
        this.flame.rotation.z = -f * (this.flameAxis || 0) + f * 0.04
        this.flame.material.uniforms.uTime.value = this.time
        this.flame.material.uniforms.uAlpha.value = this.flameA
    },

    buildLoadoutKit() {
        const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({
            color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
            toneMapped: false,
        })
        this.loadoutMats = {
            beamCore: add(0xffffff),
            rocket: new THREE.MeshStandardMaterial({color: 0x9ca3af, metalness: 0.7, roughness: 0.3}),
            rocketTip: new THREE.MeshStandardMaterial({color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.6}),
            blast: add(0xffa94d, 0.9),
        }
        this.beams = []
        this.rockets = []
        this.blasts = []
        this.holes = []
    },

    addBeam(ax, ay, bx, by, color, core, glow, life) {
        const k = this.shotScale || 1
        core *= k
        glow *= k
        const len = Math.hypot(bx - ax, by - ay)
        const ang = Math.atan2(-(by - ay), bx - ax)
        const g = new THREE.Group()
        const outer = new THREE.Mesh(this.geo.box, new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
            toneMapped: false,
        }))
        outer.scale.set(len, glow, 1)
        const inner = new THREE.Mesh(this.geo.box, this.loadoutMats.beamCore.clone())
        inner.scale.set(len, core, 1)
        g.add(outer, inner)
        g.position.set((ax + bx) / 2, -(ay + by) / 2, 88)
        g.rotation.z = ang
        g.renderOrder = 12
        this.scene.add(g)
        this.beams.push({mesh: g, life, max: life, thick: [glow, core]})
    },

    addBolt([ax, ay], [bx, by]) {
        // jagged lightning: a few kinked segments
        const n = 5
        let px = ax
        let py = ay
        for (let i = 1; i <= n; i++) {
            const t = i / n
            const nx = ax + (bx - ax) * t + (i < n ? rand(-16, 16) : 0)
            const ny = ay + (by - ay) * t + (i < n ? rand(-16, 16) : 0)
            this.addBeam(px, py, nx, ny, 0xa855f7, 3, 12, 0.16)
            px = nx
            py = ny
        }
    },

    updateLoadout(dt) {
        if (!this.flame) this.buildFlame()
        this.updateFlame(dt)
        this.updateHoles(dt)
        for (const b of this.beams) {
            b.life -= dt
            const k = Math.max(0, b.life / b.max)
            b.mesh.children[0].material.opacity = 0.45 * k
            b.mesh.children[1].material.opacity = k
            b.mesh.children[0].scale.y = b.thick[0] * (0.4 + k * 0.6)
        }
        this.beams = this.beams.filter(b => {
            if (b.life > 0) return true
            this.scene.remove(b.mesh)
            b.mesh.children.forEach(m => m.material.dispose())
            return false
        })

        for (const r of this.rockets) {
            r.life -= dt
            r.x += r.vx * dt
            r.y += r.vy * dt
            r.mesh.position.set(r.x, -r.y, 86)
            r.mesh.rotation.z = Math.atan2(-r.vy, r.vx)
            r.mesh.scale.x = r.vx < 0 ? 1 : 1
            this.burst(r.x - Math.sign(r.vx) * 14, r.y, 2, 0xffb347, 90)
            let boom = r.life <= 0 || r.x < -40 || r.x > this.vw + 40
            for (const b of this.bugs) {
                if (boom) break
                if (!b.dead && Math.abs(b.x - r.x) < b.size * 0.45 && Math.abs(b.y - b.size * 0.42 - r.y) < b.size * 0.45) boom = true
            }
            for (const e of this.platformList) {
                if (boom) break
                if (r.x > e.l && r.x < e.r && r.y > e.t && r.y < e.b) boom = true
            }
            if (boom) {
                this.explode(r.x, r.y, r.k || 1)
                r.life = -1
            }
        }
        this.rockets = this.rockets.filter(r => {
            if (r.life > 0) return true
            this.scene.remove(r.mesh)
            return false
        })

        for (const b of this.blasts) {
            b.t += dt
            const k = clamp(b.t / 0.35, 0, 1)
            const s = ROCKET_RADIUS * (0.3 + k * 0.7)
            b.mesh.scale.set(s, s, 1)
            b.mesh.material.opacity = 0.9 * (1 - k)
        }
        this.blasts = this.blasts.filter(b => {
            if (b.t < 0.35) return true
            this.scene.remove(b.mesh)
            b.mesh.material.dispose()
            return false
        })
    },

    clearLoadout() {
        for (const list of [this.beams, this.rockets, this.blasts, this.holes]) for (const o of list || []) this.scene.remove(o.mesh)
        this.beams = []
        this.rockets = []
        this.blasts = []
        this.holes = []
    },
}
