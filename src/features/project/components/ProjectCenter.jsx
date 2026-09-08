import {useEffect, useState} from 'react'
import {Archive, ArchiveRestore, Check, Pencil, Play, X} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'

export function ProjectCenter({onOpen, onClose}) {
    const [projects, setProjects] = useState([]), [query, setQuery] = useState(''), [error, setError] = useState(''), [showArchived, setShowArchived] = useState(false)
    const [renaming, setRenaming] = useState(null), [draft, setDraft] = useState('')
    const load = () => mangaDeskBridge.listProjects({archived: showArchived}).then(setProjects).catch(error => setError(error.message))
    useEffect(() => { load() }, [showArchived])
    const visible = projects.filter(project => project.name.toLowerCase().includes(query.toLowerCase()))
    // Electron does not implement window.prompt, so renaming happens inline.
    const startRename = project => {
        setRenaming(project.id)
        setDraft(project.name)
        setError('')
    }
    const commitRename = async () => {
        const id = renaming, name = draft.trim()
        setRenaming(null)
        if (!id || !name) return
        try { await mangaDeskBridge.renameProject(id, name); load() } catch (reason) { setError(reason.message) }
    }
    const toggleArchive = async project => {
        try { await mangaDeskBridge.archiveProject(project.id, !showArchived); load() } catch (reason) { setError(reason.message) }
    }
    return <main className="min-h-0 flex-1 overflow-auto bg-[#0d1118] p-6"><section className="mx-auto max-w-4xl"><div className="flex items-center"><div><h1 className="text-xl font-bold">项目中心</h1><p className="mt-1 text-sm text-slate-400">打开已有项目，继续上次的工作现场。</p></div><Button className="ml-auto" variant="secondary" onClick={onClose}>返回工作区</Button></div><div className="mt-5 flex gap-2"><input className="h-9 min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-3 text-sm" placeholder="搜索项目" value={query} onChange={event => setQuery(event.target.value)}/><Button size="sm" variant={showArchived ? 'default' : 'secondary'} onClick={() => setShowArchived(value => !value)}>{showArchived ? '查看活跃项目' : '查看已归档'}</Button></div>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map(project => <article key={project.id} className="rounded border border-slate-700 bg-[#171c26] p-4">{renaming === project.id ?
        <div className="flex items-center gap-1"><input autoFocus value={draft} onChange={event => setDraft(event.target.value)}
                                                      onKeyDown={event => {
                                                          if (event.key === 'Enter') void commitRename()
                                                          if (event.key === 'Escape') setRenaming(null)
                                                      }}
                                                      className="h-8 min-w-0 flex-1 rounded border border-orange-400 bg-slate-950 px-2 text-sm"/><Button size="icon" variant="ghost" aria-label="确认重命名" title="确认重命名" onClick={commitRename}><Check className="h-4 w-4"/></Button><Button size="icon" variant="ghost" aria-label="取消重命名" title="取消重命名" onClick={() => setRenaming(null)}><X className="h-4 w-4"/></Button></div> :
        <b className="block truncate">{project.name}</b>}<p className="mt-1 text-xs text-slate-400">{project.blockCount} 个 Block · 已完成 {project.progress} · {new Date(project.updatedAt).toLocaleString()}</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => onOpen(project.id)}><Play className="h-4 w-4"/>继续创作</Button><Button size="sm" variant="ghost" onClick={() => startRename(project)} title="重命名"><Pencil className="h-4 w-4"/>重命名</Button><Button size="sm" variant="ghost" className="ml-auto text-slate-400" onClick={() => toggleArchive(project)}>{showArchived ? <ArchiveRestore className="h-4 w-4"/> : <Archive className="h-4 w-4"/>}{showArchived ? '恢复' : '归档'}</Button></div></article>)}{!visible.length && <p className="text-sm text-slate-400">没有匹配的{showArchived ? '已归档' : '活跃'}项目。</p>}</div></section></main>
}
