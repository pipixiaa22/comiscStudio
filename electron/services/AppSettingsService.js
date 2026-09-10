const fs = require('fs/promises')
const path = require('path')

const defaults = {theme: 'light', ffmpegPath: '', ffprobePath: ''}

class AppSettingsService {
  constructor(userData) { this.file = path.join(userData, 'settings.json'); this.value = {...defaults} }
  async load() {
    try { this.value = {...defaults, ...JSON.parse(await fs.readFile(this.file, 'utf8'))} } catch {}
    return this.get()
  }
  get() { return {...this.value} }
  async save(input) {
    const next = {...this.value, ...input}
    if (!['light', 'dark'].includes(next.theme)) throw new Error('主题无效')
    for (const key of ['ffmpegPath', 'ffprobePath']) if (typeof next[key] !== 'string') throw new Error('媒体工具路径无效')
    this.value = next
    await fs.writeFile(this.file, JSON.stringify(next, null, 2), 'utf8')
    return this.get()
  }
}
module.exports = {AppSettingsService}
