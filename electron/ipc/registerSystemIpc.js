function registerSystemIpc({ ipcMain, clipboard }) {
  ipcMain.handle('system:copy-text', (_, text) => { clipboard.writeText(String(text || '')); return { ok: true } })
}

module.exports = { registerSystemIpc }
