import { BookOpen, FolderOpen, Save, PanelsTopLeft } from 'lucide-react'
import { Button } from '../components/ui/button'

export function AppHeader({ project, saveStatus, view, onViewChange, onSave, onImport }) {
  const status = { saved: '已保存', saving: '正在保存…', dirty: '有未保存修改', error: saveStatus.error || '保存失败' }[saveStatus.status]
  return <header className="flex h-14 shrink-0 items-center border-b border-slate-700 bg-[#151924] px-5">
    <div className="flex items-center gap-2 text-xl font-black"><BookOpen className="h-5 w-5 text-orange-400" />Manga<span className="text-orange-400">Desk</span></div>
    <div className="ml-5 border-l border-slate-700 pl-5 text-sm text-slate-400">{project?.name || '未命名项目'}</div>
    {project && <div className="ml-5 text-xs text-slate-500">{status}</div>}
    <div className="ml-auto flex gap-2">
      {project && <Button variant={view === 'storyboard' ? 'default' : 'secondary'} size="sm" onClick={() => onViewChange(view === 'storyboard' ? 'workspace' : 'storyboard')}><PanelsTopLeft className="h-4 w-4" />{view === 'storyboard' ? '返回工作区' : 'Storyboard'}</Button>}
      {project && <Button variant="secondary" size="sm" onClick={onSave}><Save className="h-4 w-4" />保存</Button>}
      <Button variant="secondary" onClick={() => onImport('pdf')}>导入 PDF</Button>
      <Button onClick={() => onImport('directory')}><FolderOpen className="h-4 w-4" />导入漫画目录</Button>
    </div>
  </header>
}
