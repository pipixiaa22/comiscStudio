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
  copyText: text => bridge().copyText(text)
}
export { BridgeError }
