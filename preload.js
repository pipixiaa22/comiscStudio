const {contextBridge, ipcRenderer} = require('electron')
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
    onExportProgress: callback => {
        const listener = (_, payload) => callback(payload);
        ipcRenderer.on('export:progress', listener);
        return () => ipcRenderer.removeListener('export:progress', listener)
    },
    video: {
        choose: projectId => ipcRenderer.invoke('video:choose', projectId),
        playback: input => ipcRenderer.invoke('video:playback', input),
        resolveBoundary: input => ipcRenderer.invoke('video:resolveBoundary', input),
        onProgress: callback => {
            const listener = (_, payload) => callback(payload)
            ipcRenderer.on('video:progress', listener)
            return () => ipcRenderer.removeListener('video:progress', listener)
        }
    },
    voice: {
        start: input => ipcRenderer.invoke('voice:start', input),
        append: input => ipcRenderer.invoke('voice:append', input),
        pause: sessionId => ipcRenderer.invoke('voice:pause', sessionId),
        resume: sessionId => ipcRenderer.invoke('voice:resume', sessionId),
        finish: sessionId => ipcRenderer.invoke('voice:finish', sessionId),
        discard: sessionId => ipcRenderer.invoke('voice:discard', sessionId),
        readTake: input => ipcRenderer.invoke('voice:read-take', input),
        listRecoverable: projectId => ipcRenderer.invoke('voice:list-recoverable', projectId),
        recover: sessionId => ipcRenderer.invoke('voice:recover', sessionId),
        trashTake: input => ipcRenderer.invoke('voice:trash-take', input),
        restoreTake: input => ipcRenderer.invoke('voice:restore-take', input)
    },
    createProject: payload => ipcRenderer.invoke('project:create', payload),
    saveProject: project => ipcRenderer.invoke('project:save', project),
    loadRecentProject: () => ipcRenderer.invoke('project:recent'),
    listProjects: options => ipcRenderer.invoke('project:list', options),
    openProject: id => ipcRenderer.invoke('project:open', id),
    renameProject: (id, name) => ipcRenderer.invoke('project:rename', id, name),
    archiveProject: (id, archived) => ipcRenderer.invoke('project:archive', id, archived),
    relocateSources: (id, replacements) => ipcRenderer.invoke('project:relocate-sources', id, replacements),
    copyText: text => ipcRenderer.invoke('system:copy-text', text)
    ,
    assistant: {
        open: () => ipcRenderer.invoke('assistant:open'),
        publish: snapshot => ipcRenderer.invoke('assistant:publish', snapshot),
        snapshot: () => ipcRenderer.invoke('assistant:snapshot'),
        topmost: value => ipcRenderer.invoke('assistant:topmost', value),
        copy: input => ipcRenderer.invoke('assistant:copy', input),
        command: input => ipcRenderer.invoke('assistant:command', input),
        prepare: input => ipcRenderer.invoke('assistant:prepare', input),
        cancelPrepare: input => ipcRenderer.invoke('assistant:cancel-prepare', input),
        startDrag: token => ipcRenderer.send('assistant:start-drag', token),
        openAssetDirectory: token => ipcRenderer.invoke('assistant:open-asset-directory', token),
        onSnapshot: callback => {
            const listener = (_, payload) => callback(payload);
            ipcRenderer.on('assistant:snapshot', listener);
            return () => ipcRenderer.removeListener('assistant:snapshot', listener)
        },
        onCommand: callback => {
            const listener = (_, payload) => callback(payload);
            ipcRenderer.on('assistant:command', listener);
            return () => ipcRenderer.removeListener('assistant:command', listener)
        },
        onAssetState: callback => {
            const listener = (_, payload) => callback(payload);
            ipcRenderer.on('assistant:asset-state', listener);
            return () => ipcRenderer.removeListener('assistant:asset-state', listener)
        }
    }
})
