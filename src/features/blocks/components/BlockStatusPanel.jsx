import {ChevronDown, ChevronUp, Copy, Redo2, Trash2, Undo2} from 'lucide-react'
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
    return <aside className="min-h-0 overflow-auto bg-[#181c25] p-4" onDragOver={event => event.preventDefault()}
                  onDrop={dropBasket}>
        <h2 className="text-sm font-bold">当前 Block</h2>
        <Card className="mt-3"><CardContent className="space-y-3">
            <div><span className="text-xs text-slate-500">BLOCK</span>
                <div className="text-xl font-bold">#{pageNumber(index)} <span
                    className="text-xs font-normal text-slate-500">/ {total}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">{statuses.map(([key, label]) => <label key={key}
                                                                                                   className="flex items-center gap-2"><input
                type="checkbox"
                checked={narrationMode === 'voice' && key === 'voiced' ? (block.voice?.narrationRequired === false || Boolean(block.voice?.activeTakeId)) : Boolean(block.status[key])}
                disabled={narrationMode === 'voice' && key === 'voiced'}
                onChange={event => commands.setBlockStatus(block.id, key, event.target.checked)}/>{narrationMode === 'voice' && key === 'voiced' ? '录音' : label}
            </label>)}</div>
            <div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" disabled={!index}
                                                            onClick={() => commands.moveCurrentBlock(-1)}><ChevronUp
                className="h-4 w-4"/>上移</Button><Button variant="secondary" size="sm" disabled={index === total - 1}
                                                          onClick={() => commands.moveCurrentBlock(1)}><ChevronDown
                className="h-4 w-4"/>下移</Button><Button variant="secondary" size="sm"
                                                          onClick={commands.duplicateCurrentBlock}><Copy
                className="h-4 w-4"/>复制</Button><Button variant="ghost" size="sm" className="text-red-300"
                                                          onClick={commands.deleteCurrentBlock}><Trash2
                className="h-4 w-4"/>删除</Button></div>
        </CardContent></Card>
        <BlockAssetList assets={block.assets} sourcesById={sourcesById} selectedAssetId={selectedAssetId}
                        onSelect={onSelectAsset} onLocate={onLocateAsset}
                        onRemove={assetId => commands.removeAsset(block.id, assetId)}
                        onMove={(assetId, toIndex) => commands.moveAsset(block.id, assetId, toIndex)}/>
        <ScratchBasket projectId={projectId} items={basket} sourcesById={sourcesById} currentBlockId={block.id}
                       onAdd={commands.addBasketItemToBlock} onRemove={commands.removeBasketItem}
                       onMove={commands.reorderBasket} onClear={commands.clearBasket}/>
        <div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" disabled={!undoCount}
                                                 onClick={commands.undo}><Undo2
            className="h-4 w-4"/>撤销</Button><Button variant="secondary" size="sm" disabled={!redoCount}
                                                      onClick={commands.redo}><Redo2 className="h-4 w-4"/>重做</Button>
        </div>
    </aside>
}
