export function buildUsageIndex(blocks) {
  const index = new Map()
  for (const block of blocks || []) for (const asset of block.assets || []) {
    if (!asset?.sourceId) continue
    const usage = index.get(asset.sourceId) || { count: 0, references: [] }
    usage.count += 1
    usage.references.push({ blockId: block.id, assetId: asset.id })
    index.set(asset.sourceId, usage)
  }
  return index
}
