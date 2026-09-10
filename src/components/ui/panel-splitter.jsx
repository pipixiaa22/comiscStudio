import {useRef} from 'react'

// Vertical drag handle between two workspace columns.  The grab area sits on the
// far side of the boundary so the panel's own scrollbar stays clickable, while
// the visible line is drawn exactly on the boundary.
export function PanelSplitter({value, min, max, onChange, onReset, label = '调整面板宽度'}) {
    const drag = useRef(null)
    const clamp = next => Math.round(Math.max(min, Math.min(max, next)))
    const onPointerDown = event => {
        event.preventDefault()
        drag.current = {x: event.clientX, value}
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    const onPointerMove = event => {
        if (!drag.current) return
        onChange(clamp(drag.current.value + (event.clientX - drag.current.x)))
    }
    const onPointerUp = event => {
        if (!drag.current) return
        drag.current = null
        event.currentTarget.releasePointerCapture?.(event.pointerId)
    }
    const onKeyDown = event => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault()
            onChange(clamp(value - 16))
        } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            onChange(clamp(value + 16))
        }
    }
    return <div role="separator" aria-orientation="vertical" aria-label={label} tabIndex={0}
                aria-valuenow={Math.round(value)} aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp} onKeyDown={onKeyDown} onDoubleClick={onReset}
                title="拖动调整宽度 · 双击复位"
                className="workspace-browser-splitter group absolute top-0 z-20 h-full w-2 cursor-col-resize touch-none focus:outline-none"
                style={{left: `${value}px`}}>
        <div className="h-full w-px bg-border transition-colors group-hover:bg-foreground/70 group-focus:bg-foreground"/>
    </div>
}
