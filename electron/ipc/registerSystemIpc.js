function registerSystemIpc({ ipcMain, clipboard, dialog, settingsService }) {
  ipcMain.handle('system:copy-text', (_, text) => { clipboard.writeText(String(text || '')); return { ok: true } })
  ipcMain.handle('settings:get', async () => ({ok: true, data: settingsService.get()}))
  ipcMain.handle('settings:save', async (_, input) => {
    try {
      const settings = await settingsService.save(input)
      process.env.COMISC_FFMPEG_PATH = settings.ffmpegPath || ''
      process.env.COMISC_FFPROBE_PATH = settings.ffprobePath || ''
      return {ok: true, data: settings}
    } catch (error) { return {ok: false, error: {message: error.message}} }
  })
  ipcMain.handle('settings:choose-media-tool', async (_, key) => {
    if (!['ffmpegPath', 'ffprobePath'].includes(key)) return {ok: false, error: {message: '无效的媒体工具类型'}}
    const result = await dialog.showOpenDialog({title: `选择 ${key === 'ffmpegPath' ? 'FFmpeg' : 'FFprobe'} 可执行文件`, properties: ['openFile']})
    return {ok: true, data: result.canceled ? '' : result.filePaths[0]}
  })
}

module.exports = { registerSystemIpc }
