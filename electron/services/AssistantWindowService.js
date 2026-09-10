const { BrowserWindow, screen } = require('electron')
const fs = require('fs/promises')
const path = require('path')
const themeTokens = require('../../theme/tokens.json')
const windowBackground = themeTokens.themes?.light?.colors?.background || '#FFFFFF'

class AssistantWindowService {
  constructor({ app, preload, indexFile }) { this.app = app; this.preload = preload; this.indexFile = indexFile; this.window = null; this.preferenceFile = path.join(app.getPath('userData'), 'assistant-window.json'); this.preferences = { alwaysOnTop: true } }
  async loadPreferences() { try { this.preferences = { ...this.preferences, ...JSON.parse(await fs.readFile(this.preferenceFile, 'utf8')) } } catch {} }
  async savePreferences() { await fs.writeFile(this.preferenceFile, JSON.stringify(this.preferences), 'utf8').catch(() => {}) }
  async open() {
    if (this.window && !this.window.isDestroyed()) { this.window.show(); this.window.focus(); return this.window }
    await this.loadPreferences()
    const area = screen.getPrimaryDisplay().workArea
    const width = Math.min(Math.max(this.preferences.width || 420, 340), area.width)
    const height = Math.min(Math.max(this.preferences.height || 640, 420), area.height)
    const x = Number.isFinite(this.preferences.x) && this.preferences.x >= area.x && this.preferences.x < area.x + area.width ? this.preferences.x : Math.max(area.x, area.x + area.width - width - 24)
    const y = Number.isFinite(this.preferences.y) && this.preferences.y >= area.y && this.preferences.y < area.y + area.height ? this.preferences.y : Math.max(area.y, area.y + 48)
    const window = this.window = new BrowserWindow({ width, height, x, y, minWidth: 340, minHeight: 420, title: 'MangaDesk 剪映辅助', backgroundColor: windowBackground, autoHideMenuBar: true, webPreferences: { preload: this.preload, contextIsolation: true, nodeIntegration: false } })
    window.setAlwaysOnTop(this.preferences.alwaysOnTop !== false)
    window.loadFile(this.indexFile, { hash: '/capcut' })
    window.on('close', () => { const bounds = window.getBounds(); this.preferences = { ...this.preferences, ...bounds, alwaysOnTop: window.isAlwaysOnTop() }; void this.savePreferences() })
    window.on('closed', () => { if (this.window === window) this.window = null })
    return window
  }
  isAssistant(sender) { return Boolean(this.window && !this.window.isDestroyed() && sender.id === this.window.webContents.id) }
  send(channel, data) { if (this.window && !this.window.isDestroyed()) this.window.webContents.send(channel, data) }
  setAlwaysOnTop(value) { if (!this.window || this.window.isDestroyed()) throw new Error('辅助窗口未打开'); this.window.setAlwaysOnTop(Boolean(value)); this.preferences.alwaysOnTop = Boolean(value); void this.savePreferences(); return this.preferences.alwaysOnTop }
  close() { this.window?.close() }
}
module.exports = { AssistantWindowService }
