const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const {renderAsset, releaseRenderCaches} = require('./AssetRenderer')
const {VideoRenderService} = require('./VideoRenderService')
const {sourceFile, sourcePage} = require('./ExportPlanner')
const {validateVideoAsset} = require('../../src/shared/domain/mediaAsset')

const RENDER_VERSION = 'assistant-media-v2'
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const cancelled = () => new Error('素材准备已取消')

async function directorySize(target) {
  let total = 0
  for (const entry of await fs.readdir(target, {withFileTypes: true}).catch(() => [])) {
    const child = path.join(target, entry.name)
    if (entry.isDirectory()) total += await directorySize(child)
    else if (entry.isFile()) total += await fs.stat(child).then(stat => stat.size).catch(() => 0)
  }
  return total
}
const contentVersions = new Map()

function contentVersion(asset) {
  const source = asset.source || {}
  // Source scan metadata can be very large. Delivery only depends on these
  // fields, so cache a compact identity instead of serializing every source
  // object for every assistant refresh.
  const descriptor = {type: asset.type || 'image', sourceId: asset.sourceId, path: source.path,
    pdfPath: source.pdfPath, pageNumber: source.pageNumber, mediaType: source.mediaType,
    crop: asset.crop || null, startUs: asset.startUs, endUs: asset.endUs,
    videoStreamIndex: asset.videoStreamIndex, audio: asset.audio}
  const key = JSON.stringify(descriptor)
  const cached = contentVersions.get(key)
  if (cached) return cached
  const version = hash(descriptor)
  contentVersions.set(key, version)
  if (contentVersions.size > 2048) contentVersions.delete(contentVersions.keys().next().value)
  return version
}

class MediaDeliveryService {
  constructor(projectService, videoRenderer = new VideoRenderService()) {
    this.root = projectService.root
    this.videoRenderer = videoRenderer
    this.jobs = new Map()
    this.tail = Promise.resolve()
  }
  directory(projectId) {
    if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('项目 ID 无效')
    return path.join(this.root, projectId, 'exports', 'assistant-assets')
  }
  async identify(projectId, asset) {
    this.directory(projectId)
    const file = sourceFile(asset.source)
    const stat = await fs.stat(file)
    if (!stat.isFile()) throw new Error('素材来源不可用')
    const fingerprint = {size: stat.size, mtimeMs: stat.mtimeMs}
    const video = asset.type === 'video' || asset.source.mediaType === 'video'
    if (video) {
      const error = validateVideoAsset(asset, asset.source)
      if (error) throw new Error(error)
      if (asset.source.preview?.status === 'unsupported') throw new Error(asset.source.preview.reason || '不支持的视频来源')
      await this.videoRenderer.checkSource(asset.source)
    }
    const toolVersion = video ? await this.videoRenderer.toolVersion() : `sharp-${require('sharp').versions.sharp}`
    const descriptor = {sourcePath: await fs.realpath(file), fingerprint, type: video ? 'video' : 'image',
      page: video ? null : sourcePage(asset.source), crop: asset.crop || null,
      startUs: asset.startUs, endUs: asset.endUs, videoStreamIndex: asset.videoStreamIndex, audio: asset.audio,
      rotation: asset.source.video?.rotation, colorPolicy: asset.source.video?.color,
      outputProfile: video ? 'h264-crf18-aac192' : 'source-png-pdf200', toolVersion, renderVersion: RENDER_VERSION}
    return {key: hash(descriptor), descriptor}
  }
  prepare({projectId, asset, identity, onProgress}) {
    const jobKey = `${projectId}:${identity.key}`
    const existing = this.jobs.get(jobKey)
    if (existing) {
      if (onProgress) existing.listeners.add(onProgress)
      return existing.promise
    }
    if (this.jobs.size >= 16) return Promise.reject(new Error('准备队列已满，请等待当前任务完成'))
    const job = {projectId, key: identity.key, listeners: new Set(onProgress ? [onProgress] : []), aborted: false, children: new Set()}
    // A child spawned after cancellation must also be stopped.
    job.children.add = child => {
      Set.prototype.add.call(job.children, child)
      if (job.aborted) child.kill()
      return job.children
    }
    const emit = state => { for (const listener of job.listeners) listener(state) }
    job.promise = this.tail.catch(() => {}).then(async () => {
      if (job.aborted) throw cancelled()
      const directory = this.directory(projectId)
      await fs.mkdir(directory, {recursive: true})
      for (const name of await fs.readdir(directory)) {
        if (!name.startsWith(`${identity.key}-`)) continue
        try {
          const manifest = JSON.parse(await fs.readFile(path.join(directory, name, 'manifest.json'), 'utf8'))
          if (manifest.key !== identity.key) continue
          const item = {key: identity.key, directory: path.join(directory, name), file: path.join(directory, name, manifest.type === 'video' ? 'media.mp4' : 'media.png'), icon: path.join(directory, name, manifest.type === 'video' ? 'poster.png' : 'media.png')}
          await fs.access(item.file); await fs.access(item.icon)
          if (job.aborted) throw cancelled()
          return item
        } catch (error) { if (job.aborted) throw error }
      }
      const temporary = await fs.mkdtemp(path.join(directory, '.preparing-'))
      try {
        if (job.aborted) throw cancelled()
        emit({state: 'rendering', progress: 0})
        const video = identity.descriptor.type === 'video'
        const fileName = video ? 'media.mp4' : 'media.png'
        const iconName = video ? 'poster.png' : fileName
        let result
        if (video) result = await this.videoRenderer.renderClip({source: asset.source, clip: asset,
          output: path.join(temporary, fileName), poster: path.join(temporary, iconName), children: job.children,
          onProgress: progress => emit({state: 'rendering', progress})})
        else result = await renderAsset(asset, path.join(temporary, fileName), {layout: 'source', format: 'png', pdfDpi: 200})
        if (job.aborted) throw cancelled()
        const stat = await fs.stat(sourceFile(asset.source))
        if (stat.size !== identity.descriptor.fingerprint.size || stat.mtimeMs !== identity.descriptor.fingerprint.mtimeMs) throw new Error('来源已变化，请重新准备')
        const published = path.join(directory, `${identity.key}-${crypto.randomUUID()}`)
        await fs.writeFile(path.join(temporary, 'manifest.json'), JSON.stringify({key: identity.key, projectId, type: identity.descriptor.type, descriptor: identity.descriptor, result, createdAt: Date.now()}, null, 2))
        if (job.aborted) throw cancelled()
        await fs.rename(temporary, published)
        return {key: identity.key, directory: published, file: path.join(published, fileName), icon: path.join(published, iconName)}
      } finally {
        // Only our unpublished temporary directory is disposable; delivered versions are permanent.
        await fs.rm(temporary, {recursive: true, force: true})
      }
    }).finally(() => {
      this.jobs.delete(jobKey)
      // Delivery renders one asset at a time; dropping the shared render caches
      // here keeps the main process from holding decoded pages between requests.
      return releaseRenderCaches()
    })
    this.jobs.set(jobKey, job)
    this.tail = job.promise.catch(() => {})
    emit({state: 'queued', progress: 0})
    return job.promise
  }
  cancel(projectId, key) {
    const job = this.jobs.get(`${projectId}:${key}`)
    if (!job) return false
    job.aborted = true
    for (const child of job.children) child.kill()
    return true
  }

  // Delivered files are permanent by design: a CapCut project may still point at
  // them.  This only reports what is on disk so the user can delete explicitly.
  async stats(projectId) {
    const directory = this.directory(projectId)
    const entries = []
    let temporaryCount = 0, temporaryBytes = 0
    for (const name of await fs.readdir(directory).catch(() => [])) {
      const target = path.join(directory, name)
      if (name.startsWith('.preparing-')) {
        temporaryCount += 1
        temporaryBytes += await directorySize(target)
        continue
      }
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(target, 'manifest.json'), 'utf8'))
        entries.push({
          name,
          key: manifest.key,
          type: manifest.type,
          createdAt: manifest.createdAt || 0,
          size: await directorySize(target)
        })
      } catch {
      }
    }
    entries.sort((left, right) => right.createdAt - left.createdAt)
    return {
      entries,
      totalBytes: entries.reduce((total, entry) => total + entry.size, 0),
      temporary: {count: temporaryCount, bytes: temporaryBytes}
    }
  }

  async remove(projectId, name) {
    const directory = this.directory(projectId)
    const target = path.resolve(directory, String(name || ''))
    if (!target.startsWith(directory + path.sep)) throw new Error('缓存条目无效')
    await fs.rm(target, {recursive: true, force: true})
    return true
  }

  async pruneTemporary(projectId) {
    const directory = this.directory(projectId)
    let removed = 0
    for (const name of await fs.readdir(directory).catch(() => [])) {
      if (!name.startsWith('.preparing-')) continue
      await fs.rm(path.join(directory, name), {recursive: true, force: true})
      removed += 1
    }
    return {removed}
  }

  async shutdown() {
    for (const job of this.jobs.values()) this.cancel(job.projectId, job.key)
    await this.tail
  }
}

module.exports = {MediaDeliveryService, contentVersion}
