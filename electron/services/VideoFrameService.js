const fs = require('fs/promises')
const path = require('path')
const {spawn} = require('child_process')
const {findFfprobeBinary} = require('./ffprobeBinary')

const BOUNDARY_DIRECTIONS = ['frame-start', 'frame-end', 'prev-frame', 'next-frame']
const WINDOW_US = 2000000
const WIDE_WINDOW_US = 12000000
const MAX_CACHED_SOURCES = 32
const MAX_CACHED_FRAMES = 60000

// ffprobe 按解码序输出帧（B 帧时 pts 无序），统一升序去重为展示帧起点表。
function parseFrameTimesUs(json) {
  const frames = (json?.frames || [])
    .map(frame => frame.pts_time ?? frame.best_effort_timestamp_time)
    .filter(value => value != null && Number.isFinite(Number(value)))
    .map(value => Math.round(Number(value) * 1000000))
  return [...new Set(frames)].sort((a, b) => a - b)
}

// frames 是窗口内的展示帧起点；coversBefore/coversAfter 表示窗口是否触及媒体首/尾。
// 返回吸附结果，或 {need: 'earlier'|'later'} 表示需要更宽窗口后重算。
function resolveBoundaryFromFrames(frames, timeUs, durationUs, direction, {coversBefore, coversAfter}) {
  if (!Array.isArray(frames) || !frames.length) throw new Error('窗口内没有可用帧时间')
  if (timeUs < frames[0] && !coversBefore) return {need: 'earlier'}
  let index = 0
  for (let i = frames.length - 1; i >= 0; i--) { if (frames[i] <= timeUs) { index = i; break } }
  const frameStartUs = frames[index]
  const nextUs = index + 1 < frames.length ? frames[index + 1] : null
  const frameEndUs = nextUs ?? (coversAfter ? durationUs : null)
  const isLastFrame = nextUs == null && coversAfter
  if (direction === 'frame-start') return {snappedUs: frameStartUs, frameStartUs, frameEndUs, isLastFrame}
  if (direction === 'frame-end') {
    if (frameEndUs == null) return {need: 'later'}
    return {snappedUs: frameEndUs, frameStartUs, frameEndUs, isLastFrame}
  }
  if (direction === 'prev-frame') {
    if (timeUs > frameStartUs) return {snappedUs: frameStartUs, frameStartUs, frameEndUs, isLastFrame}
    if (index === 0) return coversBefore ? {snappedUs: null, frameStartUs, frameEndUs, isLastFrame} : {need: 'earlier'}
    return {snappedUs: frames[index - 1], frameStartUs: frames[index - 1], frameEndUs: frameStartUs, isLastFrame: false}
  }
  if (direction === 'next-frame') {
    if (nextUs == null) return coversAfter ? {snappedUs: null, frameStartUs, frameEndUs, isLastFrame} : {need: 'later'}
    return {snappedUs: nextUs, frameStartUs: nextUs, frameEndUs: index + 2 < frames.length ? frames[index + 2] : (coversAfter ? durationUs : null), isLastFrame: index + 1 === frames.length - 1 && coversAfter}
  }
  throw new Error('边界方向无效')
}

class VideoFrameService {
  constructor(options = {}) {
    this.options = options
    this.binaryPromise = null
    this.cache = new Map()
    this.busy = new Map()
  }
  binary() {
    if (!this.binaryPromise) this.binaryPromise = findFfprobeBinary(this.options).then(binary => {
      if (!path.isAbsolute(binary)) throw new Error('ffprobe 必须使用绝对路径')
      return binary
    })
    return this.binaryPromise
  }
  async runFfprobe(args) {
    const binary = await this.binary()
    const data = await new Promise((resolve, reject) => {
      const child = spawn(binary, args, {shell: false, windowsHide: true})
      let output = '', errors = '', failure
      const timer = setTimeout(() => { failure = new Error('帧时间读取超时'); child.kill() }, 30000)
      child.stdout.on('data', chunk => { output += chunk; if (output.length > 4000000) { failure = new Error('帧时间数据超出限制'); child.kill() } })
      child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000) })
      child.on('error', () => { clearTimeout(timer); reject(new Error('缺少可执行 ffprobe，无法读取帧边界')) })
      child.on('close', code => {
        clearTimeout(timer)
        if (failure || code !== 0) return reject(failure || new Error(`帧时间读取失败：${errors || code}`))
        try { resolve(JSON.parse(output)) } catch { reject(new Error('帧时间数据无效')) }
      })
    })
    return parseFrameTimesUs(data)
  }
  async checkSource(source) {
    const stat = await fs.stat(source.path)
    if (!stat.isFile() || stat.size !== source.fingerprint?.size || stat.mtimeMs !== source.fingerprint?.mtimeMs) throw new Error('原视频已改变，帧边界信息已失效；请恢复原文件')
    return stat
  }
  entry(projectId, sourceId) {
    const key = `${projectId}:${sourceId}`
    let entry = this.cache.get(key)
    if (entry) { this.cache.delete(key); this.cache.set(key, entry) }
    else {
      entry = {frames: [], coverage: []}
      this.cache.set(key, entry)
      if (this.cache.size > MAX_CACHED_SOURCES) this.cache.delete(this.cache.keys().next().value)
    }
    return entry
  }
  covered(entry, fromUs, toUs) {
    return entry.coverage.some(([start, end]) => start <= fromUs && toUs <= end)
  }
  mergeWindow(entry, fromUs, toUs, frames) {
    entry.coverage.push([fromUs, toUs])
    entry.coverage.sort((a, b) => a[0] - b[0])
    for (let i = entry.coverage.length - 1; i > 0; i--) {
      if (entry.coverage[i - 1][1] >= entry.coverage[i][0] - 1) {
        entry.coverage[i - 1][1] = Math.max(entry.coverage[i - 1][1], entry.coverage[i][1])
        entry.coverage.splice(i, 1)
      }
    }
    entry.frames = [...new Set([...entry.frames, ...frames])].sort((a, b) => a - b)
    if (entry.frames.length > MAX_CACHED_FRAMES) { entry.frames = []; entry.coverage = [] }
    return entry.frames.filter(time => time >= fromUs && time <= toUs)
  }
  async framesInWindow(projectId, sourceId, source, centerUs, spanUs) {
    const fromUs = Math.max(0, centerUs - Math.floor(spanUs / 2))
    const toUs = Math.min(source.durationUs, centerUs + Math.ceil(spanUs / 2))
    if (toUs <= fromUs) throw new Error('帧时间窗口无效')
    const key = `${projectId}:${sourceId}`
    const work = async () => {
      await this.checkSource(source)
      const entry = this.entry(projectId, sourceId)
      if (this.covered(entry, fromUs, toUs)) return entry.frames.filter(time => time >= fromUs && time <= toUs)
      const frames = await this.runFfprobe(['-v', 'error', '-select_streams', String(source.video.streamIndex),
        '-show_entries', 'frame=best_effort_timestamp_time,pts_time', '-of', 'json',
        '-read_intervals', `${(fromUs / 1000000).toFixed(6)}%+${((toUs - fromUs) / 1000000).toFixed(6)}`, source.path])
      if (!frames.length) throw new Error('窗口内没有可用帧时间')
      return this.mergeWindow(entry, fromUs, toUs, frames)
    }
    const previous = this.busy.get(key)
    const chained = (previous ? previous.catch(() => {}).then(work) : work())
    const settled = chained.finally(() => { if (this.busy.get(key) === settled) this.busy.delete(key) })
    settled.catch(() => {})
    this.busy.set(key, settled)
    return chained
  }
  // I 取当前展示帧起点；O 取下一帧展示起点（末帧为媒体结尾），持久化仍为右开区间。
  async resolveBoundary({projectId, source, timeUs, direction}) {
    if (!BOUNDARY_DIRECTIONS.includes(direction)) throw new Error('边界方向无效')
    if (!Number.isSafeInteger(timeUs) || timeUs < 0 || timeUs > source.durationUs) throw new Error('时间超出视频范围')
    let lastError
    for (const spanUs of [WINDOW_US, WIDE_WINDOW_US]) {
      try {
        const frames = await this.framesInWindow(projectId, source.id, source, timeUs, spanUs)
        const result = resolveBoundaryFromFrames(frames, timeUs, source.durationUs, direction, {
          coversBefore: timeUs - Math.floor(spanUs / 2) <= 0,
          coversAfter: timeUs + Math.ceil(spanUs / 2) >= source.durationUs
        })
        if (!result.need) return result
        lastError = new Error('无法读取附近帧时间，暂不能逐帧吸附')
      } catch (error) { lastError = error }
    }
    throw lastError
  }
}

module.exports = {VideoFrameService, parseFrameTimesUs, resolveBoundaryFromFrames, BOUNDARY_DIRECTIONS}
