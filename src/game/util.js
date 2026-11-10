// shared constants & helpers for the "Fix the bugs" game
export const GRAVITY = 2600
export const MAX_FALL = 1600

export const rand = (a, b) => a + Math.random() * (b - a)
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const pick = arr => arr[(Math.random() * arr.length) | 0]
export const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// every enemy; `kind` picks the builder / brain (default: bug)
// `model` = Quaternius monster in public/game/monsters (falls back to the hand-made creature if missing)
export const ENEMY_TYPES = {
    crawler: {model: 'mushnub', size: 46, hp: 1, speed: 100, color: 0xf87171, head: 0x2e1065, eye: 0xff3b6b, score: 100},
    orc: {model: 'orc', size: 68, hp: 2, speed: 125, color: 0x84cc16, head: 0x1a2e05, eye: 0xfacc15, score: 150},
    jumper: {model: 'cactoro', size: 56, hp: 2, speed: 90, color: 0x4ade80, head: 0x431407, eye: 0x22d3ee, score: 150},
    tank: {model: 'yeti', size: 88, hp: 5, speed: 60, color: 0xbae6fd, head: 0x450a0a, eye: 0xfacc15, score: 300},
    // the boss: a big dragon that flies over the knight and breathes fireballs
    boss: {
        kind: 'dragonboss', boss: true, title: 'THE PROD DRAGON', model: 'dragon_evolved', size: 210, hp: 40, speed: 75,
        color: 0xf97316, head: 0x1c0303, eye: 0x14e956, score: 5000, burn: true,
    },
    bossYeti: {
        kind: 'yetiboss', boss: true, title: 'YETI KING', model: 'yeti', size: 200, hp: 48, speed: 95,
        color: 0xbae6fd, head: 0x0c4a6e, eye: 0x38bdf8, score: 5000,
    },
    bossWizard: {
        kind: 'wizardboss', boss: true, title: 'DARK WIZARD', model: 'wizard', size: 165, hp: 40, speed: 60,
        color: 0xa78bfa, head: 0x2e1065, eye: 0xc084fc, score: 5000,
    },
    bossShroom: {
        kind: 'shroomboss', boss: true, title: 'SHROOM GIANT', model: 'mushnub', size: 210, hp: 52, speed: 55,
        color: 0xf87171, head: 0x450a0a, eye: 0x86efac, score: 5000,
    },
    // event monster: runs away from the hero, drops a pile of coins
    golden: {model: 'mushnub', flee: true, size: 52, hp: 8, speed: 250, color: 0xfacc15, head: 0x713f12, eye: 0xfde047, score: 1500},
    // flyers hover near the knight and dive at him
    bat: {kind: 'bat', model: 'armabee', size: 54, hp: 2, speed: 170, color: 0xfacc15, score: 200},
    dragon: {kind: 'bat', model: 'dragon', size: 78, hp: 3, speed: 150, color: 0xef4444, score: 300, burn: true},
    // tougher blue bee: its sting jams your gun for 3 s
    stingbee: {kind: 'bat', model: 'armabee', hue: 0.46, size: 64, hp: 5, speed: 195, color: 0x60a5fa, score: 400, jam: true},
    // jelly that bounces at the knight and splits in two when it dies
    slime: {kind: 'slime', model: 'greenspikyblob', size: 58, hp: 3, speed: 120, color: 0x4ade80, score: 200},
    slimelet: {kind: 'slime', model: 'pinkblob', size: 36, hp: 1, speed: 140, color: 0xf9a8d4, score: 80},
    // archer: keeps away, draws the bow and fires leading arrows
    archer: {kind: 'archer', model: 'orc', tint: 0x9bd37a, size: 64, hp: 2, speed: 95, color: 0x84cc16, score: 250},
    // bomber: lobs bouncing bombs (the sword can bat them back)
    bomber: {kind: 'bomber', model: 'cactoro', tint: 0xffb38a, size: 58, hp: 3, speed: 80, color: 0xf97316, score: 250},
    // caster that keeps its distance and throws energy orbs
    sentinel: {kind: 'sentinel', model: 'wizard', size: 62, hp: 3, speed: 45, color: 0xa78bfa, score: 300},
}
