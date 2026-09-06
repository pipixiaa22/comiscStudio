export const selectBlocks = state => state.project?.blocks || []
export const selectCurrentBlock = state => selectBlocks(state).find(block => block.id === state.current) || selectBlocks(state)[0] || null
export const selectCurrentBlockIndex = state => selectBlocks(state).indexOf(selectCurrentBlock(state))
export const selectSourceById = (state, sourceId) => state.project?.sources?.find(source => source.id === sourceId) || null
