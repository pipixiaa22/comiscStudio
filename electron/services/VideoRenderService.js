const fs = require('fs/promises')
const path = require('path')
const {spawn} = require('child_process')
const {findFfmpegBinary} = require('./ffmpegBinary')
const {findFfprobeBinary} = require('./ffprobeBinary')

// ffmpeg accepts decimal seconds; µs precision is far beyond frame resolution.
const seconds = value => (value / 1000000).toFixed(6)
// One-frame interval from CFR metadata; null keeps callers on a media-time fallback.
function frameIntervalUs(source) {
  const ratio = String(source?.video?.avgFrameRate || '').split('/')
  const rate = ratio.length === 2 ? Number(ratio[0]) / Number(ratio[1]) : NaN
  return Number.isFinite(rate) && rate > 0 ? Math.round(1000000 / rate) : null
}

// Whitelisted argument builder: renderer never submits command text or filters.
function buildVideoArgs({source, clip, output}) {
  const startUs = clip.startUs, endUs = clip.endUs
  if (!Number.isSafeInteger(startUs) || !Number.isSafeInteger(endUs) || endUs <= startUs) throw new Error('视频选区无效')
  if (!source?.path || !source.video) throw new Error('视频来源元数据无效')
  const args = ['-y', '-ss', seconds(startUs), '-i', source.path, '-t', seconds(endUs - startUs),
    '-map', `0:${clip.videoStreamIndex}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p']
  // libx264 requires even dimensions; pad minimal edge pixels instead of cropping.
  if (Number(source.video.width) % 2 !== 0 || Number(source.video.height) % 2 !== 0) args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2')
  if (clip.audio?.mode === 'keep' && Number.isInteger(clip.audio.streamIndex)) args.push('-map', `0:${clip.audio.streamIndex}`, '-c:a', 'aac', '-b:a', '192k')
  else args.push('-an')
  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', output)
  return args
}

function parseProgressLine(line, durationUs, onProgress) {
  if (!line.startsWith('out_time_us=')) return
  const value = Number(line.slice('out_time_us='.length))
  if (!Number.isFinite(value) || !durationUs || durationUs <= 0) return
  onProgress?.(Math.max(0, Math.min(1, value / durationUs)))
}

class VideoRenderService {
  constructor(options = {}) {
    this.options = options
    this.binaryPromise = null
    this.probePromise = null
    this.versionCache = null
  }
  binary() {
    if (!this.binaryPromise) this.binaryPromise = findFfmpegBinary(this.options).then(binary => {
      if (!path.isAbsolute(binary)) throw new Error('ffmpeg 必须使用绝对路径')
      return binary
    })
    return this.binaryPromise
  }
  ffprobe() {
    if (!this.probePromise) this.probePromise = findFfprobeBinary(this.options).then(binary => {
      if (!path.isAbsolute(binary)) throw new Error('ffprobe 必须使用绝对路径')
      return binary
    })
    return this.probePromise
  }
  async available() {
    try { await this.binary(); return true } catch { return false }
  }
  async toolVersion() {
    if (this.versionCache) return this.versionCache
    const binary = await this.binary()
    const first = await new Promise((resolve, reject) => {
      const child = spawn(binary, ['-version'], {shell: false, windowsHide: true})
      let output = ''
      const timer = setTimeout(() => { child.kill(); reject(new Error('读取 ffmpeg 版本超时')) }, 10000)
      child.stdout.on('data', chunk => { output += chunk })
      child.on('error', () => { clearTimeout(timer); reject(new Error('缺少可执行 ffmpeg')) })
      child.on('close', () => { clearTimeout(timer); resolve(output.split('\n')[0] || 'ffmpeg') })
    })
    this.versionCache = first
    return first
  }
  async checkSource(source) {
    const stat = await fs.stat(source.path)
    if (!stat.isFile() || stat.size !== source.fingerprint?.size || stat.mtimeMs !== source.fingerprint?.mtimeMs) throw new Error('导出期间原视频已改变，请重新确认来源')
    return stat
  }
  async probeFile(file) {
    const ffprobe = await this.ffprobe()
    const output = await new Promise((resolve, reject) => {
      const child = spawn(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {shell: false, windowsHide: true})
      let json = '', errors = '', failure
      const timer = setTimeout(() => { failure = new Error('产物校验超时'); child.kill() }, 30000)
      child.stdout.on('data', chunk => { json += chunk; if (json.length > 2000000) { failure = new Error('产物元数据超出限制'); child.kill() } })
      child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000) })
      child.on('error', () => { clearTimeout(timer); reject(new Error('缺少可执行 ffprobe，无法校验导出产物')) })
      child.on('close', code => {
        clearTimeout(timer)
        if (failure || code !== 0) return reject(failure || new Error(`产物校验失败：${errors || code}`))
        try { resolve(JSON.parse(json)) } catch { reject(new Error('产物元数据无效')) }
      })
    })
    const format = output?.format || {}
    const video = (output?.streams || []).find(stream => stream.codec_type === 'video')
    const audioStreams = (output?.streams || []).filter(stream => stream.codec_type === 'audio').map(stream => ({index: stream.index, codec: stream.codec_name, channels: stream.channels}))
    const durationUs = Math.round(Number(format.duration || video?.duration || 0) * 1000000)
    if (!video || !Number.isSafeInteger(durationUs) || durationUs <= 0) throw new Error('导出产物没有可用的视频流')
    return {durationUs, width: video.width, height: video.height, audioStreams}
  }
  async renderClip({source, clip, output, poster, onProgress, children}) {
    await this.checkSource(source)
    const durationUs = clip.endUs - clip.startUs
    const args = buildVideoArgs({source, clip, output})
    await this.runProcess(args, {durationUs, onProgress, children})
    const meta = await this.probeFile(output)
    const tolerance = frameIntervalUs(source) || 250000
    if (Math.abs(meta.durationUs - durationUs) > Math.max(150000, Math.ceil(tolerance * 1.5))) throw new Error(`导出时长 ${(meta.durationUs / 1000000).toFixed(3)}s 与选区 ${(durationUs / 1000000).toFixed(3)}s 不一致`)
    if (clip.audio?.mode === 'keep' && !meta.audioStreams.length) throw new Error('导出产物缺少所选原声音轨')
    if (clip.audio?.mode === 'mute' && meta.audioStreams.length) throw new Error('静音导出不应包含音轨')
    if (poster) {
      await this.runProcess(['-y', '-ss', seconds(clip.startUs), '-i', source.path, '-frames:v', '1', '-q:v', '3', poster], {children})
      await fs.stat(poster)
    }
    await this.checkSource(source)
    const version = await this.toolVersion()
    return {...meta, codec: 'h264', encoder: 'libx264', toolVersion: version, frameIntervalUs: frameIntervalUs(source)}
  }
  async runProcess(args, {durationUs = 0, onProgress, children, timeoutMs = 3 * 60 * 60 * 1000} = {}) {
    const binary = await this.binary()
    await new Promise((resolve, reject) => {
      const child = spawn(binary, args, {shell: false, windowsHide: true})
      children?.add(child)
      let errors = '', failure
      const timer = setTimeout(() => { failure = new Error('视频渲染超时'); child.kill() }, timeoutMs)
      child.stdout.on('data', chunk => {
        const text = String(chunk)
        for (const line of text.split('\n')) parseProgressLine(line, durationUs, onProgress)
      })
      child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-3000) })
      child.on('error', error => { clearTimeout(timer); children?.delete(child); reject(error.code === 'ENOENT' ? new Error('缺少可执行 ffmpeg；开发环境可设置 COMISC_FFMPEG_PATH') : error) })
      child.on('close', code => {
        clearTimeout(timer)
        children?.delete(child)
        if (failure || code !== 0) return reject(failure || new Error(`视频渲染失败：${errors.trim() || code}`))
        resolve()
      })
    })
  }
}

module.exports = {VideoRenderService, buildVideoArgs, parseProgressLine, frameIntervalUs, seconds}
