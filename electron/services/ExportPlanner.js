const path = require('path')

const illegalName = /[<>:"/\\|?*\x00-\x1f]/
const deviceName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const supportedImageTypes = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])
function validatePackageName(name) {
  const value = String(name || '')
  if (!value || value.length > 120 || illegalName.test(value) || /[. ]$/.test(value) || deviceName.test(value)) return '请输入合法的素材包名称'
  return null
}
function validCrop(crop) {
  if (!crop) return true
  return ['x', 'y', 'width', 'height'].every(key => Number.isFinite(crop[key])) && crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001
}
function sourceFile(source) { return source.pdfPath || (source.path || '').replace(/#page=\d+$/, '') }
function sourcePage(source) { return Number(source.pageNumber || String(source.path || '').match(/#page=(\d+)$/)?.[1] || 1) }
function extensionFor(options) { return options.format === 'png' ? 'png' : 'jpg' }
function hasContinuousOrders(items) {
  return items.length === 0 || [...items]
    .sort((left, right) => left.order - right.order)
    .every((item, index) => Number.isInteger(item?.order) && item.order === index)
}
function validateOptions(options = {}) {
  const errors = []
  if (options.format != null && !['jpeg', 'png'].includes(options.format)) errors.push({ code: 'INVALID_FORMAT', message: 'Unsupported export image format' })
  if (options.jpegQuality != null && (!Number.isInteger(options.jpegQuality) || options.jpegQuality < 1 || options.jpegQuality > 100)) errors.push({ code: 'INVALID_JPEG_QUALITY', message: 'JPEG quality must be between 1 and 100' })
  if (options.pdfDpi != null && ![150, 200, 300].includes(options.pdfDpi)) errors.push({ code: 'INVALID_PDF_DPI', message: 'PDF DPI must be 150, 200, or 300' })
  if (options.maxEdge != null && (!Number.isInteger(options.maxEdge) || options.maxEdge < 1)) errors.push({ code: 'INVALID_MAX_EDGE', message: 'Maximum edge must be a positive integer' })
  if (options.canvasWidth != null && (!Number.isInteger(options.canvasWidth) || options.canvasWidth < 320 || options.canvasWidth > 7680)) errors.push({ code: 'INVALID_CANVAS_WIDTH', message: 'Canvas width must be between 320 and 7680 pixels' })
  if (options.canvasHeight != null && (!Number.isInteger(options.canvasHeight) || options.canvasHeight < 180 || options.canvasHeight > 4320)) errors.push({ code: 'INVALID_CANVAS_HEIGHT', message: 'Canvas height must be between 180 and 4320 pixels' })
  if (options.backgroundColor != null && !/^#[0-9a-f]{6}$/i.test(options.backgroundColor)) errors.push({ code: 'INVALID_BACKGROUND_COLOR', message: 'Background color must be a six-digit hex color' })
  return errors
}

function createExportPlan(project, options = {}) {
  const errors = validateOptions(options), warnings = []
  const narrationMode = project?.narration?.mode || 'text'
  if (!['text', 'voice'].includes(narrationMode)) errors.push({ code: 'INVALID_NARRATION_MODE', message: 'Narration mode is invalid' })
  if (!project || typeof project.id !== 'string' || !Array.isArray(project.blocks) || !Array.isArray(project.sources)) return { errors: [{ code: 'INVALID_PROJECT', message: '项目结构无效' }], warnings, plan: null }
  if (!project.blocks.length) errors.push({ code: 'EMPTY_PROJECT', message: '项目没有 Block，无法导出' })
  const sourceById = new Map(project.sources.map(source => [source.id, source]))
  const blocks = [...project.blocks].sort((left, right) => left.order - right.order)
  const blockIds = new Set()
  if (!hasContinuousOrders(project.blocks)) errors.push({ code: 'INVALID_BLOCK_ORDER', message: 'Block order must start at 0 and be continuous' })
  for (const block of blocks) { if (blockIds.has(block.id)) errors.push({ code: 'DUPLICATE_BLOCK', message: 'Block ID 重复' }); blockIds.add(block.id) }
  const maxAssets = Math.max(1, ...blocks.map(block => (block.assets || []).length))
  const blockDigits = Math.max(3, String(blocks.length).length), assetDigits = Math.max(2, String(maxAssets).length)
  const entries = []
  blocks.forEach((block, blockIndex) => {
    const assets = [...(block.assets || [])].sort((left, right) => left.order - right.order)
    if (!Array.isArray(block.assets) || !hasContinuousOrders(block.assets)) errors.push({ code: 'INVALID_ASSET_ORDER', blockId: block.id, message: `#${blockIndex + 1} asset order must start at 0 and be continuous` })
    if (!String(block.text || '').trim()) warnings.push({ code: 'EMPTY_TEXT', blockId: block.id, message: `#${blockIndex + 1} 缺少文案` })
    if (!assets.length) warnings.push({ code: 'EMPTY_ASSETS', blockId: block.id, message: `#${blockIndex + 1} 未选择画面` })
    if (!block.status?.scriptDone || !block.status?.assetDone) warnings.push({ code: 'INCOMPLETE_STATUS', blockId: block.id, message: `#${blockIndex + 1} 有人工状态未完成` })
    const planAssets = assets.map((asset, assetIndex) => {
      const source = sourceById.get(asset.sourceId)
      const sourceExtension = source ? path.extname(sourceFile(source)).toLowerCase() : ''
      if (source && sourceFile(source) && sourceExtension !== '.pdf' && !supportedImageTypes.has(sourceExtension)) errors.push({ code: 'UNSUPPORTED_FORMAT', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} contains an unsupported source format` })
      if (!source) errors.push({ code: 'SOURCE_NOT_FOUND', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 有悬空素材引用` })
      else if (!sourceFile(source)) errors.push({ code: 'SOURCE_INVALID', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 来源路径无效` })
      else if (path.extname(sourceFile(source)).toLowerCase() === '.gif') errors.push({ code: 'UNSUPPORTED_FORMAT', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 包含未支持的 GIF 素材` })
      if (!validCrop(asset.crop)) errors.push({ code: 'INVALID_CROP', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 有无效裁切范围` })
      const file = `images/${String(blockIndex + 1).padStart(blockDigits, '0')}_${String(assetIndex + 1).padStart(assetDigits, '0')}.${extensionFor(options)}`
      return { blockId: block.id, assetId: asset.id, sourceId: asset.sourceId, source, crop: asset.crop, file, blockPosition: blockIndex + 1, assetPosition: assetIndex + 1 }
    })
    entries.push({ block, position: blockIndex + 1, assets: planAssets })
  })
  return { errors, warnings, plan: errors.length ? null : { project, entries, assets: entries.flatMap(entry => entry.assets), blockDigits, assetDigits, narrationMode } }
}

module.exports = { createExportPlan, validatePackageName, sourceFile, sourcePage }
