import {useEffect} from 'react'

function isEditable(target) {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable
}

export function useShortcutScope({enabled = true, bindings}) {
    useEffect(() => {
        if (!enabled) return
        const onKeyDown = event => {
            if (event.isComposing) return
            const key = `${event.ctrlKey ? 'Ctrl+' : ''}${event.altKey ? 'Alt+' : ''}${event.shiftKey ? 'Shift+' : ''}${event.key}`
            const handler = bindings[key]
            if (!handler || (isEditable(event.target) && !event.ctrlKey)) return
            event.preventDefault()
            handler(event)
        }
        addEventListener('keydown', onKeyDown)
        return () => removeEventListener('keydown', onKeyDown)
    }, [enabled, bindings])
}
