const { app, BrowserWindow, clipboard, dialog, ipcMain } = require('electron')
const path = require('path')
const { registerProjectIpc } = require('./electron/ipc/registerProjectIpc')
const { registerSourceIpc } = require('./electron/ipc/registerSourceIpc')
const { registerSystemIpc } = require('./electron/ipc/registerSystemIpc')
const { ProjectService } = require('./electron/services/ProjectService')
const { SourceScanService } = require('./electron/services/SourceScanService')

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1500, height: 940, minWidth: 1040, minHeight: 680,
    backgroundColor: '#11141c', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  })
  window.loadFile(path.join(__dirname, 'dist', 'index.html'))
}

app.whenReady().then(() => {
  const projectService = new ProjectService(app.getPath('userData'))
  const sourceScanService = new SourceScanService()
  registerProjectIpc({ ipcMain, projectService, sourceScanService })
  registerSourceIpc({ ipcMain, dialog, sourceScanService })
  registerSystemIpc({ ipcMain, clipboard })
  createMainWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createMainWindow() })
