export function appendHistory(entries, snapshot) {
    return [...entries, snapshot].slice(-100)
}

export function undoHistory(state) {
    if (!state.undo.length) return state
    const project = state.undo.at(-1)
    return {
        ...state,
        project,
        current: project.workspace.currentBlockId,
        undo: state.undo.slice(0, -1),
        redo: [state.project, ...state.redo]
    }
}

export function redoHistory(state) {
    if (!state.redo.length) return state
    const project = state.redo[0]
    return {
        ...state,
        project,
        current: project.workspace.currentBlockId,
        undo: appendHistory(state.undo, state.project),
        redo: state.redo.slice(1)
    }
}
