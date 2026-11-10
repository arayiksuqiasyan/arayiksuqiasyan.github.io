// 5 colour themes for the whole site; the game level picks one (1→5, then again)
export const THEMES = [
    {name: 'Neon', accent: 0x14e956, accent2: 0x22d3ee},
    {name: 'Sunset', accent: 0xf97316, accent2: 0xfacc15},
    {name: 'Cyber', accent: 0xa855f7, accent2: 0xec4899},
    {name: 'Ocean', accent: 0x3b82f6, accent2: 0x22d3ee},
    {name: 'Crimson', accent: 0xef4444, accent2: 0xf59e0b},
]

export const themeIndex = level => (Math.max(1, level) - 1) % THEMES.length

export function applyTheme(level) {
    const i = themeIndex(level)
    const root = document.documentElement
    if (i === 0) delete root.dataset.theme
    else root.dataset.theme = String(i + 1)
    return THEMES[i]
}

// read the saved game level from the progress cookie (site load, before the game runs)
export function savedLevel() {
    try {
        const m = document.cookie.match(/(?:^|; )fixbugs_progress=([^;]*)/)
        if (!m) return 1
        const raw = decodeURIComponent(m[1])
        const json = raw.startsWith('v2.') ? decodeURIComponent(escape(atob(raw.split('.')[1]))) : raw
        return JSON.parse(json).level || 1
    } catch (e) {
        return 1
    }
}
