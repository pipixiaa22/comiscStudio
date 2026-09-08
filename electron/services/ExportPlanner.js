const path = require('path')
const {validateVideoAsset} = require('../../src/shared/domain/mediaAsset')

// Control characters are rejected on purpose: they are invalid in file names.
// eslint-disable-next-line no-control-regex
const illegalName = /[<>:"/\\|?*\x00-\x1f]/
const deviceName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i
const supportedImageTypes = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp'])
const videoIssueText = code => ({
    SOURCE_NOT_FOUND: '素材来源不是可用视频',
    INVALID_VIDEO_RANGE: '视频区间超出来源或无效',
    VIDEO_STREAM_UNAVAILABLE: '视频流与来源不符',
    AUDIO_STREAM_UNAVAILABLE: '原声音轨选择无效'
}[code] || '视频素材无效')
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
  if (options.watermarkText != null && (typeof options.watermarkText !== 'string' || options.watermarkText.length > 100)) errors.push({ code: 'INVALID_WATERMARK_TEXT', message: '水印文本必须是 100 字以内的文字' })
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
  // Array position is the canonical order in an in-memory snapshot.  This also
  // accepts a snapshot taken between a MOVE and its persistence/reindexing.
  const blocks = project.blocks.map((block, order) => ({ ...block, order }))
  const blockIds = new Set()
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
      const position = `${String(blockIndex + 1).padStart(blockDigits, '0')}_${String(assetIndex + 1).padStart(assetDigits, '0')}`
      const base = { blockId: block.id, assetId: asset.id, sourceId: asset.sourceId, source, type: asset.type || 'image', blockPosition: blockIndex + 1, assetPosition: assetIndex + 1 }
      if (!source) {
        errors.push({ code: 'SOURCE_NOT_FOUND', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 有悬空素材引用` })
        return { ...base, file: null }
      }
      if (asset.type === 'video') {
        const code = source.mediaType === 'video' ? validateVideoAsset(asset, source) : 'SOURCE_NOT_FOUND'
        if (code) errors.push({ code, blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 第 ${assetIndex + 1} 项 ${videoIssueText(code)}` })
        // Videos and images share one block/asset sequence but land in their own folders.
        return { ...base, type: 'video', file: `videos/${position}.mp4`, startUs: asset.startUs, endUs: asset.endUs, videoStreamIndex: asset.videoStreamIndex, audio: asset.audio, selectionBasis: asset.selectionBasis }
      }
      if (asset.type && asset.type !== 'image') errors.push({ code: 'UNSUPPORTED_MEDIA_TYPE', blockId: block.id, assetId: asset.id, message: '不支持的素材类型' })
      const sourceExtension = source ? path.extname(sourceFile(source)).toLowerCase() : ''
      if (source && sourceFile(source) && sourceExtension !== '.pdf' && !supportedImageTypes.has(sourceExtension)) errors.push({ code: 'UNSUPPORTED_FORMAT', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} contains an unsupported source format` })
      else if (!sourceFile(source)) errors.push({ code: 'SOURCE_INVALID', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 来源路径无效` })
      else if (path.extname(sourceFile(source)).toLowerCase() === '.gif') errors.push({ code: 'UNSUPPORTED_FORMAT', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 包含未支持的 GIF 素材` })
      if (!validCrop(asset.crop)) errors.push({ code: 'INVALID_CROP', blockId: block.id, assetId: asset.id, message: `#${blockIndex + 1} 有无效裁切范围` })
      return { ...base, crop: asset.crop, file: `images/${position}.${extensionFor(options)}` }
    })
    entries.push({ block, position: blockIndex + 1, assets: planAssets })
  })
  const canonicalProject = { ...project, blocks }
  return { errors, warnings, plan: errors.length ? null : { project: canonicalProject, entries, assets: entries.flatMap(entry => entry.assets), blockDigits, assetDigits, narrationMode } }
}

module.exports = { createExportPlan, validatePackageName, sourceFile, sourcePage }
