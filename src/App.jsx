import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from './app/AppHeader'
import { WorkspacePage } from './app/WorkspacePage'
import { Welcome } from './features/project/components/Welcome'
import { useProjectAutosave } from './features/project/hooks/useProjectAutosave'
import { useProjectBootstrap } from './features/project/hooks/useProjectBootstrap'
import { useProjectImport } from './features/project/hooks/useProjectImport'
import { ReaderDialog } from './features/reader/components/ReaderDialog'
import { releaseAllPdfDocuments } from './features/reader/services/PdfDocumentRepository'
import { buildUsageIndex } from './features/assets/model/usageIndex'
import { StoryboardView } from './features/storyboard/components/StoryboardView'
import { ExportView } from './features/export/components/ExportView'
import { useProjectStore } from './store/ProjectStoreProvider'
import { useShortcutScope } from './shared/hooks/useShortcutScope'

export default function App() {
  const { state, blocks, currentBlock, currentBlockIndex, commands } = useProjectStore()
  const [sources, setSources] = useState([])
  const [selectedSource, setSelectedSource] = useState(null)
  const [search, setSearch] = useState('')
  const [readerOpen, setReaderOpen] = useState(false)
  const [readerPrefs, setReaderPrefs] = useState({})
  const [cropDraft, setCropDraft] = useState(null)
  const [locatedCrop, setLocatedCrop] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState(null)
  const [browserView, setBrowserView] = useState('all')
  const [view, setView] = useState('workspace')
  const [storyReturnBlockId, setStoryReturnBlockId] = useState(null)
  const [error, setError] = useState('')
  const origin = useRef()
  const project = state.project
  const sourcesById = useMemo(() => new Map(sources.filter(source => source.sourceId).map(source => [source.sourceId, source])), [sources])
  const favoriteIds = useMemo(() => new Set((project?.favorites || []).map(entry => entry.sourceId)), [project?.favorites])
  const usageIndex = useMemo(() => buildUsageIndex(blocks), [blocks])
  const filteredSources = useMemo(() => {
    const favoriteOrder = new Map((project?.favorites || []).map(entry => [entry.sourceId, entry.createdAt]))
    return sources.filter((source, index) => (browserView !== 'favorites' || favoriteIds.has(source.sourceId)) && `${index + 1} ${source.name}`.toLowerCase().includes(search.toLowerCase())).sort((left, right) => browserView === 'favorites' ? (favoriteOrder.get(right.sourceId) || 0) - (favoriteOrder.get(left.sourceId) || 0) : 0)
  }, [sources, browserView, favoriteIds, search, project?.favorites])
  const chooseSource = useCallback(source => {
    setSelectedSource(source)
    if (source?.sourceId && source.sourceId !== project?.workspace?.currentSourceId) commands.selectSource(source.sourceId)
  }, [commands, project?.workspace?.currentSourceId])
  const { flush: save } = useProjectAutosave({ project, revision: state.revision, savedRevision: state.savedRevision, saveStatus: state.saveStatus, onSaveStarted: commands.saveStarted, onSaveSucceeded: commands.saveSucceeded, onSaveFailed: commands.saveFailed })
  const openReader = useCallback(target => {
    const source = target || selectedSource
    if (!source) return
    if (target) chooseSource(target)
    origin.current = document.activeElement
    setReaderOpen(true)
  }, [chooseSource, selectedSource])
  const closeReader = useCallback(() => { setReaderOpen(false); requestAnimationFrame(() => origin.current?.focus?.()) }, [])
  const clearLocated = useCallback(() => setLocatedCrop(null), [])
  const addBasketFromReader = useCallback((sourceId, crop) => { commands.addBasketItem(sourceId, crop); setCropDraft(null) }, [commands])
  const addAssetFromReader = useCallback((sourceId, crop) => commands.addAssetToCurrentBlock(sourceId, crop), [commands])
  const toggleFavorite = useCallback(sourceId => {
    const wasFavorite = favoriteIds.has(sourceId)
    if (wasFavorite && browserView === 'favorites' && selectedSource?.sourceId === sourceId) {
      const position = filteredSources.findIndex(source => source.sourceId === sourceId)
      setSelectedSource(filteredSources[position + 1] || filteredSources[position - 1] || null)
    }
    commands.toggleFavorite(sourceId)
  }, [browserView, commands, favoriteIds, filteredSources, selectedSource?.sourceId])
  const selectReference = useCallback(reference => {
    commands.selectBlock(reference.blockId)
    setView('workspace')
  }, [commands])
  const locateAsset = useCallback(asset => {
    const source = sourcesById.get(asset.sourceId)
    if (!source) { setError('原图不可用'); return }
    setSearch(''); setBrowserView('all'); setCropDraft(null)
    setLocatedCrop(asset.crop ? { sourceId: asset.sourceId, crop: asset.crop } : null)
    chooseSource(source)
    openReader(source)
  }, [chooseSource, openReader, sourcesById])
  const editStoryboardBlock = useCallback(blockId => {
    setStoryReturnBlockId(blockId)
    commands.selectBlock(blockId)
    setView('workspace')
  }, [commands])
  useProjectBootstrap({ onLoad: commands.load, onSources: setSources, onSelect: setSelectedSource, onError: setError })
  const importSource = useProjectImport({ onLoad: commands.load, onSources: setSources, onSelect: setSelectedSource, onError: setError })
  useEffect(() => () => releaseAllPdfDocuments(), [sources])
  useEffect(() => {
    if (!state.notice) return
    const timer = setTimeout(commands.clearNotice, 2200)
    return () => clearTimeout(timer)
  }, [commands, state.notice])
  useEffect(() => {
    if (!currentBlock?.assets.length) { if (selectedAssetId) setSelectedAssetId(null); return }
    if (!selectedAssetId || !currentBlock.assets.some(asset => asset.id === selectedAssetId)) setSelectedAssetId(currentBlock.assets.at(-1).id)
  }, [currentBlock?.assets, selectedAssetId])
  const bindings = useMemo(() => ({
    'Ctrl+s': save,
    'Ctrl+Enter': commands.completeCurrentBlock,
    ' ': selectedSource ? () => openReader() : null,
    Enter: selectedSource ? () => commands.addAssetToCurrentBlock(selectedSource.sourceId) : null,
    b: selectedSource ? () => toggleFavorite(selectedSource.sourceId) : null,
    q: selectedSource ? () => commands.addBasketItem(selectedSource.sourceId, cropDraft?.sourceId === selectedSource.sourceId ? cropDraft.crop : undefined) : null,
    Delete: selectedAssetId && currentBlock ? () => commands.removeAsset(currentBlock.id, selectedAssetId) : null,
    ArrowLeft: filteredSources.length ? () => chooseSource(filteredSources[Math.max(0, filteredSources.findIndex(source => source.path === selectedSource?.path) - 1)]) : null,
    ArrowRight: filteredSources.length ? () => chooseSource(filteredSources[Math.min(filteredSources.length - 1, filteredSources.findIndex(source => source.path === selectedSource?.path) + 1)]) : null
  }), [save, commands, selectedSource, cropDraft, selectedAssetId, currentBlock, toggleFavorite, filteredSources, openReader, chooseSource])
  useShortcutScope({ enabled: !readerOpen && view === 'workspace', bindings })
  const readerKey = selectedSource?.pdfPath || 'images'
  return <div className="flex h-full min-h-0 flex-col bg-[#0f1219]">
    <AppHeader project={project} saveStatus={{ status: state.saveStatus, error: state.saveError }} view={view} onViewChange={setView} onSave={save} onImport={importSource} onExport={() => setView('export')} narrationMode={project?.narration?.mode || 'text'} onNarrationMode={commands.setNarrationMode} />
    {(error || state.notice) && <div role="status" className="bg-slate-800 px-4 py-2 text-center text-sm text-slate-200">{error || state.notice}</div>}
    {!project ? <Welcome onImport={importSource} /> : view === 'export' ? <ExportView project={project} revision={state.revision} onClose={() => setView('workspace')} /> : view === 'storyboard' ? <StoryboardView project={project} revision={state.revision} sourcesById={sourcesById} restoreBlockId={storyReturnBlockId} onEditBlock={editStoryboardBlock} onOpenSource={sourceId => { const source = sourcesById.get(sourceId); if (source) openReader(source) }} /> : <WorkspacePage project={project} sources={sources} filteredSources={filteredSources} sourcesById={sourcesById} selectedSource={selectedSource} search={search} onSearchChange={setSearch} onSelectSource={chooseSource} onOpenReader={openReader} browserView={browserView} onBrowserViewChange={setBrowserView} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} onAddBasket={sourceId => commands.addBasketItem(sourceId)} onAddAsset={sourceId => commands.addAssetToCurrentBlock(sourceId)} usageIndex={usageIndex} onSelectReference={selectReference} onLocateAsset={locateAsset} selectedAssetId={selectedAssetId} onSelectAsset={setSelectedAssetId} block={currentBlock} blockIndex={currentBlockIndex} blocks={blocks} commands={commands} undoCount={state.undo.length} redoCount={state.redo.length} />}
    {readerOpen && selectedSource && <ReaderDialog item={selectedSource} sources={sources} fitMode={readerPrefs[readerKey] || 'page'} setFitMode={fitMode => setReaderPrefs(preferences => ({ ...preferences, [readerKey]: fitMode }))} onSelect={chooseSource} onClose={closeReader} isFavorite={favoriteIds.has(selectedSource.sourceId)} onToggleFavorite={toggleFavorite} onAddBasket={addBasketFromReader} onAddAsset={addAssetFromReader} cropDraft={cropDraft} onCropDraft={setCropDraft} locatedCrop={locatedCrop} onClearLocated={clearLocated} />}
  </div>
}
