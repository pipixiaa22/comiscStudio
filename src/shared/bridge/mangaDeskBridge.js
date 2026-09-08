class BridgeError extends Error {
    constructor(message, code = 'BRIDGE_ERROR') {
        super(message);
        this.code = code
    }
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
    listProjects: async options => unwrap(await bridge().listProjects(options)),
    openProject: async id => unwrap(await bridge().openProject(id)),
    renameProject: async (id, name) => unwrap(await bridge().renameProject(id, name)),
    archiveProject: async (id, archived) => unwrap(await bridge().archiveProject(id, archived)),
    relocateSources: async (id, replacements) => unwrap(await bridge().relocateSources(id, replacements)),
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
    video: {
        choose: async projectId => unwrap(await bridge().video.choose(projectId)),
        playback: async input => unwrap(await bridge().video.playback(input)),
        resolveBoundary: async input => unwrap(await bridge().video.resolveBoundary(input)),
        onProgress: callback => bridge().video.onProgress(callback)
    },
    voice: {
        start: async input => unwrap(await bridge().voice.start(input)),
        append: async input => unwrap(await bridge().voice.append(input)),
        pause: async sessionId => unwrap(await bridge().voice.pause(sessionId)),
        resume: async sessionId => unwrap(await bridge().voice.resume(sessionId)),
        finish: async sessionId => unwrap(await bridge().voice.finish(sessionId)),
        discard: async sessionId => unwrap(await bridge().voice.discard(sessionId)),
        readTake: async input => unwrap(await bridge().voice.readTake(input)),
        listRecoverable: async projectId => unwrap(await bridge().voice.listRecoverable(projectId)),
        recover: async sessionId => unwrap(await bridge().voice.recover(sessionId)),
        trashTake: async input => unwrap(await bridge().voice.trashTake(input)),
        restoreTake: async input => unwrap(await bridge().voice.restoreTake(input))
    },
    copyText: text => bridge().copyText(text)
    ,
    assistant: {
        open: async () => unwrap(await bridge().assistant.open()),
        publish: async snapshot => unwrap(await bridge().assistant.publish(snapshot)),
        snapshot: async () => unwrap(await bridge().assistant.snapshot()),
        topmost: async value => unwrap(await bridge().assistant.topmost(value)),
        copy: async input => unwrap(await bridge().assistant.copy(input)),
        command: async input => unwrap(await bridge().assistant.command(input)),
        prepare: async input => unwrap(await bridge().assistant.prepare(input)),
        cancelPrepare: async input => unwrap(await bridge().assistant.cancelPrepare(input)),
        startDrag: token => bridge().assistant.startDrag(token),
        openAssetDirectory: async token => unwrap(await bridge().assistant.openAssetDirectory(token)),
        onSnapshot: callback => bridge().assistant.onSnapshot(callback),
        onCommand: callback => bridge().assistant.onCommand(callback),
        onAssetState: callback => bridge().assistant.onAssetState(callback)
    }
}
export {BridgeError}
