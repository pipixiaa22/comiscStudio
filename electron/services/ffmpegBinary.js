const fs = require('fs/promises')
const path = require('path')

const FALLBACKS = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']

async function findFfmpegBinary({packaged = false, resourcesPath = process.resourcesPath, binary} = {}) {
  let resolved = binary || process.env.COMISC_FFMPEG_PATH || path.join(resourcesPath || '', 'media-tools', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  try {
    await fs.access(resolved)
  } catch {
    if (!packaged) {
      for (const candidate of FALLBACKS) {
        if (await fs.access(candidate).then(() => true, () => false)) return candidate
      }
    }
  }
  return resolved
}

module.exports = {findFfmpegBinary}
