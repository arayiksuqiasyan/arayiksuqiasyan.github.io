import React, {Suspense, useCallback, useEffect, useState} from "react";
import "./game.scss";
import {applyTheme, savedLevel} from "./theme";

// the whole site wears the colour theme of the level the visitor reached in the game
if (typeof document !== 'undefined') applyTheme(savedLevel())

const Game = React.lazy(() => import("./Game"))

export const SwordIcon = ({size = 18}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>
        <path d="m13 19 6-6"/>
        <path d="m16 16 4 4"/>
        <path d="m19 21 2-2"/>
    </svg>
)

export const START_GAME_EVENT = 'portfolio-game:start'
export const startGame = () => window.dispatchEvent(new Event(START_GAME_EVENT))

// Floating "Play" button; the game code (three.js + knight model) loads only on click.
const FAB_KEY = 'fixbugs_fab_min'
const readMin = () => {
    try {
        return localStorage.getItem(FAB_KEY) === '1'
    } catch (e) {
        return false
    }
}

export const PlayLauncher = () => {
    const [playing, setPlaying] = useState(false)
    // the floating button can be folded into a small round icon
    const [mini, setMini] = useState(readMin)
    const fold = (v) => (e) => {
        e.stopPropagation()
        setMini(v)
        try {
            localStorage.setItem(FAB_KEY, v ? '1' : '0')
        } catch (err) { /* private mode */ }
    }

    useEffect(() => {
        const on = () => setPlaying(true)
        window.addEventListener(START_GAME_EVENT, on)
        return () => window.removeEventListener(START_GAME_EVENT, on)
    }, [])

    const exit = useCallback(() => setPlaying(false), [])

    return (
        <>
            {!playing && !mini && (
                <div className="play-fab-wrap">
                    <button type="button" className="play-fab" onClick={() => setPlaying(true)}>
                        <span className="play-fab-icon"><SwordIcon size={22}/></span>
                        <span className="play-fab-text"><b>Play</b><small>Fix the bugs</small></span>
                    </button>
                    <button type="button" className="play-fab-fold" onClick={fold(true)} aria-label="Fold the play button">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </div>
            )}
            {!playing && mini && (
                <button type="button" className="play-fab play-fab--mini" onClick={() => setPlaying(true)}
                        onContextMenu={(e) => { e.preventDefault(); fold(false)(e) }}
                        aria-label="Play the game">
                    <span className="play-fab-icon"><SwordIcon size={20}/></span>
                    <span className="play-fab-unfold" onClick={fold(false)} role="button" aria-label="Unfold the play button">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
                    </span>
                </button>
            )}
            {playing && (
                <Suspense fallback={<div className="game-boot">Loading game…</div>}>
                    <Game onExit={exit}/>
                </Suspense>
            )}
        </>
    )
}
