import {createContext, useContext, useEffect, useMemo, useReducer} from 'react'
import {mangaDeskBridge} from '../shared/bridge/mangaDeskBridge'
import {projectReducer} from './projectReducer'
import {projectActions} from './projectActions'
import {selectBlocks, selectCurrentBlock, selectCurrentBlockIndex} from './projectSelectors'

const ProjectStoreContext = createContext(null)
const initialState = {
    project: null,
    current: null,
    dirty: false,
    undo: [],
    redo: [],
    revision: 0,
    savedRevision: 0,
    saveStatus: 'saved',
    saveError: null,
    activeTextEdit: null,
    notice: null
}

export function ProjectStoreProvider({children}) {
    const [state, dispatch] = useReducer(projectReducer, initialState)
    useEffect(() => {
        if (!state.pendingVoiceRestore) return
        void mangaDeskBridge.voice.restoreTake(state.pendingVoiceRestore).finally(() => dispatch({type: 'VOICE_RESTORE_HANDLED'}))
    }, [state.pendingVoiceRestore])
    const commands = useMemo(() => ({
        setVideoWorkspace: patch => dispatch({type: 'VIDEO_WORKSPACE', patch}),
        appendSources: (projectId, sources, directory) => dispatch({
            type: 'APPEND_SOURCES',
            projectId,
            sources,
            directory
        }),
        addMediaAsset: payload => dispatch({...payload, type: 'ADD_MEDIA_ASSET'}),
        updateVideoRange: payload => dispatch({...payload, type: 'UPDATE_VIDEO_RANGE'}),
        setVideoAudio: payload => dispatch({...payload, type: 'SET_VIDEO_AUDIO'}),
        load: project => dispatch(projectActions.load(project)),
        selectBlock: blockId => dispatch(projectActions.selectBlock(blockId)),
        selectSource: sourceId => dispatch(projectActions.selectSource(sourceId)),
        updateBlockText: (blockId, text) => dispatch(projectActions.updateText(blockId, text, Date.now())),
        completeCurrentBlock: () => dispatch(projectActions.complete()),
        completeAndAddBlock: () => dispatch(projectActions.completeAndAdd()),
        addBlock: () => dispatch(projectActions.addBlock()),
        addAssetToCurrentBlock: (sourceId, crop) => dispatch(projectActions.addAsset(sourceId, crop)),
        moveCurrentBlock: direction => dispatch(projectActions.move(direction)),
        duplicateCurrentBlock: () => dispatch(projectActions.duplicate()),
        deleteCurrentBlock: () => dispatch(projectActions.remove()),
        removeAsset: (blockId, assetId) => dispatch(projectActions.removeAsset(blockId, assetId)),
        moveAsset: (blockId, assetId, toIndex) => dispatch(projectActions.moveAsset(blockId, assetId, toIndex)),
        toggleFavorite: sourceId => dispatch(projectActions.toggleFavorite(sourceId)),
        addBasketItem: (sourceId, crop) => dispatch(projectActions.addBasketItem(sourceId, crop)),
        removeBasketItem: itemId => dispatch(projectActions.removeBasketItem(itemId)),
        reorderBasket: (itemId, toIndex) => dispatch(projectActions.reorderBasket(itemId, toIndex)),
        clearBasket: () => dispatch(projectActions.clearBasket()),
        addBasketItemToBlock: (itemId, blockId) => dispatch(projectActions.addBasketItemToBlock(itemId, blockId)),
        setBlockStatus: (blockId, key, value) => dispatch(projectActions.setBlockStatus(blockId, key, value)),
        setNarrationMode: mode => dispatch(projectActions.setNarrationMode(mode)),
        addVoiceTake: (blockId, take) => dispatch(projectActions.addVoiceTake(blockId, take)),
        setActiveVoiceTake: (blockId, takeId) => dispatch(projectActions.setActiveVoiceTake(blockId, takeId)),
        setNarrationRequired: (blockId, required) => dispatch(projectActions.setNarrationRequired(blockId, required)),
        setVoiceTrim: (blockId, trimStartMs, trimEndMs) => dispatch(projectActions.setVoiceTrim(blockId, trimStartMs, trimEndMs)),
        removeVoiceTake: (blockId, takeId, trashId) => dispatch(projectActions.removeVoiceTake(blockId, takeId, trashId)),
        undo: () => dispatch(projectActions.undo()),
        redo: () => dispatch(projectActions.redo()),
        commitTextHistory: () => dispatch(projectActions.commitTextHistory()),
        saveStarted: () => dispatch(projectActions.saveStarted()),
        saveSucceeded: revision => dispatch(projectActions.saveSucceeded(revision)),
        saveFailed: error => dispatch(projectActions.saveFailed(error)),
        clearNotice: () => dispatch(projectActions.clearNotice())
    }), [dispatch])
    const value = useMemo(() => {
        const blocks = selectBlocks(state)
        const currentBlock = selectCurrentBlock(state)
        const currentBlockIndex = selectCurrentBlockIndex(state)
        return {
            state,
            dispatch,
            ...state,
            blocks,
            currentBlock,
            currentBlockIndex,
            commands
        }
    }, [state, commands])
    return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>
}

export function useProjectStore() {
    const value = useContext(ProjectStoreContext)
    if (!value) throw new Error('useProjectStore must be used within ProjectStoreProvider')
    return value
}
