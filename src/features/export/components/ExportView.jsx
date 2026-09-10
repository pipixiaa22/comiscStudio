import {useEffect, useMemo, useRef, useState} from 'react'
import {FolderOpen, Play, Save, Trash2, X} from 'lucide-react'
import {Button} from '../../../components/ui/button'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'
import {createId} from '../../../shared/lib/ids'

const fingerprint = block => JSON.stringify({text: block.text, assets: block.assets, voice: {activeTakeId: block.voice?.activeTakeId, trimStartMs: block.voice?.trimStartMs, trimEndMs: block.voice?.trimEndMs}})

export function ExportView({project, revision, onClose, onSavePreset, onRemovePreset, onRecordDelivery}) {
    const [destination, setDestination] = useState(null)
    // Control characters are stripped on purpose: they are invalid in file names.
    // eslint-disable-next-line no-control-regex
    const [packageName, setPackageName] = useState(() => String(project.name || '素材包').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || '素材包')
    const [options, setOptions] = useState({
        format: 'jpeg',
        jpegQuality: 92,
        pdfDpi: 200,
        maxEdge: '',
        canvasWidth: 1920,
        canvasHeight: 1080,
        backgroundColor: '#F4EBD9',
        watermarkText: ''
    })
    const [preflight, setPreflight] = useState(null)
    const [confirmedWarnings, setConfirmedWarnings] = useState(false)
    const [job, setJob] = useState(null)
    const [presetName, setPresetName] = useState('')
    const [baselineId, setBaselineId] = useState('')
    const [progress, setProgress] = useState({stage: 'idle', completed: 0, total: 0})
    // 交付基线必须在点击导出时固定，之后写稿不能混入本次产物。
    const [baseline, setBaseline] = useState(null)
    const recordedJob = useRef(null)
    const input = useMemo(() => ({
        projectSnapshot: project,
        options: {
            ...options,
            maxEdge: Number(options.maxEdge) || null,
            canvasWidth: Number(options.canvasWidth),
            canvasHeight: Number(options.canvasHeight)
        },
        packageName,
        destinationToken: destination?.token
    }), [project, options, packageName, destination])
    const runPreflight = async () => {
        setPreflight(await mangaDeskBridge.preflightExport(input))
    }
    const chooseDirectory = async () => {
        const next = await mangaDeskBridge.chooseExportDirectory();
        if (next) {
            setDestination(next);
            setPreflight(null)
        }
    }
    const start = async () => {
        const report = await mangaDeskBridge.preflightExport(input)
        setPreflight(report)
        if (report.errors.length || (report.warnings.length && !confirmedWarnings)) return
        setBaseline({revision, options: input.options, blocks: project.blocks.map(block => ({id: block.id, fingerprint: fingerprint(block)}))})
        const result = await mangaDeskBridge.startExport({...input, projectRevision: revision})
        setJob(result.jobId);
        setProgress({stage: 'validating', completed: 0, total: report.assetCount})
    }
    useEffect(() => mangaDeskBridge.onExportProgress(event => {
        if (event.jobId === job) setProgress(event)
    }), [job])
    useEffect(() => {
        if (progress.stage !== 'succeeded' || !progress.output || !job || !baseline || !onRecordDelivery) return
        if (recordedJob.current === job) return
        recordedJob.current = job
        onRecordDelivery({id: createId(), createdAt: Date.now(), revision: baseline.revision, output: progress.output, options: baseline.options, blocks: baseline.blocks})
    }, [progress.stage, progress.output, job, baseline, onRecordDelivery])
    const running = ['validating', 'rendering', 'writingDocuments', 'finalizing'].includes(progress.stage)
    const completed = progress.stage === 'succeeded'
    return <main className="min-h-0 flex-1 overflow-auto bg-background p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-5">
            <div className="flex items-center">
                <div><h1 className="text-xl font-bold">导出素材包</h1><p
                    className="mt-1 text-sm text-slate-400">导出固定快照；之后的修改不会混入本次产物。</p></div>
                <Button className="ml-auto" variant="ghost" disabled={running} onClick={onClose}><X className="h-4 w-4"/>返回</Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">素材包名称<input
                value={packageName} disabled={running || completed} onChange={event => {
                setPackageName(event.target.value);
                setPreflight(null)
            }} className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2"/></label>
                <div className="text-sm">目标父目录
                    <div className="mt-1 flex gap-2"><input value={destination?.path || ''} readOnly
                                                            placeholder="请选择目录"
                                                            className="h-9 min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2"/><Button
                        disabled={running || completed} variant="secondary" onClick={chooseDirectory}><FolderOpen
                        className="h-4 w-4"/>选择</Button></div>
                </div>
                <label className="text-sm">图片格式<select value={options.format} disabled={running || completed}
                                                           onChange={event => setOptions(value => ({
                                                               ...value,
                                                               format: event.target.value
                                                           }))}
                                                           className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2">
                    <option value="jpeg">JPEG</option>
                    <option value="png">PNG</option>
                </select></label><label className="text-sm">限制最长边（可选）<input type="number" min="1"
                                                                                   value={options.maxEdge}
                                                                                   disabled={running || completed}
                                                                                   onChange={event => setOptions(value => ({
                                                                                       ...value,
                                                                                       maxEdge: event.target.value
                                                                                   }))}
                                                                                   className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2"/></label>
                {options.format === 'jpeg' && <label className="text-sm">JPEG 质量<input type="number" min="1" max="100"
                                                                                         value={options.jpegQuality}
                                                                                         disabled={running || completed}
                                                                                         onChange={event => setOptions(value => ({
                                                                                             ...value,
                                                                                             jpegQuality: Number(event.target.value)
                                                                                         }))}
                                                                                         className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2"/></label>}<label
                    className="text-sm">PDF DPI<select value={options.pdfDpi} disabled={running || completed}
                                                       onChange={event => setOptions(value => ({
                                                           ...value,
                                                           pdfDpi: Number(event.target.value)
                                                       }))}
                                                       className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2">
                    <option value="150">150</option>
                    <option value="200">200</option>
                    <option value="300">300</option>
                </select></label>
                <section className="md:col-span-2 rounded border border-slate-700 bg-slate-900/40 p-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm"><b>统一横版底图</b><p
                            className="mt-0.5 text-xs text-slate-400">每张漫画画面将按比例居中放入同一画布，避免 PDF
                            裁切尺寸不一致。</p></div>
                        <label className="ml-auto text-xs">画布<select
                            value={`${options.canvasWidth}x${options.canvasHeight}`} disabled={running || completed}
                            onChange={event => {
                                const [canvasWidth, canvasHeight] = event.target.value.split('x').map(Number);
                                setOptions(value => ({...value, canvasWidth, canvasHeight}))
                            }} className="ml-2 h-8 rounded border border-slate-600 bg-slate-950 px-2">
                            <option value="1280x720">1280 × 720</option>
                            <option value="1920x1080">1920 × 1080</option>
                            <option value="2560x1440">2560 × 1440</option>
                            <option value="3840x2160">3840 × 2160</option>
                        </select></label></div>
                    <div className="mt-3 flex flex-wrap items-center gap-2"><span
                        className="text-xs text-slate-400">底图颜色</span>{['#F4EBD9', '#EEE7D8', '#E8EDF0', '#FFFFFF', '#242424'].map(color =>
                        <button key={color} type="button" aria-label={`使用 ${color} 底色`}
                                disabled={running || completed}
                                onClick={() => setOptions(value => ({...value, backgroundColor: color}))}
                                className={`h-7 w-7 rounded-full border-2 ${options.backgroundColor === color ? 'border-orange-400' : 'border-slate-500'}`}
                                style={{backgroundColor: color}}/>)}<input aria-label="自定义底图颜色" type="color"
                                                                           value={options.backgroundColor}
                                                                           disabled={running || completed}
                                                                           onChange={event => setOptions(value => ({
                                                                               ...value,
                                                                               backgroundColor: event.target.value.toUpperCase()
                                                                           }))}
                                                                           className="h-8 w-10 cursor-pointer rounded border border-slate-600 bg-transparent p-0"/><code
                        className="text-xs text-slate-400">{options.backgroundColor}</code>
                        <div className="ml-auto h-20 w-36 overflow-hidden rounded border border-slate-600 p-2"
                             style={{backgroundColor: options.backgroundColor}}>
                            <div className="h-full w-full bg-white shadow-md">
                                <div
                                    className="h-full w-1/2 border-r border-slate-300 bg-gradient-to-br from-slate-100 to-slate-500"/>
                            </div>
                        </div>
                    </div>
                    <label className="mt-3 block text-sm">水印文本（可选）<input
                        value={options.watermarkText || ''} maxLength={100} disabled={running || completed}
                        placeholder="输入自定义文字，留空不添加水印"
                        onChange={event => {
                            setOptions(value => ({...value, watermarkText: event.target.value}))
                            setPreflight(null)
                        }}
                        className="mt-1 h-9 w-full rounded border border-slate-600 bg-slate-950 px-2"/>
                    </label>
                    <p className="mt-1 text-xs text-slate-400">水印以淡色斜向平铺，仅显示在图片周围的底图区域；图片铺满画布时不会显示水印。最多 100 字。</p>
                </section>
            </div>
            <section className="mt-4 rounded border border-slate-700 bg-slate-900/40 p-3"><div className="flex flex-wrap items-center gap-2"><b className="text-sm">导出预设</b><select className="h-8 rounded border border-slate-600 bg-slate-950 px-2 text-xs" defaultValue="" onChange={event => { const preset = project.exportPresets?.find(item => item.id === event.target.value); if (preset) setOptions(value => ({...value, ...preset.options})) }}><option value="">选择预设…</option>{(project.exportPresets || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={presetName} onChange={event => setPresetName(event.target.value)} placeholder="预设名称" className="h-8 w-28 rounded border border-slate-600 bg-slate-950 px-2 text-xs"/><Button size="sm" variant="secondary" onClick={() => { onSavePreset(presetName, options); setPresetName('') }}><Save className="h-3.5 w-3.5"/>保存</Button>{(project.exportPresets || []).length > 0 && <Button size="sm" variant="ghost" className="text-slate-400" onClick={() => { const item = project.exportPresets.at(-1); if (item) onRemovePreset(item.id) }}><Trash2 className="h-3.5 w-3.5"/>删除最近</Button>}</div><p className="mt-2 text-xs text-slate-400">预设只保存导出参数，不保存素材或输出目录。</p></section>
            {(project.deliveries || []).length > 0 && <section className="mt-4 rounded border border-slate-700 bg-slate-900/40 p-3"><b className="text-sm">交付版本对比</b><div className="mt-2 flex items-center gap-2"><select value={baselineId} onChange={event => setBaselineId(event.target.value)} className="h-8 rounded border border-slate-600 bg-slate-950 px-2 text-xs"><option value="">选择已交付版本…</option>{project.deliveries.map(item => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · r{item.revision}</option>)}</select>{baselineId && <DeliveryDiff delivery={project.deliveries.find(item => item.id === baselineId)} project={project}/>}</div></section>}
            {!completed && <div className="mt-5 flex gap-2"><Button variant="secondary" disabled={running}
                                                                    onClick={runPreflight}>预检</Button><Button
                disabled={running} onClick={start}><Play className="h-4 w-4"/>开始导出</Button>{running &&
                <Button variant="ghost" className="text-red-300"
                        onClick={() => mangaDeskBridge.cancelExport(job)}>取消</Button>}</div>}
            {preflight &&
                <section className="mt-5 rounded border border-slate-700 p-3 text-sm"><b>预检：{preflight.blockCount} 个
                    Block，{preflight.assetCount} 项素材</b>{preflight.imageCount > 0 || preflight.videoCount > 0 ?
                    <span className="ml-2 text-slate-400">（图片 {preflight.imageCount} · 视频
                        {preflight.videoCount}）</span> : null}{preflight.videoCount > 0 && <p className="mt-1 text-xs text-amber-200">视频片段将按各自选区重新编码为
                        MP4/H.264；静音或保留原声遵循每个素材的交付策略，原文件不会被修改。</p>}
                    {preflight.errors.length > 0 &&
                    <ul className="mt-2 list-inside list-disc text-red-300">{preflight.errors.map((item, index) => <li
                        key={index}>{item.message}</li>)}</ul>}{preflight.warnings.length > 0 && <>
                    <ul className="mt-2 list-inside list-disc text-amber-300">{preflight.warnings.map((item, index) =>
                        <li key={index}>{item.message}</li>)}</ul>
                    <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox"
                                                                                   checked={confirmedWarnings}
                                                                                   onChange={event => setConfirmedWarnings(event.target.checked)}/>我了解警告，仍继续导出</label></>}
                </section>}
            {job && <section className="mt-5 rounded border border-slate-700 p-3 text-sm">
                <b>状态：{progress.stage}</b>{progress.total > 0 &&
                <p className="mt-1 text-slate-400">已处理 {progress.completed}/{progress.total} 项素材</p>}{progress.error &&
                <p className="mt-1 text-red-300">{progress.error}</p>}{completed &&
                <div className="mt-3 flex gap-2"><Button size="sm"
                                                         onClick={() => mangaDeskBridge.openExportDirectory(job)}>打开文件夹</Button><Button
                    size="sm" variant="secondary"
                    onClick={() => mangaDeskBridge.openExportStoryboard(job)}>打开故事板</Button></div>}</section>}
            <p className="mt-5 text-xs text-slate-500">导出 project.json 是含来源路径的追溯快照；仅分享审稿时请分享
                storyboard.html 与 images 目录。</p>
            <p className="mt-2 text-xs text-slate-500">subtitles.srt
                可导入剪映；它按阅读速度预估时间，完成配音后请以实际音频为准微调。</p>
            {project.narration?.mode === 'voice' &&
                <p className="mt-2 text-xs text-amber-200">语音模式将导出 audio/narration.wav 和 audio/timing.json，不生成
                    SRT；请在剪映导入 narration.wav 后使用“识别字幕”。</p>}
        </div>
    </main>
}

function DeliveryDiff({delivery, project}) {
    const prior = new Map(delivery?.blocks?.map(block => [block.id, block.fingerprint]))
    const changed = project.blocks.filter(block => prior.get(block.id) !== fingerprint(block)).length
    const removed = [...prior.keys()].filter(id => !project.blocks.some(block => block.id === id)).length
    return <span className="text-xs text-amber-200">当前变化 {changed} 段 · 已移除 {removed} 段；差异包会保留为后续增强，当前仍建议全量导出。</span>
}
