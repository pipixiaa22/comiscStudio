const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('mangaDesk', {
  chooseDirectory: () => ipcRenderer.invoke('images:choose-directory'),
  choosePdf: () => ipcRenderer.invoke('images:choose-pdf'),
  readPdf: file => ipcRenderer.invoke('pdf:read', file),
  validateSources: sources => ipcRenderer.invoke('sources:validate', sources),
  chooseExportDirectory: () => ipcRenderer.invoke('export:choose-directory'),
  preflightExport: input => ipcRenderer.invoke('export:preflight', input),
  startExport: input => ipcRenderer.invoke('export:start', input),
  cancelExport: jobId => ipcRenderer.invoke('export:cancel', jobId),
  openExportDirectory: jobId => ipcRenderer.invoke('export:open-directory', jobId),
  openExportStoryboard: jobId => ipcRenderer.invoke('export:open-storyboard', jobId),
  onExportProgress: callback => { const listener = (_, payload) => callback(payload); ipcRenderer.on('export:progress', listener); return () => ipcRenderer.removeListener('export:progress', listener) },
  voice: {
    start: input => ipcRenderer.invoke('voice:start', input), append: input => ipcRenderer.invoke('voice:append', input), pause: sessionId => ipcRenderer.invoke('voice:pause', sessionId), resume: sessionId => ipcRenderer.invoke('voice:resume', sessionId), finish: sessionId => ipcRenderer.invoke('voice:finish', sessionId), discard: sessionId => ipcRenderer.invoke('voice:discard', sessionId), readTake: input => ipcRenderer.invoke('voice:read-take', input), listRecoverable: projectId => ipcRenderer.invoke('voice:list-recoverable', projectId), recover: sessionId => ipcRenderer.invoke('voice:recover', sessionId), trashTake: input => ipcRenderer.invoke('voice:trash-take', input), restoreTake: input => ipcRenderer.invoke('voice:restore-take', input)
  },
  createProject: payload => ipcRenderer.invoke('project:create', payload),
  saveProject: project => ipcRenderer.invoke('project:save', project),
  loadRecentProject: () => ipcRenderer.invoke('project:recent'),
  copyText: text => ipcRenderer.invoke('system:copy-text', text)
})
