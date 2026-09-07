const { result } = require('./result')
function registerVoiceIpc({ ipcMain, voiceRecordingService }) {
  ipcMain.handle('voice:start', (_, input) => result(() => voiceRecordingService.start(input)))
  ipcMain.handle('voice:append', (_, input) => result(() => voiceRecordingService.append(input)))
  ipcMain.handle('voice:pause', (_, sessionId) => result(() => voiceRecordingService.pause(sessionId)))
  ipcMain.handle('voice:resume', (_, sessionId) => result(() => voiceRecordingService.resume(sessionId)))
  ipcMain.handle('voice:finish', (_, sessionId) => result(() => voiceRecordingService.finish(sessionId)))
  ipcMain.handle('voice:discard', (_, sessionId) => result(() => voiceRecordingService.discard(sessionId)))
  ipcMain.handle('voice:read-take', (_, input) => result(() => voiceRecordingService.readTake(input)))
  ipcMain.handle('voice:list-recoverable', (_, projectId) => result(() => voiceRecordingService.listRecoverable(projectId)))
  ipcMain.handle('voice:recover', (_, sessionId) => result(() => voiceRecordingService.recover(sessionId)))
  ipcMain.handle('voice:trash-take', (_, input) => result(() => voiceRecordingService.trashTake(input)))
  ipcMain.handle('voice:restore-take', (_, input) => result(() => voiceRecordingService.restoreTake(input)))
}
module.exports = { registerVoiceIpc }
