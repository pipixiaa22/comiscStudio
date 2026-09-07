const { result } = require('./result')

function registerProjectIpc({ ipcMain, projectService, sourceScanService, exportService }) {
  const registerSources = project => { exportService?.registerProjectSources(project); return project }
  ipcMain.handle('project:create', (_, payload) => result(async () => registerSources(await projectService.create(payload))))
  ipcMain.handle('project:save', (_, project) => result(async () => registerSources(await projectService.save(project))))
  ipcMain.handle('project:recent', () => result(async () => {
    const project = await projectService.recent()
    if (!project) return null
    const sourcePath = project.sourceDirectories?.[0]
    const images = sourcePath ? await sourceScanService.scanPath(sourcePath).catch(() => []) : []
    registerSources(project)
    return { project, images }
  }))
}

module.exports = { registerProjectIpc }
