const fs = require('fs/promises')
const path = require('path')

const FALLBACKS = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe']

async function findFfprobeBinary({packaged = false, resourcesPath = process.resourcesPath, binary} = {}) {
  let resolved = binary || process.env.COMISC_FFPROBE_PATH || path.join(resourcesPath || '', 'media-tools', process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
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

module.exports = {findFfprobeBinary}
