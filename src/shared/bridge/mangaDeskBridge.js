class BridgeError extends Error {
  constructor(message, code = 'BRIDGE_ERROR') { super(message); this.code = code }
}

function bridge() {
  if (!window.mangaDesk) throw new BridgeError('MangaDesk 桌面桥接不可用')
  return window.mangaDesk
}
function unwrap(result) {
  if (!result?.ok) throw new BridgeError(result?.error?.message || '操作失败', result?.error?.code)
  return result.data
}

export const mangaDeskBridge = {
  loadRecentProject: async () => unwrap(await bridge().loadRecentProject()),
  saveProject: async project => unwrap(await bridge().saveProject(project)),
  createProject: async input => unwrap(await bridge().createProject(input)),
  chooseDirectory: () => bridge().chooseDirectory(),
  choosePdf: () => bridge().choosePdf(),
  readPdf: file => bridge().readPdf(file),
  validateSources: sources => bridge().validateSources(sources),
  chooseExportDirectory: () => bridge().chooseExportDirectory(),
  preflightExport: input => bridge().preflightExport(input),
  startExport: input => bridge().startExport(input),
  cancelExport: jobId => bridge().cancelExport(jobId),
  openExportDirectory: jobId => bridge().openExportDirectory(jobId),
  openExportStoryboard: jobId => bridge().openExportStoryboard(jobId),
  onExportProgress: callback => bridge().onExportProgress(callback),
  voice: {
    start: async input => unwrap(await bridge().voice.start(input)), append: async input => unwrap(await bridge().voice.append(input)), pause: async sessionId => unwrap(await bridge().voice.pause(sessionId)), resume: async sessionId => unwrap(await bridge().voice.resume(sessionId)), finish: async sessionId => unwrap(await bridge().voice.finish(sessionId)), discard: async sessionId => unwrap(await bridge().voice.discard(sessionId)), readTake: async input => unwrap(await bridge().voice.readTake(input)), listRecoverable: async projectId => unwrap(await bridge().voice.listRecoverable(projectId)), recover: async sessionId => unwrap(await bridge().voice.recover(sessionId)), trashTake: async input => unwrap(await bridge().voice.trashTake(input)), restoreTake: async input => unwrap(await bridge().voice.restoreTake(input))
  },
  copyText: text => bridge().copyText(text)
}
export { BridgeError }
