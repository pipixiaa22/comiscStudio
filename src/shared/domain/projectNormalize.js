function normalizeProjectShape(project, createBlock, timestamp) {
  if (Number(project.schemaVersion || 1) > 2) throw new Error(`项目版本 ${project.schemaVersion} 高于当前支持版本 2，已阻止降级保存`)
  const blocks = (Array.isArray(project.blocks) && project.blocks.length ? project.blocks : [createBlock(0)]).map((block, order) => {
    const base = createBlock(order)
    return {
      ...base, ...block, id: typeof block?.id === 'string' ? block.id : base.id, order,
      assets: Array.isArray(block?.assets) ? block.assets.filter(asset => asset?.sourceId).map((asset, assetOrder) => ({ ...asset, order: assetOrder })) : [],
      status: { ...base.status, ...(block?.status || {}) },
      voice: { activeTakeId: null, takes: [], trimStartMs: 0, trimEndMs: null, gapAfterMs: 300, narrationRequired: true, ...(block?.voice || {}) }
    }
  })
  const currentBlockId = blocks.some(block => block.id === project.workspace?.currentBlockId) ? project.workspace.currentBlockId : blocks[0].id
  return { ...project, schemaVersion: 2, narration: { mode: 'text', defaultGapAfterMs: 300, ...(project.narration || {}) }, blocks, favorites: Array.isArray(project.favorites) ? project.favorites : [], scratchBasket: Array.isArray(project.scratchBasket) ? project.scratchBasket.map((item, order) => ({ ...item, order })) : [], workspace: { currentBlockId, currentSourceId: project.workspace?.currentSourceId || null }, updatedAt: timestamp }
}

module.exports = { normalizeProjectShape }
