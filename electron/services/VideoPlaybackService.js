const fs = require('fs/promises')
const {createReadStream} = require('fs')
const {Readable} = require('stream')
const crypto = require('crypto')
const {parseByteRange} = require('./byteRange')

class VideoPlaybackService {
  constructor(projectService) { this.projects = projectService; this.imported = new Map(); this.tokens = new Map() }
  register(projectId, source) {
    this.imported.set(`${projectId}:${source.id}`, source)
    if (this.imported.size > 1000) this.imported.delete(this.imported.keys().next().value)
  }
  async locate(projectId, sourceId) {
    const source = this.imported.get(`${projectId}:${sourceId}`) || (await this.projects.load(projectId)).sources.find(item => item.id === sourceId)
    if (source?.mediaType !== 'video') throw new Error('视频来源未登记')
    return source
  }
  async open(projectId, sourceId) {
    const source = await this.locate(projectId, sourceId)
    if (source.preview?.status !== 'pending') throw new Error(source.preview?.reason || '此来源尚未通过兼容性探测，请重新导入')
    await this.check(source)
    const token = crypto.randomUUID()
    this.tokens.set(token, source)
    if (this.tokens.size > 256) this.tokens.delete(this.tokens.keys().next().value)
    return {url: `studio-video://media/${token}`}
  }
  async check(source) {
    const stat = await fs.stat(source.path)
    if (!stat.isFile() || stat.size !== source.fingerprint?.size || stat.mtimeMs !== source.fingerprint?.mtimeMs) throw new Error('原视频已改变，暂不能预览；请恢复原文件')
    return stat
  }
  async respond(request) {
    const url = new URL(request.url)
    const source = url.host === 'media' && this.tokens.get(url.pathname.slice(1))
    if (!source || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', {status: 404})
    try {
      const stat = await this.check(source)
      let range
      try { range = parseByteRange(request.headers.get('range'), stat.size) } catch {
        return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${stat.size}`}})
      }
      const {start, end, partial} = range
      const headers = {'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Cache-Control': 'no-store'}
      if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
      const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(source.path, {start, end}))
      return new Response(body, {status: partial ? 206 : 200, headers})
    } catch { return new Response('Source changed or unavailable', {status: 409}) }
  }
}
module.exports = {VideoPlaybackService, parseByteRange}
