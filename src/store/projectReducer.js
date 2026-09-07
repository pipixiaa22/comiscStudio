import {prepareSourceAdditions, validateVideoAsset} from '../shared/domain/mediaAsset'
import {createId, now} from '../shared/lib/ids'
import {appendHistory, redoHistory, undoHistory} from './history'
import {normalizeProjectShape} from '../shared/domain/projectNormalize'
import {cropKey, isValidCrop, normalizeCrop} from '../features/assets/model/crop'

export const createBlock = (order = 0) => ({
    id: createId(), order, text: '', assets: [], note: '',
    status: {scriptDone: false, assetDone: false, voiced: false, edited: false, effectDone: false},
    voice: {activeTakeId: null, takes: [], trimStartMs: 0, trimEndMs: null, gapAfterMs: 300, narrationRequired: true},
    createdAt: now(), updatedAt: now()
})

export function normalizeProject(project) {
    return normalizeProjectShape(project, createBlock, now())
}

const contentUpdate = (state, mutate, {recordHistory = true, historySnapshot = state.project} = {}) => {
    const project = normalizeProject(structuredClone(state.project))
    mutate(project)
    return {
        ...state,
        project,
        current: project.workspace.currentBlockId,
        dirty: true,
        revision: state.revision + 1,
        undo: recordHistory ? appendHistory(state.undo, historySnapshot) : historySnapshot === state.project ? state.undo : appendHistory(state.undo, historySnapshot),
        redo: recordHistory || historySnapshot !== state.project ? [] : state.redo,
        activeTextEdit: null
    }
}

const updateWorkspace = (state, workspace) => ({
    ...state,
    project: {...state.project, workspace: {...state.project.workspace, ...workspace}},
    current: workspace.currentBlockId || state.current,
    dirty: true,
    revision: state.revision + 1,
    activeTextEdit: null
})

function updateText(state, action) {
    const blockIndex = state.project.blocks.findIndex(block => block.id === action.blockId)
    if (blockIndex < 0) return state
    const timestamp = Number.isFinite(action.timestamp) ? action.timestamp : 0
    const active = state.activeTextEdit
    const continuesEdit = active?.blockId === action.blockId && timestamp - active.lastAt <= 700
    const oldBlock = state.project.blocks[blockIndex]
    const blocks = [...state.project.blocks]
    blocks[blockIndex] = {
        ...oldBlock,
        text: action.text,
        status: {...oldBlock.status, scriptDone: false},
        updatedAt: timestamp
    }
    return {
        ...state,
        project: {...state.project, blocks},
        dirty: true,
        revision: state.revision + 1,
        undo: continuesEdit ? state.undo : appendHistory(state.undo, state.project),
        redo: continuesEdit ? state.redo : [],
        activeTextEdit: {blockId: action.blockId, lastAt: timestamp}
    }
}

export function projectReducer(state, action) {
    switch (action.type) {
        case 'LOAD': {
            const project = normalizeProject(action.project);
            return {
                ...state,
                project,
                current: project.workspace.currentBlockId,
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
        }
        case 'WORKSPACE_SOURCE':
        case 'SOURCE':
            return updateWorkspace(state, {currentSourceId: action.sourceId || action.id})
        case 'WORKSPACE_BLOCK':
        case 'SELECT':
            return updateWorkspace(state, {currentBlockId: action.blockId || action.id})
        case 'VIDEO_WORKSPACE': {
            const patch = action.patch || {}
            const workspace = {}
            if (['image', 'video'].includes(patch.activeMediaTab)) workspace.activeMediaTab = patch.activeMediaTab
            if (state.project.sources.some(source => source.id === patch.currentVideoSourceId && source.mediaType === 'video')) workspace.currentVideoSourceId = patch.currentVideoSourceId
            if (Number.isSafeInteger(patch.positionUs) && patch.positionUs >= 0 && state.project.sources.some(source => source.id === patch.sourceId && patch.positionUs <= source.durationUs)) {
                if (state.project.workspace.videoPositions?.[patch.sourceId] !== patch.positionUs) workspace.videoPositions = {...state.project.workspace.videoPositions, [patch.sourceId]: patch.positionUs}
            }
            return Object.keys(workspace).length ? updateWorkspace(state, workspace) : state
        }
        case 'APPEND_SOURCES': {
            if (action.projectId !== state.project.id) return state
            const additions = prepareSourceAdditions(state.project.sources, action.sources, createId)
            if (!additions.length) return {...state, notice: '所选来源已在当前项目中'}
            return contentUpdate(state, project => {
                project.sources.push(...additions)
                project.sourceDirectories ||= []
                if (action.directory && !project.sourceDirectories.includes(action.directory)) project.sourceDirectories.push(action.directory)
            })
        }
        case 'ADD_MEDIA_ASSET': {
            const block = state.project.blocks.find(item => item.id === action.blockId)
            const source = state.project.sources.find(item => item.id === action.asset?.sourceId)
            const error = action.asset?.type === 'image'
                ? (!source || source.mediaType !== 'image' || !isValidCrop(action.asset.crop) ? '素材或裁切范围无效' : null)
                : validateVideoAsset(action.asset || {}, source)
            if (!block || error) return {...state, notice: error || '目标 Block 不存在'}
            return contentUpdate(state, project => {
                const target = project.blocks.find(item => item.id === action.blockId)
                target.assets.push({...action.asset, id: createId(), order: target.assets.length, createdAt: now()})
                target.status.assetDone = false
            })
        }
        case 'UPDATE_VIDEO_RANGE':
        case 'SET_VIDEO_AUDIO': {
            const block = state.project.blocks.find(item => item.id === action.blockId)
            const asset = block?.assets.find(item => item.id === action.assetId)
            if (asset?.type !== 'video') return state
            const patch = action.type === 'UPDATE_VIDEO_RANGE'
                ? {startUs: action.startUs, endUs: action.endUs, selectionBasis: 'time'} : {audio: action.audio}
            const error = validateVideoAsset({...asset, ...patch}, state.project.sources.find(source => source.id === asset.sourceId))
            if (error) return {...state, notice: error}
            if (JSON.stringify({...asset, ...patch}) === JSON.stringify(asset)) return state
            return contentUpdate(state, project => {
                const target = project.blocks.find(item => item.id === action.blockId)
                Object.assign(target.assets.find(item => item.id === action.assetId), patch)
                target.status.assetDone = false
            })
        }
        case 'TEXT':
            return updateText(state, action)
        case 'COMPLETE':
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === state.current);
                if (block) block.status.scriptDone = true
            })
        case 'COMPLETE_ADD':
        case 'ADD_BLOCK':
            return contentUpdate(state, project => {
                const index = project.blocks.findIndex(item => item.id === state.current);
                if (index < 0) return;
                if (action.type === 'COMPLETE_ADD') project.blocks[index].status.scriptDone = true;
                const next = createBlock(index + 1);
                project.blocks.splice(index + 1, 0, next);
                project.blocks = project.blocks.map((block, order) => ({...block, order}));
                project.workspace.currentBlockId = next.id
            })
        case 'INSERT_TEXT_BLOCKS': {
            const texts = (action.texts || []).map(text => String(text)).filter(text => text.trim())
            if (!texts.length) return {...state, notice: '没有可导入的非空段落'}
            return contentUpdate(state, project => {
                const requested = project.blocks.findIndex(block => block.id === action.insertAfterId)
                const index = requested >= 0 ? requested + 1 : project.blocks.length
                const inserted = texts.map((text, offset) => ({...createBlock(index + offset), text, updatedAt: now()}))
                const onlyEmpty = project.blocks.length === 1 && !project.blocks[0].text.trim() && !project.blocks[0].assets.length
                if (onlyEmpty) project.blocks = inserted
                else project.blocks.splice(index, 0, ...inserted)
                project.blocks = project.blocks.map((block, order) => ({...block, order}))
                project.workspace.currentBlockId = inserted[0].id
            })
        }
        case 'SPLIT_BLOCK': {
            const block = state.project.blocks.find(item => item.id === action.blockId)
            const offset = Number(action.offset)
            if (!block || !Number.isInteger(offset) || offset <= 0 || offset >= block.text.length) return state
            if (block.voice?.takes?.length) return {...state, notice: '已有录音的段落暂不能拆分，以免破坏音频边界'}
            return contentUpdate(state, project => {
                const index = project.blocks.findIndex(item => item.id === action.blockId)
                const target = project.blocks[index], next = createBlock(index + 1)
                target.text = target.text.slice(0, offset)
                target.status = {...target.status, scriptDone: false}
                target.updatedAt = now()
                next.text = block.text.slice(offset)
                project.blocks.splice(index + 1, 0, next)
                project.blocks = project.blocks.map((item, order) => ({...item, order}))
                project.workspace.currentBlockId = next.id
            })
        }
        case 'MERGE_WITH_NEXT': {
            const index = state.project.blocks.findIndex(item => item.id === action.blockId)
            const block = state.project.blocks[index], next = state.project.blocks[index + 1]
            if (!block || !next) return {...state, notice: '没有可合并的下一段'}
            if (block.voice?.takes?.length || next.voice?.takes?.length) return {...state, notice: '含有录音的段落暂不能合并，以免破坏音频边界'}
            return contentUpdate(state, project => {
                const target = project.blocks[index], following = project.blocks[index + 1]
                target.text = `${target.text}${target.text && following.text ? '\n' : ''}${following.text}`
                target.assets = [...target.assets, ...following.assets].map((asset, order) => ({...asset, order}))
                target.status = {...target.status, scriptDone: false, assetDone: false}
                target.updatedAt = now()
                project.blocks.splice(index + 1, 1)
                project.blocks = project.blocks.map((item, order) => ({...item, order}))
                project.workspace.currentBlockId = target.id
            })
        }
        case 'BULK_BLOCKS': {
            const ids = [...new Set(action.blockIds || [])].filter(id => state.project.blocks.some(block => block.id === id))
            if (!ids.length) return state
            return contentUpdate(state, project => {
                const selected = project.blocks.filter(block => ids.includes(block.id))
                if (action.operation === 'up') {
                    for (let index = 1; index < project.blocks.length; index++) if (ids.includes(project.blocks[index].id) && !ids.includes(project.blocks[index - 1].id)) [project.blocks[index - 1], project.blocks[index]] = [project.blocks[index], project.blocks[index - 1]]
                }
                if (action.operation === 'down') {
                    for (let index = project.blocks.length - 2; index >= 0; index--) if (ids.includes(project.blocks[index].id) && !ids.includes(project.blocks[index + 1].id)) [project.blocks[index], project.blocks[index + 1]] = [project.blocks[index + 1], project.blocks[index]]
                }
                if (action.operation === 'todo') selected.forEach(block => { block.status = {...block.status, scriptDone: false, assetDone: false, voiced: false, edited: false, effectDone: false} })
                if (action.operation === 'copy') {
                    const copies = selected.map(block => ({...structuredClone(block), id: createId(), assets: block.assets.map(asset => ({...structuredClone(asset), id: createId()})), createdAt: now(), updatedAt: now()}))
                    const last = Math.max(...project.blocks.map(block => ids.includes(block.id) ? block.order : -1))
                    project.blocks.splice(last + 1, 0, ...copies)
                    project.workspace.currentBlockId = copies[0].id
                }
                if (action.operation === 'delete') {
                    project.blocks = project.blocks.filter(block => !ids.includes(block.id))
                    if (!project.blocks.length) project.blocks = [createBlock()]
                    project.workspace.currentBlockId = project.blocks[0].id
                }
                project.blocks = project.blocks.map((block, order) => ({...block, order}))
            })
        }
        case 'SELECT_NEXT_TODO': {
            const currentIndex = state.project.blocks.findIndex(block => block.id === state.current)
            const required = block => action.kind === 'assets' ? !block.assets.length : action.kind === 'voice' ? block.voice?.narrationRequired !== false && !block.voice?.activeTakeId : !block.text.trim()
            const ordered = [...state.project.blocks.slice(currentIndex + 1), ...state.project.blocks.slice(0, currentIndex + 1)]
            const target = ordered.find(required)
            return target ? updateWorkspace(state, {currentBlockId: target.id}) : {...state, notice: '没有待处理的 Block'}
        }
        case 'SAVE_EXPORT_PRESET': {
            const name = String(action.name || '').trim().slice(0, 60)
            if (!name || !action.options) return {...state, notice: '请输入预设名称'}
            return contentUpdate(state, project => {
                const preset = {id: createId(), name, options: structuredClone(action.options), updatedAt: now()}
                const previous = project.exportPresets.findIndex(item => item.name === name)
                if (previous >= 0) project.exportPresets.splice(previous, 1, preset); else project.exportPresets.push(preset)
            })
        }
        case 'REMOVE_EXPORT_PRESET':
            return state.project.exportPresets?.some(item => item.id === action.id) ? contentUpdate(state, project => {
                project.exportPresets = project.exportPresets.filter(item => item.id !== action.id)
            }) : state
        case 'RECORD_DELIVERY':
            return action.delivery?.id ? contentUpdate(state, project => {
                project.deliveries = [action.delivery, ...(project.deliveries || [])].slice(0, 20)
            }) : state
        case 'ADD_ASSET': {
            if (!state.project.sources.some(source => source.id === action.sourceId && source.mediaType === 'image') || !isValidCrop(action.crop)) return {
                ...state,
                notice: '素材或裁切范围无效'
            }
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === state.current);
                if (block) block.assets.push({
                    id: createId(),
                    type: 'image',
                    sourceId: action.sourceId,
                    crop: normalizeCrop(action.crop),
                    order: block.assets.length,
                    createdAt: now()
                })
            })
        }
        case 'REMOVE_ASSET': {
            const block = state.project.blocks.find(item => item.id === action.blockId)
            if (!block?.assets.some(asset => asset.id === action.assetId)) return state
            return contentUpdate(state, project => {
                const target = project.blocks.find(item => item.id === action.blockId);
                target.assets = target.assets.filter(asset => asset.id !== action.assetId).map((asset, order) => ({
                    ...asset,
                    order
                }));
                if (!target.assets.length) target.status.assetDone = false
            })
        }
        case 'MOVE_ASSET': {
            const block = state.project.blocks.find(item => item.id === action.blockId)
            const from = block?.assets.findIndex(asset => asset.id === action.assetId) ?? -1
            const to = Math.max(0, Math.min((block?.assets.length || 1) - 1, action.toIndex))
            if (from < 0 || from === to) return state
            return contentUpdate(state, project => {
                const target = project.blocks.find(item => item.id === action.blockId);
                const [asset] = target.assets.splice(from, 1);
                target.assets.splice(to, 0, asset);
                target.assets = target.assets.map((entry, order) => ({...entry, order}))
            })
        }
        case 'TOGGLE_FAVORITE': {
            if (!state.project.sources.some(source => source.id === action.sourceId)) return state
            return contentUpdate(state, project => {
                const index = project.favorites.findIndex(entry => entry.sourceId === action.sourceId);
                if (index >= 0) project.favorites.splice(index, 1); else project.favorites.push({
                    sourceId: action.sourceId,
                    createdAt: now()
                })
            })
        }
        case 'ADD_BASKET_ITEM': {
            if (!state.project.sources.some(source => source.id === action.sourceId && source.mediaType === 'image') || !isValidCrop(action.crop)) return {
                ...state,
                notice: '选区无效，请重新框选'
            }
            const key = `${action.sourceId}:${cropKey(action.crop)}`
            if (state.project.scratchBasket.some(item => `${item.sourceId}:${cropKey(item.crop)}` === key)) return {
                ...state,
                notice: '已在素材篮'
            }
            return {
                ...contentUpdate(state, project => {
                    project.scratchBasket.push({
                        id: createId(),
                        type: 'image',
                        sourceId: action.sourceId,
                        crop: normalizeCrop(action.crop),
                        order: project.scratchBasket.length,
                        createdAt: now()
                    })
                }), notice: '已加入素材篮'
            }
        }
        case 'ADD_VIDEO_BASKET_ITEM': {
            const item = action.item, source = state.project.sources.find(entry => entry.id === item?.sourceId)
            if (!item || !source || validateVideoAsset({...item, type: 'video', selectionBasis: item.selectionBasis || 'time'}, source)) return {...state, notice: '视频候选区间无效'}
            const duplicate = state.project.scratchBasket.some(entry => entry.type === 'video-range' && entry.sourceId === item.sourceId && entry.startUs === item.startUs && entry.endUs === item.endUs)
            if (duplicate) return {...state, notice: '已在素材篮'}
            return contentUpdate(state, project => { project.scratchBasket.push({...item, id: createId(), type: 'video-range', order: project.scratchBasket.length, createdAt: now()}) })
        }
        case 'TOGGLE_VIDEO_FAVORITE': {
            const favorite = action.favorite, source = state.project.sources.find(entry => entry.id === favorite?.sourceId)
            if (!favorite || !source || !Number.isSafeInteger(favorite.timeUs) || favorite.timeUs < 0 || favorite.timeUs > source.durationUs) return state
            return contentUpdate(state, project => {
                const index = project.videoFavorites.findIndex(item => item.sourceId === favorite.sourceId && item.timeUs === favorite.timeUs && item.startUs === favorite.startUs && item.endUs === favorite.endUs)
                if (index >= 0) project.videoFavorites.splice(index, 1); else project.videoFavorites.push({...favorite, id: createId(), createdAt: now()})
            })
        }
        case 'REMOVE_BASKET_ITEM': {
            if (!state.project.scratchBasket.some(item => item.id === action.itemId)) return state
            return contentUpdate(state, project => {
                project.scratchBasket = project.scratchBasket.filter(item => item.id !== action.itemId).map((item, order) => ({
                    ...item,
                    order
                }))
            })
        }
        case 'REORDER_BASKET': {
            const from = state.project.scratchBasket.findIndex(item => item.id === action.itemId)
            const to = Math.max(0, Math.min(state.project.scratchBasket.length - 1, action.toIndex))
            if (from < 0 || from === to) return state
            return contentUpdate(state, project => {
                const [item] = project.scratchBasket.splice(from, 1);
                project.scratchBasket.splice(to, 0, item);
                project.scratchBasket = project.scratchBasket.map((entry, order) => ({...entry, order}))
            })
        }
        case 'CLEAR_BASKET':
            return state.project.scratchBasket.length ? contentUpdate(state, project => {
                project.scratchBasket = []
            }) : state
        case 'ADD_BASKET_TO_BLOCK': {
            const item = state.project.scratchBasket.find(entry => entry.id === action.itemId)
            const block = state.project.blocks.find(entry => entry.id === action.blockId)
            const source = state.project.sources.find(source => source.id === item?.sourceId)
            const videoError = item?.type === 'video-range' ? validateVideoAsset({...item, type: 'video', selectionBasis: item.selectionBasis || 'time'}, source) : null
            if (!item || !block || (item.type === 'video-range' ? videoError : (!source || source.mediaType !== 'image' || !isValidCrop(item.crop)))) return {
                ...state,
                notice: '候选或目标 Block 已失效'
            }
            return {
                ...contentUpdate(state, project => {
                    const target = project.blocks.find(entry => entry.id === action.blockId);
                    target.assets.push(item.type === 'video-range' ? {
                        id: createId(), type: 'video', sourceId: item.sourceId, startUs: item.startUs, endUs: item.endUs,
                        videoStreamIndex: item.videoStreamIndex, selectionBasis: item.selectionBasis || 'time', audio: structuredClone(item.audio), order: target.assets.length, createdAt: now()
                    } : {
                        id: createId(),
                        type: 'image',
                        sourceId: item.sourceId,
                        crop: normalizeCrop(item.crop),
                        order: target.assets.length,
                        createdAt: now()
                    })
                }), notice: `已加入 #${String(state.project.blocks.indexOf(block) + 1).padStart(3, '0')}`
            }
        }
        case 'SET_BLOCK_STATUS': {
            const allowed = ['scriptDone', 'assetDone', 'voiced', 'edited', 'effectDone']
            if (!allowed.includes(action.key) || !state.project.blocks.some(block => block.id === action.blockId)) return state
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                block.status[action.key] = Boolean(action.value)
            })
        }
        case 'SET_NARRATION_MODE':
            return ['text', 'voice'].includes(action.mode) ? contentUpdate(state, project => {
                project.narration.mode = action.mode
            }) : state
        case 'ADD_VOICE_TAKE':
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                if (!block || !action.take?.id) return;
                block.voice.takes.push(action.take);
                block.voice.activeTakeId = action.take.id;
                block.voice.trimStartMs = 0;
                block.voice.trimEndMs = action.take.durationMs;
                block.status.voiced = true
            })
        case 'SET_ACTIVE_VOICE_TAKE':
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                if (!block || !block.voice.takes.some(take => take.id === action.takeId)) return;
                block.voice.activeTakeId = action.takeId;
                const take = block.voice.takes.find(item => item.id === action.takeId);
                block.voice.trimStartMs = 0;
                block.voice.trimEndMs = take.durationMs;
                block.status.voiced = true
            })
        case 'SET_NARRATION_REQUIRED':
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                if (!block) return;
                block.voice.narrationRequired = Boolean(action.required);
                block.status.voiced = !block.voice.narrationRequired || Boolean(block.voice.activeTakeId)
            })
        case 'SET_VOICE_TRIM':
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                const take = block?.voice.takes.find(item => item.id === block.voice.activeTakeId);
                const start = Math.max(0, Number(action.trimStartMs) || 0),
                    end = action.trimEndMs == null ? null : Number(action.trimEndMs);
                if (!block || !take || (end != null && (!Number.isFinite(end) || end - start < 200 || end > take.durationMs))) return;
                block.voice.trimStartMs = start;
                block.voice.trimEndMs = end
            })
        case 'REMOVE_VOICE_TAKE': {
            // Keep the trash token in the undo snapshot so restoring project
            // metadata also restores the corresponding WAV.
            const historySnapshot = normalizeProject(structuredClone(state.project));
            const historyBlock = historySnapshot.blocks.find(item => item.id === action.blockId);
            const historyTake = historyBlock?.voice.takes.find(item => item.id === action.takeId);
            if (!historyTake || !action.trashId) return state;
            historyTake.trashId = action.trashId;
            return contentUpdate(state, project => {
                const block = project.blocks.find(item => item.id === action.blockId);
                if (!block) return;
                block.voice.takes = block.voice.takes.filter(take => take.id !== action.takeId);
                if (block.voice.activeTakeId === action.takeId) {
                    const next = block.voice.takes.at(-1);
                    block.voice.activeTakeId = next?.id || null;
                    block.voice.trimStartMs = 0;
                    block.voice.trimEndMs = next?.durationMs ?? null;
                }
                block.status.voiced = !block.voice.narrationRequired || Boolean(block.voice.activeTakeId)
            }, {recordHistory: false, historySnapshot})
        }
        case 'MOVE':
            return contentUpdate(state, project => {
                const index = project.blocks.findIndex(item => item.id === state.current);
                const target = index + action.dir;
                if (target >= 0 && target < project.blocks.length) {
                    [project.blocks[index], project.blocks[target]] = [project.blocks[target], project.blocks[index]];
                    project.blocks = project.blocks.map((block, order) => ({...block, order}))
                }
            })
        case 'DUP':
            return contentUpdate(state, project => {
                const index = project.blocks.findIndex(item => item.id === state.current);
                if (index >= 0) {
                    const copy = {
                        ...structuredClone(project.blocks[index]),
                        id: createId(),
                        assets: project.blocks[index].assets.map(asset => ({...structuredClone(asset), id: createId()})),
                        createdAt: now(),
                        updatedAt: now()
                    };
                    project.blocks.splice(index + 1, 0, copy);
                    project.workspace.currentBlockId = copy.id
                }
            })
        case 'DELETE':
            return contentUpdate(state, project => {
                const index = project.blocks.findIndex(item => item.id === state.current);
                if (index >= 0) project.blocks.splice(index, 1);
                if (!project.blocks.length) project.blocks = [createBlock()];
                project.workspace.currentBlockId = project.blocks[Math.min(index, project.blocks.length - 1)].id
            })
        case 'COMMIT_TEXT_HISTORY':
            return {...state, activeTextEdit: null}
        case 'UNDO': {
            if (!state.undo.length) return state
            const target = state.undo.at(-1);
            const restoredTake = target.blocks.flatMap(block => (block.voice?.takes || []).map(take => ({block, take})))
                .find(({block, take}) => take.trashId && !state.project.blocks.find(current => current.id === block.id)?.voice?.takes.some(current => current.id === take.id));
            return {
                ...undoHistory(state),
                dirty: true,
                revision: state.revision + 1,
                activeTextEdit: null,
                pendingVoiceRestore: restoredTake ? {projectId: target.id, trashId: restoredTake.take.trashId, relativePath: restoredTake.take.relativePath} : null
            }
        }
        case 'REDO':
            return state.redo.length ? {
                ...redoHistory(state),
                dirty: true,
                revision: state.revision + 1,
                activeTextEdit: null
            } : state
        case 'VOICE_RESTORE_HANDLED':
            return {...state, pendingVoiceRestore: null}
        case 'SAVE_STARTED':
            return {...state, saveStatus: 'saving', saveError: null}
        case 'SAVE_SUCCEEDED':
            return action.revision === state.revision ? {
                ...state,
                savedRevision: action.revision,
                dirty: false,
                saveStatus: 'saved',
                saveError: null
            } : {
                ...state,
                savedRevision: Math.max(state.savedRevision, action.revision),
                saveStatus: 'dirty',
                saveError: null
            }
        case 'SAVE_FAILED':
            return {...state, saveStatus: 'error', saveError: action.error || '保存失败'}
        case 'CLEAR_NOTICE':
            return {...state, notice: null}
        default:
            return state
    }
}
