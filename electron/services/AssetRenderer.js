const fs = require('fs/promises')
const path = require('path')
const sharp = require('sharp')
const { createCanvas } = require('@napi-rs/canvas')
const { sourceFile, sourcePage } = require('./ExportPlanner')

async function fingerprint(file) { const stat = await fs.stat(file); return { size: stat.size, mtimeMs: stat.mtimeMs } }
function sameFingerprint(left, right) { return left.size === right.size && left.mtimeMs === right.mtimeMs }
function exportCanvas(options) {
  return {
    width: Number.isInteger(options.canvasWidth) && options.canvasWidth > 0 ? options.canvasWidth : 1920,
    height: Number.isInteger(options.canvasHeight) && options.canvasHeight > 0 ? options.canvasHeight : 1080,
    background: /^#[0-9a-f]{6}$/i.test(options.backgroundColor || '') ? options.backgroundColor : '#F4EBD9'
  }
}

async function renderAsset(asset, output, options) {
  const file = sourceFile(asset.source)
  const before = await fingerprint(file)
  const isPdf = path.extname(file).toLowerCase() === '.pdf'
  // Materialize EXIF rotation before reading dimensions: metadata on a rotated
  // pipeline still describes the encoded JPEG, not its displayed orientation.
  let image
  if (isPdf) image = sharp(await renderPdfPage(file, sourcePage(asset.source), options.pdfDpi || 200))
  else image = sharp(await sharp(file, { animated: false }).rotate().toBuffer())
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height) throw new Error('无法取得素材尺寸')
  if (asset.crop) {
    const left = Math.floor(asset.crop.x * metadata.width), top = Math.floor(asset.crop.y * metadata.height)
    const right = Math.min(metadata.width, Math.ceil((asset.crop.x + asset.crop.width) * metadata.width)), bottom = Math.min(metadata.height, Math.ceil((asset.crop.y + asset.crop.height) * metadata.height))
    if (right <= left || bottom <= top) throw new Error('裁切范围没有有效像素')
    image = image.extract({ left, top, width: right - left, height: bottom - top })
  }
  if (Number.isFinite(options.maxEdge) && options.maxEdge > 0) {
    // Sharp permits one resize per pipeline, so materialize the edge limit
    // before composing the final canvas.
    image = sharp(await image.resize({ width: options.maxEdge, height: options.maxEdge, fit: 'inside', withoutEnlargement: true }).toBuffer())
  }
  const canvas = exportCanvas(options)
  image = image.resize({ width: canvas.width, height: canvas.height, fit: 'contain', background: canvas.background, withoutEnlargement: true })
  if (options.format === 'png') image = image.png()
  else image = image.flatten({ background: '#ffffff' }).jpeg({ quality: Math.max(1, Math.min(100, options.jpegQuality || 92)) })
  const result = await image.toFile(output)
  const after = await fingerprint(file)
  if (!sameFingerprint(before, after)) throw new Error('导出期间来源文件发生变化')
  return { width: result.width, height: result.height, canvas }
}

async function renderPdfPage(file, pageNumber, dpi) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({ data: new Uint8Array(await fs.readFile(file)), disableWorker: true })
  const document = await loadingTask.promise
  try {
    if (pageNumber < 1 || pageNumber > document.numPages) throw new Error('PDF 页面不存在')
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: dpi / 72 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
    return canvas.toBuffer('image/png')
  } finally { await loadingTask.destroy() }
}

module.exports = { renderAsset }
