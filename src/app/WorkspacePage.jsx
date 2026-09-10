import {VideoWorkspace} from '../features/video/components/VideoWorkspace'
import {useCallback, useEffect, useRef, useState} from 'react'
import {PanelRightOpen, X} from 'lucide-react'
import {Button} from '../components/ui/button'
import {PanelSplitter} from '../components/ui/panel-splitter'
import {usePersistentState} from '../shared/hooks/usePersistentState'
import { MangaBrowser } from '../features/library/components/MangaBrowser'
import { BlockEditor } from '../features/blocks/components/BlockEditor'
import { BlockStatusPanel } from '../features/blocks/components/BlockStatusPanel'

const DEFAULT_BROWSER_WIDTH = 360
const MIN_BROWSER_WIDTH = 220
// The editor needs room for its own toolbar and text column, so the browser stops
// growing once only this much of the row is left.
const MIN_EDITOR_WIDTH = 430

export function WorkspacePage({ videoProps, project, sources, filteredSources, sourcesById, selectedSource, search, onSearchChange, onSelectSource, onOpenReader, browserView, onBrowserViewChange, favoriteIds, onToggleFavorite, onAddBasket, onAddAsset, usageIndex, onSelectReference, onLocateAsset, selectedAssetId, onSelectAsset, block, blockIndex, blocks, commands, undoCount, redoCount, thumbSize, onThumbSize }) {
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [browserWidth, setBrowserWidth] = usePersistentState('mangadesk.workspace.browserWidth', DEFAULT_BROWSER_WIDTH)
  const grid = useRef(null)
  // A corrupt stored preference must not produce an invalid grid-template-columns.
  const width = Number.isFinite(browserWidth) ? browserWidth : DEFAULT_BROWSER_WIDTH
  const inspectorProps = {projectId: project.id, narrationMode: project.narration?.mode, block, index: blockIndex, total: blocks.length, sourcesById, basket: project.scratchBasket, commands, undoCount, redoCount, onLocateAsset, selectedAssetId, onSelectAsset}
  // The inspector column is hidden by CSS on narrow windows, so its measured
  // width (0 while hidden) is what actually bounds the browser panel.
  const maxBrowserWidth = useCallback(() => {
    const element = grid.current
    const total = element?.clientWidth || 0
    if (!total) return 900
    const inspector = element.children[2]?.getBoundingClientRect().width || 0
    return Math.max(MIN_BROWSER_WIDTH, total - inspector - MIN_EDITOR_WIDTH)
  }, [])
  const resizeBrowser = useCallback(width => {
    setBrowserWidth(Math.round(Math.max(MIN_BROWSER_WIDTH, Math.min(maxBrowserWidth(), width))))
  }, [maxBrowserWidth, setBrowserWidth])
  // Shrinking the window must not leave the panel wider than the row allows.
  useEffect(() => {
    const element = grid.current
    if (!element || !window.ResizeObserver) return
    const observer = new ResizeObserver(() => setBrowserWidth(current => Math.round(Math.max(MIN_BROWSER_WIDTH, Math.min(maxBrowserWidth(), current)))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [maxBrowserWidth, setBrowserWidth])
  return <>
  <main ref={grid} className="workspace-grid relative grid min-h-0 flex-1" style={{'--browser-width': `${width}px`}}>
    {project.workspace.activeMediaTab === 'video' ? <VideoWorkspace project={project} block={block} commands={commands} {...videoProps}/> : <MangaBrowser sources={filteredSources} allSources={sources} selectedSource={selectedSource} search={search} onSearchChange={onSearchChange} onSelectSource={onSelectSource} onOpenReader={onOpenReader} view={browserView} onViewChange={onBrowserViewChange} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onAddBasket={onAddBasket} onAddAsset={onAddAsset} usageIndex={usageIndex} blocks={blocks} onSelectReference={onSelectReference} thumbSize={thumbSize} onThumbSize={onThumbSize} />}
    <BlockEditor projectId={project.id} narrationMode={project.narration?.mode} block={block} blocks={blocks} onSelectBlock={commands.selectBlock} onChangeText={commands.updateBlockText} onBlurText={commands.commitTextHistory} onComplete={commands.completeCurrentBlock} onCompleteAndAdd={commands.completeAndAddBlock} onCompleteAndNext={commands.completeAndNextBlock} onAddBlock={commands.addBlock} onInsertTextBlocks={commands.insertTextBlocks} onSplitBlock={commands.splitBlock} onMergeWithNext={commands.mergeWithNext} onBulkBlocks={commands.bulkBlocks} onMoveCurrent={commands.moveCurrentBlock} onDuplicateCurrent={commands.duplicateCurrentBlock} onDeleteCurrent={commands.deleteCurrentBlock} onAddVoiceTake={commands.addVoiceTake} onSetActiveVoiceTake={commands.setActiveVoiceTake} onSetNarrationRequired={commands.setNarrationRequired} onSetVoiceTrim={commands.setVoiceTrim} onRemoveVoiceTake={commands.removeVoiceTake} />
    <BlockStatusPanel {...inspectorProps} />
    <PanelSplitter value={width} min={MIN_BROWSER_WIDTH} max={maxBrowserWidth()} onChange={resizeBrowser}
                   onReset={() => resizeBrowser(DEFAULT_BROWSER_WIDTH)} label="调整漫画浏览器宽度"/>
  </main>
  <Button className="workspace-inspector-toggle" size="sm" onClick={() => setInspectorOpen(true)}><PanelRightOpen className="h-4 w-4"/>检查器</Button>
  {inspectorOpen && <div className="workspace-inspector-drawer" role="dialog" aria-modal="true" aria-label="当前段检查器"><div className="workspace-inspector-backdrop" onClick={() => setInspectorOpen(false)}/><div className="workspace-inspector-content"><Button className="absolute right-3 top-3 z-10" size="icon" variant="ghost" aria-label="关闭检查器" onClick={() => setInspectorOpen(false)}><X className="h-4 w-4"/></Button><BlockStatusPanel {...inspectorProps}/></div></div>}
  </>
}
