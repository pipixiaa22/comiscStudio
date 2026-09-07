import {Check, ChevronDown, ChevronRight, Image as ImageIcon, Plus} from 'lucide-react'
import {useEffect, useState} from 'react'
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
                                onAddBlock,
                                onAddVoiceTake,
                                onSetActiveVoiceTake,
                                onSetNarrationRequired,
                                onSetVoiceTrim,
                                onRemoveVoiceTake
                            }) {
    const [open, setOpen] = useState(() => new Set(block?.id ? [block.id] : []))
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
    return <section className="flex min-h-0 flex-col border-r border-slate-700 bg-[#11151d]">
        <div className="flex h-14 items-center border-b border-slate-700 px-5"><ImageIcon
            className="mr-2 h-4 w-4 text-orange-300"/><b className="text-sm">文案编辑器</b><span
            className="ml-auto text-xs text-slate-500">双击段落展开 / 收起</span><Button className="ml-3" size="sm"
                                                                                         onClick={onAddBlock}><Plus
            className="h-4 w-4"/>新增段落</Button></div>
        <ScrollAreaBox className="min-h-0 flex-1">
            <div className="mx-auto max-w-2xl space-y-3 p-5">{blocks.map((entry, index) => {
                const expanded = open.has(entry.id);
                return <Card key={entry.id}
                             className={entry.id === block?.id ? 'border-orange-400/40' : 'border-slate-700'}>
                    <button className="flex w-full items-center gap-2 px-4 py-3 text-left" onDoubleClick={() => {
                        onSelectBlock(entry.id);
                        toggle(entry.id)
                    }} onClick={() => onSelectBlock(entry.id)}>{expanded ? <ChevronDown className="h-4 w-4"/> :
                        <ChevronRight className="h-4 w-4"/>}<b className="text-sm">#{pageNumber(index)}</b><span
                        className="min-w-0 flex-1 truncate text-xs text-slate-400">{textSummary(entry.text) || '空白文案段落'}</span>{entry.status.scriptDone &&
                        <Check className="h-4 w-4 text-emerald-400"/>}</button>
                    {expanded && <CardContent><textarea value={entry.text}
                                                        onChange={event => onChangeText(entry.id, event.target.value)}
                                                        onBlur={onBlurText} placeholder="在这里写这一段解说…"
                                                        className="min-h-40 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 text-[15px] leading-7 outline-none focus:border-orange-400"/>
                        <div className="mt-3 flex items-center text-xs text-slate-500">
                            <span>{entry.text.length} 字</span>
                            <div className="ml-auto flex gap-2"><Button size="sm" variant="secondary"
                                                                        onClick={() => complete(entry.id)}><Check
                                className="h-4 w-4"/>完成</Button><Button size="sm" onClick={() => {
                                onSelectBlock(entry.id);
                                onCompleteAndAdd()
                            }}><Plus className="h-4 w-4"/>完成并新建</Button></div>
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
        </ScrollAreaBox></section>
}
