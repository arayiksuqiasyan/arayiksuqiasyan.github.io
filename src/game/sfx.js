// Procedural sound effects and a small synthwave loop — all generated with the Web Audio API (no files).
const MUTE_KEY = 'fixbugs_mute'

// musical roots per colour theme (Neon, Sunset, Cyber, Ocean, Crimson)
const THEME_ROOT = [45, 48, 43, 50, 41] // MIDI notes
const midi = n => 440 * Math.pow(2, (n - 69) / 12)

export class Sfx {
    constructor() {
        this.ctx = null
        this.last = {}
        try {
            this.muted = localStorage.getItem(MUTE_KEY) === '1'
        } catch (e) {
            this.muted = false
        }
    }

    // must be called from a user gesture (the Play click) so the browser allows audio
    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume()
            return
        }
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        this.ctx = new AC()
        const c = this.ctx
        this.comp = c.createDynamicsCompressor()
        this.comp.threshold.value = -16
        this.comp.ratio.value = 6
        this.master = c.createGain()
        this.master.gain.value = this.muted ? 0 : 0.55
        this.master.connect(this.comp)
        this.comp.connect(c.destination)
        this.sfxBus = c.createGain()
        this.sfxBus.gain.value = 0.9
        this.sfxBus.connect(this.master)
        this.musicBus = c.createGain()
        this.musicBus.gain.value = 0.32
        this.musicBus.connect(this.master)
        // shared white noise
        const len = c.sampleRate
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate)
        const d = this.noiseBuf.getChannelData(0)
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }

    setMuted(m) {
        this.muted = m
        try {
            localStorage.setItem(MUTE_KEY, m ? '1' : '0')
        } catch (e) { /* private mode */ }
        if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05)
    }

    // ---------------------------------------------------------------- building blocks
    noise(t, dur, {freq = 1200, q = 1, type = 'bandpass', gain = 0.5, sweepTo} = {}) {
        const c = this.ctx
        const src = c.createBufferSource()
        src.buffer = this.noiseBuf
        src.loop = true
        const f = c.createBiquadFilter()
        f.type = type
        f.frequency.setValueAtTime(freq, t)
        if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
        f.Q.value = q
        const g = c.createGain()
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + dur)
        src.connect(f)
        f.connect(g)
        g.connect(this.sfxBus)
        src.start(t, Math.random())
        src.stop(t + dur + 0.02)
    }

    tone(t, dur, {freq = 440, to, type = 'sine', gain = 0.3, attack = 0.005} = {}) {
        const c = this.ctx
        const o = c.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(freq, t)
        if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
        const g = c.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(gain, t + attack)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(g)
        g.connect(this.sfxBus)
        o.start(t)
        o.stop(t + dur + 0.02)
    }

    // ---------------------------------------------------------------- effects
    play(name, opts = {}) {
        if (!this.ctx || this.muted) return
        const now = this.ctx.currentTime
        // per-sound rate limit so rapid weapons don't turn into noise
        const gap = {minigun: 0.05, hit: 0.035, flamer: 0.09, coin: 0.05, pop: 0.04, step: 0.12, stomp: 0.15}[name] || 0.02
        if (now - (this.last[name] || 0) < gap) return
        this.last[name] = now
        const t = now + 0.005
        const v = opts.volume == null ? 1 : opts.volume
        switch (name) {
            case 'swing':
                this.noise(t, 0.16, {freq: 900, sweepTo: 3200, q: 0.8, gain: 0.35 * v})
                break
            case 'heavySwing':
                this.noise(t, 0.26, {freq: 400, sweepTo: 1800, q: 0.7, gain: 0.45 * v})
                break
            case 'slice':
                this.noise(t, 0.12, {freq: 4000, sweepTo: 9000, q: 4, gain: 0.3})
                this.tone(t, 0.08, {freq: 2600, to: 1200, type: 'sine', gain: 0.06})
                break
            case 'thud':
                this.tone(t, 0.3, {freq: 90, to: 35, type: 'sine', gain: 0.8})
                this.noise(t, 0.25, {freq: 400, sweepTo: 80, q: 0.5, type: 'lowpass', gain: 0.6})
                break
            case 'reap':
                this.noise(t, 0.45, {freq: 300, sweepTo: 2400, q: 1.5, gain: 0.35})
                this.tone(t, 0.45, {freq: 220, to: 110, type: 'sawtooth', gain: 0.06})
                break
            case 'clink':
                this.tone(t, 0.25, {freq: 2200, type: 'triangle', gain: 0.2})
                this.tone(t, 0.25, {freq: 3300, type: 'sine', gain: 0.1})
                this.noise(t, 0.05, {freq: 6000, q: 2, gain: 0.2})
                break
            case 'fireswing':
                this.noise(t, 0.35, {freq: 600, sweepTo: 1500, q: 0.6, type: 'lowpass', gain: 0.45})
                break
            case 'swish':
                this.noise(t, 0.08, {freq: 2500, sweepTo: 6000, q: 1.5, gain: 0.3})
                break
            case 'splash':
                for (let i = 0; i < 5; i++) this.tone(t + i * 0.02, 0.08, {freq: 600 + Math.random() * 900, to: 200, type: 'sine', gain: 0.12})
                this.noise(t, 0.25, {freq: 1800, q: 0.8, gain: 0.25})
                break
            case 'warn':
                this.tone(t, 0.16, {freq: 520, to: 880, type: 'square', gain: 0.12 * v})
                break
            case 'hit':
                this.tone(t, 0.09, {freq: 220, to: 70, type: 'triangle', gain: 0.45 * v})
                this.noise(t, 0.06, {freq: 2500, q: 0.6, gain: 0.25 * v})
                break
            case 'crit':
                this.tone(t, 0.25, {freq: 160, to: 40, type: 'square', gain: 0.35})
                this.noise(t, 0.2, {freq: 1200, q: 0.5, gain: 0.4})
                break
            case 'shotgun':
                this.noise(t, 0.28, {freq: 900, sweepTo: 200, q: 0.4, type: 'lowpass', gain: 0.8})
                this.tone(t, 0.18, {freq: 120, to: 40, type: 'sine', gain: 0.6})
                break
            case 'laser':
                this.tone(t, 0.18, {freq: 1800, to: 300, type: 'sawtooth', gain: 0.12})
                this.tone(t, 0.18, {freq: 2400, to: 500, type: 'sine', gain: 0.12})
                break
            case 'rail':
                this.tone(t, 0.45, {freq: 90, to: 1400, type: 'sawtooth', gain: 0.18})
                this.noise(t + 0.02, 0.4, {freq: 3000, sweepTo: 400, q: 0.7, gain: 0.35})
                break
            case 'rocket':
                this.noise(t, 0.5, {freq: 300, sweepTo: 1500, q: 1.2, gain: 0.35})
                break
            // ---- sounds of the newer effects
            case 'grenade': // fire grenade: a deep thump, a crackling burst and a hiss of flames
                this.tone(t, 0.45, {freq: 120, to: 34, type: 'sine', gain: 0.75 * v})
                this.noise(t, 0.55, {freq: 1800, sweepTo: 120, q: 0.6, type: 'lowpass', gain: 0.7 * v})
                this.noise(t + 0.05, 0.6, {freq: 3200, sweepTo: 1200, q: 1.2, type: 'bandpass', gain: 0.25 * v})
                for (let i = 0; i < 4; i++) this.noise(t + 0.08 + i * 0.07, 0.04, {freq: 4000, q: 2, type: 'bandpass', gain: 0.18 * v})
                break
            case 'shatter': // a ceramic mug breaking: bright clinks and a little rattle
                for (let i = 0; i < 4; i++) {
                    this.tone(t + i * 0.025, 0.12, {freq: 2400 + Math.random() * 1800, to: 1600, type: 'triangle', gain: 0.1 * v})
                }
                this.noise(t, 0.16, {freq: 5200, sweepTo: 2600, q: 1.5, type: 'bandpass', gain: 0.3 * v})
                this.noise(t + 0.03, 0.12, {freq: 900, q: 0.8, type: 'lowpass', gain: 0.15 * v})
                break
            case 'jam': // the gun jams: an electric buzz that sputters out
                this.tone(t, 0.32, {freq: 180, to: 90, type: 'square', gain: 0.12 * v})
                this.tone(t, 0.32, {freq: 187, to: 70, type: 'sawtooth', gain: 0.08 * v})
                this.noise(t, 0.3, {freq: 2600, q: 3, type: 'bandpass', gain: 0.2 * v})
                this.tone(t + 0.34, 0.08, {freq: 900, to: 300, type: 'square', gain: 0.08 * v})
                break
            case 'horde': // a war horn before the horde
                this.tone(t, 1.6, {freq: 98, to: 110, type: 'sawtooth', gain: 0.32 * v, attack: 0.25})
                this.tone(t, 1.6, {freq: 147, to: 165, type: 'sawtooth', gain: 0.18 * v, attack: 0.3})
                this.tone(t + 0.2, 1.4, {freq: 49, type: 'square', gain: 0.12 * v, attack: 0.3})
                this.noise(t, 1.5, {freq: 500, q: 0.7, type: 'lowpass', gain: 0.2 * v})
                break
            case 'surge': // a rising alarm
                this.tone(t, 0.5, {freq: 330, to: 880, type: 'sawtooth', gain: 0.12 * v})
                this.tone(t + 0.5, 0.5, {freq: 330, to: 880, type: 'sawtooth', gain: 0.12 * v})
                break
            case 'calm': // a soft, low chime
                this.tone(t, 1.2, {freq: 392, type: 'sine', gain: 0.12 * v, attack: 0.08})
                this.tone(t + 0.12, 1.2, {freq: 523, type: 'sine', gain: 0.08 * v, attack: 0.08})
                break
            case 'perk': // a bright little arpeggio
                [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, 0.35, {freq: f, type: 'triangle', gain: 0.14 * v}))
                break
            case 'bubble': // a soft pop
                this.tone(t, 0.12, {freq: 300, to: 900, type: 'sine', gain: 0.2 * v})
                this.noise(t, 0.08, {freq: 1500, q: 1, type: 'bandpass', gain: 0.12 * v})
                break
            case 'thunder': // a lightning crack and a short rumble
                this.noise(t, 0.12, {freq: 6000, sweepTo: 2000, q: 0.8, type: 'highpass', gain: 0.5 * v})
                this.noise(t + 0.05, 0.7, {freq: 400, sweepTo: 60, q: 0.5, type: 'lowpass', gain: 0.55 * v})
                break
            case 'boomerang': // a whooshing blade
                this.noise(t, 0.35, {freq: 600, sweepTo: 2400, q: 3, type: 'bandpass', gain: 0.22 * v})
                break
            case 'boom':
                this.noise(t, 0.7, {freq: 700, sweepTo: 60, q: 0.4, type: 'lowpass', gain: 0.9 * v})
                this.tone(t, 0.5, {freq: 90, to: 30, type: 'sine', gain: 0.7 * v})
                break
            case 'zap':
                for (let i = 0; i < 4; i++) this.noise(t + i * 0.035, 0.04, {freq: 3500 + Math.random() * 2500, q: 3, gain: 0.25})
                this.tone(t, 0.15, {freq: 900, to: 200, type: 'square', gain: 0.06})
                break
            case 'minigun':
                this.noise(t, 0.05, {freq: 1800, q: 0.6, gain: 0.35})
                this.tone(t, 0.04, {freq: 160, to: 70, type: 'square', gain: 0.12})
                break
            case 'flamer':
                this.noise(t, 0.16, {freq: 500, q: 0.5, type: 'lowpass', gain: 0.3})
                break
            case 'vortex':
                this.tone(t, 1.2, {freq: 60, to: 220, type: 'sawtooth', gain: 0.12, attack: 0.2})
                break
            case 'pop':
                this.tone(t, 0.12, {freq: 520 + Math.random() * 200, to: 160, type: 'triangle', gain: 0.3 * v})
                this.noise(t, 0.08, {freq: 1800, q: 1, gain: 0.18 * v})
                break
            case 'coin':
                this.tone(t, 0.08, {freq: 1320, type: 'square', gain: 0.08})
                this.tone(t + 0.07, 0.16, {freq: 1760, type: 'square', gain: 0.08})
                break
            case 'heart':
                this.tone(t, 0.18, {freq: 660, type: 'sine', gain: 0.22})
                this.tone(t + 0.1, 0.3, {freq: 990, type: 'sine', gain: 0.22})
                break
            case 'armor':
                this.tone(t, 0.25, {freq: 1200, to: 1600, type: 'triangle', gain: 0.18})
                break
            case 'shield':
                this.tone(t, 0.2, {freq: 900, to: 600, type: 'triangle', gain: 0.25})
                this.noise(t, 0.1, {freq: 4000, q: 2, gain: 0.15})
                break
            case 'hurt':
                this.tone(t, 0.3, {freq: 180, to: 60, type: 'sawtooth', gain: 0.35})
                break
            case 'jump':
                this.tone(t, 0.12, {freq: 300, to: 600, type: 'sine', gain: 0.12})
                break
            case 'stomp': // a heavy footstep
                this.tone(t, 0.22, {freq: 75, to: 38, type: 'sine', gain: 0.6 * v})
                this.noise(t, 0.16, {freq: 380, sweepTo: 90, q: 0.6, type: 'lowpass', gain: 0.45 * v})
                this.noise(t + 0.01, 0.06, {freq: 2400, q: 1.5, type: 'bandpass', gain: 0.08 * v})
                break
            case 'land':
                this.noise(t, 0.12, {freq: 300, q: 0.5, type: 'lowpass', gain: 0.35 * v})
                break
            case 'super':
                this.tone(t, 0.8, {freq: 80, to: 30, type: 'sawtooth', gain: 0.4})
                this.noise(t, 0.9, {freq: 2000, sweepTo: 100, q: 0.5, gain: 0.6})
                break
            case 'roar':
                this.tone(t, 1.1, {freq: 110, to: 55, type: 'sawtooth', gain: 0.35, attack: 0.08})
                this.tone(t, 1.1, {freq: 82, to: 40, type: 'square', gain: 0.15, attack: 0.1})
                this.noise(t, 1.0, {freq: 600, q: 0.6, type: 'lowpass', gain: 0.35})
                break
            case 'event':
                ;[0, 4, 7, 12].forEach((s, i) => this.tone(t + i * 0.08, 0.2, {freq: midi(72 + s), type: 'triangle', gain: 0.14}))
                break
            case 'win':
                ;[0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(t + i * 0.09, 0.4, {freq: midi(64 + s), type: 'triangle', gain: 0.16}))
                break
            case 'lose':
                ;[7, 4, 0, -5].forEach((s, i) => this.tone(t + i * 0.18, 0.4, {freq: midi(60 + s), type: 'sawtooth', gain: 0.1}))
                break
            default:
        }
    }

    // ---------------------------------------------------------------- music: a looping synthwave groove
    startMusic(themeIdx = 0) {
        if (!this.ctx) return
        this.stopMusic()
        this.root = THEME_ROOT[themeIdx % THEME_ROOT.length]
        this.step = 0
        this.nextT = this.ctx.currentTime + 0.1
        this.musicTimer = setInterval(() => this.schedule(), 50)
    }

    setMusicIntensity(boss) {
        this.boss = boss
    }

    schedule() {
        const c = this.ctx
        if (!c) return
        const bpm = this.boss ? 132 : 118
        const sixteenth = 60 / bpm / 4
        // chord roots: i – VI – III – VII
        const prog = [0, -4, 3, -2]
        while (this.nextT < c.currentTime + 0.2) {
            const s = this.step % 64
            const bar = Math.floor(s / 16)
            const root = this.root + prog[bar]
            const t = this.nextT
            if (!this.muted) {
                const out = this.musicBus
                // kick on beats, hat on offbeats
                if (s % 4 === 0) this.musicTone(out, t, 0.18, 120, 45, 'sine', 0.7)
                if (s % 4 === 2) this.musicNoise(out, t, 0.04, 7000, 0.12)
                if (this.boss && s % 8 === 4) this.musicNoise(out, t, 0.12, 1800, 0.25)
                // bass on eighths
                if (s % 2 === 0) this.musicTone(out, t, sixteenth * 1.8, midi(root - 12 + (s % 8 === 6 ? 12 : 0)), null, 'sawtooth', 0.12)
                // arpeggio
                const arp = [0, 7, 12, 15, 12, 7, 3, 7]
                if (s % 2 === 1 || this.boss) this.musicTone(out, t, sixteenth * 0.9, midi(root + 12 + arp[s % 8]), null, 'square', 0.035)
            }
            this.nextT += sixteenth
            this.step++
        }
    }

    musicTone(out, t, dur, freq, to, type, gain) {
        const c = this.ctx
        const o = c.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(freq, t)
        if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
        const f = c.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = type === 'sawtooth' ? 900 : 4000
        const g = c.createGain()
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        o.connect(f)
        f.connect(g)
        g.connect(out)
        o.start(t)
        o.stop(t + dur + 0.02)
    }

    musicNoise(out, t, dur, freq, gain) {
        const c = this.ctx
        const src = c.createBufferSource()
        src.buffer = this.noiseBuf
        const f = c.createBiquadFilter()
        f.type = 'highpass'
        f.frequency.value = freq
        const g = c.createGain()
        g.gain.setValueAtTime(gain, t)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        src.connect(f)
        f.connect(g)
        g.connect(out)
        src.start(t, Math.random())
        src.stop(t + dur + 0.02)
    }

    stopMusic() {
        clearInterval(this.musicTimer)
        this.musicTimer = null
    }

    dispose() {
        this.stopMusic()
        if (this.ctx) this.ctx.close()
        this.ctx = null
    }
}
