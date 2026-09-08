import {VideoWorkspace} from '../features/video/components/VideoWorkspace'
import {useState} from 'react'
import {PanelRightOpen, X} from 'lucide-react'
import {Button} from '../components/ui/button'
import { MangaBrowser } from '../features/library/components/MangaBrowser'
import { BlockEditor } from '../features/blocks/components/BlockEditor'
import { BlockStatusPanel } from '../features/blocks/components/BlockStatusPanel'

export function WorkspacePage({ videoProps, project, sources, filteredSources, sourcesById, selectedSource, search, onSearchChange, onSelectSource, onOpenReader, browserView, onBrowserViewChange, favoriteIds, onToggleFavorite, onAddBasket, onAddAsset, usageIndex, onSelectReference, onLocateAsset, selectedAssetId, onSelectAsset, block, blockIndex, blocks, commands, undoCount, redoCount }) {
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const inspectorProps = {projectId: project.id, narrationMode: project.narration?.mode, block, index: blockIndex, total: blocks.length, sourcesById, basket: project.scratchBasket, commands, undoCount, redoCount, onLocateAsset, selectedAssetId, onSelectAsset}
  return <>
  <main className="workspace-grid grid min-h-0 flex-1">
    {project.workspace.activeMediaTab === 'video' ? <VideoWorkspace project={project} block={block} commands={commands} {...videoProps}/> : <MangaBrowser sources={filteredSources} allSources={sources} selectedSource={selectedSource} search={search} onSearchChange={onSearchChange} onSelectSource={onSelectSource} onOpenReader={onOpenReader} view={browserView} onViewChange={onBrowserViewChange} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite} onAddBasket={onAddBasket} onAddAsset={onAddAsset} usageIndex={usageIndex} blocks={blocks} onSelectReference={onSelectReference} />}
    <BlockEditor projectId={project.id} narrationMode={project.narration?.mode} block={block} blocks={blocks} onSelectBlock={commands.selectBlock} onChangeText={commands.updateBlockText} onBlurText={commands.commitTextHistory} onComplete={commands.completeCurrentBlock} onCompleteAndAdd={commands.completeAndAddBlock} onCompleteAndNext={commands.completeAndNextBlock} onAddBlock={commands.addBlock} onInsertTextBlocks={commands.insertTextBlocks} onSplitBlock={commands.splitBlock} onMergeWithNext={commands.mergeWithNext} onBulkBlocks={commands.bulkBlocks} onMoveCurrent={commands.moveCurrentBlock} onDuplicateCurrent={commands.duplicateCurrentBlock} onDeleteCurrent={commands.deleteCurrentBlock} onAddVoiceTake={commands.addVoiceTake} onSetActiveVoiceTake={commands.setActiveVoiceTake} onSetNarrationRequired={commands.setNarrationRequired} onSetVoiceTrim={commands.setVoiceTrim} onRemoveVoiceTake={commands.removeVoiceTake} />
    <BlockStatusPanel {...inspectorProps} />
  </main>
  <Button className="workspace-inspector-toggle" size="sm" onClick={() => setInspectorOpen(true)}><PanelRightOpen className="h-4 w-4"/>检查器</Button>
  {inspectorOpen && <div className="workspace-inspector-drawer" role="dialog" aria-modal="true" aria-label="当前段检查器"><div className="workspace-inspector-backdrop" onClick={() => setInspectorOpen(false)}/><div className="workspace-inspector-content"><Button className="absolute right-3 top-3 z-10" size="icon" variant="ghost" aria-label="关闭检查器" onClick={() => setInspectorOpen(false)}><X className="h-4 w-4"/></Button><BlockStatusPanel {...inspectorProps}/></div></div>}
  </>
}
