import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {GameEngine} from "./engine";
import {MyLinks} from "../constacts";
import Shop from "./Shop";
import TouchControls from "./TouchControls";
import {GameIcon} from "./icons";
import {PERKS} from "./perks";

const MAIL = `mailto:${MyLinks.find(l => l.type === 'mail').path}?subject=${encodeURIComponent('Hi Arayik — I played your portfolio')}`
// touch layout on phones/tablets (add ?touch=1 to the URL to preview it on a desktop)
const isTouch = typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(window.location.search))

export default function Game({onExit}) {
    const canvasRef = useRef(null)
    const fxRef = useRef(null)
    const engine = useRef(null)
    const [hud, setHud] = useState({state: 'loading', loading: true, hp: 6, maxHp: 6, score: 0, kills: 0, combo: 0, destroyed: 0})
    const [toast, setToast] = useState(null)
    const [flash, setFlash] = useState(null)
    const [hurt, setHurt] = useState(null)
    const [shopOpen, setShopOpen] = useState(false)
    const [perkChoice, setPerkChoice] = useState(null)
    const lobbyShown = useRef(false)
    const [helpOpen, setHelpOpen] = useState(() => {
        try {
            return localStorage.getItem('fixbugs_help') !== '0'
        } catch (e) {
            return true
        }
    })
    const toggleHelp = () => {
        setHelpOpen(v => {
            try {
                localStorage.setItem('fixbugs_help', v ? '0' : '1')
            } catch (e) { /* private mode */ }
            return !v
        })
    }

    useEffect(() => {
        const g = new GameEngine({
            canvas: canvasRef.current,
            fx: fxRef.current,
            assetUrl: `${process.env.PUBLIC_URL}/game/knight.glb`,
            onHud: (h) => {
                if (h.toast) {
                    setToast(h.toast)
                    return
                }
                if (h.flash) {
                    setFlash(h.flash)
                    return
                }
                if (h.hurt) {
                    setHurt(h.hurt)
                    return
                }
                if ('perkChoice' in h) {
                    setPerkChoice(h.perkChoice)
                    return
                }
                setHud(h)
            },
        })
        engine.current = g
        g.init().catch((err) => {
            console.error(err)
            setHud(h => ({...h, state: 'error'}))
        })
        return () => {
            g.dispose()
            engine.current = null
        }
    }, [])

    useEffect(() => {
        if (!toast) return
        const t = setTimeout(() => setToast(null), 2200)
        return () => clearTimeout(t)
    }, [toast])

    // 1 / 2 / 3 pick a power-up card
    useEffect(() => {
        if (!perkChoice) return
        const onKey = (e) => {
            const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)
            if (i >= 0 && perkChoice.ids[i] && engine.current) engine.current.pickPerk(perkChoice.ids[i])
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [perkChoice])

    useEffect(() => {
        const onKey = (e) => { if (e.code === 'Escape') onExit() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onExit])

    useEffect(() => {
        if (!flash) return
        const t = setTimeout(() => setFlash(null), 500)
        return () => clearTimeout(t)
    }, [flash])

    const power = hud.power || 0
    const ready = power >= 100
    const restart = () => engine.current && engine.current.restart()
    // the lobby: the world waits behind it; Play starts a fresh run with the chosen gear
    const openLobby = () => {
        setPerkChoice(null)
        setShopOpen(true)
        engine.current && engine.current.setPaused(true)
    }
    const playFromLobby = () => {
        setShopOpen(false)
        if (!engine.current) return
        engine.current.setPaused(false)
        engine.current.restart()
    }
    // first thing after loading: the lobby
    useEffect(() => {
        if (hud.state !== 'loading' && hud.state !== 'error' && !lobbyShown.current) {
            lobbyShown.current = true
            openLobby()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hud.state])
    const gunName = hud.gun ? hud.gun.name : 'Gun'
    const superStrike = () => engine.current && engine.current.trySuper()
    const rebuild = () => engine.current && engine.current.startRewind()

    return createPortal(
        <>
            <div className="game-fx" ref={fxRef} aria-hidden="true"/>
            <canvas className="game-canvas" ref={canvasRef} aria-hidden="true"/>
            <div className="game-ui">
                <div className="game-hud">
                    <div className="game-hearts-compact" aria-hidden="true">
                        <GameIcon name="heart" size={13}/>{hud.hp}/{hud.maxHp}
                    </div>
                    <div className="game-hearts" aria-label={`${hud.hp} lives`}>
                        {Array.from({length: hud.maxHp}, (_, i) => (
                            <span key={i} className={i < hud.hp ? 'on' : ''}><GameIcon name="heart" size={16}/></span>
                        ))}
                    </div>
                    <div className="game-stat game-level"><small>Level</small>{hud.level || 1}</div>
                    <div className="game-stat"><small>Score</small>{hud.score.toLocaleString('en-US')}</div>
                    <div className="game-stat game-coins"><small>Coins</small><span><GameIcon name="coin" size={15}/>{(hud.coins || 0).toLocaleString('en-US')}</span></div>
                    <div className="game-stat"><small>Bugs fixed</small>{hud.kills}</div>
                    <div className="game-stat"><small>Site destroyed</small>{hud.destroyed}%</div>
                    <div
                        className={`game-armor ${hud.armor ? 'is-on' : 'is-empty'}`}
                        aria-label={`Armor ${hud.armor || 0}%`}
                    >
                        <small><GameIcon name="shield" size={11}/> Armor</small>
                        <span><i style={{width: `${hud.armor || 0}%`}}/></span>
                        <em>{hud.armor || 0}%</em>
                    </div>
                    <div className={`game-stat game-ammo ${hud.ammo || hud.infinite ? '' : 'is-empty'}`}>
                        <small>{gunName} · K</small>
                        <span>{hud.gun && <GameIcon name={hud.gun.id} size={15}/>}<i/>{hud.infinite ? '∞' : Math.floor(hud.ammo || 0)}</span>
                        {hud.heats && (
                            <span className={`game-heat ${hud.overheated ? 'is-hot' : ''}`} aria-label="Gun heat">
                                <b style={{width: `${Math.round((hud.heat || 0) * 100)}%`}}/>
                            </span>
                        )}
                    </div>
                    {hud.superOn !== false && <button
                        type="button"
                        className={`game-power ${ready ? 'is-ready' : ''}`}
                        onClick={superStrike}
                        disabled={!ready}
                        aria-label={ready ? 'Super strike ready' : `Super strike ${power}%`}
                    >
                        <small><GameIcon name="bolt" size={11}/> {ready ? (hud.metal ? 'Iron Wings · L' : 'Super ready · hold Space') : (hud.metal ? 'Iron Wings' : 'Super')}</small>
                        <span><i style={{width: `${power}%`}}/></span>
                    </button>}
                    <div className={`game-ability ${hud.dashCharges > 0 ? 'is-ready' : ''}`} aria-label="Dash">
                        <small><GameIcon name="pk_swift" size={11}/> Dash · Shift{hud.dashCharges > 1 ? ' ×2' : ''}</small>
                        <span><i style={{width: `${Math.round((hud.dash === undefined ? 1 : hud.dash) * 100)}%`}}/></span>
                    </div>
                    {hud.ability && !hud.ability.passive && (
                        <button
                            type="button"
                            className={`game-ability ${hud.ability.ready ? 'is-ready' : ''} ${hud.ability.active ? 'is-active' : ''}`}
                            onClick={() => engine.current && engine.current.useAbility()}
                            aria-label={hud.ability.label}
                        >
                            <small>
                                <GameIcon name={{helper: 'drone', jetpack: 'jet', stealth: 'eye', dual: 'bolt', metal: 'pk_barrage'}[hud.ability.trait]} size={11}/>{' '}
                                {hud.ability.label}
                            </small>
                            <span><i style={{width: `${Math.round(hud.ability.value * 100)}%`}}/></span>
                        </button>
                    )}
                    {hud.combo > 1 && <div className="game-combo">x{hud.combo}</div>}
                    <div className="game-hud-actions">
                        <button type="button" className="game-btn game-btn--icon" onClick={() => engine.current && engine.current.toggleMute()}
                                aria-label={hud.muted ? 'Sound on' : 'Sound off'}>
                            <GameIcon name={hud.muted ? 'mute' : 'sound'} size={16}/>
                        </button>
                        {/* the lobby mid-run: gear can change there, so the run starts over on Play */}
                        <button type="button" className="game-btn game-btn--shop" onClick={openLobby} title="Lobby — the run restarts"
                                aria-label="Lobby (restarts the run)"><GameIcon name="cart" size={16}/><span className="lbl">Lobby</span></button>
                        <button type="button" className="game-btn" onClick={rebuild} disabled={hud.rewinding} aria-label="Rebuild the site"><GameIcon name="rebuild" size={15}/><span className="lbl">Rebuild</span></button>
                        <button type="button" className="game-btn game-btn--icon" onClick={onExit} aria-label="Exit game"><GameIcon name="close" size={16}/></button>
                    </div>
                </div>

                {hud.perks && hud.perks.length > 0 && (
                    <div className="game-perks" aria-label="Power-ups this run">
                        {hud.perks.map(p => (
                            <span key={p.id} title={p.name} style={{'--pk': p.color}}><GameIcon name={p.svg} size={17}/>{p.n > 1 && <b>{p.n}</b>}</span>
                        ))}
                    </div>
                )}
                {perkChoice && (
                    <div className="perk-pick" role="dialog" aria-label="Choose a power-up">
                        <h3>{perkChoice.reason} <small>choose a power-up</small></h3>
                        <div className="perk-cards">
                            {perkChoice.ids.map((id, i) => {
                                const P = PERKS[id]
                                const have = (hud.perks || []).find(p => p.id === id)
                                return (
                                    <button key={id} type="button" className="perk-card" style={{'--pk': P.color}} onClick={() => engine.current && engine.current.pickPerk(id)}>
                                        <span className="perk-icon"><GameIcon name={P.svg} size={40}/></span>
                                        <b>{P.name}{have ? ` · ${have.n + 1}` : ''}</b>
                                        <small>{P.desc}</small>
                                        {!isTouch && <kbd>{i + 1}</kbd>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
                {hud.event && !hud.boss && (
                    <div className="game-event">★ {hud.event.name} <b>{hud.event.left}s</b></div>
                )}
                {hud.boss && (
                    <div className="game-boss">
                        <span>{hud.boss.name || 'BOSS'}</span>
                        <div><i style={{width: `${(hud.boss.hp / hud.boss.max) * 100}%`}}/></div>
                    </div>
                )}

                {flash && <div key={flash} className="game-flash"/>}
                {hurt && <div key={hurt.id} className={`game-hurt ${hurt.armor ? 'game-hurt--armor' : ''}`}/>}
                {toast && <div key={toast.id} className={`game-toast ${toast.kind ? 'game-toast--' + toast.kind : ''}`}>{toast.text}</div>}

                {hud.state === 'loading' && (
                    <div className="game-center"><div className="game-spinner"/>Loading the knight…</div>
                )}
                {hud.state === 'error' && (
                    <div className="game-panel">
                        <h3>Couldn't start the game</h3>
                        <button type="button" className="btn" onClick={onExit}>Back to the site</button>
                    </div>
                )}
                {hud.state === 'intro' && (
                    <div className="game-center game-intro">
                        <strong>Bugs are attacking the site!</strong>
                        <span>Fight your way down to the contact section ↓</span>
                    </div>
                )}

                {!isTouch && hud.state !== 'loading' && !helpOpen && (
                    <button type="button" className="game-help-tab" onClick={toggleHelp}>
                        Controls
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
                    </button>
                )}
                {!isTouch && hud.state !== 'loading' && helpOpen && (
                    <div className="game-help">
                        <button type="button" className="game-help-fold" onClick={toggleHelp} aria-label="Fold the controls">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        <span><kbd>A</kbd><kbd>D</kbd> run</span>
                        <span><kbd>W</kbd> jump ×2</span>
                        <span><kbd>S</kbd> drop down</span>
                        <span><kbd>Space</kbd> / click — {hud.metal ? 'iron blades' : hud.dual ? 'dual pistols (auto-aim)' : 'sword (hold)'}</span>
                        <span><kbd>K</kbd> {hud.metal ? 'magnetic pulse' : 'shoot'}</span>
                        {!hud.dual && (hud.metal ? <span><kbd>L</kbd> iron wings</span> : <span>hold <kbd>Space</kbd> / <kbd>L</kbd> super strike</span>)}
                        <span><kbd>Shift</kbd> dash</span>
                        <span><kbd>E</kbd> hero ability · <kbd>W</kbd><kbd>W</kbd> jetpack</span>
                        <span><kbd>M</kbd> sound</span>
                        <span><kbd>R</kbd> rebuild</span>
                        <span><kbd>Esc</kbd> exit</span>
                    </div>
                )}

                {isTouch && !shopOpen && !perkChoice && (hud.state === 'play' || hud.state === 'intro') && (
                    <TouchControls engine={engine} hud={hud}/>
                )}

                {hud.state === 'dead' && (
                    <div className="game-panel">
                        <h3>Game over</h3>
                        <p>The bugs won this time. Score <b>{hud.score.toLocaleString('en-US')}</b> · best combo x{hud.best}</p>
                        <p>Earned this run: <b className="coin-val"><GameIcon name="coin" size={14}/>{hud.runCoins || 0}</b> — spend them in the lobby.</p>
                        <div className="game-panel-actions">
                            <button type="button" className="btn" onClick={restart}>Try again</button>
                            <button type="button" className="btn btn--ghost" onClick={openLobby}><GameIcon name="cart" size={15}/> Lobby</button>
                            <button type="button" className="btn btn--ghost" onClick={onExit}>Back to the site</button>
                        </div>
                    </div>
                )}
                {hud.state === 'win' && (
                    <div className="game-panel game-panel--win">
                        <h3>🏆 Dragon defeated — all bugs fixed</h3>
                        <p>
                            Score <b>{hud.score.toLocaleString('en-US')}</b> · {hud.kills} bugs · best combo x{hud.best} ·
                            site destroyed {hud.destroyed}%
                        </p>
                        <p className="game-panel-reward">
                            Level {hud.wonLevel || 1} complete · bonus{' '}
                            <b className="coin-val"><GameIcon name="coin" size={14}/>{hud.levelBonus || 0}</b> · earned{' '}
                            <b className="coin-val"><GameIcon name="coin" size={14}/>{hud.runCoins || 0}</b>
                        </p>
                        <p className="game-panel-pitch">I fix real bugs just as fast. Let's work together.</p>
                        <div className="game-panel-actions">
                            {/* every new level goes through the lobby, so you can upgrade first */}
                            <button type="button" className="btn" onClick={openLobby}>
                                <GameIcon name="cart" size={15}/> Next level {(hud.wonLevel || 1) + 1} → Lobby
                            </button>
                            <a className="btn btn--ghost" href={MAIL}>Hire me</a>
                            <button type="button" className="btn btn--ghost" onClick={onExit}>Back to the site</button>
                        </div>
                    </div>
                )}
                {shopOpen && (
                    <Shop engine={engine} onPlay={playFromLobby} onExit={onExit}
                          playLabel={hud.state === 'win' ? `Play level ${(hud.wonLevel || 1) + 1}` : 'Play'}/>
                )}
            </div>
        </>,
        document.body,
    )
}
