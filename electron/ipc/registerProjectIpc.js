const { result } = require('./result')

function registerProjectIpc({ ipcMain, projectService, sourceScanService }) {
  ipcMain.handle('project:create', (_, payload) => result(() => projectService.create(payload)))
  ipcMain.handle('project:save', (_, project) => result(() => projectService.save(project)))
  ipcMain.handle('project:recent', () => result(async () => {
    const project = await projectService.recent()
    if (!project) return null
    const sourcePath = project.sourceDirectories?.[0]
    const images = sourcePath ? await sourceScanService.scanPath(sourcePath).catch(() => []) : []
    return { project, images }
  }))
}

module.exports = { registerProjectIpc }
