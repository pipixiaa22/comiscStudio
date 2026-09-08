const fs = require('fs/promises')
const path = require('path')

function registerSourceIpc({ ipcMain, dialog, sourceScanService, localMediaService }) {
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
  // PDF.js pages through the file with range requests instead of receiving the
  // whole document as a Uint8Array over IPC.
  ipcMain.handle('pdf:url', (_, file) => {
    if (typeof file !== 'string' || !path.isAbsolute(file) || !sourceScanService.isPdf(file)) throw new Error('无效的 PDF 路径')
    return localMediaService.register('pdf', file).url
  })
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
