import {memo, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {LayoutGrid, Maximize2, Minus, Plus, Search, ShoppingBasket, Star} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {ScrollAreaBox} from '../../../components/ui/scroll-area'
import {pageNumber} from '../../../shared/lib/pageNumber'
import {PageMedia} from '../../reader/components/PageMedia'
import {UsageBadge} from './UsageBadge'
import {GRID_GAP, GRID_PADDING, THUMB_SIZES, gridWindow, previewHeightFor, stepThumbSize, thumbHeightOf, thumbnailRenderScale} from '../model/thumbnailGrid'

export const MangaBrowser = memo(function MangaBrowser({
                                 sources,
                                 allSources,
                                 selectedSource,
                                 search,
                                 onSearchChange,
                                 onSelectSource,
                                 onOpenReader,
                                 view,
                                 onViewChange,
                                 favoriteIds,
                                 onToggleFavorite,
                                 onAddBasket,
                                 onAddAsset,
                                 usageIndex,
                                 blocks,
                                 onSelectReference,
                                 thumbSize = 'm',
                                 onThumbSize
                             }) {
    const selectedCard = useRef(null)
    const viewport = useRef(null)
    const [box, setBox] = useState({scrollTop: 0, width: 0, height: 0})
    const thumbHeight = thumbHeightOf(thumbSize)
    const renderScale = thumbnailRenderScale(thumbHeight, window.devicePixelRatio || 1)
    const sourceIndexes = useMemo(() => new Map(allSources.map((source, index) => [source.path, index])), [allSources])
    const documentPages = selectedSource?.kind === 'pdf-page' ? allSources.filter(source => source.pdfPath === selectedSource.pdfPath) : allSources
    const documentPage = Math.max(0, documentPages.findIndex(source => source.path === selectedSource?.path))
    // Measured before paint so the first frame already uses the real column count
    // instead of mounting every page once at a guessed width.
    useLayoutEffect(() => {
        const element = viewport.current
        if (!element) return
        const measure = () => setBox(current => current.width === element.clientWidth && current.height === element.clientHeight
            ? current
            : {...current, width: element.clientWidth, height: element.clientHeight})
        measure()
        if (!window.ResizeObserver) return
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    const metrics = gridWindow({
        viewWidth: box.width,
        viewHeight: box.height,
        scrollTop: box.scrollTop,
        count: sources.length,
        thumbHeight
    })
    const visible = sources.slice(metrics.firstIndex, metrics.lastIndex)
    // Keep the selected page in view without mounting every card: when its row is
    // outside the mounted window, scroll the viewport to it first.
    useEffect(() => {
        const index = sources.findIndex(source => source.path === selectedSource?.path)
        if (index < 0 || !viewport.current) return
        const element = viewport.current
        const rowTop = GRID_PADDING + Math.floor(index / metrics.columns) * metrics.rowStride
        const rowBottom = rowTop + metrics.cardHeight
        if (rowTop < element.scrollTop || rowBottom > element.scrollTop + element.clientHeight) {
            const next = Math.max(0, rowTop - Math.max(0, (element.clientHeight - metrics.cardHeight) / 2))
            element.scrollTop = next
            setBox(current => ({...current, scrollTop: next, width: element.clientWidth, height: element.clientHeight}))
            return
        }
        selectedCard.current?.scrollIntoView({block: 'nearest'})
    }, [selectedSource?.path, sources, metrics.columns, metrics.rowStride, metrics.cardHeight])
    const previewHeight = previewHeightFor(box.width)
    const stepSize = direction => onThumbSize?.(stepThumbSize(thumbSize, direction))
    return <aside className="flex min-h-0 flex-col border-r border-border bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-2">
            <LayoutGrid className="h-4 w-4 shrink-0 text-foreground"/><b className="shrink-0 text-sm">漫画浏览器</b>
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <Button size="sm" variant={view === 'all' ? 'default' : 'ghost'} onClick={() => onViewChange('all')}>全部</Button>
                <Button size="sm" variant={view === 'favorites' ? 'default' : 'ghost'} onClick={() => onViewChange('favorites')}>收藏</Button>
                <Button size="icon" variant="ghost" aria-label="缩小缩略图" title="缩小缩略图" disabled={thumbSize === THUMB_SIZES[0].id}
                        onClick={() => stepSize(-1)}><Minus className="h-4 w-4"/></Button>
                <span className="w-6 text-center text-xs text-slate-400"
                      title="缩略图大小">{THUMB_SIZES.find(size => size.id === thumbSize)?.label || '中'}</span>
                <Button size="icon" variant="ghost" aria-label="放大缩略图" title="放大缩略图" disabled={thumbSize === THUMB_SIZES[THUMB_SIZES.length - 1].id}
                        onClick={() => stepSize(1)}><Plus className="h-4 w-4"/></Button>
            </div>
            <div className="relative w-full"><Search
                className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500"/><input value={search}
                                                                                     onChange={event => onSearchChange(event.target.value)}
                                                                                     placeholder="页码 / 文件名"
                                                                                     className="h-9 w-full rounded border border-input bg-background pl-7 text-xs outline-none focus:border-foreground"/>
            </div>
        </div>
        {selectedSource && <div className="m-3 overflow-hidden rounded border border-slate-800 bg-black">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs"><span
                className="min-w-0 flex-1 truncate">第 {documentPage + 1}/{documentPages.length} 页</span><Button
                size="sm" onClick={() => onAddAsset(selectedSource.sourceId)}>加入当前段</Button><Button
                size="sm" variant="secondary" onClick={() => onOpenReader(selectedSource)}><Maximize2
                className="h-3.5 w-3.5"/>打开大图</Button></div>
            <div className="grid place-items-center overflow-hidden bg-black" style={{height: previewHeight}}>
                <PageMedia item={selectedSource} priority scale={Math.min(Math.max(renderScale * 3, 0.5), 2.25)}
                           style={{maxHeight: '100%', maxWidth: '100%'}}/></div></div>}
        <ScrollAreaBox className="min-h-0 flex-1" viewportRef={viewport}
                       onScroll={event => {
                           const element = event.currentTarget
                           setBox(current => current.scrollTop === element.scrollTop && current.width === element.clientWidth && current.height === element.clientHeight
                               ? current
                               : {scrollTop: element.scrollTop, width: element.clientWidth, height: element.clientHeight})
                       }}>
            <div className="grid px-4" style={{
                gridTemplateColumns: `repeat(${metrics.columns}, minmax(0, 1fr))`,
                gap: GRID_GAP,
                paddingTop: metrics.topPadding,
                paddingBottom: metrics.bottomPadding
            }}>
                {!sources.length &&
                    <p className="col-span-full py-10 text-center text-xs text-slate-500">{view === 'favorites' ? '看到想留用的画面，按 B 收藏' : '没有匹配页面'}</p>}
                {visible.map(source => {
                    const index = sourceIndexes.get(source.path) ?? 0;
                    const favorite = favoriteIds.has(source.sourceId);
                    const selected = selectedSource?.path === source.path
                    return <div key={source.path} ref={selected ? selectedCard : null}
                                style={{height: metrics.cardHeight}}
                                className={`group relative rounded-lg border p-1.5 transition-colors ${selected ? 'border-foreground bg-selected' : 'border-transparent bg-card hover:border-input'}`}>
                        <button style={{height: thumbHeight + 22}} className="flex w-full flex-col overflow-hidden text-left" onClick={() => onSelectSource(source)}
                                onDoubleClick={() => onAddAsset(source.sourceId)}>
                            <div className="grid shrink-0 place-items-center overflow-hidden rounded bg-black/25" style={{height: thumbHeight}}>
                                <PageMedia item={source} scale={renderScale} style={{maxHeight: '100%', maxWidth: '100%'}}/></div>
                            <span className="block truncate px-1.5 pt-1.5 text-xs text-slate-300">P{pageNumber(index)}</span></button>
                        <div className="absolute right-2 top-2 flex gap-1"><UsageBadge
                            usage={usageIndex.get(source.sourceId)} blocks={blocks}
                            onSelectReference={onSelectReference}/>
                            <button className="rounded bg-slate-950/85 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={event => {
                                event.stopPropagation();
                                onToggleFavorite(source.sourceId)
                            }} aria-label="切换收藏"><Star
                                className={`h-3.5 w-3.5 ${favorite ? 'fill-foreground text-foreground' : 'text-white'}`}/>
                            </button>
                        </div>
                        <button className="absolute bottom-8 left-2 rounded bg-slate-950/85 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={event => { event.stopPropagation(); onAddBasket(source.sourceId) }} aria-label="暂存素材" title="暂存素材"><ShoppingBasket className="h-3.5 w-3.5"/></button>
                    </div>
                })}
            </div>
        </ScrollAreaBox>
    </aside>
})
