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
  ipcMain.handle('pdf:read', (_, file) => sourceScanService.readPdf(file))
  ipcMain.handle('sources:validate', (_, sources) => sourceScanService.validateSources(sources))
}

module.exports = { registerSourceIpc }
