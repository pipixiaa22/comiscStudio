import {useEffect, useState} from 'react'

// Layout preferences live in localStorage so they survive restarts without
// touching the project file (and without triggering an autosave).
export function usePersistentState(key, initialValue) {
    const [value, setValue] = useState(() => {
        try {
            const stored = window.localStorage?.getItem(key)
            return stored == null ? initialValue : JSON.parse(stored)
        } catch {
            return initialValue
        }
    })
    useEffect(() => {
        try {
            window.localStorage?.setItem(key, JSON.stringify(value))
        } catch {
            // Storage can be unavailable; the setting then just stays per-session.
        }
    }, [key, value])
    return [value, setValue]
}
