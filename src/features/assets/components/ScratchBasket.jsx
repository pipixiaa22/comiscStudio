import {ChevronDown, ChevronUp, Trash2} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {SourcePreview} from './SourcePreview'
import {formatVideoTime} from '../../video/model/videoRange'

export function ScratchBasket({projectId, items, sourcesById, currentBlockId, onAdd, onRemove, onMove, onClear}) {
    return <details open className="mt-4 rounded border border-slate-700 bg-slate-900/40">
        <summary className="cursor-pointer px-3 py-2 text-sm font-bold">素材篮 <span
            className="text-slate-400">({items.length})</span></summary>
        <div className="space-y-2 border-t border-slate-700 p-2">{!items.length &&
            <p className="py-4 text-center text-xs text-slate-500">按 Q 暂存当前画面</p>}
            {items.map((item, index) => <div key={item.id} draggable
                                             onDragStart={event => event.dataTransfer.setData('application/x-mangadesk-basket', JSON.stringify({
                                                 projectId,
                                                 itemId: item.id
                                             }))} className="rounded border border-slate-700 bg-slate-950 p-2">
                {item.type === 'video-range' ? <div className="flex h-20 items-center rounded bg-slate-800 px-2 text-[10px] text-orange-200">视频区间<br/>{formatVideoTime(item.startUs)} – {formatVideoTime(item.endUs)}</div> : <SourcePreview source={sourcesById.get(item.sourceId)} crop={item.crop} className="h-20 w-full rounded"/>}
                <div className="mt-1 flex items-center gap-1"><span
                    className="mr-auto text-[10px] text-slate-400">{item.type === 'video-range' ? '视频片段' : item.crop ? 'Crop' : '整页'}</span><Button size="sm"
                                                                                                               variant="ghost"
                                                                                                               disabled={!index}
                                                                                                               onClick={() => onMove(item.id, index - 1)}><ChevronUp
                    className="h-3 w-3"/></Button><Button size="sm" variant="ghost"
                                                          disabled={index === items.length - 1}
                                                          onClick={() => onMove(item.id, index + 1)}><ChevronDown
                    className="h-3 w-3"/></Button><Button size="sm" variant="ghost"
                                                          onClick={() => onRemove(item.id)}><Trash2
                    className="h-3 w-3"/></Button></div>
                <Button size="sm" className="mt-1 w-full" disabled={!currentBlockId}
                        onClick={() => onAdd(item.id, currentBlockId)}>加入当前 Block</Button></div>)}
            {!!items.length && <Button size="sm" variant="ghost" className="w-full text-red-300"
                                       onClick={onClear}>清空 {items.length} 项</Button>}
        </div>
    </details>
}
