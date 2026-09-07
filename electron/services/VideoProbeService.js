const fs = require('fs/promises')
const path = require('path')
const {spawn} = require('child_process')
const crypto = require('crypto')
const {findFfprobeBinary} = require('./ffprobeBinary')

function parseVideoProbe(data, file, stat) {
  const streams = data.streams || []
  const videos = streams.filter(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic)
  if (!videos.length) throw new Error('文件没有可用视频流')
  const stream = videos[0]
  const durationUs = Math.round(Number(stream.duration || data.format?.duration) * 1000000)
  if (!Number.isSafeInteger(durationUs) || durationUs <= 0) throw new Error('无法确定有效视频时长')
  const audioStreams = streams.filter(item => item.codec_type === 'audio').map(item => ({index: item.index, codec: item.codec_name, channels: item.channels, language: item.tags?.language, startTime: item.start_time}))
  let reason = ''
  if (videos.length !== 1) reason = '多视频流来源暂不支持选段'
  else if (['smpte2084', 'arib-std-b67'].includes(stream.color_transfer)) reason = 'HDR 来源暂不支持'
  else if (stream.field_order !== 'progressive') reason = '交错或扫描方式未知的来源暂不支持'
  else if (Number(stream.start_time) !== 0 || Number(data.format?.start_time) !== 0) reason = '非零或未知时间原点暂不支持'
  else if (stream.codec_name !== 'h264' || !['yuv420p', 'yuvj420p'].includes(stream.pix_fmt) || !['.mp4', '.m4v', '.mov'].includes(path.extname(file).toLowerCase())) reason = '需生成兼容预览副本，此功能尚未开放'
  else if (audioStreams.length > 1 || audioStreams.some(item => item.codec !== 'aac')) reason = '多音轨或非 AAC 原声需兼容预览副本'
  return {
    id: crypto.randomUUID(), mediaType: 'video', path: file, fileName: path.basename(file), durationUs,
    fingerprint: {size: stat.size, mtimeMs: stat.mtimeMs},
    video: {streamIndex: stream.index, codec: stream.codec_name, width: stream.width, height: stream.height,
      timeBase: stream.time_base, startPts: String(stream.start_pts ?? ''), startTime: stream.start_time,
      avgFrameRate: stream.avg_frame_rate, variableFrameRate: null,
      rotation: stream.side_data_list?.find(item => item.rotation != null)?.rotation || 0,
      sampleAspectRatio: stream.sample_aspect_ratio, color: {transfer: stream.color_transfer, primaries: stream.color_primaries, space: stream.color_space}},
    audioStreams, subtitleStreams: streams.filter(item => item.codec_type === 'subtitle').map(item => ({index: item.index, codec: item.codec_name})),
    preview: {status: reason ? 'unsupported' : 'pending', reason}
  }
}

class VideoProbeService {
  constructor({packaged = false, resourcesPath = process.resourcesPath, binary} = {}) {
    this.binary = binary || (!packaged && process.env.COMISC_FFPROBE_PATH) || path.join(resourcesPath || '', 'media-tools', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
    this.packaged = packaged
  }
  async probe(file) {
    const binary = await findFfprobeBinary(this)
    if (!path.isAbsolute(binary)) throw new Error('ffprobe 必须使用绝对路径')
    const before = await fs.stat(file)
    if (!before.isFile()) throw new Error('来源不是视频文件')
    const data = await new Promise((resolve, reject) => {
      const child = spawn(binary, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {shell: false, windowsHide: true})
      let output = '', errors = '', failure
      const timer = setTimeout(() => { failure = new Error('视频探测超时'); child.kill() }, 30000)
      child.stdout.on('data', chunk => { output += chunk; if (output.length > 2000000) { failure = new Error('视频元数据超出限制'); child.kill() } })
      child.stderr.on('data', chunk => { errors = (errors + chunk).slice(-2000) })
      child.on('error', () => { clearTimeout(timer); reject(new Error('缺少可执行 ffprobe；开发环境可设置 COMISC_FFPROBE_PATH，安装版需要 media-tools/ffprobe')) })
      child.on('close', code => {
        clearTimeout(timer)
        if (failure || code !== 0) return reject(failure || new Error(`视频探测失败：${errors || code}`))
        try { resolve(JSON.parse(output)) } catch { reject(new Error('视频元数据无效')) }
      })
    })
    const after = await fs.stat(file)
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('探测期间来源发生变化，请重试')
    return parseVideoProbe(data, file, after)
  }
}
module.exports = {VideoProbeService, parseVideoProbe}
