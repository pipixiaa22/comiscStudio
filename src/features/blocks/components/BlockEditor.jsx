import {Check, ChevronDown, ChevronRight, Ellipsis, Image as ImageIcon, Merge, MoveDown, MoveUp, Plus, Search, Scissors, Trash2, Upload} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {Button} from '../../../components/ui/button'
import {Card, CardContent} from '../../../components/ui/card'
import {ScrollAreaBox} from '../../../components/ui/scroll-area'
import {pageNumber, textSummary} from '../../../shared/lib/pageNumber'
import {VoiceRecorderPanel} from '../../voice/components/VoiceRecorderPanel'

export function BlockEditor({
                                projectId,
                                narrationMode,
                                block,
                                blocks,
                                onSelectBlock,
                                onChangeText,
                                onBlurText,
                                onComplete,
                                onCompleteAndAdd,
                                onCompleteAndNext,
                                onAddBlock,
                                onInsertTextBlocks,
                                onSplitBlock,
                                onMergeWithNext,
                                onBulkBlocks,
                                onMoveCurrent,
                                onDuplicateCurrent,
                                onDeleteCurrent,
                                onAddVoiceTake,
                                onSetActiveVoiceTake,
                                onSetNarrationRequired,
                                onSetVoiceTrim,
                                onRemoveVoiceTake
                            }) {
    const [open, setOpen] = useState(() => new Set(block?.id ? [block.id] : []))
    const [selected, setSelected] = useState(new Set())
    const [query, setQuery] = useState('')
    const [importOpen, setImportOpen] = useState(false)
    const [importText, setImportText] = useState('')
    const [separator, setSeparator] = useState('blank')
    const [blockMenuOpen, setBlockMenuOpen] = useState(false)
    const fileRef = useRef(null)
    // 每段的 textarea 元素，按钮直接读它自己的 selectionStart，避免取到别的段落的光标。
    const textareas = useRef(new Map())
    useEffect(() => {
        if (block?.id) setOpen(value => new Set([...value, block.id]))
    }, [block?.id])
    const toggle = id => setOpen(value => {
        const next = new Set(value);
        next.has(id) ? next.delete(id) : next.add(id);
        return next
    })
    const complete = id => {
        onSelectBlock(id);
        onComplete();
        setOpen(value => {
            const next = new Set(value);
            next.delete(id);
            return next
        })
    }
    const importParts = useMemo(() => {
        const delimiter = separator === 'blank' ? /\r?\n\s*\r?\n/ : separator === 'line' ? /\r?\n/ : separator ? new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : /\r?\n\s*\r?\n/
        return importText.split(delimiter).filter(text => text.trim())
    }, [importText, separator])
    const toggleSelected = id => setSelected(value => {
        const next = new Set(value); next.has(id) ? next.delete(id) : next.add(id); return next
    })
    const handleTextFile = event => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => setImportText(String(reader.result || ''))
        reader.readAsText(file)
        event.target.value = ''
    }
    const runBulk = operation => {
        if (!selected.size) return
        if (operation === 'delete' && !window.confirm(`确定删除选中的 ${selected.size} 个 Block？此操作可撤销。`)) return
        onBulkBlocks([...selected], operation)
        setSelected(new Set())
    }
    const matches = entry => !query.trim() || entry.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    return <section className="flex min-h-0 flex-col border-r border-slate-700 bg-[#11151d]">
        <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-slate-700 px-5 py-2"><ImageIcon className="h-4 w-4 text-orange-300"/><b className="text-sm">文案编辑器</b>
            <label className="ml-2 flex h-8 items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 text-xs"><Search className="h-3.5 w-3.5 text-slate-500"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索全文" className="w-28 bg-transparent outline-none"/></label>
            <span className="ml-auto text-xs text-slate-500">双击段落展开 / 收起</span><Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4"/>导入文稿</Button><Button size="sm" onClick={onAddBlock}><Plus className="h-4 w-4"/>新增段落</Button></div>
        {selected.size > 0 && <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900/70 px-5 py-2 text-xs"><span>已选 {selected.size} 段</span><Button size="sm" variant="secondary" onClick={() => runBulk('up')}><MoveUp className="h-3.5 w-3.5"/>上移</Button><Button size="sm" variant="secondary" onClick={() => runBulk('down')}><MoveDown className="h-3.5 w-3.5"/>下移</Button><Button size="sm" variant="secondary" onClick={() => runBulk('copy')}>复制</Button><Button size="sm" variant="secondary" onClick={() => runBulk('todo')}>标为待办</Button><Button size="sm" variant="ghost" className="text-red-300" onClick={() => runBulk('delete')}><Trash2 className="h-3.5 w-3.5"/>删除</Button><button className="ml-auto text-slate-400 hover:text-slate-100" onClick={() => setSelected(new Set())}>取消选择</button></div>}
        <ScrollAreaBox className="min-h-0 flex-1">
            <div className="mx-auto max-w-2xl space-y-3 p-5">{blocks.filter(matches).map(entry => {
                const index = blocks.indexOf(entry)
                const expanded = open.has(entry.id);
                return <Card key={entry.id}
                             className={entry.id === block?.id ? 'border-orange-400/40' : 'border-slate-700'}>
                    <div className="flex items-center"><label className="pl-3" title="选择此段"><input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggleSelected(entry.id)}/></label><button className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left" onDoubleClick={() => {
                        onSelectBlock(entry.id);
                        toggle(entry.id)
                    }} onClick={() => onSelectBlock(entry.id)}>{expanded ? <ChevronDown className="h-4 w-4"/> :
                        <ChevronRight className="h-4 w-4"/>}<b className="text-sm">#{pageNumber(index)}</b><span
                        className="min-w-0 flex-1 truncate text-xs text-slate-400">{textSummary(entry.text) || '空白文案段落'}</span>{entry.status.scriptDone &&
                        <Check className="h-4 w-4 text-emerald-400"/>}</button>{entry.id === block?.id && <div className="relative mr-2"><Button size="icon" variant="ghost" aria-label="当前段更多操作" title="当前段更多操作" onClick={() => setBlockMenuOpen(value => !value)}><Ellipsis className="h-4 w-4"/></Button>{blockMenuOpen && <div className="absolute right-0 top-full z-20 w-40 rounded border border-slate-700 bg-slate-900 p-1 shadow-xl"><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-800 disabled:text-slate-600" disabled={!index} onClick={() => { onMoveCurrent(-1); setBlockMenuOpen(false) }}>上移当前段</button><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-800 disabled:text-slate-600" disabled={index === blocks.length - 1} onClick={() => { onMoveCurrent(1); setBlockMenuOpen(false) }}>下移当前段</button><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-800" onClick={() => { onDuplicateCurrent(); setBlockMenuOpen(false) }}>复制当前段</button><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-800" onClick={() => { onCompleteAndAdd(); setBlockMenuOpen(false) }}>完成并新建</button><button className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-800" onClick={() => { onCompleteAndNext(); setBlockMenuOpen(false) }}>完成并前往待办</button><button className="w-full rounded px-3 py-2 text-left text-xs text-red-300 hover:bg-slate-800" onClick={() => { onDeleteCurrent(); setBlockMenuOpen(false) }}>删除当前段</button></div>}</div>}</div>
                    {expanded && <CardContent><textarea value={entry.text}
                                                        onChange={event => onChangeText(entry.id, event.target.value)}
                                                        onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Enter') { event.preventDefault(); onSplitBlock(entry.id, event.currentTarget.selectionStart) } }}
                                                        ref={element => { if (element) textareas.current.set(entry.id, element); else textareas.current.delete(entry.id) }}
                                                        onBlur={onBlurText} placeholder="在这里写这一段解说…"
                                                        className="min-h-40 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 text-[15px] leading-7 outline-none focus:border-orange-400"/>
                        <div className={`mt-4 flex items-center text-xs text-slate-500 ${entry.id === block?.id ? 'sticky bottom-0 -mx-4 border-t border-slate-700 bg-slate-800/95 px-4 py-3 backdrop-blur' : ''}`}>
                            <span>{entry.text.length} 字 · Ctrl/Cmd+Shift+Enter 拆分</span>
                            <Button size="sm" variant="ghost" className="ml-2" disabled={!entry.text || Boolean(entry.voice?.takes?.length)} onClick={() => {
                                // 读该段自己 textarea 的当前光标；没放过光标（0）时从中间拆。
                                const caret = textareas.current.get(entry.id)?.selectionStart || 0
                                onSplitBlock(entry.id, caret > 0 ? caret : Math.floor(entry.text.length / 2))
                            }}><Scissors className="h-3.5 w-3.5"/>拆分</Button><Button size="sm" variant="ghost" disabled={index === blocks.length - 1 || Boolean(entry.voice?.takes?.length) || Boolean(blocks[index + 1]?.voice?.takes?.length)} onClick={() => onMergeWithNext(entry.id)}><Merge className="h-3.5 w-3.5"/>合并下一段</Button>
                            <div className="ml-auto flex gap-2">{entry.id !== block?.id && <Button size="sm" variant="secondary"
                                                                        onClick={() => complete(entry.id)}><Check
                                className="h-4 w-4"/>完成</Button>}{entry.id === block?.id && <Button size="sm" onClick={() => complete(entry.id)}><Check className="h-4 w-4"/>完成当前段</Button>}</div>
                        </div>
                        {narrationMode === 'voice' && entry.id === block?.id &&
                            <VoiceRecorderPanel projectId={projectId} block={entry}
                                                onAddTake={take => onAddVoiceTake(entry.id, take)}
                                                onSetActiveTake={takeId => onSetActiveVoiceTake(entry.id, takeId)}
                                                onSetRequired={required => onSetNarrationRequired(entry.id, required)}
                                                onSetTrim={(start, end) => onSetVoiceTrim(entry.id, start, end)}
                                                onRemoveTake={(takeId, trashId) => onRemoveVoiceTake(entry.id, takeId, trashId)}/>}
                    </CardContent>}</Card>
            })}</div>
        </ScrollAreaBox>
        {importOpen && <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-6">
            <Card className="w-full max-w-2xl border-slate-600 shadow-2xl"><CardContent className="space-y-4 p-5"><div className="flex items-center"><div><h2 className="font-bold">导入整篇文稿</h2><p className="mt-1 text-xs text-slate-400">保留原文与中文标点；不会自动按句号拆分。</p></div><button className="ml-auto text-sm text-slate-400 hover:text-white" onClick={() => setImportOpen(false)}>关闭</button></div>
                <div className="flex items-center gap-3 text-sm"><label>拆分方式 <select value={separator} onChange={event => setSeparator(event.target.value)} className="ml-2 rounded border border-slate-600 bg-slate-900 px-2 py-1"><option value="blank">空行</option><option value="line">每一行</option><option value="---">--- 分隔符</option></select></label><input ref={fileRef} type="file" accept="text/plain,.txt" className="hidden" onChange={handleTextFile}/><Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>读取 TXT</Button></div>
                <textarea autoFocus value={importText} onChange={event => setImportText(event.target.value)} placeholder="粘贴全文…" className="min-h-64 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 leading-6 outline-none focus:border-orange-400"/>
                <div className="rounded bg-slate-900 p-3 text-xs text-slate-300">预览：将新增 {importParts.length} 个 Block{importParts.length ? `，第一段：${textSummary(importParts[0])}` : ''}</div>
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setImportOpen(false)}>取消</Button><Button disabled={!importParts.length} onClick={() => { onInsertTextBlocks(importParts, block?.id); setImportText(''); setImportOpen(false) }}>追加到当前段之后</Button></div>
            </CardContent></Card>
        </div>}
    </section>
}
