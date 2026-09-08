const fs = require('fs/promises')
const {createReadStream} = require('fs')
const path = require('path')
const crypto = require('crypto')
const {spawn} = require('child_process')
const {findFfmpegBinary} = require('./ffmpegBinary')
const {findFfprobeBinary} = require('./ffprobeBinary')

async function checksum(file) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}

function runTool(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {shell: false, windowsHide: true})
    let output = '', error = '', failure
    const timer = setTimeout(() => { failure = new Error('媒体工具检查超时'); child.kill() }, 15000)
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 2000000) { failure = new Error('媒体工具输出超限'); child.kill() } })
    child.stderr.on('data', chunk => { error = (error + chunk).slice(-2000) })
    child.on('error', reason => { clearTimeout(timer); reject(new Error(`媒体工具不可执行：${path.basename(binary)} (${reason.code})`)) })
    child.on('close', code => { clearTimeout(timer); if (failure || code !== 0) reject(failure || new Error(error || '媒体工具检查失败')); else resolve(output) })
  })
}

async function validateBundle(directory, {platform = process.platform, arch = process.arch} = {}) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'))
  if (manifest.platform !== platform || manifest.arch !== arch) throw new Error('媒体工具平台或架构不匹配')
  if (!Array.isArray(manifest.licenses) || !manifest.licenses.length) throw new Error('缺少媒体工具许可材料')
  const within = name => {
    if (typeof name !== 'string' || !name || path.isAbsolute(name) || name.split(/[\\/]/).includes('..')) throw new Error('媒体工具清单路径无效')
    return path.join(directory, name)
  }
  for (const name of manifest.licenses) {
    if (!(await fs.stat(within(name))).isFile()) throw new Error('媒体工具许可文件缺失')
  }
  for (const tool of ['ffmpeg', 'ffprobe']) {
    const entry = manifest[tool]
    const name = `${tool}${platform === 'win32' ? '.exe' : ''}`
    if (!entry?.version || !entry.sourceUrl || !entry.configure || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) throw new Error(`${tool} 缺少版本、来源、构建参数或校验值`)
    const file = within(name)
    if (await checksum(file) !== entry.sha256) throw new Error(`${tool} 校验值不匹配`)
    const version = await runTool(file, ['-version'])
    if (version.split('\n')[0] !== entry.version || !version.includes(entry.configure)) throw new Error(`${tool} 版本或构建参数不匹配`)
  }
  return manifest
}

async function checkMediaToolchain(options = {}) {
  if (options.packaged) await validateBundle(path.join(options.resourcesPath || process.resourcesPath, 'media-tools'))
  const ffmpeg = await findFfmpegBinary(options), ffprobe = await findFfprobeBinary(options)
  const version = await runTool(ffmpeg, ['-version'])
  const probeVersion = await runTool(ffprobe, ['-version'])
  const encoders = await runTool(ffmpeg, ['-hide_banner', '-encoders'])
  for (const encoder of ['libx264', 'aac', 'png']) if (!new RegExp(`\\s${encoder}\\s`).test(encoders)) throw new Error(`媒体工具缺少 ${encoder} 编码器`)
  const decoders = await runTool(ffmpeg, ['-hide_banner', '-decoders'])
  for (const decoder of ['h264', 'aac']) if (!new RegExp(`\\s${decoder}\\s`).test(decoders)) throw new Error(`媒体工具缺少 ${decoder} 解码器`)
  return {ffmpeg, ffprobe, version: version.split('\n')[0], probeVersion: probeVersion.split('\n')[0]}
}

module.exports = {checkMediaToolchain, validateBundle, checksum, runTool}
