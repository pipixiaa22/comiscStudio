import {CircleCheck, ImageOff, MicOff, Redo2, TextCursorInput, Undo2} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {Card, CardContent} from '../../../components/ui/card'
import {pageNumber} from '../../../shared/lib/pageNumber'
import {ScratchBasket} from '../../assets/components/ScratchBasket'
import {BlockAssetList} from '../../assets/components/BlockAssetList'

const statuses = [['scriptDone', '文案'], ['assetDone', '素材'], ['voiced', '配音'], ['edited', '剪辑'], ['effectDone', '特效']]

export function BlockStatusPanel({
                                     projectId,
                                     narrationMode,
                                     block,
                                     index,
                                     total,
                                     sourcesById,
                                     basket,
                                     commands,
                                     undoCount,
                                     redoCount,
                                     onLocateAsset,
                                     selectedAssetId,
                                     onSelectAsset
                                 }) {
    const dropBasket = event => {
        event.preventDefault()
        try {
            const payload = JSON.parse(event.dataTransfer.getData('application/x-mangadesk-basket'));
            if (payload.projectId === projectId) commands.addBasketItemToBlock(payload.itemId, block.id)
        } catch {
        }
    }
    const requiredStatuses = statuses.filter(([key]) => narrationMode === 'voice' || key !== 'voiced')
    const missing = requiredStatuses.filter(([key]) => !(narrationMode === 'voice' && key === 'voiced' ? (block.voice?.narrationRequired === false || Boolean(block.voice?.activeTakeId)) : block.status[key]))
    const nextTodo = missing.find(([key]) => key === 'scriptDone') ? 'text' : missing.find(([key]) => key === 'assetDone') ? 'assets' : narrationMode === 'voice' ? 'voice' : 'text'
    const todoLabel = {text: '文案', assets: '配图', voice: '录音'}[nextTodo]
    return <aside className="min-h-0 overflow-auto bg-[#181c25] p-5" onDragOver={event => event.preventDefault()}
                  onDrop={dropBasket}>
        <div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">当前段检查器</h2><div className="ml-auto flex items-center gap-1"><Button size="icon" variant="ghost" aria-label="撤销" title="撤销 (Ctrl/Cmd+Z)" disabled={!undoCount} onClick={commands.undo}><Undo2 className="h-4 w-4"/></Button><Button size="icon" variant="ghost" aria-label="重做" title="重做 (Ctrl/Cmd+Shift+Z)" disabled={!redoCount} onClick={commands.redo}><Redo2 className="h-4 w-4"/></Button><span className="ml-1 text-xs text-slate-500">#{pageNumber(index)} / {total}</span></div></div>
        <Card className="mt-4 border-slate-700 bg-[#1c2230]"><CardContent className="space-y-4">
            <div><span className="text-xs font-medium text-slate-400">当前段完成度</span>
                <div className="mt-1 flex items-end gap-2"><div className="text-2xl font-bold">{requiredStatuses.length - missing.length}/{requiredStatuses.length}</div><span className="mb-1 text-xs text-slate-400">{missing.length ? `还缺 ${missing.map(([, label]) => label).join('、')}` : '已满足当前要求'}</span></div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">{requiredStatuses.map(([key, label]) => <label key={key}
                                                                                                   className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 ${!missing.some(([missingKey]) => missingKey === key) ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-300'}`}><input
                type="checkbox"
                checked={narrationMode === 'voice' && key === 'voiced' ? (block.voice?.narrationRequired === false || Boolean(block.voice?.activeTakeId)) : Boolean(block.status[key])}
                disabled={narrationMode === 'voice' && key === 'voiced'}
                onChange={event => commands.setBlockStatus(block.id, key, event.target.checked)}/>{narrationMode === 'voice' && key === 'voiced' ? '录音' : label}
            </label>)}</div>
        </CardContent></Card>
        <BlockAssetList assets={block.assets} sourcesById={sourcesById} selectedAssetId={selectedAssetId}
                        onSelect={onSelectAsset} onLocate={onLocateAsset}
                        onRemove={assetId => commands.removeAsset(block.id, assetId)}
                        onMove={(assetId, toIndex) => commands.moveAsset(block.id, assetId, toIndex)}/>
        <ScratchBasket projectId={projectId} items={basket} sourcesById={sourcesById} currentBlockId={block.id}
                       onAdd={commands.addBasketItemToBlock} onRemove={commands.removeBasketItem}
                       onMove={commands.reorderBasket} onClear={commands.clearBasket}/>
        <Card className="mt-6 border-slate-700 bg-slate-900/40"><CardContent className="space-y-3 py-4"><div><h3 className="text-sm font-semibold">下一待办</h3><p className="mt-1 text-xs text-slate-400">{missing.length ? `前往下一处待处理的${todoLabel}` : '当前段已完成，可继续检查后续段落。'}</p></div><Button className="w-full" onClick={() => commands.selectNextTodo(nextTodo)}><CircleCheck className="h-4 w-4"/>{missing.length ? `前往下一待办：${todoLabel}` : '查看下一段'}</Button><div className="flex gap-1"><Button size="sm" variant="ghost" className="flex-1" onClick={() => commands.selectNextTodo('text')} title="下一未写文案"><TextCursorInput className="h-3.5 w-3.5"/>文案</Button><Button size="sm" variant="ghost" className="flex-1" onClick={() => commands.selectNextTodo('assets')} title="下一未配图"><ImageOff className="h-3.5 w-3.5"/>配图</Button>{narrationMode === 'voice' && <Button size="sm" variant="ghost" className="flex-1" onClick={() => commands.selectNextTodo('voice')} title="下一待录音"><MicOff className="h-3.5 w-3.5"/>录音</Button>}</div></CardContent></Card>
    </aside>
}
