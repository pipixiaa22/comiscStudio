const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('mangaDesk', {
  chooseDirectory: () => ipcRenderer.invoke('images:choose-directory'),
  choosePdf: () => ipcRenderer.invoke('images:choose-pdf'),
  readPdf: file => ipcRenderer.invoke('pdf:read', file),
  validateSources: sources => ipcRenderer.invoke('sources:validate', sources),
  createProject: payload => ipcRenderer.invoke('project:create', payload),
  saveProject: project => ipcRenderer.invoke('project:save', project),
  loadRecentProject: () => ipcRenderer.invoke('project:recent'),
  copyText: text => ipcRenderer.invoke('system:copy-text', text)
})
