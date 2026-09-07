const {result} = require('./result')

function registerProjectIpc({ipcMain, projectService, sourceScanService, exportService}) {
    const registerSources = project => {
        exportService?.registerProjectSources(project);
        return project
    }
    const scanProjectSources = async project => (await Promise.all((project.sourceDirectories || []).map(directory => sourceScanService.scanPath(directory).catch(() => [])))).flat()
    ipcMain.handle('project:create', (_, payload) => result(async () => registerSources(await projectService.create(payload))))
    ipcMain.handle('project:save', (_, project) => result(async () => registerSources(await projectService.save(project))))
    ipcMain.handle('project:recent', () => result(async () => {
        const project = await projectService.recent()
        if (!project) return null
        const images = await scanProjectSources(project)
        registerSources(project)
        return {project, images}
    }))
    ipcMain.handle('project:list', (_, options) => result(() => projectService.list(options)))
    ipcMain.handle('project:open', (_, id) => result(async () => {
        const project = await projectService.load(id);
        const images = await scanProjectSources(project);
        registerSources(project);
        return {project, images}
    }))
    ipcMain.handle('project:rename', (_, id, name) => result(async () => registerSources(await projectService.rename(id, name))))
    ipcMain.handle('project:archive', (_, id, archived) => result(async () => registerSources(await projectService.archive(id, archived))))
    ipcMain.handle('project:relocate-sources', (_, id, replacements) => result(async () => registerSources(await projectService.relocateSources(id, replacements))))
}

module.exports = {registerProjectIpc}
