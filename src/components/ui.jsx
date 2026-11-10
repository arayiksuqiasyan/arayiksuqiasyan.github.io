import React, {useEffect, useRef, useState} from "react";
import {animate, motion, useInView, useMotionValue, useScroll, useSpring, useTransform} from "framer-motion";
import {MyLinks} from "../constacts";

export const linkHref = ({type, path}) => (type === 'mail' ? `mailto:${path}` : path)

const ease = [0.22, 1, 0.36, 1]

// Fade + rise when the block enters the viewport
export const Reveal = ({children, delay = 0, y = 40, className, as = 'div'}) => {
    const Tag = motion[as]
    return (
        <Tag
            className={className}
            initial={{opacity: 0, y}}
            whileInView={{opacity: 1, y: 0}}
            viewport={{once: true, margin: '-80px'}}
            transition={{duration: 0.8, delay, ease}}
        >
            {children}
        </Tag>
    )
}

// Words slide up out of a mask, one after another
export const SplitText = ({text, className, delay = 0, as = 'span'}) => {
    // The observer sits on the container: the words themselves start fully
    // clipped by their mask, so they would never count as "in view".
    const Tag = motion[as]
    const words = text.split(' ')
    return (
        <Tag
            className={className}
            aria-label={text}
            initial="hidden"
            whileInView="shown"
            viewport={{once: true}}
        >
            {words.map((w, i) => (
                <span className="split-mask" key={i} aria-hidden="true">
                    <motion.span
                        className="split-word"
                        variants={{hidden: {y: '110%'}, shown: {y: '0%'}}}
                        transition={{duration: 0.9, delay: delay + i * 0.08, ease}}
                    >
                        {w}
                    </motion.span>
                    {i < words.length - 1 ? ' ' : ''}
                </span>
            ))}
        </Tag>
    )
}

export const SectionTitle = ({index, title, kicker}) => (
    <div className="section-title">
        <Reveal y={20}>
            <span className="section-index">{index} / {kicker}</span>
        </Reveal>
        <SplitText as="h2" text={title}/>
    </div>
)

export const CountUp = ({value, decimals = 0, suffix = ''}) => {
    const ref = useRef(null)
    const inView = useInView(ref, {once: true})
    const [display, setDisplay] = useState((0).toFixed(decimals))

    useEffect(() => {
        if (!inView) return
        const controls = animate(0, value, {
            duration: 1.8,
            ease,
            onUpdate: v => setDisplay(v.toFixed(decimals)),
        })
        return () => controls.stop()
    }, [inView, value, decimals])

    return <span ref={ref}>{display}{suffix}</span>
}

// Card that tilts toward the pointer, with a moving glare
export const TiltCard = ({children, className = '', max = 8}) => {
    const ref = useRef(null)
    const rx = useMotionValue(0)
    const ry = useMotionValue(0)
    const gx = useMotionValue(50)
    const gy = useMotionValue(50)
    const srx = useSpring(rx, {stiffness: 150, damping: 15})
    const sry = useSpring(ry, {stiffness: 150, damping: 15})
    const glare = useTransform([gx, gy], ([x, y]) =>
        `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.14), transparent 55%)`)

    const onMove = (e) => {
        if (e.pointerType !== 'mouse') return
        const r = ref.current.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        ry.set((px - 0.5) * max * 2)
        rx.set(-(py - 0.5) * max * 2)
        gx.set(px * 100)
        gy.set(py * 100)
    }
    const onLeave = () => {
        rx.set(0)
        ry.set(0)
    }

    return (
        <motion.div
            ref={ref}
            className={`tilt ${className}`}
            style={{rotateX: srx, rotateY: sry, transformPerspective: 1000}}
            onPointerMove={onMove}
            onPointerLeave={onLeave}
        >
            {children}
            <motion.span className="tilt-glare" style={{background: glare}}/>
        </motion.div>
    )
}

// Glowing dot that follows the mouse (desktop only)
export const Cursor = () => {
    const x = useMotionValue(-100)
    const y = useMotionValue(-100)
    const sx = useSpring(x, {stiffness: 500, damping: 40})
    const sy = useSpring(y, {stiffness: 500, damping: 40})
    const [active, setActive] = useState(false)
    const [enabled] = useState(() => window.matchMedia('(pointer: fine)').matches)

    useEffect(() => {
        if (!enabled) return
        const move = e => {
            x.set(e.clientX)
            y.set(e.clientY)
        }
        const over = e => setActive(!!e.target.closest('a, button'))
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerover', over)
        return () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerover', over)
        }
    }, [enabled, x, y])

    if (!enabled) return null
    return <motion.div className={`cursor ${active ? 'cursor--active' : ''}`} style={{x: sx, y: sy}}/>
}

const NAV = [
    {href: '#about', label: 'About'},
    {href: '#experience', label: 'Experience'},
    {href: '#portfolio', label: 'Portfolio'},
    {href: '#skills', label: 'Tooling'},
    {href: '#contact', label: 'Contact'},
]

export const Nav = () => {
    const {scrollYProgress} = useScroll()
    const scaleX = useSpring(scrollYProgress, {stiffness: 120, damping: 30})
    const [open, setOpen] = useState(false)

    return (
        <header className="nav">
            <motion.div className="nav-progress" style={{scaleX}}/>
            <motion.div
                className="nav-inner"
                initial={{y: -40, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                transition={{duration: 0.8, delay: 0.2, ease}}
            >
                <a href="#top" className="nav-logo" aria-label="Arayik Suqiasyan — home">AS<span>.</span></a>
                <nav className={`nav-links ${open ? 'nav-links--open' : ''}`}>
                    {NAV.map(n => (
                        <a key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</a>
                    ))}
                </nav>
                <a className="btn btn--small nav-cta" href={linkHref(MyLinks.find(l => l.type === 'mail'))}>
                    Hire me
                </a>
                <button
                    className={`nav-burger ${open ? 'nav-burger--open' : ''}`}
                    aria-label="Menu"
                    aria-expanded={open}
                    onClick={() => setOpen(o => !o)}
                >
                    <span/><span/>
                </button>
            </motion.div>
        </header>
    )
}

const GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFXYZ'

// Characters "decode" from random glyphs into the final text
export const ScrambleText = ({text, delay = 0, duration = 1100, className}) => {
    const [out, setOut] = useState(() => text.replace(/\S/g, ' '))

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setOut(text)
            return
        }
        let raf = 0
        let start = 0
        const timer = setTimeout(() => {
            const tick = (now) => {
                if (!start) start = now
                const p = Math.min((now - start) / duration, 1)
                const revealed = Math.floor(p * text.length)
                let s = ''
                for (let i = 0; i < text.length; i++) {
                    const ch = text[i]
                    if (ch === ' ' || i < revealed) s += ch
                    else if (i < revealed + 6) s += GLYPHS[(Math.random() * GLYPHS.length) | 0]
                    else s += ' '
                }
                setOut(s)
                if (p < 1) raf = requestAnimationFrame(tick)
            }
            raf = requestAnimationFrame(tick)
        }, delay * 1000)
        return () => {
            clearTimeout(timer)
            cancelAnimationFrame(raf)
        }
    }, [text, delay, duration])

    return <span className={className} aria-label={text}><span aria-hidden="true">{out}</span></span>
}

// Element is pulled toward the pointer while hovered
export const Magnetic = ({children, strength = 0.35, className, ...props}) => {
    const ref = useRef(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const sx = useSpring(x, {stiffness: 220, damping: 14})
    const sy = useSpring(y, {stiffness: 220, damping: 14})

    const onMove = (e) => {
        if (e.pointerType !== 'mouse') return
        const r = ref.current.getBoundingClientRect()
        x.set((e.clientX - r.left - r.width / 2) * strength)
        y.set((e.clientY - r.top - r.height / 2) * strength)
    }
    const reset = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.a
            ref={ref}
            className={className}
            style={{x: sx, y: sy}}
            onPointerMove={onMove}
            onPointerLeave={reset}
            {...props}
        >
            {children}
        </motion.a>
    )
}

// Intro: counter to 100, then the curtain slides away
export const Preloader = ({onDone}) => {
    const [n, setN] = useState(0)

    useEffect(() => {
        const controls = animate(0, 100, {
            duration: 1.6,
            ease: [0.65, 0, 0.35, 1],
            onUpdate: v => setN(Math.round(v)),
            onComplete: () => setTimeout(onDone, 150),
        })
        return () => controls.stop()
    }, [onDone])

    return (
        <motion.div
            className="preloader"
            initial={{y: 0}}
            exit={{y: '-100%', transition: {duration: 0.9, ease: [0.76, 0, 0.24, 1]}}}
        >
            <div className="preloader-inner">
                <span className="preloader-name">Arayik Suqiasyan</span>
                <span className="preloader-count gradient-text">{n}</span>
                <div className="preloader-bar"><span style={{transform: `scaleX(${n / 100})`}}/></div>
            </div>
        </motion.div>
    )
}
