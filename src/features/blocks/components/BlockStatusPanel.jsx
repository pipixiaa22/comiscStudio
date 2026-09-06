import { ChevronDown, ChevronUp, Copy, Redo2, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { pageNumber } from '../../../shared/lib/pageNumber'
import { SourcePreview } from '../../assets/components/SourcePreview'
import { ScratchBasket } from '../../assets/components/ScratchBasket'

const statuses = [['scriptDone', '文案'], ['assetDone', '素材'], ['voiced', '配音'], ['edited', '剪辑'], ['effectDone', '特效']]

export function BlockStatusPanel({ projectId, block, index, total, sourcesById, basket, commands, undoCount, redoCount, onLocateAsset }) {
  const dropBasket = event => {
    event.preventDefault()
    try { const payload = JSON.parse(event.dataTransfer.getData('application/x-mangadesk-basket')); if (payload.projectId === projectId) commands.addBasketItemToBlock(payload.itemId, block.id) } catch {}
  }
  return <aside className="min-h-0 overflow-auto bg-[#181c25] p-4" onDragOver={event => event.preventDefault()} onDrop={dropBasket}>
    <h2 className="text-sm font-bold">当前 Block</h2>
    <Card className="mt-3"><CardContent className="space-y-3">
      <div><span className="text-xs text-slate-500">BLOCK</span><div className="text-xl font-bold">#{pageNumber(index)} <span className="text-xs font-normal text-slate-500">/ {total}</span></div></div>
      <div className="grid grid-cols-2 gap-2 text-xs">{statuses.map(([key, label]) => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(block.status[key])} onChange={event => commands.setBlockStatus(block.id, key, event.target.checked)} />{label}</label>)}</div>
      <div className="grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" disabled={!index} onClick={() => commands.moveCurrentBlock(-1)}><ChevronUp className="h-4 w-4" />上移</Button><Button variant="secondary" size="sm" disabled={index === total - 1} onClick={() => commands.moveCurrentBlock(1)}><ChevronDown className="h-4 w-4" />下移</Button><Button variant="secondary" size="sm" onClick={commands.duplicateCurrentBlock}><Copy className="h-4 w-4" />复制</Button><Button variant="ghost" size="sm" className="text-red-300" onClick={commands.deleteCurrentBlock}><Trash2 className="h-4 w-4" />删除</Button></div>
    </CardContent></Card>
    <div className="mt-3 space-y-2"><h3 className="text-xs font-bold">已选素材 ({block.assets.length})</h3>{block.assets.map(asset => <div key={asset.id} className="rounded border border-slate-700 bg-slate-950 p-2"><button className="w-full" onClick={() => onLocateAsset(asset)}><SourcePreview source={sourcesById.get(asset.sourceId)} crop={asset.crop} className="h-20 w-full rounded" /></button><div className="mt-1 flex items-center text-[10px] text-slate-400"><span>{asset.crop ? 'Crop' : '整页'}</span><Button className="ml-auto" size="sm" variant="ghost" onClick={() => commands.removeAsset(block.id, asset.id)}><Trash2 className="h-3 w-3" /></Button></div></div>)}</div>
    <ScratchBasket projectId={projectId} items={basket} sourcesById={sourcesById} currentBlockId={block.id} onAdd={commands.addBasketItemToBlock} onRemove={commands.removeBasketItem} onMove={commands.reorderBasket} onClear={commands.clearBasket} />
    <div className="mt-4 flex gap-2"><Button variant="secondary" size="sm" disabled={!undoCount} onClick={commands.undo}><Undo2 className="h-4 w-4" />撤销</Button><Button variant="secondary" size="sm" disabled={!redoCount} onClick={commands.redo}><Redo2 className="h-4 w-4" />重做</Button></div>
  </aside>
}
