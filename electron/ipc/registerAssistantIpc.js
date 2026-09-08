const crypto = require('crypto')
const fs = require('fs/promises')
const {MediaDeliveryService, contentVersion} = require('../services/MediaDeliveryService')
const {result} = require('./result')

function registerAssistantIpc({ipcMain, shell, clipboard, assistantWindowService, projectService, mainWindow, deliveryService = new MediaDeliveryService(projectService)}) {
  let snapshot = null, sequence = 0, sessionId = null
  const tokens = new Map(), requests = new Map(), watched = new Set()
  const validMain = event => mainWindow() && event.sender.id === mainWindow().webContents.id
  const validAssistant = event => assistantWindowService.isAssistant(event.sender)
  const findAsset = (blockId, assetId) => snapshot?.blocks.find(block => block.id === blockId)?.assets.find(asset => asset.id === assetId)
  const current = item => item.sessionId === snapshot?.sessionId && item.projectId === snapshot?.projectId && contentVersion(findAsset(item.blockId, item.assetId) || {}) === item.version
  const validInput = (event, input) => {
    if (!validAssistant(event) || !snapshot || input?.sessionId !== snapshot.sessionId || input?.revision !== snapshot.revision) throw new Error('内容已更新，请重试')
  }
  const stop = request => { request.cancelled = true; if (request.key) deliveryService.cancel(request.projectId, request.key) }
  const send = (request, state) => {
    if (!request.cancelled && current(request) && !request.sender.isDestroyed?.()) request.sender.send('assistant:asset-state', {
      sessionId: request.sessionId, revision: request.revision, blockId: request.blockId, assetId: request.assetId, version: request.version, ...state
    })
  }
  ipcMain.handle('assistant:open', event => result(async () => { if (!validMain(event)) throw new Error('Unauthorized'); await assistantWindowService.open(); return true }))
  ipcMain.handle('assistant:publish', (event, next) => result(() => {
    if (!validMain(event) || !next?.projectId) throw new Error('Unauthorized')
    if (snapshot?.projectId !== next.projectId) { sessionId = crypto.randomUUID(); tokens.clear() }
    snapshot = {...next, sessionId, sequence: ++sequence, blocks: next.blocks.map(block => ({...block, assets: block.assets.map(asset => ({...asset, deliveryVersion: contentVersion(asset)}))}))}
    for (const [token, item] of tokens) if (!current(item)) tokens.delete(token)
    for (const request of requests.values()) if (!current(request)) stop(request)
    assistantWindowService.send('assistant:snapshot', snapshot)
    return true
  }))
  ipcMain.handle('assistant:snapshot', event => result(() => { if (!validAssistant(event)) throw new Error('Unauthorized'); return snapshot }))
  ipcMain.handle('assistant:topmost', (event, value) => result(() => { if (!validAssistant(event)) throw new Error('Unauthorized'); return assistantWindowService.setAlwaysOnTop(value) }))
  ipcMain.handle('assistant:copy', (event, input) => result(() => { validInput(event, input); const block = snapshot.blocks.find(item => item.id === input.blockId); if (!block || !String(block.text || '').trim()) throw new Error('没有可复制的文案'); clipboard.writeText(block.text); return {blockId: block.id} }))
  ipcMain.handle('assistant:command', (event, command) => result(() => { if (!validAssistant(event) || !snapshot || command?.sessionId !== snapshot.sessionId || command?.projectId !== snapshot.projectId || command?.baseRevision !== snapshot.revision) throw new Error('内容已更新，请重试'); mainWindow().webContents.send('assistant:command', command); return true }))
  ipcMain.handle('assistant:prepare', (event, input) => result(async () => {
    validInput(event, input)
    const asset = structuredClone(findAsset(input.blockId, input.assetId))
    if (!asset?.source) throw new Error('素材来源不可用')
    const requestId = [event.sender.id, snapshot.sessionId, input.blockId, input.assetId].join(':')
    const prior = requests.get(requestId)
    if (prior) return prior.promise
    const request = {sender: event.sender, webContentsId: event.sender.id, sessionId: snapshot.sessionId, projectId: snapshot.projectId,
      revision: snapshot.revision, blockId: input.blockId, assetId: asset.id, version: contentVersion(asset), cancelled: false}
    if (!watched.has(event.sender.id)) {
      watched.add(event.sender.id)
      event.sender.once('destroyed', () => {
        watched.delete(event.sender.id)
        for (const item of requests.values()) if (item.webContentsId === event.sender.id) stop(item)
        for (const [token, item] of tokens) if (item.webContentsId === event.sender.id) tokens.delete(token)
      })
    }
    request.promise = (async () => {
      send(request, {state: 'queued', progress: 0})
      const identity = await deliveryService.identify(request.projectId, asset)
      request.key = identity.key
      if (request.cancelled || !current(request)) throw new Error('内容已更新或准备已取消，请重试')
      const item = await deliveryService.prepare({projectId: request.projectId, asset, identity, onProgress: state => send(request, state)})
      if (request.cancelled || !current(request) || !validAssistant(event)) throw new Error('内容已更新或准备已取消，请重试')
      const token = crypto.randomUUID()
      tokens.set(token, {...item, sessionId: request.sessionId, projectId: request.projectId, blockId: request.blockId,
        assetId: request.assetId, version: request.version, webContentsId: request.webContentsId})
      if (tokens.size > 512) tokens.delete(tokens.keys().next().value)
      const data = {token, file: item.file, directory: item.directory, version: request.version}
      send(request, {state: 'ready', delivery: data})
      return data
    })().catch(error => { send(request, {state: 'failed', error: error.message}); throw error }).finally(() => requests.delete(requestId))
    requests.set(requestId, request)
    return request.promise
  }))
  ipcMain.handle('assistant:cancel-prepare', (event, input) => result(() => {
    validInput(event, input)
    const request = requests.get([event.sender.id, snapshot.sessionId, input.blockId, input.assetId].join(':'))
    if (request) stop(request)
    return true
  }))
  const checkToken = async (event, token) => {
    const item = tokens.get(token)
    if (!validAssistant(event) || !item || !current(item) || item.webContentsId !== event.sender.id) throw new Error('素材版本已失效，请重新准备')
    await fs.access(item.file); await fs.access(item.icon)
    const identity = await deliveryService.identify(item.projectId, findAsset(item.blockId, item.assetId))
    if (identity.key !== item.key || !current(item) || !validAssistant(event)) throw new Error('来源已变化，请重新准备')
    return item
  }
  ipcMain.on('assistant:start-drag', (event, token) => {
    checkToken(event, token).then(item => event.sender.startDrag({file: item.file, icon: item.icon})).catch(error => {
      const item = tokens.get(token)
      tokens.delete(token)
      if (item && validAssistant(event)) event.sender.send('assistant:asset-state', {...item, state: 'failed', error: error.message})
    })
  })
  ipcMain.handle('assistant:open-asset-directory', (event, token) => result(async () => {
    const item = await checkToken(event, token)
    const error = await shell.openPath(item.directory)
    if (error) throw new Error(error)
    return true
  }))
  return {shutdown: async () => { for (const request of requests.values()) stop(request); await Promise.allSettled([...requests.values()].map(request => request.promise)); await deliveryService.shutdown() }}
}
module.exports = {registerAssistantIpc}
