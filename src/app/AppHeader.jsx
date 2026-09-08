import { BookOpen, Check, Download, FolderOpen, Save, PanelsTopLeft, Clapperboard, Plus, Library, MoreHorizontal, ChevronDown } from 'lucide-react'
import {useEffect, useState} from 'react'
import { Button } from '../components/ui/button'
import { ProjectProgress } from '../features/project/components/ProjectProgress'

export function AppHeader({ project, saveStatus, view, onViewChange, onSave, onImport, onAppendSource, onProjectCenter, onExport, onAssistant, narrationMode, onNarrationMode, onMediaTab }) {
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const status = { saved: '已保存', saving: '正在保存…', dirty: '有未保存修改', error: saveStatus.error || '保存失败' }[saveStatus.status]
  const importSource = type => {
    setSourceMenuOpen(false)
    onImport(type)
  }
  useEffect(() => {
    if (!sourceMenuOpen && !moreMenuOpen) return
    const onKeyDown = event => { if (event.key === 'Escape') { setSourceMenuOpen(false); setMoreMenuOpen(false) } }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sourceMenuOpen, moreMenuOpen])
  return <header className="flex h-14 shrink-0 items-center border-b border-slate-700 bg-[#151924] px-5">
    <div className="flex items-center gap-2 text-xl font-black"><BookOpen className="h-5 w-5 text-orange-400" />Manga<span className="text-orange-400">Desk</span></div>
    <div className="ml-5 min-w-0 border-l border-slate-700 pl-5"><div className="truncate text-sm text-slate-300">{project?.name || '未命名项目'}</div>{project && <div className="flex items-center gap-1.5 text-xs text-slate-500"><i className={`h-1.5 w-1.5 rounded-full ${saveStatus.status === 'error' ? 'bg-red-400' : saveStatus.status === 'saving' ? 'bg-orange-300' : 'bg-emerald-400'}`}/>{status}</div>}</div>
    {project && <select aria-label="工作区" title="切换漫画/动漫工作区" value={project.workspace.activeMediaTab} onChange={event => onMediaTab(event.target.value)} className="ml-4 h-8 shrink-0 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"><option value="image">漫画工作区</option><option value="video">动漫工作区</option></select>}
    {project && <label className="ml-3 hidden shrink-0 items-center gap-1.5 text-xs text-slate-400 xl:flex">旁白<select aria-label="旁白模式" value={narrationMode} onChange={event => onNarrationMode(event.target.value)} className="h-8 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-100"><option value="text">文字文案</option><option value="voice">真人录音</option></select></label>}
    {project && <nav aria-label="工作区视图" className="ml-6 hidden items-center gap-1 lg:flex"><Button variant={view === 'workspace' ? 'default' : 'ghost'} size="sm" onClick={() => onViewChange('workspace')}>工作区</Button><Button variant={view === 'storyboard' ? 'default' : 'ghost'} size="sm" onClick={() => onViewChange('storyboard')}><PanelsTopLeft className="h-4 w-4"/>Storyboard</Button><Button variant={view === 'export' ? 'default' : 'ghost'} size="sm" onClick={onExport}><Download className="h-4 w-4"/>导出</Button></nav>}
    {project && <div className="ml-4 hidden 2xl:block"><ProjectProgress blocks={project.blocks} /></div>}
    <div className="ml-auto flex items-center gap-2">
      {project && <Button variant={saveStatus.status === 'error' ? 'default' : 'secondary'} size="sm" onClick={onSave} title={saveStatus.status === 'error' ? '上次保存失败，点击重试' : '保存项目'}><Save className="h-4 w-4"/>{saveStatus.status === 'error' ? '重试保存' : '保存'}</Button>}
      <div className="relative"><Button onClick={() => { setSourceMenuOpen(value => !value); setMoreMenuOpen(false) }}><Plus className="h-4 w-4"/>{project ? '添加来源' : '导入来源'}<ChevronDown className="h-3.5 w-3.5"/></Button>{sourceMenuOpen && <div aria-hidden className="fixed inset-0 z-40" onClick={() => setSourceMenuOpen(false)}/>}{sourceMenuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl"><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => project ? (setSourceMenuOpen(false), onAppendSource('directory')) : importSource('directory')}><FolderOpen className="h-4 w-4"/>漫画目录</button><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => importSource('pdf')}><BookOpen className="h-4 w-4"/>PDF 文件</button></div>}</div>
      {project && <div className="relative"><Button aria-label="更多项目操作" title="更多项目操作" variant="ghost" size="icon" onClick={() => { setMoreMenuOpen(value => !value); setSourceMenuOpen(false) }}><MoreHorizontal className="h-5 w-5"/></Button>{moreMenuOpen && <div aria-hidden className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)}/>}{moreMenuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-44 rounded-md border border-slate-700 bg-slate-900 p-1 shadow-xl"><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { setMoreMenuOpen(false); onProjectCenter() }}><Library className="h-4 w-4"/>项目中心</button><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { setMoreMenuOpen(false); onAssistant() }}><Clapperboard className="h-4 w-4"/>剪映辅助</button><div className="my-1 border-t border-slate-700"/><p className="px-3 py-1 text-[10px] text-slate-500">旁白模式</p><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { setMoreMenuOpen(false); onNarrationMode('text') }}><Check className={`h-4 w-4 ${narrationMode === 'text' ? 'text-emerald-400' : 'text-transparent'}`}/>文字文案</button><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-slate-800" onClick={() => { setMoreMenuOpen(false); onNarrationMode('voice') }}><Check className={`h-4 w-4 ${narrationMode === 'voice' ? 'text-emerald-400' : 'text-transparent'}`}/>真人录音</button></div>}</div>}
    </div>
  </header>
}
