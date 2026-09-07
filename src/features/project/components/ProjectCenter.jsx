import {useEffect, useState} from 'react'
import {Archive, FolderOpen, Play} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'

export function ProjectCenter({onOpen, onClose}) {
    const [projects, setProjects] = useState([]), [query, setQuery] = useState(''), [error, setError] = useState('')
    const load = () => mangaDeskBridge.listProjects().then(setProjects).catch(error => setError(error.message))
    useEffect(() => { load() }, [])
    const visible = projects.filter(project => project.name.toLowerCase().includes(query.toLowerCase()))
    return <main className="min-h-0 flex-1 overflow-auto bg-[#0d1118] p-6"><section className="mx-auto max-w-4xl"><div className="flex items-center"><div><h1 className="text-xl font-bold">项目中心</h1><p className="mt-1 text-sm text-slate-400">打开已有项目，继续上次的工作现场。</p></div><Button className="ml-auto" variant="secondary" onClick={onClose}>返回工作区</Button></div><input className="mt-5 h-9 w-full rounded border border-slate-600 bg-slate-950 px-3 text-sm" placeholder="搜索项目" value={query} onChange={event => setQuery(event.target.value)}/>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map(project => <article key={project.id} className="rounded border border-slate-700 bg-[#171c26] p-4"><b className="block truncate">{project.name}</b><p className="mt-1 text-xs text-slate-400">{project.blockCount} 个 Block · 已完成 {project.progress} · {new Date(project.updatedAt).toLocaleString()}</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => onOpen(project.id)}><Play className="h-4 w-4"/>继续创作</Button><Button size="sm" variant="ghost" className="ml-auto text-slate-400" onClick={async () => { await mangaDeskBridge.archiveProject(project.id, true); load() }}><Archive className="h-4 w-4"/>归档</Button></div></article>)}{!visible.length && <p className="text-sm text-slate-400">没有匹配的活跃项目。</p>}</div></section></main>
}
