const {result} = require('./result')

function registerVideoIpc({ipcMain, dialog, mainWindow, probeService, playbackService, frameService}) {
  let importing = false
  const authorize = event => {
    if (!mainWindow() || event.sender !== mainWindow().webContents || event.senderFrame !== event.sender.mainFrame) throw new Error('仅主工作区可访问视频')
  }
  ipcMain.handle('video:choose', (event, projectId) => result(async () => {
    authorize(event)
    if (typeof projectId !== 'string' || !projectId || importing) throw new Error('视频导入正在进行或项目无效')
    importing = true
    try {
      // Keep the chooser aligned with the direct-preview pipeline. Unsupported
      // containers/codecs are not silently imported as unusable sources.
      const selection = await dialog.showOpenDialog(mainWindow(), {properties: ['openFile', 'multiSelections'], filters: [{name: '兼容视频（H.264）', extensions: ['mp4', 'm4v', 'mov']}]})
      const sources = [], failures = []
      if (selection.canceled) return {sources, failures}
      const files = [...new Set(selection.filePaths)].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}))
      for (const [index, file] of files.entries()) {
        if (event.sender.isDestroyed()) break
        event.sender.send('video:progress', {projectId, current: index + 1, total: files.length})
        try {
          const source = await probeService.probe(file)
          playbackService.register(projectId, source)
          sources.push(source)
        } catch (error) { failures.push({file, message: error.message}) }
      }
      return {sources, failures}
    } finally { importing = false }
  }))
  ipcMain.handle('video:playback', (event, input) => result(async () => {
    authorize(event)
    if (typeof input?.projectId !== 'string' || typeof input?.sourceId !== 'string') throw new Error('视频来源无效')
    return playbackService.open(input.projectId, input.sourceId)
  }))
  ipcMain.handle('video:resolveBoundary', (event, input) => result(async () => {
    authorize(event)
    if (typeof input?.projectId !== 'string' || typeof input?.sourceId !== 'string') throw new Error('视频来源无效')
    const source = await playbackService.locate(input.projectId, input.sourceId)
    return frameService.resolveBoundary({projectId: input.projectId, source, timeUs: input.timeUs, direction: input.direction})
  }))
}
module.exports = {registerVideoIpc}
