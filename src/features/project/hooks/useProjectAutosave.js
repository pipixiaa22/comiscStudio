import {useCallback, useEffect, useRef} from 'react'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'

export function useProjectAutosave({
                                       project,
                                       revision,
                                       savedRevision,
                                       saveStatus,
                                       onSaveStarted,
                                       onSaveSucceeded,
                                       onSaveFailed,
                                       delay = 400
                                   }) {
    const latest = useRef({project, revision, savedRevision})
    const timer = useRef(null)
    const saving = useRef(false)
    latest.current = {project, revision, savedRevision}

    const flush = useCallback(async () => {
        if (!latest.current.project || latest.current.revision <= latest.current.savedRevision || saving.current) return
        clearTimeout(timer.current)
        saving.current = true
        const snapshot = latest.current
        onSaveStarted()
        try {
            await mangaDeskBridge.saveProject(snapshot.project)
            onSaveSucceeded(snapshot.revision)
        } catch (error) {
            onSaveFailed(error instanceof Error ? error.message : '保存失败')
        } finally {
            saving.current = false
            if (latest.current.revision > snapshot.revision) void flush()
        }
    }, [onSaveFailed, onSaveStarted, onSaveSucceeded])

    useEffect(() => {
        if (!project || revision <= savedRevision || saveStatus === 'error' || saving.current) return
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            void flush()
        }, delay)
        return () => clearTimeout(timer.current)
    }, [project, revision, savedRevision, saveStatus, delay, flush])
    useEffect(() => () => clearTimeout(timer.current), [])
    return {flush}
}
