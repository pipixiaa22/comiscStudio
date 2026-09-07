const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const { renderAsset } = require('../services/AssetRenderer')
const { result } = require('./result')

function registerAssistantIpc({ ipcMain, shell, clipboard, assistantWindowService, projectService, mainWindow }) {
  let snapshot = null, sequence = 0, sessionId = null
  const tokens = new Map()
  const validMain = event => mainWindow() && event.sender.id === mainWindow().webContents.id
  const validAssistant = event => assistantWindowService.isAssistant(event.sender)
  ipcMain.handle('assistant:open', event => result(async () => { if (!validMain(event)) throw new Error('Unauthorized'); await assistantWindowService.open(); return true }))
  ipcMain.handle('assistant:publish', (event, next) => result(() => { if (!validMain(event) || !next?.projectId) throw new Error('Unauthorized'); if (snapshot?.projectId !== next.projectId) { sessionId = crypto.randomUUID(); tokens.clear() }; snapshot = { ...next, sessionId, sequence: ++sequence }; assistantWindowService.send('assistant:snapshot', snapshot); return true }))
  ipcMain.handle('assistant:snapshot', event => result(() => { if (!validAssistant(event)) throw new Error('Unauthorized'); return snapshot }))
  ipcMain.handle('assistant:topmost', (event, value) => result(() => { if (!validAssistant(event)) throw new Error('Unauthorized'); return assistantWindowService.setAlwaysOnTop(value) }))
  ipcMain.handle('assistant:copy', (event, input) => result(() => { if (!validAssistant(event) || !snapshot || input?.sessionId !== snapshot.sessionId || input?.revision !== snapshot.revision) throw new Error('内容已更新，请重试'); const block = snapshot.blocks.find(item => item.id === input.blockId); if (!block || !String(block.text || '').trim()) throw new Error('没有可复制的文案'); clipboard.writeText(block.text); return { blockId: block.id } }))
  ipcMain.handle('assistant:command', (event, command) => result(() => { if (!validAssistant(event) || !snapshot || command?.sessionId !== snapshot.sessionId || command?.projectId !== snapshot.projectId || command?.baseRevision !== snapshot.revision) throw new Error('内容已更新，请重试'); mainWindow().webContents.send('assistant:command', command); return true }))
  ipcMain.handle('assistant:prepare', (event, input) => result(async () => {
    if (!validAssistant(event) || !snapshot || input?.sessionId !== snapshot.sessionId || input?.revision !== snapshot.revision) throw new Error('内容已更新，请重试')
    const block = snapshot.blocks.find(item => item.id === input.blockId), asset = block?.assets.find(item => item.id === input.assetId)
    if (!asset?.source) throw new Error('素材来源不可用')
    const key = `${snapshot.projectId}:${block.id}:${asset.id}:${JSON.stringify(asset.crop || null)}`
    const existing = [...tokens.values()].find(item => item.key === key)
    if (existing) return existing
    const deliveryId = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)
    const directory = path.join(projectService.root, snapshot.projectId, 'exports', 'assistant-assets', deliveryId)
    await fs.mkdir(directory, { recursive: true })
    const file = path.join(directory, `${String(block.position).padStart(3, '0')}_${String(asset.position).padStart(2, '0')}.png`)
    await renderAsset(asset, file, { layout: 'source', format: 'png', pdfDpi: 200 })
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ projectId: snapshot.projectId, blockId: block.id, assetId: asset.id, createdAt: Date.now() }, null, 2))
    const token = crypto.randomUUID(), data = { token, key, file, directory, sessionId: snapshot.sessionId, webContentsId: event.sender.id }
    tokens.set(token, data); assistantWindowService.send('assistant:asset-state', { blockId: block.id, assetId: asset.id, state: 'ready', token }); return data
  }))
  ipcMain.on('assistant:start-drag', (event, token) => { const item = tokens.get(token); if (!validAssistant(event) || !item || item.sessionId !== snapshot?.sessionId || item.webContentsId !== event.sender.id) return; fs.access(item.file).then(() => event.sender.startDrag({ file: item.file, icon: item.file })).catch(() => tokens.delete(token)) })
  ipcMain.handle('assistant:open-asset-directory', (event, token) => result(async () => { const item = tokens.get(token); if (!validAssistant(event) || !item) throw new Error('素材尚未准备'); return shell.openPath(item.directory) }))
}
module.exports = { registerAssistantIpc }
