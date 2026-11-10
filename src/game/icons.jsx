import React from "react";

// one consistent line-icon set for the game UI (24×24, stroke = currentColor)
const P = {
    cart: ['M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2', 'M10 20.5h.01', 'M17 20.5h.01'],
    rebuild: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5'],
    close: ['M18 6 6 18', 'm6 6 12 12'],
    coin: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M14.8 9.4c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2 0 2.8 5.6 1.5 5.6 4.3 0 1.2-1.2 2-2.8 2-1.3 0-2.4-.6-2.9-1.5', 'M12 6.5v11'],
    shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    heart: ['M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2 0 3.4 1.1 5.4 3.2 2-2.1 3.4-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z'],
    bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
    sword: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'm13 19 6-6', 'm16 16 4 4', 'm19 21 2-2'],
    axe: ['m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9', 'M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z'],
    katana: ['M21 3 8 16', 'M21 3c-1 4-4 7-8 9', 'm6 14 4 4', 'm7 17-4 4'],
    bow: ['M6 3c7 3 7 15 0 18', 'M6 3v18', 'M3 12h18', 'm18 9 3 3-3 3'],
    shotgun: ['M2 10h13l3-3h4v4h-3l-2 2h-3l-1 5H9l1-5H6l-1 2H2z'],
    laser: ['M2 12h5', 'M7 9h8l3 3-3 3H7z', 'M18 12h4', 'm19.5 7.5 2-2', 'm19.5 16.5 2 2'],
    rocket: ['M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z', 'M12 15 9 12a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2z', 'M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0', 'M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5'],
    lightning: ['M13 2 4 14h7l-1 8 9-12h-7z', 'M3 4l2 2', 'M21 20l-2-2'],
    minigun: ['M2 8.5h11', 'M2 12h11', 'M2 15.5h11', 'M13 6.5h5a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-5z', 'M16 17.5V21'],
    hero: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
    lock: ['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    pickaxe: ['M14 6 4 20', 'M6 4c5 0 10 2 14 6-4-1-8-1-11 1'],
    torch: ['M10 21h4l1-9H9z', 'M12 12c-3-2-2-6 0-9 2 3 3 7 0 9z'],
    knife: ['M14 3 5 12l3 3 9-9c1-1 1-3 0-4s-2 0-3 1z', 'm8 15-4 4', 'M3 21l2-2'],
    mug: ['M5 8h11v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z', 'M16 10h2a2 2 0 0 1 0 4h-2', 'M8 4c0 1 1 1 1 2', 'M12 4c0 1 1 1 1 2'],
    sound: ['M11 5 6 9H2v6h4l5 4V5z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M19 5a10 10 0 0 1 0 14'],
    mute: ['M11 5 6 9H2v6h4l5 4V5z', 'm23 9-6 6', 'm17 9 6 6'],
    hammer: ['M14 4h6v7h-6z', 'M14 7.5H4', 'm11 7.5-7 12'],
    scythe: ['M4 21 15 6', 'M15 6c-3-3-8-3-11 0 4-1 8 0 11 3'],
    flamer: ['M2 13h9l2-2h3v4h-3l-2-2', 'M18 9c2 1 3 2 3 4s-1 3-3 4', 'M20 6c1.5 1 2 2 2 3'],
    railgun: ['M2 12h14', 'M2 9h10', 'M2 15h10', 'M16 8h3l3 4-3 4h-3z'],
    blackhole: ['M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M3 12a9 4 0 0 0 18 0', 'M21 12a9 4 0 0 0-18 0'],
    drone: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M3 7h6', 'M15 7h6', 'M6 7v3', 'M18 7v3', 'M9 12H6', 'M18 12h-3'],
    jet: ['M9 3h6v11H9z', 'M8 14l-1 4h4l-1-4', 'M16 14l1 4h-4l1-4', 'M10 21v-1', 'M14 21v-1'],
    pistols: ['M3 9h11v3H8l-1 5H4l1-5H3z', 'M14 9.5h2', 'M10 13h11v3h-6l-1 5h-3l1-5h-2z', 'M21 13.5h1'],
    ninja: ['M4 10c2-4 14-4 16 0', 'M4 10v3c0 4 4 7 8 7s8-3 8-7v-3', 'M7 12h10', 'M9 12v1', 'M15 12v1'],
    eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    // run power-ups
    pk_fury: ['M12 22c4 0 7-2.8 7-6.8 0-3.6-2.4-5.6-3.6-8.2-.6 2-1.6 3-2.8 3.4.4-3.2-.8-6.2-3.6-8.4.2 3.6-1.6 5.6-3.2 7.6C4.6 11.2 5 13 5 15.2 5 19.2 8 22 12 22z', 'M12 22c1.7 0 3-1.3 3-3 0-1.8-1.4-2.7-2-4-.5 1-1.2 1.6-2 1.8-.6.9-1 1.4-1 2.2 0 1.7 1.3 3 2 3z'],
    pk_frenzy: ['M14 2 5 13.5h6L9.5 22 19 9.5h-6z', 'M2 8h3', 'M1 12h3', 'M2 16h3'],
    pk_barrage: ['M3 12h11', 'm11 8 4 4-4 4', 'M3 6h8', 'm8 3 3 3-3 3', 'M3 18h8', 'm8 15 3 3-3 3', 'M20 5v14'],
    pk_thunder: ['M7 15a4.5 4.5 0 1 1 .8-8.9A6 6 0 0 1 19 7.5a3.8 3.8 0 0 1-.5 7.5H17', 'm12.5 11-3 5h4l-2.5 5'],
    pk_vamp: ['M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z', 'M9 15a3 3 0 0 0 3 3'],
    pk_vitality: ['M12 20.5s-7.5-4.6-9.6-9.3C.9 7.7 3 4 6.6 4c2 0 3.4 1.1 5.4 3.2C14 5.1 15.4 4 17.4 4 21 4 23.1 7.7 21.6 11.2 19.5 15.9 12 20.5 12 20.5z', 'M12 9v6', 'M9 12h6'],
    pk_plating: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 7v10', 'M8 10.5h8'],
    pk_quarter: ['M3 8.5 12 4l9 4.5v9L12 22l-9-4.5z', 'M3 8.5 12 13l9-4.5', 'M12 13v9', 'M7.5 6.2l9 4.6'],
    pk_swift: ['M4 14c3-1 6-1 9 1l7-6c1-1 0-2.5-1.3-2l-5.2 2.2', 'M3 18h6', 'M5 21h8', 'M13 15c1.6 1.1 2.4 2.6 2 4'],
    pk_spikes: ['m12 2 1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2z', 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
    pk_lucky: ['M12 12c-2.5-3.2-6-3.5-6.6-1-.6 2.7 3.6 3.4 6.6 1z', 'M12 12c3.2-2.5 3.5-6 1-6.6-2.7-.6-3.4 3.6-1 6.6z', 'M12 12c2.5 3.2 6 3.5 6.6 1 .6-2.7-3.6-3.4-6.6-1z', 'M12 12c-3.2 2.5-3.5 6-1 6.6 2.7.6 3.4-3.6 1-6.6z', 'M12 12c1.5 3 3 6 6 9'],
    pk_bubble: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M7.5 9.5a5 5 0 0 1 4-3.3', 'M16 15.5a1 1 0 1 0 0 .01'],
}
const FILLED = new Set(['heart', 'bolt'])

export const GameIcon = ({name, size = 18, fill, className = ''}) => {
    const d = P[name]
    if (!d) return null
    const filled = fill === undefined ? FILLED.has(name) : fill
    return (
        <svg className={`gicon ${className}`} width={size} height={size} viewBox="0 0 24 24"
             fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {d.map((p, i) => <path key={i} d={p}/>)}
        </svg>
    )
}

// shop item id -> icon + accent colour of its tile
export const ITEM_LOOK = {
    sword: {icon: 'sword', color: '#14e956'},
    axe: {icon: 'axe', color: '#f97316'},
    katana: {icon: 'katana', color: '#22d3ee'},
    bow: {icon: 'bow', color: '#fbbf24'},
    shotgun: {icon: 'shotgun', color: '#facc15'},
    laser: {icon: 'laser', color: '#22d3ee'},
    rocket: {icon: 'rocket', color: '#f97316'},
    lightning: {icon: 'lightning', color: '#a855f7'},
    minigun: {icon: 'minigun', color: '#fde047'},
    hammer: {icon: 'hammer', color: '#60a5fa'},
    pickaxe: {icon: 'pickaxe', color: '#fbbf24'},
    torch: {icon: 'torch', color: '#ff7a1a'},
    knife: {icon: 'knife', color: '#e5e7eb'},
    mug: {icon: 'mug', color: '#b7794a'},
    scythe: {icon: 'scythe', color: '#a855f7'},
    flamer: {icon: 'flamer', color: '#ff6a00'},
    railgun: {icon: 'railgun', color: '#c084fc'},
    blackhole: {icon: 'blackhole', color: '#818cf8'},
    hp: {icon: 'heart', color: '#ff3b6b'},
    aspd: {icon: 'bolt', color: '#facc15'},
    armor: {icon: 'shield', color: '#38e8ff'},
    knight: {icon: 'hero', color: '#ef4444'},
    michelle: {icon: 'drone', color: '#facc15'},
    vanguard: {icon: 'jet', color: '#7dd3fc'},
    ninja: {icon: 'ninja', color: '#a78bfa'},
    swat: {icon: 'pistols', color: '#38bdf8'},
    ferrum: {icon: 'pk_barrage', color: '#a78bfa'},
    pistols: {icon: 'pistols', color: '#7dd3fc'},
}
