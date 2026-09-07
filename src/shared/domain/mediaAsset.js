const MEDIA_TYPES = new Set(['image', 'video'])

function normalizeSource(source) {
    const mediaType = source.mediaType ?? 'image'
    if (!MEDIA_TYPES.has(mediaType)) throw new Error(`不支持的来源类型：${mediaType}`)
    return {...source, mediaType, fileName: source.fileName || source.name}
}

function normalizeAsset(asset, order) {
    const type = asset.type ?? 'image'
    if (!MEDIA_TYPES.has(type)) throw new Error(`不支持的素材类型：${type}`)
    if (!asset.sourceId) throw new Error('素材缺少来源 ID')
    return {...asset, type, order}
}

// A1 validates time selections; frame snapping belongs to the A2 frame service.
function validateVideoAsset(asset, source) {
    if (!source || source.mediaType !== 'video') return 'SOURCE_NOT_FOUND'
    if (asset.type !== 'video' || asset.crop != null ||
        !['time', 'frame'].includes(asset.selectionBasis) ||
        !Number.isSafeInteger(source.durationUs) || source.durationUs <= 0 ||
        !Number.isSafeInteger(asset.startUs) || !Number.isSafeInteger(asset.endUs) ||
        asset.startUs < 0 || asset.endUs <= asset.startUs || asset.endUs > source.durationUs) return 'INVALID_VIDEO_RANGE'
    if (!Number.isInteger(asset.videoStreamIndex) || asset.videoStreamIndex < 0 ||
        asset.videoStreamIndex !== source.video?.streamIndex) return 'VIDEO_STREAM_UNAVAILABLE'
    if (!asset.audio || !['mute', 'keep'].includes(asset.audio.mode) ||
        (asset.audio.mode === 'mute' && asset.audio.streamIndex !== null) ||
        (asset.audio.mode === 'keep' && (!Number.isInteger(asset.audio.streamIndex) ||
            !(source.audioStreams || []).some(stream => stream.index === asset.audio.streamIndex)))) return 'AUDIO_STREAM_UNAVAILABLE'
    return null
}

function sourceKey(source) {
    return `${String(source.path || '').replace(/\\/g, '/')}|${source.pageNumber || ''}`
}

function prepareSourceAdditions(existing, incoming, createId) {
    const keys = new Set(existing.map(sourceKey))
    const ids = new Set(existing.map(source => source.id))
    const additions = []
    for (const raw of incoming || []) {
        if (!raw?.path) throw new Error('来源路径无效')
        const key = sourceKey(raw)
        if (keys.has(key)) continue
        const source = normalizeSource(raw)
        source.id = source.id && !ids.has(source.id) ? source.id : createId()
        keys.add(key)
        ids.add(source.id)
        additions.push(source)
    }
    return additions
}

module.exports = {normalizeSource, normalizeAsset, validateVideoAsset, prepareSourceAdditions}
