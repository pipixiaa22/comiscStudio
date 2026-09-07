const {normalizeSource, normalizeAsset} = require('./mediaAsset')

function normalizeProjectShape(project, createBlock, timestamp) {
    if (Number(project.schemaVersion || 1) > 3) throw new Error(`项目版本 ${project.schemaVersion} 高于当前支持版本 3，已阻止降级保存`)
    const blocks = (Array.isArray(project.blocks) && project.blocks.length ? project.blocks : [createBlock(0)]).map((block, order) => {
        const base = createBlock(order)
        return {
            ...base, ...block, id: typeof block?.id === 'string' ? block.id : base.id, order,
            assets: Array.isArray(block?.assets) ? block.assets.map((asset, assetOrder) => normalizeAsset(asset, assetOrder)) : [],
            status: {...base.status, ...(block?.status || {}), edited: block?.status?.edited ?? block?.status?.placed ?? false},
            voice: {
                activeTakeId: null,
                takes: [],
                trimStartMs: 0,
                trimEndMs: null,
                gapAfterMs: 300,
                narrationRequired: true, ...(block?.voice || {})
            }
        }
    })
    const currentBlockId = blocks.some(block => block.id === project.workspace?.currentBlockId) ? project.workspace.currentBlockId : blocks[0].id
    return {
        ...project,
        schemaVersion: 3,
        sources: (project.sources || []).map(normalizeSource),
        narration: {mode: 'text', defaultGapAfterMs: 300, ...(project.narration || {})},
        blocks,
        favorites: Array.isArray(project.favorites) ? project.favorites : [],
        scratchBasket: Array.isArray(project.scratchBasket) ? project.scratchBasket.map((item, order) => ({
            ...item,
            order
        })) : [],
        exportPresets: Array.isArray(project.exportPresets) ? project.exportPresets.filter(item => item?.id && item?.name && item?.options) : [],
        deliveries: Array.isArray(project.deliveries) ? project.deliveries : [],
        videoFavorites: Array.isArray(project.videoFavorites) ? project.videoFavorites : [],
        workspace: {...(project.workspace || {}), activeMediaTab: project.workspace?.activeMediaTab || 'image', videoPositions: {...(project.workspace?.videoPositions || {})}, currentBlockId, currentSourceId: project.workspace?.currentSourceId || null},
        updatedAt: timestamp
    }
}

module.exports = {normalizeProjectShape}
