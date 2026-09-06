import { MangaBrowser } from '../features/library/components/MangaBrowser'
import { BlockEditor } from '../features/blocks/components/BlockEditor'
import { BlockStatusPanel } from '../features/blocks/components/BlockStatusPanel'

export function WorkspacePage({ project, sources, filteredSources, sourcesById, selectedSource, search, onSearchChange, onSelectSource, onOpenReader, browserView, onBrowserViewChange, favoriteIds, onToggleFavorite, onAddBasket, usageIndex, onSelectReference, onLocateAsset, block, blockIndex, blocks, commands, undoCount, redoCount }) {
  return <main className="grid min-h-0 flex-1 grid-cols-[28%_50%_22%]">
    <MangaBrowser sources={filteredSources} allSources={sources} selectedSource={selectedSource} search={search} onSearchChange={onSearchChange} onSelectSource={onSelectSource} onOpenReader={onOpenReader} view={browserView} onViewChange={onBrowserViewChange} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onAddBasket={onAddBasket} usageIndex={usageIndex} blocks={blocks} onSelectReference={onSelectReference} />
    <BlockEditor block={block} index={blockIndex} previous={blocks[blockIndex - 1]} next={blocks[blockIndex + 1]} onSelectBlock={commands.selectBlock} onChangeText={commands.updateBlockText} onBlurText={commands.commitTextHistory} onComplete={commands.completeCurrentBlock} />
    <BlockStatusPanel projectId={project.id} block={block} index={blockIndex} total={blocks.length} sourcesById={sourcesById} basket={project.scratchBasket} commands={commands} undoCount={undoCount} redoCount={redoCount} onLocateAsset={onLocateAsset} />
  </main>
}
