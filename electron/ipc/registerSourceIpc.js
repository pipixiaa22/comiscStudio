const fs = require('fs/promises')
const path = require('path')

function registerSourceIpc({ ipcMain, dialog, sourceScanService }) {
  ipcMain.handle('images:choose-directory', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (selection.canceled) return null
    const directory = selection.filePaths[0]
    return { directory, images: await sourceScanService.scanDirectory(directory) }
  })
  ipcMain.handle('images:choose-pdf', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'PDF 漫画', extensions: ['pdf'] }] })
    if (selection.canceled) return null
    const file = selection.filePaths[0]
    return { directory: path.dirname(file), sourcePath: file, name: path.basename(file, path.extname(file)), images: await sourceScanService.scanPdf(file) }
  })
  // PDF.js cannot use a custom protocol for streaming (it only sends Range
  // requests for http(s) URLs), so the document arrives as bytes over IPC.
  ipcMain.handle('pdf:read', (_, file) => sourceScanService.readPdf(file))
  // Lets a user point a missing source at its new location, which may be a single
  // file (the page itself) or the folder that now holds the whole set.
  ipcMain.handle('sources:choose-replacement', async (_, input) => {
    const selection = await dialog.showOpenDialog({
      properties: input?.kind === 'directory' ? ['openDirectory'] : ['openFile', 'openDirectory'],
      title: input?.title || '选择替换位置'
    })
    if (selection.canceled) return null
    const selected = selection.filePaths[0]
    const stats = await fs.stat(selected).catch(() => null)
    if (!stats) throw new Error('无法访问所选位置')
    return {path: selected, kind: stats.isDirectory() ? 'directory' : 'file', name: path.basename(selected)}
  })
  ipcMain.handle('sources:validate', (_, sources) => sourceScanService.validateSources(sources))
}

module.exports = { registerSourceIpc }
