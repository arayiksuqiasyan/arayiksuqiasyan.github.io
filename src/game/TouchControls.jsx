import React, {useRef, useState} from "react";

const STICK_R = 56 // max knob travel, px
const DEAD = 14
const JUMP_UP = -46
const DROP_DOWN = 50

// simple stroke icons (24×24)
const Icon = ({d, fill}) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {[].concat(d).map((p, i) => <path key={i} d={p}/>)}
    </svg>
)
const ICONS = {
    sword: ['M14.5 17.5 3 6V3h3l11.5 11.5', 'm13 19 6-6', 'm16 16 4 4', 'm19 21 2-2'],
    shoot: ['M2 10h13l3-3h4v4h-3l-2 2h-3l-1 5H9l1-5H6l-1 2H2z'],
    jump: ['M12 19V5', 'm5 12 7-7 7 7'],
    bolt: ['M13 2 4 14h7l-1 8 9-12h-7z'],
    swap: ['M7 7h13l-4-4', 'M17 17H4l4 4'],
    dash: ['M13 6l6 6-6 6', 'M5 6l6 6-6 6', 'M2 12h1'],
    ability: ['M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1z'],
}

// every button owns its own finger (pointer capture): it stays pressed while that finger is down,
// even if it slides a bit — so several buttons, and the joystick, work at the same time
const Btn = ({engine, name, className = '', children, label}) => {
    const fingers = useRef(new Set())
    const down = e => {
        e.preventDefault()
        e.stopPropagation()
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch (err) { /* not supported */ }
        if (!fingers.current.size) engine.current && engine.current.press(name, true)
        fingers.current.add(e.pointerId)
    }
    const up = e => {
        e.preventDefault()
        e.stopPropagation()
        fingers.current.delete(e.pointerId)
        if (!fingers.current.size) engine.current && engine.current.press(name, false)
    }
    return (
        <button
            type="button"
            aria-label={label || name}
            className={`tc-btn tc-${name} ${className}`}
            onPointerDown={down}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            onContextMenu={e => e.preventDefault()}
        >
            {children}
        </button>
    )
}

// Mobile controls in the style of action shooters:
// touch anywhere on the left half and drag = floating joystick (left/right run, flick up = jump,
// pull down = drop through the block); big action buttons in an arc on the right.
export default function TouchControls({engine, hud}) {
    const [stick, setStick] = useState(null)
    const s = useRef({id: null, ox: 0, oy: 0, jump: false, drop: false})

    const press = (name, v) => engine.current && engine.current.press(name, v)
    const tap = name => {
        press(name, true)
        setTimeout(() => press(name, false), 60)
    }

    const onDown = e => {
        if (s.current.id !== null) return
        e.preventDefault()
        s.current = {id: e.pointerId, ox: e.clientX, oy: e.clientY, jump: false, drop: false}
        e.currentTarget.setPointerCapture(e.pointerId)
        setStick({ox: e.clientX, oy: e.clientY, kx: 0, ky: 0})
    }
    const onMove = e => {
        const st = s.current
        if (e.pointerId !== st.id) return
        let dx = e.clientX - st.ox
        let dy = e.clientY - st.oy
        const d = Math.hypot(dx, dy)
        if (d > STICK_R) {
            dx *= STICK_R / d
            dy *= STICK_R / d
        }
        press('left', dx < -DEAD)
        press('right', dx > DEAD)
        // flick up = jump (again for the double jump), pull down = drop
        if (dy < JUMP_UP && !st.jump) {
            st.jump = true
            tap('jump')
        } else if (dy > JUMP_UP + 18) st.jump = false
        if (dy > DROP_DOWN && !st.drop) {
            st.drop = true
            tap('down')
        } else if (dy < DROP_DOWN - 18) st.drop = false
        setStick({ox: st.ox, oy: st.oy, kx: dx, ky: dy})
    }
    const onUp = e => {
        if (e.pointerId !== s.current.id) return
        s.current.id = null
        press('left', false)
        press('right', false)
        setStick(null)
    }

    const ready = (hud.power || 0) >= 100
    return (
        <div className="tc">
            <div
                className="tc-zone"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
            >
                {stick ? (
                    <div className="tc-stick" style={{left: stick.ox, top: stick.oy}}>
                        <i style={{transform: `translate(${stick.kx}px, ${stick.ky}px)`}}/>
                    </div>
                ) : (
                    <div className="tc-hint">Drag here to move<br/>flick up to jump</div>
                )}
            </div>
            <div className="tc-actions">
                <Btn engine={engine} name="attack" label="Sword"><Icon d={ICONS.sword}/></Btn>
                {/* no shoot button: on touch screens the gun fires by itself */}
                <Btn engine={engine} name="jump" label="Jump"><Icon d={ICONS.jump}/></Btn>
                <Btn engine={engine} name="dash" label="Dash"><Icon d={ICONS.dash}/></Btn>
                {hud.superOn !== false && (
                    <Btn engine={engine} name="super" label="Super strike" className={ready ? 'is-ready' : ''}><Icon d={ICONS.bolt}/></Btn>
                )}
                {hud.ability && !hud.ability.passive && hud.ability.trait !== 'jetpack' && (
                    <Btn engine={engine} name="ability" label="Hero ability" className={hud.ability.ready ? 'is-ready' : ''}>
                        <Icon d={ICONS.ability}/>
                    </Btn>
                )}
            </div>
        </div>
    )
}
