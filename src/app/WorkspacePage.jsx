import {VideoWorkspace} from '../features/video/components/VideoWorkspace'
import { MangaBrowser } from '../features/library/components/MangaBrowser'
import { BlockEditor } from '../features/blocks/components/BlockEditor'
import { BlockStatusPanel } from '../features/blocks/components/BlockStatusPanel'

export function WorkspacePage({ videoProps, project, sources, filteredSources, sourcesById, selectedSource, search, onSearchChange, onSelectSource, onOpenReader, browserView, onBrowserViewChange, favoriteIds, onToggleFavorite, onAddBasket, onAddAsset, usageIndex, onSelectReference, onLocateAsset, selectedAssetId, onSelectAsset, block, blockIndex, blocks, commands, undoCount, redoCount }) {
  return <main className="grid min-h-0 flex-1 grid-cols-[28%_50%_22%]">
    {project.workspace.activeMediaTab === 'video' ? <VideoWorkspace project={project} block={block} commands={commands} {...videoProps}/> : <MangaBrowser sources={filteredSources} allSources={sources} selectedSource={selectedSource} search={search} onSearchChange={onSearchChange} onSelectSource={onSelectSource} onOpenReader={onOpenReader} view={browserView} onViewChange={onBrowserViewChange} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onAddBasket={onAddBasket} onAddAsset={onAddAsset} usageIndex={usageIndex} blocks={blocks} onSelectReference={onSelectReference} />}
    <BlockEditor projectId={project.id} narrationMode={project.narration?.mode} block={block} blocks={blocks} onSelectBlock={commands.selectBlock} onChangeText={commands.updateBlockText} onBlurText={commands.commitTextHistory} onComplete={commands.completeCurrentBlock} onCompleteAndAdd={commands.completeAndAddBlock} onAddBlock={commands.addBlock} onAddVoiceTake={commands.addVoiceTake} onSetActiveVoiceTake={commands.setActiveVoiceTake} onSetNarrationRequired={commands.setNarrationRequired} onSetVoiceTrim={commands.setVoiceTrim} onRemoveVoiceTake={commands.removeVoiceTake} />
    <BlockStatusPanel projectId={project.id} narrationMode={project.narration?.mode} block={block} index={blockIndex} total={blocks.length} sourcesById={sourcesById} basket={project.scratchBasket} commands={commands} undoCount={undoCount} redoCount={redoCount} onLocateAsset={onLocateAsset} selectedAssetId={selectedAssetId} onSelectAsset={onSelectAsset} />
  </main>
}
