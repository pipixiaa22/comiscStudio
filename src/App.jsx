import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {AppHeader} from './app/AppHeader'
import {WorkspacePage} from './app/WorkspacePage'
import {Welcome} from './features/project/components/Welcome'
import {useProjectAutosave} from './features/project/hooks/useProjectAutosave'
import {useProjectBootstrap} from './features/project/hooks/useProjectBootstrap'
import {useProjectImport} from './features/project/hooks/useProjectImport'
import {ReaderDialog} from './features/reader/components/ReaderDialog'
import {releaseAllPdfDocuments} from './features/reader/services/PdfDocumentRepository'
import {buildUsageIndex} from './features/assets/model/usageIndex'
import {StoryboardView} from './features/storyboard/components/StoryboardView'
import {ExportView} from './features/export/components/ExportView'
import {useProjectStore} from './store/ProjectStoreProvider'
import {useShortcutScope} from './shared/hooks/useShortcutScope'
import {mangaDeskBridge} from './shared/bridge/mangaDeskBridge'
import {prepareSourceAdditions} from './shared/domain/mediaAsset'
import {createId} from './shared/lib/ids'
import {hydrateSources} from './features/project/projectSources'
import {ProjectCenter} from './features/project/components/ProjectCenter'

export default function App() {
    const {state, blocks, currentBlock, currentBlockIndex, commands} = useProjectStore()
    const [videoImporting, setVideoImporting] = useState(false)
    const [videoProgress, setVideoProgress] = useState('')
    const [locatedVideo, setLocatedVideo] = useState(null)
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
    const latestProject = useRef(project)
    latestProject.current = project
    const sourcesById = useMemo(() => new Map([...sources.filter(source => source.sourceId).map(source => [source.sourceId, source]), ...(project?.sources || []).filter(source => source.mediaType === 'video').map(source => [source.id, source])]), [sources, project?.sources])
    const favoriteIds = useMemo(() => new Set((project?.favorites || []).map(entry => entry.sourceId)), [project?.favorites])
    const usageIndex = useMemo(() => buildUsageIndex(blocks), [blocks])
    const filteredSources = useMemo(() => {
        const favoriteOrder = new Map((project?.favorites || []).map(entry => [entry.sourceId, entry.createdAt]))
        const registeredIds = new Set((project?.sources || []).map(source => source.id))
        return sources.filter((source, index) => registeredIds.has(source.sourceId) && (browserView !== 'favorites' || favoriteIds.has(source.sourceId)) && `${index + 1} ${source.name}`.toLowerCase().includes(search.toLowerCase())).sort((left, right) => browserView === 'favorites' ? (favoriteOrder.get(right.sourceId) || 0) - (favoriteOrder.get(left.sourceId) || 0) : 0)
    }, [sources, browserView, favoriteIds, search, project?.favorites, project?.sources])
    const chooseSource = useCallback(source => {
        setSelectedSource(source)
        if (source?.sourceId && source.sourceId !== project?.workspace?.currentSourceId) commands.selectSource(source.sourceId)
    }, [commands, project?.workspace?.currentSourceId])
    const {flush: save} = useProjectAutosave({
        project,
        revision: state.revision,
        savedRevision: state.savedRevision,
        saveStatus: state.saveStatus,
        onSaveStarted: commands.saveStarted,
        onSaveSucceeded: commands.saveSucceeded,
        onSaveFailed: commands.saveFailed
    })
    const openReader = useCallback(target => {
        const source = target || selectedSource
        if (!source) return
        if (target) chooseSource(target)
        origin.current = document.activeElement
        setReaderOpen(true)
    }, [chooseSource, selectedSource])
    const closeReader = useCallback(() => {
        setReaderOpen(false);
        requestAnimationFrame(() => origin.current?.focus?.())
    }, [])
    const clearLocated = useCallback(() => setLocatedCrop(null), [])
    const addBasketFromReader = useCallback((sourceId, crop) => {
        commands.addBasketItem(sourceId, crop);
        setCropDraft(null)
    }, [commands])
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
        if (asset.type === 'video') {
            commands.setVideoWorkspace({activeMediaTab: 'video', currentVideoSourceId: asset.sourceId})
            setLocatedVideo({asset, requestId: Date.now()})
            setView('workspace')
            return
        }
        const source = sourcesById.get(asset.sourceId)
        if (!source) {
            setError('原图不可用');
            return
        }
        setSearch('');
        setBrowserView('all');
        setCropDraft(null)
        setLocatedCrop(asset.crop ? {sourceId: asset.sourceId, crop: asset.crop} : null)
        chooseSource(source)
        openReader(source)
    }, [chooseSource, openReader, sourcesById, commands])
    const editStoryboardBlock = useCallback(blockId => {
        setStoryReturnBlockId(blockId)
        commands.selectBlock(blockId)
        setView('workspace')
    }, [commands])
    useProjectBootstrap({onLoad: commands.load, onSources: setSources, onSelect: setSelectedSource, onError: setError})
    const importSource = useProjectImport({
        onLoad: commands.load,
        onSources: setSources,
        onSelect: setSelectedSource,
        onError: setError
    })
    const appendSource = useCallback(async kind => {
        if (!project) return
        try {
            const source = await (kind === 'pdf' ? mangaDeskBridge.choosePdf() : mangaDeskBridge.chooseDirectory())
            if (!source?.images?.length) return
            if (latestProject.current?.id !== project.id) return
            const additions = prepareSourceAdditions(latestProject.current.sources, source.images, createId)
            commands.appendSources(project.id, additions, source.sourcePath || source.directory)
            const hydrated = hydrateSources(source.images, {sources: [...latestProject.current.sources, ...additions]})
            setSources(current => [...current, ...hydrated.filter(item => !current.some(existing => existing.sourceId === item.sourceId))])
            setSelectedSource(hydrated[0] || null)
        } catch (error) {
            setError(error instanceof Error ? error.message : '追加来源失败')
        }
    }, [commands, project])
    useEffect(() => mangaDeskBridge.video.onProgress(progress => {
        if (latestProject.current?.id === progress.projectId) setVideoProgress(`探测 ${progress.current}/${progress.total}`)
    }), [])
    const importVideo = useCallback(async () => {
        if (!project || videoImporting) return
        const projectId = project.id
        setVideoImporting(true); setVideoProgress('选择视频…')
        try {
            const result = await mangaDeskBridge.video.choose(projectId)
            if (latestProject.current?.id !== projectId) return
            commands.appendSources(projectId, result.sources)
            if (result.failures.length) setError(result.failures.map(item => `${item.file.split(/[\\/]/).pop()}：${item.message}`).join('；'))
        } catch (reason) { if (latestProject.current?.id === projectId) setError(reason.message) }
        finally { setVideoImporting(false); setVideoProgress('') }
    }, [project?.id, commands, videoImporting])
    const openProject = useCallback(async id => {
        try {
            const data = await mangaDeskBridge.openProject(id), nextSources = hydrateSources(data.images, data.project)
            commands.load(data.project);
            setSources(nextSources);
            setSelectedSource(nextSources.find(source => source.sourceId === data.project.workspace.currentSourceId) || nextSources[0] || null);
            setView('workspace')
        } catch (error) {
            setError(error instanceof Error ? error.message : '打开项目失败')
        }
    }, [commands])
    useEffect(() => () => releaseAllPdfDocuments(), [sources])
    useEffect(() => {
        if (!state.notice) return
        const timer = setTimeout(commands.clearNotice, 2200)
        return () => clearTimeout(timer)
    }, [commands, state.notice])
    useEffect(() => {
        if (!currentBlock?.assets.length) {
            if (selectedAssetId) setSelectedAssetId(null);
            return
        }
        if (!selectedAssetId || !currentBlock.assets.some(asset => asset.id === selectedAssetId)) setSelectedAssetId(currentBlock.assets.at(-1).id)
    }, [currentBlock?.assets, selectedAssetId])
    useEffect(() => {
        if (!project || !window.mangaDesk?.assistant) return
        const sources = new Map((project.sources || []).map(source => [source.id, source]))
        const snapshot = {
            projectId: project.id,
            revision: state.revision,
            projectName: project.name,
            narrationMode: project.narration?.mode || 'text',
            saveStatus: state.saveStatus,
            blocks: blocks.map((block, index) => ({
                id: block.id,
                position: index + 1,
                text: block.text,
                status: block.status,
                assets: (block.assets || []).map((asset, assetIndex) => ({
                    ...asset,
                    position: assetIndex + 1,
                    source: sources.get(asset.sourceId)
                }))
            }))
        }
        void mangaDeskBridge.assistant.publish(snapshot).catch(() => {
        })
    }, [project, blocks, state.revision, state.saveStatus])
    useEffect(() => {
        if (!window.mangaDesk?.assistant) return
        return mangaDeskBridge.assistant.onCommand(command => {
            if (command?.type === 'setStatus') commands.setBlockStatus(command.blockId, command.payload?.key, command.payload?.value)
            if (command?.type === 'locateBlock') commands.selectBlock(command.blockId)
        })
    }, [commands])
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
    useShortcutScope({enabled: !readerOpen && view === 'workspace' && project?.workspace.activeMediaTab !== 'video', bindings})
    const readerKey = selectedSource?.pdfPath || 'images'
    return <div className="flex h-full min-h-0 flex-col bg-[#0f1219]">
        <AppHeader onMediaTab={activeMediaTab => commands.setVideoWorkspace({activeMediaTab})} project={project} saveStatus={{status: state.saveStatus, error: state.saveError}} view={view}
                   onViewChange={setView} onSave={save} onImport={importSource} onExport={() => setView('export')}
                   onAppendSource={appendSource}
                   onProjectCenter={() => setView('projects')}
                   onAssistant={() => window.mangaDesk?.assistant && mangaDeskBridge.assistant.open()}
                   narrationMode={project?.narration?.mode || 'text'} onNarrationMode={commands.setNarrationMode}/>
        {(error || state.notice) && <div role="status"
                                         className="bg-slate-800 px-4 py-2 text-center text-sm text-slate-200">{error || state.notice}</div>}
        {view === 'projects' ? <ProjectCenter onOpen={openProject} onClose={() => setView('workspace')}/> : !project ?
            <Welcome onImport={importSource}/> : view === 'export' ?
                <ExportView project={project} revision={state.revision} onSavePreset={commands.saveExportPreset} onRemovePreset={commands.removeExportPreset} onRecordDelivery={commands.recordDelivery}
                            onClose={() => setView('workspace')}/> : view === 'storyboard' ?
                    <StoryboardView project={project} revision={state.revision} sourcesById={sourcesById}
                                    restoreBlockId={storyReturnBlockId} onEditBlock={editStoryboardBlock}
                                    onOpenSource={asset => {
                        if (asset.type === 'video') {
                            const target = project.blocks.find(block => block.assets.some(item => item.id === asset.id))
                            if (target) commands.selectBlock(target.id)
                            locateAsset(asset)
                            return
                        }
                        const sourceId = asset.sourceId
                                        const source = sourcesById.get(sourceId);
                                        if (source) openReader(source)
                                    }}/> :
                    <WorkspacePage videoProps={{onImport: importVideo, importing: videoImporting, importProgress: videoProgress, located: locatedVideo}} project={project} sources={sources} filteredSources={filteredSources}
                                   sourcesById={sourcesById} selectedSource={selectedSource} search={search}
                                   onSearchChange={setSearch} onSelectSource={chooseSource} onOpenReader={openReader}
                                   browserView={browserView} onBrowserViewChange={setBrowserView}
                                   favoriteIds={favoriteIds}
                                   onToggleFavorite={toggleFavorite}
                                   onAddBasket={sourceId => commands.addBasketItem(sourceId)}
                                   onAddAsset={sourceId => commands.addAssetToCurrentBlock(sourceId)}
                                   usageIndex={usageIndex} onSelectReference={selectReference}
                                   onLocateAsset={locateAsset}
                                   selectedAssetId={selectedAssetId} onSelectAsset={setSelectedAssetId}
                                   block={currentBlock}
                                   blockIndex={currentBlockIndex} blocks={blocks} commands={commands}
                                   undoCount={state.undo.length} redoCount={state.redo.length}/>}
        {readerOpen && selectedSource &&
            <ReaderDialog item={selectedSource} sources={sources} fitMode={readerPrefs[readerKey] || 'page'}
                          setFitMode={fitMode => setReaderPrefs(preferences => ({
                              ...preferences,
                              [readerKey]: fitMode
                          }))} onSelect={chooseSource} onClose={closeReader}
                          isFavorite={favoriteIds.has(selectedSource.sourceId)} onToggleFavorite={toggleFavorite}
                          onAddBasket={addBasketFromReader} onAddAsset={addAssetFromReader} cropDraft={cropDraft}
                          onCropDraft={setCropDraft} locatedCrop={locatedCrop} onClearLocated={clearLocated}/>}
    </div>
}
