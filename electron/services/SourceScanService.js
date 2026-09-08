const fs = require('fs/promises')
const path = require('path')
const { pathToFileURL } = require('url')

const imageTypes = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

class SourceScanService {
  async scanPdf(file) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(await fs.readFile(file))
    const loadingTask = getDocument({ data, disableWorker: true })
    const document = await loadingTask.promise
    try {
      return Array.from({ length: document.numPages }, (_, index) => ({
        path: `${file}#page=${index + 1}`,
        name: `${path.basename(file)} · P${String(index + 1).padStart(3, '0')}`,
        kind: 'pdf-page', pdfPath: file, pageNumber: index + 1
      }))
    } finally {
      await loadingTask.destroy()
    }
  }

  async scanDirectory(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) files.push(...await this.scanDirectory(target))
      else if (imageTypes.has(path.extname(entry.name).toLowerCase())) files.push({ path: target, name: entry.name, url: pathToFileURL(target).href })
      else if (this.isPdf(target)) files.push(...await this.scanPdf(target))
    }
    return files.sort((left, right) => left.path.localeCompare(right.path, undefined, { numeric: true }))
  }

  async scanPath(sourcePath) {
    const info = await fs.stat(sourcePath)
    if (info.isDirectory()) return this.scanDirectory(sourcePath)
    if (this.isPdf(sourcePath)) return this.scanPdf(sourcePath)
    if (imageTypes.has(path.extname(sourcePath).toLowerCase())) return [{ path: sourcePath, name: path.basename(sourcePath), url: pathToFileURL(sourcePath).href }]
    return []
  }

  async readPdf(file) {
    if (typeof file !== 'string' || !path.isAbsolute(file) || !this.isPdf(file)) throw new Error('无效的 PDF 路径')
    return new Uint8Array(await fs.readFile(file))
  }

  async validateSources(sources) {
    if (!Array.isArray(sources)) throw new Error('无效的来源列表')
    const pdfChecks = new Map()
    const output = {}
    for (const source of sources) {
      if (!source || typeof source.id !== 'string' || typeof source.path !== 'string') continue
      const pdfPath = source.pdfPath || (source.path.includes('#page=') ? source.path.slice(0, source.path.lastIndexOf('#page=')) : null)
      try {
        if (source.mediaType === 'video') {
          const stat = await fs.stat(source.path)
          if (stat.size !== source.fingerprint?.size || stat.mtimeMs !== source.fingerprint?.mtimeMs) throw new Error('原视频已改变，请恢复原文件或重新确认来源')
        } else if (!pdfPath) await fs.access(source.path)
        else {
          if (!pdfChecks.has(pdfPath)) pdfChecks.set(pdfPath, this.pdfPageCount(pdfPath))
          const pageCount = await pdfChecks.get(pdfPath)
          const pageNumber = Number(source.pageNumber || source.path.match(/#page=(\d+)$/)?.[1])
          if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) throw new Error('PDF 页面不存在')
        }
        output[source.id] = { available: true }
      } catch (error) { output[source.id] = { available: false, reason: error.message } }
    }
    return { checkedAt: Date.now(), sources: output }
  }

  async pdfPageCount(file) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = getDocument({ data: new Uint8Array(await fs.readFile(file)), disableWorker: true })
    const document = await loadingTask.promise
    try { return document.numPages } finally { await loadingTask.destroy() }
  }

  isPdf(file) { return path.extname(file).toLowerCase() === '.pdf' }
}

module.exports = { SourceScanService }
