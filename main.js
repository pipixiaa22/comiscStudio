const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require('electron')
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

let mainWindow

function createMainWindow() {
  const window = mainWindow = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1040, minHeight: 680,
    backgroundColor: '#11141c', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  window.loadFile(path.join(__dirname, 'dist', 'index.html'))
  window.on('closed', () => { mainWindow = null; assistantWindowService?.close() })
  return window
}
let assistantWindowService

app.whenReady().then(() => {
  const projectService = new ProjectService(app.getPath('userData'))
  const sourceScanService = new SourceScanService()
  const exportService = new ExportService(projectService)
  const voiceRecordingService = new VoiceRecordingService(projectService)
  assistantWindowService = new AssistantWindowService({ app, preload: path.join(__dirname, 'preload.js'), indexFile: path.join(__dirname, 'dist', 'index.html') })
  registerProjectIpc({ ipcMain, projectService, sourceScanService, exportService })
  registerSourceIpc({ ipcMain, dialog, sourceScanService })
  registerSystemIpc({ ipcMain, clipboard })
  registerExportIpc({ ipcMain, dialog, shell, exportService })
  registerVoiceIpc({ ipcMain, voiceRecordingService })
  registerAssistantIpc({ ipcMain, shell, clipboard, assistantWindowService, projectService, mainWindow: () => mainWindow })
  createMainWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow() })
