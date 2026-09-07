import {validateVideoAsset} from '../../../shared/domain/mediaAsset'
import {isValidCrop} from '../../assets/model/crop'

export const ISSUE_LABELS = {
    EMPTY_TEXT: '缺少文案',
    EMPTY_ASSETS: '未选择画面',
    SOURCE_NOT_FOUND: '素材引用不存在',
    SOURCE_UNAVAILABLE: '原文件/页面不可用',
    INVALID_VIDEO_RANGE: '视频区间无效',
    VIDEO_STREAM_UNAVAILABLE: '视频流不可用',
    AUDIO_STREAM_UNAVAILABLE: '原声音轨不可用',
    UNSUPPORTED_VIDEO: '视频预览与交付尚未开放',
    INVALID_CROP: '裁切范围无效'
}

export function validateStoryboard(project, sourceStatus = {}) {
    const sourceIds = new Set((project?.sources || []).map(source => source.id))
    return (project?.blocks || []).map(block => {
        const issues = []
        if (!String(block.text || '').trim()) issues.push({code: 'EMPTY_TEXT'})
        if (!(block.assets || []).length) issues.push({code: 'EMPTY_ASSETS'})
        for (const asset of block.assets || []) {
            if (!sourceIds.has(asset.sourceId)) issues.push({
                code: 'SOURCE_NOT_FOUND',
                assetId: asset.id,
                sourceId: asset.sourceId
            })
            else if (sourceStatus[asset.sourceId] && sourceStatus[asset.sourceId].available === false) issues.push({
                code: 'SOURCE_UNAVAILABLE',
                assetId: asset.id,
                sourceId: asset.sourceId
            })
            if (asset.type === 'video') {
                const code = validateVideoAsset(asset, project.sources.find(source => source.id === asset.sourceId))
                issues.push({code: code || 'UNSUPPORTED_VIDEO', assetId: asset.id, sourceId: asset.sourceId})
            } else if (!isValidCrop(asset.crop)) issues.push({
                code: 'INVALID_CROP',
                assetId: asset.id,
                sourceId: asset.sourceId
            })
        }
        return {blockId: block.id, issues}
    })
}
