const { app, BrowserWindow, clipboard, dialog, ipcMain, shell, protocol } = require('electron')
const path = require('path')
const { registerProjectIpc } = require('./electron/ipc/registerProjectIpc')
const { registerSourceIpc } = require('./electron/ipc/registerSourceIpc')
const { registerSystemIpc } = require('./electron/ipc/registerSystemIpc')
const { ProjectService } = require('./electron/services/ProjectService')
const { SourceScanService } = require('./electron/services/SourceScanService')
const { ExportService } = require('./electron/services/ExportService')
const { registerExportIpc } = require('./electron/ipc/registerExportIpc')
const { VoiceRecordingService } = require('./electron/services/VoiceRecordingService')
const { registerVoiceIpc } = require('./electron/ipc/registerVoiceIpc')
const { AssistantWindowService } = require('./electron/services/AssistantWindowService')
const { registerAssistantIpc } = require('./electron/ipc/registerAssistantIpc')

const {VideoProbeService} = require('./electron/services/VideoProbeService')
const {VideoPlaybackService} = require('./electron/services/VideoPlaybackService')
const {VideoFrameService} = require('./electron/services/VideoFrameService')
const {VideoRenderService} = require('./electron/services/VideoRenderService')
const {registerVideoIpc} = require('./electron/ipc/registerVideoIpc')
const {MediaDeliveryService} = require('./electron/services/MediaDeliveryService')
const {checkMediaToolchain} = require('./electron/services/MediaToolchainService')
const {LocalMediaService} = require('./electron/services/LocalMediaService')
const {AppSettingsService} = require('./electron/services/AppSettingsService')
const themeTokens = require('./theme/tokens.json')
const windowBackground = themeTokens.themes?.light?.colors?.background || '#FFFFFF'
protocol.registerSchemesAsPrivileged([
  {scheme: 'studio-video', privileges: {standard: true, secure: true, stream: true, supportFetchAPI: true}},
  {scheme: 'studio-media', privileges: {standard: true, secure: true, stream: true, supportFetchAPI: true}}
])

let mainWindow

function createMainWindow() {
  const window = mainWindow = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1040, minHeight: 680,
    backgroundColor: windowBackground, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  window.loadFile(path.join(__dirname, 'dist', 'index.html'))
  window.on('closed', () => { mainWindow = null; assistantWindowService?.close() })
  return window
}
let assistantWindowService
let assistantIpc, quitting = false

app.on('before-quit', event => {
  if (!assistantIpc || quitting) return
  event.preventDefault()
  quitting = true
  void assistantIpc.shutdown().finally(() => app.quit())
})

app.whenReady().then(async () => {
  const settingsService = new AppSettingsService(app.getPath('userData'))
  const settings = await settingsService.load()
  process.env.COMISC_FFMPEG_PATH = settings.ffmpegPath || ''
  process.env.COMISC_FFPROBE_PATH = settings.ffprobePath || ''
  const projectService = new ProjectService(app.getPath('userData'))
  const playbackService = new VideoPlaybackService(projectService)
  protocol.handle('studio-video', request => playbackService.respond(request))
  registerVideoIpc({ipcMain, dialog, mainWindow: () => mainWindow, probeService: new VideoProbeService({packaged: app.isPackaged}), playbackService, frameService: new VideoFrameService({packaged: app.isPackaged})})
  const sourceScanService = new SourceScanService()
  const localMediaService = new LocalMediaService()
  protocol.handle('studio-media', request => localMediaService.respond(request))
  const exportService = new ExportService(projectService, new VideoRenderService({packaged: app.isPackaged}))
  const voiceRecordingService = new VoiceRecordingService(projectService)
  assistantWindowService = new AssistantWindowService({ app, preload: path.join(__dirname, 'preload.js'), indexFile: path.join(__dirname, 'dist', 'index.html') })
  registerProjectIpc({ ipcMain, projectService, sourceScanService, exportService })
  registerSourceIpc({ ipcMain, dialog, sourceScanService })
  registerSystemIpc({ ipcMain, clipboard, dialog, settingsService })
  registerExportIpc({ ipcMain, dialog, shell, exportService })
  registerVoiceIpc({ ipcMain, voiceRecordingService, localMediaService })
  assistantIpc = registerAssistantIpc({ ipcMain, shell, clipboard, assistantWindowService, projectService, mainWindow: () => mainWindow,
    deliveryService: new MediaDeliveryService(projectService, new VideoRenderService({packaged: app.isPackaged})) })
  createMainWindow()
  void checkMediaToolchain({packaged: app.isPackaged}).catch(error => {
    if (!mainWindow || quitting) return
    void dialog.showMessageBox(mainWindow, {type: 'warning', title: '视频工具不可用', message: '视频探测与交付暂不可用，图片和文案仍可使用。',
      detail: `${error.message}\n${app.isPackaged ? '请重新安装包含 media-tools 的完整安装包。' : '开发环境请安装 FFmpeg/ffprobe，或设置 COMISC_FFMPEG_PATH 和 COMISC_FFPROBE_PATH。'}`})
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow() })
