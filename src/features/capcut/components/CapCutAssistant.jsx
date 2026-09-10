import {useEffect, useMemo, useState} from 'react'
import {ChevronLeft, ChevronRight, Copy, ExternalLink, Pin, PinOff, Play, Trash2} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
    return `${(bytes / 1024 ** power).toFixed(power ? 1 : 0)} ${units[power]}`
}

export function CapCutAssistant() {
    const [snapshot, setSnapshot] = useState(null), [blockId, setBlockId] = useState(null), [topmost, setTopmost] = useState(true), [notice, setNotice] = useState('')
    const [cacheOpen, setCacheOpen] = useState(false), [cache, setCache] = useState(null)
    useEffect(() => { mangaDeskBridge.settings.get().then(settings => { document.documentElement.dataset.theme = settings.theme }).catch(() => {}) }, [])
    useEffect(() => {
        const off = mangaDeskBridge.assistant.onSnapshot(next => {
            setSnapshot(current => ({...next, blocks: next.blocks.map(block => ({...block, assets: block.assets.map(asset => {
                const previous = current?.sessionId === next.sessionId && current.blocks.find(entry => entry.id === block.id)?.assets.find(entry => entry.id === asset.id)
                return previous?.deliveryVersion === asset.deliveryVersion ? {...asset, delivery: previous.delivery, preparation: previous.preparation} : asset
            })}))}));
            setBlockId(current => next.blocks.some(block => block.id === current) ? current : next.blocks[0]?.id || null)
        });
        void mangaDeskBridge.assistant.snapshot().then(next => {
            if (next) {
                setSnapshot(next);
                setBlockId(next.blocks[0]?.id || null)
            }
        }).catch(() => {
        });
        const offState = mangaDeskBridge.assistant.onAssetState(event => {
            setSnapshot(current => {
                if (current?.sessionId !== event.sessionId) return current
                return {...current, blocks: current.blocks.map(block => block.id !== event.blockId ? block : {...block,
                    assets: block.assets.map(asset => asset.id !== event.assetId || asset.deliveryVersion !== event.version ? asset : {
                        ...asset, preparation: event, delivery: event.state === 'ready' ? event.delivery : undefined
                    })})}
            })
        })
        return () => { off(); offState() }
    }, [])
    const index = useMemo(() => snapshot?.blocks.findIndex(block => block.id === blockId) ?? -1, [snapshot, blockId]),
        block = snapshot?.blocks[index]
    const copy = async () => {
        try {
            await mangaDeskBridge.assistant.copy({sessionId: snapshot.sessionId, revision: snapshot.revision, blockId});
            setNotice(`已复制 #${String(index + 1).padStart(3, '0')}`)
        } catch (error) {
            setNotice(error.message)
        }
    }
    const command = async (key, value) => {
        try {
            await mangaDeskBridge.assistant.command({
                sessionId: snapshot.sessionId,
                projectId: snapshot.projectId,
                baseRevision: snapshot.revision,
                requestId: globalThis.crypto.randomUUID(),
                blockId,
                type: 'setStatus',
                payload: {key, value}
            })
        } catch (error) {
            setNotice(error.message)
        }
    }
    const prepare = async asset => {
        const sessionId = snapshot.sessionId, targetBlockId = blockId, version = asset.deliveryVersion
        const update = patch => setSnapshot(current => current?.sessionId !== sessionId ? current : ({...current,
            blocks: current.blocks.map(block => block.id !== targetBlockId ? block : {...block,
                assets: block.assets.map(entry => entry.id === asset.id && entry.deliveryVersion === version ? {...entry, ...patch} : entry)})}))
        update({preparation: {state: 'queued', progress: 0}, delivery: undefined})
        try {
            const item = await mangaDeskBridge.assistant.prepare({
                sessionId: snapshot.sessionId,
                revision: snapshot.revision,
                blockId,
                assetId: asset.id
            });
            update({delivery: item, preparation: {state: 'ready'}})
        } catch (error) {
            update({delivery: undefined, preparation: {state: 'failed', error: error.message}})
        }
    }
    const cancel = async asset => {
        try {
            await mangaDeskBridge.assistant.cancelPrepare({sessionId: snapshot.sessionId, revision: snapshot.revision, blockId, assetId: asset.id})
        } catch (error) { setNotice(error.message) }
    }
    const loadCache = async () => {
        try { setCache(await mangaDeskBridge.assistant.cacheList()) } catch (error) { setNotice(error.message) }
    }
    useEffect(() => {
        if (cacheOpen) void loadCache()
    }, [cacheOpen])
    const removeCache = async name => {
        if (!window.confirm('删除这份交付文件？已经引用它的剪映项目将无法再读取。')) return
        try {
            await mangaDeskBridge.assistant.cacheRemove(name);
            await loadCache()
        } catch (error) { setNotice(error.message) }
    }
    const pruneCache = async () => {
        try {
            await mangaDeskBridge.assistant.cachePrune();
            await loadCache()
        } catch (error) { setNotice(error.message) }
    }
    useEffect(() => {
        const keydown = event => {
            if (event.isComposing || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)) return
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') { event.preventDefault(); void copy() }
            if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); setBlockId(snapshot.blocks[index - 1].id) }
            if (event.key === 'ArrowRight' && index >= 0 && index < snapshot.blocks.length - 1) { event.preventDefault(); setBlockId(snapshot.blocks[index + 1].id) }
        }
        window.addEventListener('keydown', keydown)
        return () => window.removeEventListener('keydown', keydown)
    }, [snapshot, index, blockId])
    if (!snapshot) return <main
        className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">正在连接主工作区…</main>
    if (!block) return <main className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">暂无
        Block</main>
    return <main className="flex h-screen flex-col bg-background p-4 text-foreground">
        <header className="flex items-center gap-2">
            <div className="min-w-0"><b className="block truncate">{snapshot.projectName}</b><span
                className="text-xs text-slate-400">#{String(index + 1).padStart(3, '0')} / {snapshot.blocks.length}</span>
            </div>
            <Button className="ml-auto" size="sm" variant="ghost" onClick={async () => {
                const next = await mangaDeskBridge.assistant.topmost(!topmost);
                setTopmost(next)
            }}>{topmost ? <Pin className="h-4 w-4"/> : <PinOff className="h-4 w-4"/>}</Button></header>
        <section className="mt-4 min-h-0 flex-1 overflow-auto rounded border border-slate-700 bg-slate-900/40 p-3">
            <div className="flex items-center"><b>文案</b><Button className="ml-auto" size="sm"
                                                                  disabled={!String(block.text || '').trim()}
                                                                  onClick={copy}><Copy
                className="h-4 w-4"/>复制文案</Button></div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">{block.text || '此段没有文案'}</p>
            <div className="mt-5"><b className="text-sm">素材</b>{!block.assets.length &&
                <p className="mt-2 text-xs text-slate-400">此段尚未配图</p>}{block.assets.map(asset => <div
                key={asset.id} className="mt-2 rounded border border-slate-700 p-2">
                <div className="flex items-center gap-2 text-xs">
                    <span>#{String(asset.position).padStart(2, '0')} {asset.source?.fileName || '素材'}</span>{asset.delivery ? <>
                    <Button className="ml-auto" size="sm" draggable onDragStart={event => {
                        event.preventDefault();
                        mangaDeskBridge.assistant.startDrag(asset.delivery.token)
                    }}><Play className="h-3 w-3"/>拖入剪映</Button><Button size="sm" variant="ghost"
                                                                           onClick={() => mangaDeskBridge.assistant.openAssetDirectory(asset.delivery.token)}><ExternalLink
                    className="h-3 w-3"/></Button></> : <Button className="ml-auto" size="sm" variant="secondary"
                                                                disabled={['queued', 'rendering'].includes(asset.preparation?.state)}
                                                                onClick={() => prepare(asset)}>{asset.preparation?.state === 'failed' ? '重试' : '准备素材'}</Button>}</div>
                {asset.type === 'video' && <p className="mt-2 text-xs text-slate-400">视频 · {(asset.startUs / 1000000).toFixed(3)}–{(asset.endUs / 1000000).toFixed(3)} 秒 · 时长 {((asset.endUs - asset.startUs) / 1000000).toFixed(3)} 秒 · 交付：{asset.audio?.mode === 'keep' ? '保留原声' : '静音'}</p>}
                {['queued', 'rendering'].includes(asset.preparation?.state) && <div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><span>{asset.preparation.state === 'queued' ? '等待准备…' : `准备中 ${Math.round((asset.preparation.progress || 0) * 100)}%`}</span><Button size="sm" variant="ghost" onClick={() => cancel(asset)}>取消</Button></div>}
                {asset.preparation?.error && <p role="alert" className="mt-2 text-xs text-amber-300">{asset.preparation.error}</p>}
            </div>)}</div>
        </section>
        <section className="mt-3 rounded border border-slate-700 bg-slate-900/40 text-xs">
            <button className="flex w-full items-center gap-2 p-2" onClick={() => setCacheOpen(value => !value)}>
                <b>素材缓存</b>{cache && <span className="text-slate-400">{cache.entries.length} 份 · {formatBytes(cache.totalBytes)}</span>}
                <span className="ml-auto text-slate-400">{cacheOpen ? '收起' : '查看'}</span></button>
            {cacheOpen && <div className="border-t border-slate-700 p-2">
                {!cache?.entries.length && <p className="text-slate-400">还没有已交付的素材。</p>}
                {cache?.entries.map(entry => <div key={entry.name} className="flex items-center gap-2 py-1">
                    <span className="min-w-0 flex-1 truncate">{entry.type === 'video' ? '视频' : '图片'} · {formatBytes(entry.size)} · {new Date(entry.createdAt).toLocaleString()}</span>
                    <Button size="sm" variant="ghost" className="text-red-300" aria-label="删除交付文件" title="删除交付文件"
                            onClick={() => removeCache(entry.name)}><Trash2 className="h-3 w-3"/></Button></div>)}
                {Boolean(cache?.temporary.count) && <div className="mt-1 flex items-center gap-2 border-t border-slate-800 pt-2 text-slate-400">
                    <span className="min-w-0 flex-1">未完成的临时文件 {cache.temporary.count} 个 · {formatBytes(cache.temporary.bytes)}</span>
                    <Button size="sm" variant="secondary" onClick={pruneCache}>清理</Button></div>}
                <p className="mt-2 text-slate-500">交付文件默认永久保留，供剪映重复导入；删除属于显式操作。</p>
            </div>}
        </section>
        <section
            className="mt-3 grid grid-cols-3 gap-2 text-xs">{[['voiced', '配音'], ['edited', '放画面'], ['effectDone', '动效']].map(([key, label]) =>
            <label key={key} className="flex items-center gap-1"><input type="checkbox"
                                                                        disabled={snapshot.narrationMode === 'voice' && key === 'voiced'}
                                                                        checked={Boolean(block.status?.[key])}
                                                                        onChange={event => command(key, event.target.checked)}/>{label}
            </label>)}</section>
        <footer className="mt-3 flex gap-2"><Button variant="secondary" disabled={index <= 0}
                                                    onClick={() => setBlockId(snapshot.blocks[index - 1].id)}><ChevronLeft
            className="h-4 w-4"/>上一段</Button><Button className="ml-auto"
                                                        disabled={index >= snapshot.blocks.length - 1}
                                                        onClick={() => setBlockId(snapshot.blocks[index + 1].id)}>下一段<ChevronRight
            className="h-4 w-4"/></Button></footer>
        <p className="mt-2 text-xs text-slate-500">准备好后再次拖入剪映，也可打开目录手动导入。交付文件会永久保留；拖动不会自动勾选“放画面”。</p>
        {notice && <p className="mt-2 text-xs text-amber-300">{notice}</p>}</main>
}
