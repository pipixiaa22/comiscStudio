import { BookOpen, Download, FolderOpen, Save, PanelsTopLeft, Clapperboard, Plus, Library } from 'lucide-react'
import { Button } from '../components/ui/button'
import { ProjectProgress } from '../features/project/components/ProjectProgress'

export function AppHeader({ project, saveStatus, view, onViewChange, onSave, onImport, onAppendSource, onProjectCenter, onExport, onAssistant, narrationMode, onNarrationMode }) {
  const status = { saved: '已保存', saving: '正在保存…', dirty: '有未保存修改', error: saveStatus.error || '保存失败' }[saveStatus.status]
  return <header className="flex h-14 shrink-0 items-center border-b border-slate-700 bg-[#151924] px-5">
    <div className="flex items-center gap-2 text-xl font-black"><BookOpen className="h-5 w-5 text-orange-400" />Manga<span className="text-orange-400">Desk</span></div>
    <div className="ml-5 border-l border-slate-700 pl-5 text-sm text-slate-400">{project?.name || '未命名项目'}</div>
    {project && <div className="ml-5 text-xs text-slate-500">{status}</div>}
    {project && <div className="ml-4 hidden xl:block"><ProjectProgress blocks={project.blocks} /></div>}
    {project && <label className="ml-4 hidden lg:flex items-center gap-2 text-xs text-slate-400">旁白<select value={narrationMode} onChange={event => onNarrationMode(event.target.value)} className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-slate-100"><option value="text">文字文案</option><option value="voice">真人录音</option></select></label>}
    <div className="ml-auto flex gap-2">
      <Button variant="secondary" size="sm" onClick={onProjectCenter}><Library className="h-4 w-4"/>项目</Button>
      {project && <Button variant={view === 'storyboard' ? 'default' : 'secondary'} size="sm" onClick={() => onViewChange(view === 'storyboard' ? 'workspace' : 'storyboard')}><PanelsTopLeft className="h-4 w-4" />{view === 'storyboard' ? '返回工作区' : 'Storyboard'}</Button>}
      {project && <Button variant={view === 'export' ? 'default' : 'secondary'} size="sm" onClick={onExport}><Download className="h-4 w-4" />导出素材包</Button>}
      {project && <Button variant="secondary" size="sm" onClick={onAssistant}><Clapperboard className="h-4 w-4" />剪映辅助</Button>}
      {project && <Button variant="secondary" size="sm" onClick={onSave}><Save className="h-4 w-4" />保存</Button>}
      {project && <Button variant="secondary" onClick={() => onAppendSource('directory')}><Plus className="h-4 w-4" />添加漫画来源</Button>}
      <Button variant="secondary" onClick={() => onImport('pdf')}>导入 PDF</Button>
      <Button onClick={() => onImport('directory')}><FolderOpen className="h-4 w-4" />导入漫画目录</Button>
    </div>
  </header>
}
