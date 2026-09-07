import { ChevronDown, ChevronUp, LocateFixed, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { SourcePreview } from './SourcePreview'

export function BlockAssetList({ assets, sourcesById, selectedAssetId, onSelect, onLocate, onRemove, onMove }) {
  const drop = (event, index) => {
    event.preventDefault()
    const assetId = event.dataTransfer.getData('application/x-mangadesk-asset')
    if (assetId) onMove(assetId, index)
  }
  return <div className="mt-3 space-y-2"><h3 className="text-xs font-bold">已选素材 ({assets.length})</h3>
    {!assets.length && <p className="rounded border border-dashed border-slate-700 p-3 text-center text-xs text-slate-500">按 Enter 加入整页，或在大图框选后按 Enter</p>}
    {assets.map((asset, index) => <div key={asset.id} draggable onDragStart={event => event.dataTransfer.setData('application/x-mangadesk-asset', asset.id)} onDragOver={event => event.preventDefault()} onDrop={event => drop(event, index)} className={`rounded border p-2 ${asset.id === selectedAssetId ? 'border-orange-400 bg-orange-400/10' : 'border-slate-700 bg-slate-950'}`}>
      <button className="w-full" onClick={() => onSelect(asset.id)} onDoubleClick={() => onLocate(asset)}><SourcePreview source={sourcesById.get(asset.sourceId)} crop={asset.crop} className="h-20 w-full rounded" /></button>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><span>#{index + 1} · {asset.crop ? 'Crop' : '整页'}</span><Button className="ml-auto" size="sm" variant="ghost" onClick={() => onLocate(asset)} aria-label="定位原图"><LocateFixed className="h-3 w-3" /></Button><Button size="sm" variant="ghost" disabled={!index} onClick={() => onMove(asset.id, index - 1)} aria-label="前移"><ChevronUp className="h-3 w-3" /></Button><Button size="sm" variant="ghost" disabled={index === assets.length - 1} onClick={() => onMove(asset.id, index + 1)} aria-label="后移"><ChevronDown className="h-3 w-3" /></Button><Button size="sm" variant="ghost" onClick={() => onRemove(asset.id)} aria-label="删除素材"><Trash2 className="h-3 w-3" /></Button></div>
    </div>)}
  </div>
}
