import {isValidCrop} from '../../assets/model/crop'

export const ISSUE_LABELS = {
    EMPTY_TEXT: '缺少文案',
    EMPTY_ASSETS: '未选择画面',
    SOURCE_NOT_FOUND: '素材引用不存在',
    SOURCE_UNAVAILABLE: '原文件/页面不可用',
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
            if (!isValidCrop(asset.crop)) issues.push({
                code: 'INVALID_CROP',
                assetId: asset.id,
                sourceId: asset.sourceId
            })
        }
        return {blockId: block.id, issues}
    })
}
