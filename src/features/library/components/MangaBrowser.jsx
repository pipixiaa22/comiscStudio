import {memo, useEffect, useMemo, useRef, useState} from 'react'
import {LayoutGrid, Maximize2, Search, ShoppingBasket, Star} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {ScrollAreaBox} from '../../../components/ui/scroll-area'
import {pageNumber} from '../../../shared/lib/pageNumber'
import {PageMedia} from '../../reader/components/PageMedia'
import {UsageBadge} from './UsageBadge'

// The grid renders two fixed-height cards per row.  Windowing relies on that
// exact geometry, so the card height is pinned by CSS instead of text metrics.
const COLUMNS = 2
const CARD_HEIGHT = 164
const ROW_GAP = 12
const ROW_STRIDE = CARD_HEIGHT + ROW_GAP
const PADDING = 16
const OVERSCAN_ROWS = 3

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
                                 onSelectReference
                             }) {
    const selectedCard = useRef(null)
    const viewport = useRef(null)
    const [window_, setWindow] = useState({scrollTop: 0, height: 0})
    const sourceIndexes = useMemo(() => new Map(allSources.map((source, index) => [source.path, index])), [allSources])
    const documentPages = selectedSource?.kind === 'pdf-page' ? allSources.filter(source => source.pdfPath === selectedSource.pdfPath) : allSources
    const documentPage = Math.max(0, documentPages.findIndex(source => source.path === selectedSource?.path))
    useEffect(() => {
        const element = viewport.current
        if (!element) return
        const measure = () => setWindow(current => current.height === element.clientHeight ? current : {...current, height: element.clientHeight})
        measure()
        if (!window.ResizeObserver) return
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [])
    // Keep the selected page visible without mounting every card: when its row is
    // outside the rendered window, scroll the viewport to it first.
    useEffect(() => {
        const index = sources.findIndex(source => source.path === selectedSource?.path)
        if (index < 0 || !viewport.current) return
        const element = viewport.current
        const rowTop = PADDING + Math.floor(index / COLUMNS) * ROW_STRIDE
        const rowBottom = rowTop + CARD_HEIGHT
        if (rowTop < element.scrollTop || rowBottom > element.scrollTop + element.clientHeight) {
            const next = Math.max(0, rowTop - Math.max(0, (element.clientHeight - CARD_HEIGHT) / 2))
            element.scrollTop = next
            setWindow(current => ({...current, scrollTop: next, height: element.clientHeight}))
            return
        }
        selectedCard.current?.scrollIntoView({block: 'nearest'})
    }, [selectedSource?.path, sources])
    const rowCount = Math.ceil(sources.length / COLUMNS)
    const firstRow = Math.max(0, Math.floor((window_.scrollTop - PADDING) / ROW_STRIDE) - OVERSCAN_ROWS)
    const lastRow = Math.min(rowCount, Math.ceil((window_.scrollTop + window_.height - PADDING) / ROW_STRIDE) + OVERSCAN_ROWS)
    const firstIndex = firstRow * COLUMNS
    const visible = sources.slice(firstIndex, lastRow * COLUMNS)
    return <aside className="flex min-h-0 flex-col border-r border-slate-700 bg-[#181c25]">
        <div className="flex min-h-14 items-center gap-2 border-b border-slate-700 px-4 py-2"><LayoutGrid
            className="h-4 w-4 text-orange-300"/><b className="text-sm">漫画浏览器</b><Button size="sm"
                                                                                              variant={view === 'all' ? 'default' : 'ghost'}
                                                                                              onClick={() => onViewChange('all')}>全部</Button><Button
            size="sm" variant={view === 'favorites' ? 'default' : 'ghost'}
            onClick={() => onViewChange('favorites')}>收藏</Button>
            <div className="relative ml-auto"><Search
                className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500"/><input value={search}
                                                                                     onChange={event => onSearchChange(event.target.value)}
                                                                                     placeholder="页码 / 文件名"
                                                                                     className="h-9 w-28 rounded border border-slate-700 bg-slate-900 pl-7 text-xs outline-none focus:border-orange-400"/>
            </div>
        </div>
        {selectedSource && <div className="m-3 overflow-hidden rounded border border-slate-800 bg-black">
            <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2 text-xs"><span
                className="min-w-0 flex-1 truncate">第 {documentPage + 1}/{documentPages.length} 页</span><Button
                size="sm" onClick={() => onAddAsset(selectedSource.sourceId)}>加入当前段</Button><Button
                size="sm" variant="secondary" onClick={() => onOpenReader(selectedSource)}><Maximize2
                className="h-3.5 w-3.5"/>打开大图</Button></div>
            <PageMedia item={selectedSource} scale={0.6} priority className="h-52 w-full object-contain"/></div>}
        <ScrollAreaBox className="min-h-0 flex-1" viewportRef={viewport}
                       onScroll={event => {
                           const element = event.currentTarget
                           setWindow(current => current.scrollTop === element.scrollTop && current.height === element.clientHeight ? current : {scrollTop: element.scrollTop, height: element.clientHeight})
                       }}>
            <div className="grid grid-cols-2 gap-3 px-4" style={{paddingTop: PADDING + firstRow * ROW_STRIDE, paddingBottom: PADDING + Math.max(0, rowCount - lastRow) * ROW_STRIDE}}>
                {!sources.length &&
                    <p className="col-span-full py-10 text-center text-xs text-slate-500">{view === 'favorites' ? '看到想留用的画面，按 B 收藏' : '没有匹配页面'}</p>}
                {visible.map(source => {
                    const index = sourceIndexes.get(source.path) ?? 0;
                    const favorite = favoriteIds.has(source.sourceId);
                    return <div key={source.path} ref={selectedSource?.path === source.path ? selectedCard : null}
                                style={{height: CARD_HEIGHT}}
                                className={`group relative rounded-lg border p-1.5 ${selectedSource?.path === source.path ? 'border-orange-400 bg-orange-400/10' : 'border-transparent bg-slate-800/70 hover:border-slate-600'}`}>
                        <button style={{height: CARD_HEIGHT - 14}} className="flex w-full flex-col overflow-hidden text-left" onClick={() => onSelectSource(source)}
                                onDoubleClick={() => onAddAsset(source.sourceId)}><PageMedia item={source} scale={0.18}
                                                                                             className="h-32 w-full shrink-0 rounded object-contain"/><span
                            className="block truncate px-1.5 pt-1.5 text-xs text-slate-300">P{pageNumber(index)}</span></button>
                        <div className="absolute right-2 top-2 flex gap-1"><UsageBadge
                            usage={usageIndex.get(source.sourceId)} blocks={blocks}
                            onSelectReference={onSelectReference}/>
                            <button className="rounded bg-slate-950/85 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={event => {
                                event.stopPropagation();
                                onToggleFavorite(source.sourceId)
                            }} aria-label="切换收藏"><Star
                                className={`h-3.5 w-3.5 ${favorite ? 'fill-amber-400 text-amber-400' : 'text-white'}`}/>
                            </button>
                        </div>
                        <button className="absolute bottom-7 left-2 rounded bg-slate-950/85 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" onClick={event => { event.stopPropagation(); onAddBasket(source.sourceId) }} aria-label="暂存素材" title="暂存素材"><ShoppingBasket className="h-3.5 w-3.5"/></button>
                    </div>
                })}
            </div>
        </ScrollAreaBox>
    </aside>
})
