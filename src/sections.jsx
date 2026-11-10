import React, {useRef} from "react";
import {motion, useScroll, useTransform} from "framer-motion";
import avatar from "./photo/avatar.jpg";
import {EXPERIENCE, GIT_WORKS, MyLinks, PORTFOLIO, SKILLS, STATS, TOOLS} from "./constacts";
import {CountUp, linkHref, Magnetic, Reveal, ScrambleText, SectionTitle, SplitText, TiltCard} from "./components/ui";
import {startGame, SwordIcon} from "./game/PlayLauncher";

export const Hero = () => {
    const ref = useRef(null)
    const {scrollYProgress} = useScroll({target: ref, offset: ['start start', 'end start']})
    const y = useTransform(scrollYProgress, [0, 1], [0, 160])
    const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])

    return (
        <section id="top" ref={ref} className="hero">
            <motion.div className="hero-inner container" style={{y, opacity}}>
                <div className="hero-text">
                    <Reveal y={20} delay={0.3}>
                        <span className="badge"><i/>Open to remote · Yerevan, Armenia</span>
                    </Reveal>
                    <h1 className="hero-title">
                        <ScrambleText text="Senior Frontend" delay={0.3} className="line"/>
                        <ScrambleText text="/ Fullstack" delay={0.55} className="line gradient-text glow"/>
                        <ScrambleText text="Engineer" delay={0.8} className="line"/>
                    </h1>
                    <Reveal y={20} delay={1}>
                        <p className="hero-lead">
                            Hi, I'm <strong>Arayik Suqiasyan</strong>. 5+ years building high-load web and mobile
                            products with React, Next.js, Angular, React Native and TypeScript — plus backends on
                            Laravel, NestJS and PostgreSQL.
                        </p>
                    </Reveal>
                    <Reveal y={20} delay={1.15} className="hero-actions">
                        <Magnetic className="btn" href="#portfolio">View portfolio</Magnetic>
                        <Magnetic className="btn btn--ghost" href="#contact">Get in touch</Magnetic>
                        <button type="button" className="btn btn--ghost btn--play" onClick={startGame}><SwordIcon/> Play the site</button>
                    </Reveal>
                </div>
            </motion.div>
            <a href="#about" className="scroll-hint" aria-label="Scroll down"><span/></a>
        </section>
    )
}

export const Marquee = () => {
    const items = [...TOOLS, ...TOOLS]
    return (
        <div className="marquee" aria-hidden="true">
            <div className="marquee-track">
                {items.map((t, i) => (
                    <span key={i}>{t.name}<i>✦</i></span>
                ))}
            </div>
        </div>
    )
}

export const About = () => (
    <section id="about" className="section container">
        <SectionTitle index="01" kicker="About" title="Clean architecture. Fast products."/>
        <div className="about-grid">
            <Reveal className="about-text">
                <div className="about-photo">
                    <div className="avatar-ring">
                        <img src={avatar} alt="Arayik Suqiasyan"/>
                    </div>
                    <div>
                        <strong>Arayik Suqiasyan</strong>
                        <span>Senior Frontend / Fullstack Engineer</span>
                    </div>
                </div>
                <p>
                    I'm a Senior Frontend / Fullstack Engineer with <strong>5+ years</strong> of experience building
                    high-load web and mobile products with React, Next.js, Angular, React Native and TypeScript,
                    plus backend work with Laravel, NestJS and PostgreSQL.
                </p>
                <p>
                    I led the frontend team that shipped an animated game for MegaMarket in <strong>2
                    months</strong> to <strong>1.5M+ players</strong>, and architected a multi-partner iGaming
                    platform on modern Angular (Signals, zoneless) with <strong>15+ integrations</strong>.
                </p>
                <p>
                    I care about clean architecture, performance and reliable delivery — and I'm comfortable
                    working with English- and Russian-speaking teams.
                </p>
                <div className="about-meta">
                    <div><span>Languages</span>Armenian · Russian · English</div>
                    <div><span>Education</span>Basic IT Center — Software Engineering</div>
                </div>
            </Reveal>
            <div className="stats">
                {STATS.map((s, i) => (
                    <Reveal key={s.id} delay={i * 0.1} className="stat">
                        <span className="stat-value gradient-text">
                            <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix}/>
                        </span>
                        <span className="stat-label">{s.label}</span>
                    </Reveal>
                ))}
            </div>
        </div>
    </section>
)

export const Experience = () => {
    const ref = useRef(null)
    const {scrollYProgress} = useScroll({target: ref, offset: ['start 70%', 'end 60%']})
    const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1])

    return (
        <section id="experience" className="section container">
            <SectionTitle index="02" kicker="Experience" title="Where I've worked"/>
            <div className="timeline" ref={ref}>
                <div className="timeline-line"><motion.div style={{scaleY}}/></div>
                {EXPERIENCE.map((e, i) => (
                    <Reveal key={e.id} className="timeline-item" delay={0.05} y={30}>
                        <span className="timeline-dot"/>
                        <div className="timeline-period">{e.period}</div>
                        <div className="timeline-card">
                            <h3>{e.role}</h3>
                            <div className="timeline-company">
                                {e.company}{e.location ? ` · ${e.location}` : ''}
                            </div>
                            <p>{e.description}</p>
                        </div>
                    </Reveal>
                ))}
            </div>
        </section>
    )
}

export const Portfolio = () => (
    <section id="portfolio" className="section container">
        <SectionTitle index="03" kicker="Portfolio" title="Selected projects"/>
        <div className="projects">
            {PORTFOLIO.map((p, i) => (
                <Reveal key={p.id} className={`project ${i % 2 ? 'project--reverse' : ''}`} y={60}>
                    <TiltCard className="project-media">
                        <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Open ${p.title}`}>
                            <img src={p.image} alt={`${p.title} screenshot`} loading="lazy"/>
                        </a>
                    </TiltCard>
                    <div className="project-info">
                        <span className="project-num">0{i + 1}</span>
                        <h3>{p.title}</h3>
                        <p>{p.description}</p>
                        <div className="tags">
                            {p.stack.split(' · ').map(t => <span key={t}>{t}</span>)}
                        </div>
                        <a className="link-arrow" href={p.url} target="_blank" rel="noreferrer">
                            Visit {new URL(p.url).hostname.replace('www.', '')} <span>↗</span>
                        </a>
                    </div>
                </Reveal>
            ))}
        </div>
    </section>
)

export const Skills = () => (
    <section id="skills" className="section container">
        <SectionTitle index="04" kicker="Tooling" title="My toolbox"/>
        <div className="skills">
            {Object.entries(SKILLS).map(([group, list], i) => (
                <Reveal key={group} delay={i * 0.08} className="skill-group">
                    <h3>{group}</h3>
                    <div className="tags">
                        {list.map(s => <span key={s}>{s}</span>)}
                    </div>
                </Reveal>
            ))}
        </div>
    </section>
)

export const Playground = () => (
    <section className="section container">
        <SectionTitle index="05" kicker="Playground" title="Pet projects"/>
        <div className="works">
            {GIT_WORKS.map((w, i) => (
                <Reveal key={w.id} delay={(i % 3) * 0.08} y={30}>
                    <a className="work" href={w.url} target="_blank" rel="noreferrer">
                        <div className="work-img"><img src={w.img} alt={w.title} loading="lazy"/></div>
                        <span>{w.title}<i>↗</i></span>
                    </a>
                </Reveal>
            ))}
        </div>
    </section>
)

export const Contact = () => (
    <section id="contact" className="section container contact">
        <Reveal y={20}><span className="section-index">06 / Contact</span></Reveal>
        <SplitText as="h2" className="contact-title" text="Let's build something great"/>
        <Reveal delay={0.2}>
            <p className="contact-lead">
                Open to remote roles and freelance projects. The fastest way to reach me is email or LinkedIn.
            </p>
        </Reveal>
        <Reveal delay={0.3} className="contact-links">
            {MyLinks.map(l => (
                <Magnetic
                    key={l.id}
                    className={l.type === 'mail' ? 'btn' : 'btn btn--ghost'}
                    href={linkHref(l)}
                    target={l.type === 'mail' ? undefined : '_blank'}
                    rel="noreferrer"
                >
                    {l.title}
                </Magnetic>
            ))}
        </Reveal>
        <footer className="footer">
            <span>© {new Date().getFullYear()} Arayik Suqiasyan</span>
            <span>Senior Frontend / Fullstack Engineer</span>
        </footer>
    </section>
)
