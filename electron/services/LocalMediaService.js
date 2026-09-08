const crypto = require('crypto')
const fs = require('fs/promises')
const {createReadStream} = require('fs')
const {Readable} = require('stream')
const path = require('path')
const {parseByteRange} = require('./byteRange')

const MIME = {pdf: 'application/pdf', audio: 'audio/wav'}
const MAX_TOKENS = 256

// Serves project files over the privileged `studio-media://` protocol with byte
// range support, so PDF.js and <audio> only fetch the bytes they need instead of
// receiving a whole file as a Uint8Array over IPC.  Only paths registered by the
// main process are reachable, and the file is re-checked on every request.
class LocalMediaService {
  constructor() { this.tokens = new Map() }

  register(kind, file) {
    if (!MIME[kind]) throw new Error('不支持的媒体类型')
    const resolved = path.resolve(file)
    const token = crypto.randomUUID()
    this.tokens.set(token, {kind, file: resolved})
    while (this.tokens.size > MAX_TOKENS) this.tokens.delete(this.tokens.keys().next().value)
    return {url: `studio-media://${kind}/${token}`, token, file: resolved}
  }

  async stat(file) {
    const info = await fs.stat(file)
    if (!info.isFile()) throw new Error('文件不可用')
    return info
  }

  async respond(request) {
    const url = new URL(request.url)
    const entry = this.tokens.get(url.pathname.replace(/^\//, ''))
    if (!entry || entry.kind !== url.host || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', {status: 404})
    let info
    try {
      info = await this.stat(entry.file)
    } catch {
      return new Response('Source unavailable', {status: 409})
    }
    let range
    try {
      range = parseByteRange(request.headers.get('range'), info.size)
    } catch {
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${info.size}`}})
    }
    const {start, end, partial} = range
    const headers = {
      'Content-Type': MIME[entry.kind],
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      'Cache-Control': 'no-store',
      // The renderer runs from file://, so PDF.js fetches are cross-origin.
      'Access-Control-Allow-Origin': '*'
    }
    if (partial) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`
    const body = request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(entry.file, {start, end}))
    return new Response(body, {status: partial ? 206 : 200, headers})
  }
}

module.exports = {LocalMediaService}
