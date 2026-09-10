import {useEffect, useRef, useState} from 'react'
import {ChevronLeft, ChevronRight, Crop, Minus, Plus, ShoppingBasket, Star, X} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {useReaderController} from '../hooks/useReaderController'
import {retryPdfDocument, releasePdfDocument} from '../services/PdfDocumentRepository'
import {PageMedia} from './PageMedia'
import {isUsableCrop} from '../../assets/model/crop'
import {CROP_CURSORS, CROP_HANDLES, CROP_HANDLE_POSITIONS, cropFromDrag, moveCrop, resizeCrop} from '../../assets/model/cropDrag'

// Matches the floor enforced by isUsableCrop so a drag can never produce a
// selection the confirm step would immediately reject.
const MIN_CROP_PX = 8

export function ReaderDialog({
                                 item,
                                 sources,
                                 fitMode,
                                 setFitMode,
                                 onSelect,
                                 onClose,
                                 isFavorite,
                                 onToggleFavorite,
                                 onAddBasket,
                                 onAddAsset,
                                 cropDraft,
                                 onCropDraft,
                                 locatedCrop,
                                 onClearLocated
                             }) {
    const [dimensions, setDimensions] = useState({width: 612, height: 792})
    const [viewport, setViewport] = useState({width: 900, height: 600})
    const [mediaState, setMediaState] = useState('loading')
    const [retry, setRetry] = useState(0)
    const [dragging, setDragging] = useState(false)
    const [cropSelecting, setCropSelecting] = useState(false)
    const [cropError, setCropError] = useState('')
    const pane = useRef(null)
    const imageBox = useRef(null)
    const drag = useRef(null)
    const cropAction = useRef(null)
    const activePdfPath = useRef(null)
    const controller = useReaderController({item, sources, fitMode, setFitMode, onSelect})
    const {
        active,
        pages,
        pageIndex,
        pageInput,
        pageError,
        manualScale,
        setPageInput,
        selectPage,
        submitPage,
        setFit,
        zoom
    } = controller
    const fitPage = Math.max(0.15, Math.min((viewport.width - 48) / dimensions.width, (viewport.height - 48) / dimensions.height))
    const fitWidth = Math.max(0.15, (viewport.width - 48) / dimensions.width)
    const scale = fitMode === 'manual' ? manualScale || fitPage : fitMode === 'width' ? fitWidth : fitPage
    const width = Math.round(dimensions.width * scale)
    const height = Math.round(dimensions.height * scale)
    const title = active.kind === 'pdf-page' ? active.name.replace(/ · P\d+$/, '') : active.name
    const draftCrop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : null
    const hasDraft = Boolean(draftCrop && draftCrop.width > 0 && draftCrop.height > 0)
    activePdfPath.current = active.kind === 'pdf-page' ? active.pdfPath : null

    useEffect(() => {
        const measure = () => {
            const rect = pane.current?.getBoundingClientRect()
            if (rect) setViewport({width: rect.width, height: rect.height})
        }
        measure()
        const observer = new ResizeObserver(measure)
        if (pane.current) observer.observe(pane.current)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        onCropDraft?.(null);
        cropAction.current = null;
        setCropSelecting(false);
        setCropError('')
    }, [active.path, onCropDraft])

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
                else {
                    onAddAsset?.(active.sourceId, crop);
                    onCropDraft?.(null)
                }
            } else if (event.key.toLowerCase() === 'f') {
                event.preventDefault()
                setFit('page')
            }
        }
        addEventListener('keydown', onKeyDown)
        return () => removeEventListener('keydown', onKeyDown)
    }, [onClose, pageIndex, scale, selectPage, zoom, active.sourceId, cropDraft, locatedCrop, onCropDraft, onClearLocated, onAddBasket, onAddAsset, width, height, setFit])

    useEffect(() => () => {
        if (activePdfPath.current) releasePdfDocument(activePdfPath.current)
    }, [])

    const handleSubmit = event => {
        event.preventDefault();
        submitPage()
    }
    const handleWheel = event => {
        if (!event.ctrlKey) return
        event.preventDefault()
        zoom(scale, event.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    const onPointerDown = event => {
        drag.current = {x: event.clientX, y: event.clientY, left: pane.current.scrollLeft, top: pane.current.scrollTop}
        setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }
    const onPointerMove = event => {
        if (!drag.current) return
        pane.current.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
        pane.current.scrollTop = drag.current.top - (event.clientY - drag.current.y)
    }
    const onPointerUp = () => {
        drag.current = null;
        setDragging(false)
    }
    // Crop points are always measured against the image box itself, so a drag
    // that starts on a handle still maps to the same normalized coordinates.
    const cropPoint = event => {
        const rect = imageBox.current?.getBoundingClientRect()
        if (!rect?.width || !rect?.height) return {x: 0, y: 0}
        return {
            x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
            y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        }
    }
    const cropMinimum = () => ({
        width: Math.min(1, MIN_CROP_PX / Math.max(1, width)),
        height: Math.min(1, MIN_CROP_PX / Math.max(1, height))
    })
    const beginCropAction = (event, action) => {
        event.stopPropagation();
        event.preventDefault();
        onClearLocated?.();
        setCropError('');
        setCropSelecting(true);
        cropAction.current = {...action, start: cropPoint(event)};
        imageBox.current?.setPointerCapture(event.pointerId)
    }
    const cropDown = event => beginCropAction(event, {mode: 'new', active: false})
    const cropBodyDown = event => {
        if (hasDraft) beginCropAction(event, {mode: 'move', origin: draftCrop})
    }
    const cropHandleDown = (event, handle) => {
        if (hasDraft) beginCropAction(event, {mode: 'resize', handle, origin: draftCrop})
    }
    const cropMove = event => {
        const action = cropAction.current
        if (!action) return
        event.stopPropagation()
        const point = cropPoint(event)
        if (action.mode === 'new') {
            // A stray click must not throw away the selection being adjusted.
            if (!action.active) {
                const farEnough = Math.abs(point.x - action.start.x) * width >= MIN_CROP_PX || Math.abs(point.y - action.start.y) * height >= MIN_CROP_PX
                if (!farEnough) return
                action.active = true
            }
            onCropDraft?.({sourceId: active.sourceId, crop: cropFromDrag(action.start, point)})
            return
        }
        if (action.mode === 'move') {
            onCropDraft?.({
                sourceId: active.sourceId,
                crop: moveCrop(action.origin, {x: point.x - action.start.x, y: point.y - action.start.y})
            })
            return
        }
        onCropDraft?.({sourceId: active.sourceId, crop: resizeCrop(action.origin, action.handle, point, cropMinimum())})
    }
    const cropUp = event => {
        if (!cropAction.current) return
        event.stopPropagation();
        cropAction.current = null
        // Crop mode stays active so the handles remain available for further
        // adjustment without leaving and reopening the page.
    }
    const retryPage = () => {
        if (active.kind === 'pdf-page') retryPdfDocument(active.pdfPath)
        setRetry(value => value + 1)
    }

    return <div className="fixed inset-0 z-30 flex flex-col bg-media-background text-media-foreground" role="dialog" aria-modal="true">
        <header className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2 text-foreground">
            <b className="mr-auto max-w-64 truncate text-sm" title={title}>{title}</b>
            <Button size="sm" variant="secondary" disabled={!pageIndex}
                    onClick={() => selectPage(pageIndex - 1)}><ChevronLeft className="h-4 w-4"/>上一页</Button>
            <form className="flex items-center gap-1" onSubmit={handleSubmit}>
                <input value={pageInput} onChange={event => setPageInput(event.target.value)} aria-label="跳转 PDF 页码"
                       className="h-8 w-14 rounded border border-slate-600 bg-slate-900 px-2 text-center"/>
                <span className="text-xs text-slate-400">/ {pages.length}</span>
            </form>
            <Button size="sm" variant="secondary" disabled={pageIndex === pages.length - 1}
                    onClick={() => selectPage(pageIndex + 1)}>下一页<ChevronRight className="h-4 w-4"/></Button>
            <Button size="sm" variant="secondary" onClick={() => zoom(scale, 1 / 1.2)} aria-label="缩小"><Minus
                className="h-4 w-4"/></Button>
            <span className="w-12 text-center text-xs">{Math.round(scale * 100)}%</span>
            <Button size="sm" variant="secondary" onClick={() => zoom(scale, 1.2)} aria-label="放大"><Plus
                className="h-4 w-4"/></Button>
            <Button size="sm" variant={fitMode === 'page' ? 'default' : 'secondary'}
                    onClick={() => setFit('page')}>适合整页</Button>
            <Button size="sm" variant={fitMode === 'width' ? 'default' : 'secondary'}
                    onClick={() => setFit('width')}>适合宽度</Button>
            <Button size="sm" variant="ghost" onClick={() => onToggleFavorite?.(active.sourceId)} aria-label="切换收藏"><Star
                className={`h-4 w-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}/>B</Button>
            <Button size="sm" variant={cropSelecting ? 'default' : 'ghost'}
                    onClick={() => setCropSelecting(value => !value)}><Crop className="h-4 w-4"/>框选</Button>
            <Button size="sm" variant="ghost" onClick={() => {
                const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined;
                if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选'); else onAddBasket?.(active.sourceId, crop)
            }}><ShoppingBasket className="h-4 w-4"/>Q</Button>
            <Button size="sm" variant="secondary" onClick={() => {
                const crop = cropDraft?.sourceId === active.sourceId ? cropDraft.crop : undefined;
                if (crop && !isUsableCrop(crop, width, height)) setCropError('选区过小，请重新框选'); else {
                    onAddAsset?.(active.sourceId, crop);
                    onCropDraft?.(null)
                }
            }}>加入 Block Enter</Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4"/>关闭 Esc</Button>
        </header>
        {(pageError || cropError) && <div role="status"
                                          className="bg-red-950 px-4 py-1 text-center text-xs text-red-200">{pageError || cropError}</div>}
        <main ref={pane} onWheel={handleWheel}
              className={`min-h-0 flex-1 overflow-auto bg-media-background ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}>
            <div className="grid min-h-full min-w-full place-items-center p-6" onPointerDown={onPointerDown}
                 onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
                <div ref={imageBox} className={`relative bg-white shadow-2xl ${cropSelecting ? 'cursor-crosshair' : ''}`} style={{width, height}}
                     onPointerDown={cropSelecting ? cropDown : undefined}
                     onPointerMove={cropSelecting ? cropMove : undefined}
                     onPointerUp={cropSelecting ? cropUp : undefined}
                     onPointerCancel={cropSelecting ? cropUp : undefined}>
                    <PageMedia item={active} priority
                               scale={Math.min(Math.max(scale * (window.devicePixelRatio || 1), 0.5), 2.25)}
                               style={{width, height}} className="block" onDimensions={setDimensions}
                               onState={setMediaState} retry={retry}/>
                    {cropSelecting && hasDraft && <>
                        <div className="pointer-events-none absolute inset-x-0 top-0 bg-slate-950/55"
                             style={{height: `${draftCrop.y * 100}%`}}/>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/55"
                             style={{height: `${Math.max(0, 1 - draftCrop.y - draftCrop.height) * 100}%`}}/>
                        <div className="pointer-events-none absolute left-0 bg-slate-950/55"
                             style={{top: `${draftCrop.y * 100}%`, width: `${draftCrop.x * 100}%`, height: `${draftCrop.height * 100}%`}}/>
                        <div className="pointer-events-none absolute right-0 bg-slate-950/55"
                             style={{top: `${draftCrop.y * 100}%`, width: `${Math.max(0, 1 - draftCrop.x - draftCrop.width) * 100}%`, height: `${draftCrop.height * 100}%`}}/>
                    </>}
                    {hasDraft &&
                        <div className={`absolute border-2 border-white bg-black/20 shadow-[0_0_0_1px_hsl(var(--foreground))] ${cropSelecting ? 'cursor-move' : 'pointer-events-none'}`}
                             style={{
                                 left: `${draftCrop.x * 100}%`,
                                 top: `${draftCrop.y * 100}%`,
                                 width: `${draftCrop.width * 100}%`,
                                 height: `${draftCrop.height * 100}%`
                             }}
                             onPointerDown={cropBodyDown}>
                            {cropSelecting && <>
                                <div className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/35"/>
                                <div className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/35"/>
                                <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/35"/>
                                <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/35"/>
                                {CROP_HANDLES.map(handle => <div key={handle} aria-hidden
                                                                 onPointerDown={event => cropHandleDown(event, handle)}
                                                                 style={{...CROP_HANDLE_POSITIONS[handle], cursor: CROP_CURSORS[handle]}}
                                                                 className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-foreground bg-white shadow"/>)}
                            </>}
                        </div>}
                    {locatedCrop?.sourceId === active.sourceId &&
                        <div className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-300/10" style={{
                            left: `${locatedCrop.crop.x * 100}%`,
                            top: `${locatedCrop.crop.y * 100}%`,
                            width: `${locatedCrop.crop.width * 100}%`,
                            height: `${locatedCrop.crop.height * 100}%`
                        }}/>}
                    {mediaState === 'loading' && <div
                        className="absolute inset-0 grid place-items-center bg-slate-950/45 text-sm">正在加载清晰页面…</div>}
                    {mediaState === 'error' && <div
                        className="absolute inset-0 grid place-items-center bg-slate-950/80 text-center text-sm text-red-200">第 {pageIndex + 1} 页加载失败<br/><Button
                        className="mt-3" size="sm" onClick={retryPage}>重试</Button></div>}
                </div>
            </div>
        </main>
        <footer className="border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-400">Enter 加入素材 · 框选后拖动控制点可缩放、拖动选区可移动
            · Enter 确认 Crop · Esc 取消选区 · Ctrl + 滚轮缩放 · ← / → 翻页
        </footer>
    </div>
}
