import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Crop, Minus, Plus, ShoppingBasket, Star, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { useReaderController } from '../hooks/useReaderController'
import { retryPdfDocument, releasePdfDocument } from '../services/PdfDocumentRepository'
import { PageMedia } from './PageMedia'
import { isUsableCrop, normalizeCrop } from '../../assets/model/crop'

export function ReaderDialog({ item, sources, fitMode, setFitMode, onSelect, onClose, isFavorite, onToggleFavorite, onAddBasket, onAddAsset, cropDraft, onCropDraft, locatedCrop, onClearLocated }) {
  const [dimensions, setDimensions] = useState({ width: 612, height: 792 })
  const [viewport, setViewport] = useState({ width: 900, height: 600 })
  const [mediaState, setMediaState] = useState('loading')
  const [retry, setRetry] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [cropSelecting, setCropSelecting] = useState(false)
  const [cropError, setCropError] = useState('')
  const pane = useRef(null)
  const drag = useRef(null)
  const cropStart = useRef(null)
  const activePdfPath = useRef(null)
  const controller = useReaderController({ item, sources, fitMode, setFitMode, onSelect })
  const { active, pages, pageIndex, pageInput, pageError, manualScale, setPageInput, selectPage, submitPage, setFit, zoom } = controller
  const fitPage = Math.max(0.15, Math.min((viewport.width - 48) / dimensions.width, (viewport.height - 48) / dimensions.height))
  const fitWidth = Math.max(0.15, (viewport.width - 48) / dimensions.width)
  const scale = fitMode === 'manual' ? manualScale || fitPage : fitMode === 'width' ? fitWidth : fitPage
  const width = Math.round(dimensions.width * scale)
  const height = Math.round(dimensions.height * scale)
  const title = active.kind === 'pdf-page' ? active.name.replace(/ · P\d+$/, '') : active.name
  activePdfPath.current = active.kind === 'pdf-page' ? active.pdfPath : null

  useEffect(() => {
    const measure = () => {
      const rect = pane.current?.getBoundingClientRect()
      if (rect) setViewport({ width: rect.width, height: rect.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (pane.current) observer.observe(pane.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { onCropDraft?.(null); setCropSelecting(false); setCropError('') }, [active.path, onCropDraft])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (cropDraft?.sourceId === active.sourceId) onCropDraft?.(null)
        else if (locatedCrop?.sourceId === active.sourceId) onClearLocated?.()
        else onClose()
      } else if (event.key === ' ') {
        event.preventDefault()
        onClose()
      } else if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
      else if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectPage(pageIndex - 1)
      } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault()
        selectPage(pageIndex + 1)
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoom(scale, 1.2)
      } else if (event.key === '-') {
        event.preventDefault()
        zoom(scale, 1 / 1.2)
      } else if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        onToggleFavorite?.(active.sourceId)
      } else if (event.key.toLowerCase() === 'q') {
        event.preventDefault()
        const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined
        if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选')
        else onAddBasket?.(active.sourceId, crop)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined
        if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选')
        else { onAddAsset?.(active.sourceId, crop); onCropDraft?.(null) }
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setFit('page')
      }
    }
    addEventListener('keydown', onKeyDown)
    return () => removeEventListener('keydown', onKeyDown)
  }, [onClose, pageIndex, scale, selectPage, zoom, active.sourceId, cropDraft, locatedCrop, onCropDraft, onClearLocated, onAddBasket, onAddAsset, width, height, setFit])

  useEffect(() => () => { if (activePdfPath.current) releasePdfDocument(activePdfPath.current) }, [])

  const handleSubmit = event => { event.preventDefault(); submitPage() }
  const handleWheel = event => {
    if (!event.ctrlKey) return
    event.preventDefault()
    zoom(scale, event.deltaY < 0 ? 1.15 : 1 / 1.15)
  }
  const onPointerDown = event => {
    drag.current = { x: event.clientX, y: event.clientY, left: pane.current.scrollLeft, top: pane.current.scrollTop }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = event => {
    if (!drag.current) return
    pane.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
    pane.current.scrollTop = drag.current.top - (event.clientY - drag.current.y)
  }
  const onPointerUp = () => { drag.current = null; setDragging(false) }
  const cropPoint = event => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }
  const cropDown = event => { event.stopPropagation(); onClearLocated?.(); setCropError(''); cropStart.current = cropPoint(event); event.currentTarget.setPointerCapture(event.pointerId); onCropDraft?.({ sourceId: active.sourceId, crop: { x: cropStart.current.x, y: cropStart.current.y, width: 0, height: 0 } }) }
  const cropMove = event => {
    if (!cropStart.current) return
    event.stopPropagation()
    const end = cropPoint(event), start = cropStart.current
    onCropDraft?.({ sourceId: active.sourceId, crop: normalizeCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }) })
  }
  const cropUp = event => { event.stopPropagation(); cropStart.current = null; setCropSelecting(false) }
  const retryPage = () => {
    if (active.kind === 'pdf-page') retryPdfDocument(active.pdfPath)
    setRetry(value => value + 1)
  }

  return <div className="fixed inset-0 z-30 flex flex-col bg-[#090c12]" role="dialog" aria-modal="true">
    <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-slate-700 bg-[#151924] px-4 py-2">
      <b className="mr-auto max-w-64 truncate text-sm" title={title}>{title}</b>
      <Button size="sm" variant="secondary" disabled={!pageIndex} onClick={() => selectPage(pageIndex - 1)}><ChevronLeft className="h-4 w-4" />上一页</Button>
      <form className="flex items-center gap-1" onSubmit={handleSubmit}>
        <input value={pageInput} onChange={event => setPageInput(event.target.value)} aria-label="跳转 PDF 页码" className="h-8 w-14 rounded border border-slate-600 bg-slate-900 px-2 text-center" />
        <span className="text-xs text-slate-400">/ {pages.length}</span>
      </form>
      <Button size="sm" variant="secondary" disabled={pageIndex === pages.length - 1} onClick={() => selectPage(pageIndex + 1)}>下一页<ChevronRight className="h-4 w-4" /></Button>
      <Button size="sm" variant="secondary" onClick={() => zoom(scale, 1 / 1.2)} aria-label="缩小"><Minus className="h-4 w-4" /></Button>
      <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
      <Button size="sm" variant="secondary" onClick={() => zoom(scale, 1.2)} aria-label="放大"><Plus className="h-4 w-4" /></Button>
      <Button size="sm" variant={fitMode === 'page' ? 'default' : 'secondary'} onClick={() => setFit('page')}>适合整页</Button>
      <Button size="sm" variant={fitMode === 'width' ? 'default' : 'secondary'} onClick={() => setFit('width')}>适合宽度</Button>
      <Button size="sm" variant="ghost" onClick={() => onToggleFavorite?.(active.sourceId)} aria-label="切换收藏"><Star className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />B</Button>
      <Button size="sm" variant={cropSelecting ? 'default' : 'ghost'} onClick={() => setCropSelecting(value => !value)}><Crop className="h-4 w-4" />框选</Button>
      <Button size="sm" variant="ghost" onClick={() => { const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined; if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选'); else onAddBasket?.(active.sourceId, crop) }}><ShoppingBasket className="h-4 w-4" />Q</Button>
      <Button size="sm" variant="secondary" onClick={() => { const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined; if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选'); else { onAddAsset?.(active.sourceId, crop); onCropDraft?.(null) } }}>加入 Block Enter</Button>
      <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" />关闭 Esc</Button>
    </header>
    {(pageError || cropError) && <div role="status" className="bg-red-950 px-4 py-1 text-center text-xs text-red-200">{pageError || cropError}</div>}
    <main ref={pane} onWheel={handleWheel} className={`min-h-0 flex-1 overflow-auto bg-[#090c12] ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}>
      <div className="grid min-h-full min-w-full place-items-center p-6" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="relative bg-white shadow-2xl" style={{ width, height }} onPointerDown={cropSelecting ? cropDown : undefined} onPointerMove={cropSelecting ? cropMove : undefined} onPointerUp={cropSelecting ? cropUp : undefined}>
          <PageMedia item={active} priority scale={Math.min(Math.max(scale * (window.devicePixelRatio || 1), 0.5), 2.25)} style={{ width, height }} className="block" onDimensions={setDimensions} onState={setMediaState} retry={retry} />
          {cropDraft?.sourceId === active.sourceId && cropDraft.crop?.width > 0 && cropDraft.crop?.height > 0 && <div className="pointer-events-none absolute border-2 border-orange-400 bg-orange-300/20" style={{ left: `${cropDraft.crop.x * 100}%`, top: `${cropDraft.crop.y * 100}%`, width: `${cropDraft.crop.width * 100}%`, height: `${cropDraft.crop.height * 100}%` }} />}
          {locatedCrop?.sourceId === active.sourceId && <div className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-300/10" style={{ left: `${locatedCrop.crop.x * 100}%`, top: `${locatedCrop.crop.y * 100}%`, width: `${locatedCrop.crop.width * 100}%`, height: `${locatedCrop.crop.height * 100}%` }} />}
          {mediaState === 'loading' && <div className="absolute inset-0 grid place-items-center bg-slate-950/45 text-sm">正在加载清晰页面…</div>}
          {mediaState === 'error' && <div className="absolute inset-0 grid place-items-center bg-slate-950/80 text-center text-sm text-red-200">第 {pageIndex + 1} 页加载失败<br /><Button className="mt-3" size="sm" onClick={retryPage}>重试</Button></div>}
        </div>
      </div>
    </main>
    <footer className="border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-400">Enter 加入素材 · 框选后 Enter 确认 Crop · Esc 取消选区 · Ctrl + 滚轮缩放 · ← / → 翻页</footer>
  </div>
}
