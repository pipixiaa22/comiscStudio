import {VideoAssetSummary} from '../../video/components/VideoAssetSummary'
import {useEffect, useMemo, useRef, useState} from 'react'
import {AlertTriangle, Link2, RefreshCw} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {pageNumber} from '../../../shared/lib/pageNumber'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'
import {SourcePreview} from '../../assets/components/SourcePreview'
import {ProjectProgress} from '../../project/components/ProjectProgress'
import {ISSUE_LABELS, validateStoryboard} from '../model/validateStoryboard'

const RELOCATABLE = new Set(['SOURCE_NOT_FOUND', 'SOURCE_UNAVAILABLE'])

export function StoryboardView({project, revision, reloadToken, sourcesById, restoreBlockId, onEditBlock, onOpenSource, onRelocate}) {
    const [sourceStatus, setSourceStatus] = useState({})
    const [checkedAt, setCheckedAt] = useState(null)
    const [checking, setChecking] = useState(false)
    const [relocating, setRelocating] = useState('')
    const [filter, setFilter] = useState('all')
    const current = useRef({projectId: project.id, revision})
    current.current = {projectId: project.id, revision}
    const runCheck = async () => {
        const projectId = project.id, checkedRevision = revision
        setChecking(true)
        try {
            const result = await mangaDeskBridge.validateSources(project.sources || [])
            if (current.current.projectId === projectId && current.current.revision === checkedRevision) {
                setSourceStatus(result.sources);
                setCheckedAt(result.checkedAt)
            }
        } finally {
            setChecking(false)
        }
    }
    const relocate = async sourceId => {
        setRelocating(sourceId)
        try {
            await onRelocate(sourceId)
        } finally {
            setRelocating('')
        }
    }
    useEffect(() => {
        void runCheck()
    }, [project.id, revision, reloadToken])
    useEffect(() => {
        if (restoreBlockId) document.getElementById(`story-${restoreBlockId}`)?.scrollIntoView({block: 'start'})
    }, [restoreBlockId])
    const checks = useMemo(() => validateStoryboard(project, sourceStatus), [project, sourceStatus])
    const checkByBlock = useMemo(() => new Map(checks.map(check => [check.blockId, check.issues])), [checks])
    const visible = project.blocks.filter(block => filter === 'all' || checkByBlock.get(block.id)?.some(issue => filter === 'problems' || issue.code === filter))
    const problemBlocks = checks.filter(check => check.issues.length).length
    const issueCount = checks.reduce((total, check) => total + check.issues.length, 0)
    return <main className="min-h-0 flex-1 overflow-auto bg-background p-5">
        <div className="sticky top-0 z-10 mb-4 rounded border border-border bg-background/95 p-3">
            <div className="flex items-center gap-3"><h1 className="text-lg font-bold">Storyboard</h1><span
                className="text-xs text-amber-300">{problemBlocks} 个 Block 有问题 · {issueCount} 条</span><select
                value={filter} onChange={event => setFilter(event.target.value)}
                className="ml-auto rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs">
                <option value="all">全部</option>
                <option value="problems">有问题</option>
                {Object.entries(ISSUE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select><Button size="sm" variant="secondary" onClick={runCheck} disabled={checking}><RefreshCw
                className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`}/>重新检查</Button></div>
            <div className="mt-2 flex items-center justify-between"><ProjectProgress
                blocks={project.blocks}/>{checkedAt &&
                <span className="text-[10px] text-slate-500">检查于 {new Date(checkedAt).toLocaleTimeString()}</span>}
            </div>
        </div>
        <div className="mx-auto max-w-5xl space-y-4">{visible.map(block => {
            const issues = checkByBlock.get(block.id) || [];
            return <article id={`story-${block.id}`} key={block.id}
                            className="scroll-mt-24 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center"><b
                    className="text-orange-300">#{pageNumber(project.blocks.indexOf(block))}</b><span
                    className="ml-3 text-xs text-slate-500">{block.assets.length} 项素材</span><Button
                    className="ml-auto" size="sm" onClick={() => onEditBlock(block.id)}>编辑此段</Button></div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{block.text ||
                    <span className="text-slate-500">（空文案）</span>}</p>
                <div
                    className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">{block.assets.map((asset, assetIndex) =>
                    <button key={asset.id} className="overflow-hidden rounded border border-slate-700 text-left"
                            onClick={() => onOpenSource(asset)}>{asset.type === 'video' ? <VideoAssetSummary asset={asset} source={sourcesById.get(asset.sourceId)}/> : <SourcePreview
                        source={sourcesById.get(asset.sourceId)} crop={asset.crop} className="h-32 w-full"/>}<span
                        className="block p-1 text-[10px] text-slate-400">{assetIndex + 1} · {asset.type === 'video' ? '视频' : asset.crop ? 'Crop' : '整页'}</span>
                    </button>)}</div>
                {issues.length > 0 &&
                    <div className="mt-3 flex flex-wrap items-center gap-2">{issues.map((issue, issueIndex) => <span
                        key={`${issue.code}-${issue.assetId || issueIndex}`}
                        className="flex items-center gap-1 rounded bg-amber-950 px-2 py-1 text-xs text-amber-200"><AlertTriangle
                        className="h-3 w-3"/>{ISSUE_LABELS[issue.code]}{RELOCATABLE.has(issue.code) && issue.sourceId &&
                        <Button size="sm" variant="ghost" className="h-5 px-1 text-amber-100 hover:bg-amber-900"
                                disabled={relocating === issue.sourceId}
                                onClick={() => relocate(issue.sourceId)}><Link2
                            className="h-3 w-3"/>{relocating === issue.sourceId ? '定位中…' : '重新定位'}</Button>}</span>)}</div>}</article>
        })}</div>
    </main>
}
