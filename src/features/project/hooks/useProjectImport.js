import { useCallback } from 'react'
import { mangaDeskBridge } from '../../../shared/bridge/mangaDeskBridge'
import { hydrateSources, projectNameFromSource } from '../projectSources'

export function useProjectImport({ onLoad, onSources, onSelect, onError }) {
  return useCallback(async kind => {
    try {
      const source = await (kind === 'pdf' ? mangaDeskBridge.choosePdf() : mangaDeskBridge.chooseDirectory())
      if (!source) return
      if (!source.images.length) throw new Error('没有找到可导入的漫画页面。')
      const project = await mangaDeskBridge.createProject({ name: projectNameFromSource(source), sourceDirectory: source.sourcePath || source.directory, sources: source.images })
      const sources = hydrateSources(source.images, project)
      onLoad(project); onSources(sources); onSelect(sources[0] || null)
    } catch (error) { onError(error instanceof Error ? error.message : '导入失败，请确认 PDF 未加密且文件仍可访问。') }
  }, [onError, onLoad, onSelect, onSources])
}
