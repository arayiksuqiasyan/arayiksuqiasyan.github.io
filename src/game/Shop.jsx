import React, {useState} from "react";
import {GameIcon, ITEM_LOOK} from "./icons";

const TABS = [
    {id: 'melee', title: 'Melee'},
    {id: 'gun', title: 'Guns'},
    {id: 'hero', title: 'Hero'},
    {id: 'ally', title: 'Allies'},
    {id: 'stats', title: 'Upgrades'},
]

const Dots = ({lv, max = 5}) => (
    <span className="shop-lv" aria-label={`level ${lv} of ${max}`}>
        {Array.from({length: max}, (_, i) => <i key={i} className={i < lv ? 'on' : ''}/>)}
    </span>
)

// Lobby before every run: spend coins on melee weapons, guns, heroes and upgrades, pick the gear, then play.
// Gear can't be changed during a run.
export default function Shop({engine, onPlay, playLabel = 'Play', onExit}) {
    const [tab, setTab] = useState('melee')
    const [, force] = useState(0)
    const g = engine.current
    if (!g) return null
    const state = g.shopState()
    const items = state[tab] || []
    const act = (fn) => () => {
        fn()
        force(n => n + 1)
    }

    return (
        <div className="shop" role="dialog" aria-label="Lobby">
            <div className="shop-head">
                <h3><GameIcon name="cart" size={22}/> Lobby</h3>
                <span className="shop-coins"><GameIcon name="coin" size={18}/>{state.coins.toLocaleString('en-US')}</span>
                <button type="button" className="game-btn game-btn--icon" onClick={onExit} aria-label="Back to the site"><GameIcon name="close" size={16}/></button>
            </div>
            <div className="shop-tabs">
                {TABS.map(t => (
                    <button key={t.id} type="button" className={`${tab === t.id ? 'on' : ''} ${state.locked && state.locked[t.id] ? 'is-locked' : ''}`} onClick={() => setTab(t.id)}>
                        {t.title}
                    </button>
                ))}
            </div>
            <div className="shop-list">
                {items.length === 0 && <p className="shop-empty">{(state.locked && state.locked[tab]) || 'Coming soon.'}</p>}
                {items.map(it => (
                    <div key={it.id} className={`shop-item ${it.equipped ? 'is-equipped' : ''}`}>
                        <span
                            className="shop-icon"
                            style={{'--accent': (ITEM_LOOK[it.id] || {}).color || '#14e956'}}
                        >
                            <GameIcon name={it.statIcon || (ITEM_LOOK[it.id] || {}).icon || 'sword'} size={28}/>
                            {!it.owned && <i className="shop-lock"><GameIcon name="lock" size={12}/></i>}
                        </span>
                        <div className="shop-info">
                            <b>{it.name}</b>
                            <small>{it.desc}</small>
                            {it.locked && <small className="shop-req">Unlocks at game level {it.unlock}</small>}
                            {it.slot === 'stat' && (it.endless
                                ? <span className="shop-tag">Lv {it.lv} · ×{Math.pow(it.id === 'power' ? 1.1 : 0.93, it.lv).toFixed(2)}</span>
                                : <Dots lv={it.lv} max={it.max}/>)}

                        </div>
                        <div className="shop-actions">
                            {!it.owned && (
                                <button
                                    type="button"
                                    className="btn btn--small"
                                    disabled={it.locked || state.coins < it.price}
                                    onClick={act(() => g.buyItem(it.slot, it.id))}
                                >
                                    Buy · <GameIcon name="coin" size={13}/>{it.price.toLocaleString('en-US')}
                                </button>
                            )}
                            {it.slot !== 'stat' && it.owned && !it.equipped && (
                                <button type="button" className="btn btn--small btn--ghost" onClick={act(() => g.equipItem(it.slot, it.id))}>
                                    Equip
                                </button>
                            )}
                            {it.equipped && <span className="shop-tag">Equipped</span>}
                            {it.slot === 'stat' && it.upgrade == null && <span className="shop-tag">Max level</span>}
                            {it.upgrade != null && tab !== 'hero' && (
                                <button
                                    type="button"
                                    className="btn btn--small btn--ghost"
                                    disabled={state.coins < it.upgrade}
                                    onClick={act(() => (it.slot === 'stat' ? g.upgradeStat(it.id) : g.upgradeItem(it.id)))}
                                >
                                    Upgrade · <GameIcon name="coin" size={13}/>{it.upgrade.toLocaleString('en-US')}
                                </button>
                            )}
                        </div>
                        {it.gunRows && (
                            <div className="shop-rows">
                                {it.gunRows.map(r => (
                                    <div key={r.key} className="shop-row">
                                        <span className="shop-row-label"><b>{r.label}</b><small>{r.desc}</small></span>
                                        <Dots lv={Math.min(r.lv, r.max)} max={r.max}/>
                                        {r.endless && r.lv > r.max && <span className="shop-tag">+{r.lv - r.max}</span>}
                                        {r.cost != null ? (
                                            <button
                                                type="button"
                                                className="btn btn--small btn--ghost"
                                                disabled={state.coins < r.cost}
                                                onClick={act(() => (it.id === 'ferrum' ? g.upgradeFerrum(r.key) : it.slot === 'melee'
                                                    ? g.upgradeMeleeStat(it.id, r.key)
                                                    : it.slot === 'ally' ? g.upgradeAllyStat(it.id, r.key) : g.upgradeGunStat(it.id, r.key)))}
                                            >
                                                <GameIcon name="coin" size={12}/>{r.cost.toLocaleString('en-US')}
                                            </button>
                                        ) : <span className="shop-tag">Max</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="shop-foot">
                <p className="shop-note">Pick your gear here — Play starts a new run with it.</p>
                <button type="button" className="btn shop-play" onClick={onPlay}>▶ {playLabel}</button>
            </div>
        </div>
    )
}
