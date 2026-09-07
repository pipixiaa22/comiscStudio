import {useEffect} from 'react'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'
import {hydrateSources} from '../projectSources'

export function useProjectBootstrap({onLoad, onSources, onSelect, onError}) {
    useEffect(() => {
        let active = true
        mangaDeskBridge.loadRecentProject().then(data => {
            if (!active || !data) return
            const sources = hydrateSources(data.images, data.project)
            onLoad(data.project);
            onSources(sources)
            onSelect(sources.find(source => source.sourceId === data.project.workspace.currentSourceId) || sources[0] || null)
        }).catch(error => active && onError(error instanceof Error ? error.message : '加载最近项目失败'))
        return () => {
            active = false
        }
    }, [onError, onLoad, onSelect, onSources])
}
