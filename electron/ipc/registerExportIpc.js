function registerExportIpc({ ipcMain, dialog, shell, exportService }) {
  ipcMain.handle('export:choose-directory', async () => {
    const selection = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (selection.canceled) return null
    return exportService.registerDestination(selection.filePaths[0])
  })
  ipcMain.handle('export:preflight', (_, input) => exportService.preflight(input))
  ipcMain.handle('export:start', (event, input) => exportService.start(input, (channel, payload) => event.sender.send(channel, payload)))
  ipcMain.handle('export:cancel', (_, jobId) => exportService.cancel(jobId))
  ipcMain.handle('export:open-directory', async (_, jobId) => shell.openPath(exportService.outputFor(jobId)))
  ipcMain.handle('export:open-storyboard', async (_, jobId) => shell.openPath(require('path').join(exportService.outputFor(jobId), 'storyboard.html')))
}
module.exports = { registerExportIpc }
