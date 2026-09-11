const fs = require('fs/promises')
const path = require('path')
const https = require('https')
const {execFile} = require('child_process')
const {promisify} = require('util')
const {runTool} = require('./MediaToolchainService')
const exec = promisify(execFile)

const windowsAsset = arch => arch === 'arm64' ? 'ffmpeg-master-latest-winarm64-gpl.zip' : arch === 'x64' ? 'ffmpeg-master-latest-win64-gpl.zip' : null
const plans = () => {
  if (process.platform === 'win32') { const asset = windowsAsset(process.arch); return asset ? [{url: `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/${asset}`, archive: 'ffmpeg.zip'}] : null }
  if (process.platform === 'darwin') return [{url: 'https://evermeet.cx/ffmpeg/getrelease/zip', archive: 'ffmpeg.zip'}, {url: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip', archive: 'ffprobe.zip'}]
  return null
}
function download(url, destination, progress) {
  return new Promise((resolve, reject) => {
    const request = current => https.get(current, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) return resolve(download(new URL(response.headers.location, current), destination, progress))
      if (response.statusCode !== 200) return reject(new Error(`下载媒体工具失败（HTTP ${response.statusCode}）`))
      const total = Number(response.headers['content-length']) || 0; let received = 0
      const file = require('fs').createWriteStream(destination)
      response.on('data', chunk => { received += chunk.length; progress?.({stage: 'downloading', received, total}) })
      response.pipe(file); file.on('finish', () => file.close(resolve)); file.on('error', reject)
    }).on('error', reject)
    request.setTimeout(120000, () => request.destroy(new Error('下载媒体工具超时')))
  })
}
async function find(directory, name) {
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) { const file = path.join(directory, entry.name); if (entry.isDirectory()) { const found = await find(file, name); if (found) return found } else if (entry.name === name) return file }
  return null
}
class MediaToolInstaller {
  constructor(userData, settingsService) { this.dir = path.join(userData, 'media-tools'); this.settings = settingsService }
  async status() { const settings = this.settings.get(); const result = {}; for (const [key, name] of [['ffmpegPath', 'ffmpeg'], ['ffprobePath', 'ffprobe']]) { try { if (!settings[key]) throw new Error('未配置'); result[key] = {available: true, detail: (await runTool(settings[key], ['-version'])).split('\n')[0]} } catch (error) { result[key] = {available: false, detail: error.message} } } return {...result, supported: Boolean(plans())} }
  async install(onProgress) {
    const source = plans(); if (!source) throw new Error(`暂不支持在 ${process.platform}/${process.arch} 自动安装`)
    const stage = path.join(this.dir, `.download-${Date.now()}`); await fs.mkdir(stage, {recursive: true})
    try { for (const item of source) { const archive = path.join(stage, item.archive); onProgress?.({stage: 'downloading', tool: item.archive}); await download(item.url, archive, onProgress); const out = path.join(stage, item.archive.replace('.zip', '')); await fs.mkdir(out); if (process.platform === 'win32') await exec('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${out.replace(/'/g, "''")}' -Force`]); else await exec('ditto', ['-x', '-k', archive, out]) }
      const suffix = process.platform === 'win32' ? '.exe' : ''; const ffmpeg = await find(stage, `ffmpeg${suffix}`), ffprobe = await find(stage, `ffprobe${suffix}`); if (!ffmpeg || !ffprobe) throw new Error('下载包中缺少 ffmpeg 或 ffprobe')
      await fs.mkdir(this.dir, {recursive: true}); const targetFfmpeg = path.join(this.dir, `ffmpeg${suffix}`), targetFfprobe = path.join(this.dir, `ffprobe${suffix}`); await fs.copyFile(ffmpeg, targetFfmpeg); await fs.copyFile(ffprobe, targetFfprobe); if (process.platform !== 'win32') { await fs.chmod(targetFfmpeg, 0o755); await fs.chmod(targetFfprobe, 0o755) }
      const saved = await this.settings.save({ffmpegPath: targetFfmpeg, ffprobePath: targetFfprobe}); process.env.COMISC_FFMPEG_PATH = saved.ffmpegPath; process.env.COMISC_FFPROBE_PATH = saved.ffprobePath; onProgress?.({stage: 'verifying'}); return {settings: saved, status: await this.status()}
    } finally { await fs.rm(stage, {recursive: true, force: true}).catch(() => {}) }
  }
}
module.exports = {MediaToolInstaller}
