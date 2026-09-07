import {useEffect, useRef, useState} from 'react'
import {Button} from '../../../components/ui/button'
import {mangaDeskBridge} from '../../../shared/bridge/mangaDeskBridge'
import {formatVideoTime, rangeMessage} from '../model/videoRange'

export function VideoWorkspace({project, block, commands, onImport, importing, importProgress, located}) {
  const sources = project.sources.filter(source => source.mediaType === 'video')
  const source = sources.find(item => item.id === project.workspace.currentVideoSourceId) || sources[0]
  return <section className="min-h-0 overflow-auto border-r border-slate-700 p-3">
    <div className="mb-3 flex items-center gap-2"><b>动漫选段</b><Button size="sm" className="ml-auto" disabled={importing} onClick={onImport}>{importing ? importProgress || '正在导入…' : '添加视频'}</Button></div>
    {!source ? <p className="text-sm text-slate-400">添加一集视频，播放并标记 I/O，再加入当前文案段。</p> : <>
      <select aria-label="视频来源" className="mb-3 w-full rounded bg-slate-900 p-2 text-xs" value={source.id} onChange={event => commands.setVideoWorkspace({currentVideoSourceId: event.target.value})}>
        {sources.map(item => <option key={item.id} value={item.id}>{item.fileName}{item.preview?.reason ? ' · 暂不支持' : ''}</option>)}
      </select>
      <VideoSelection key={`${project.id}:${source.id}:${block.id}`} project={project} source={source} block={block} commands={commands} located={located}/>
    </>}
    <p className="mt-4 text-xs leading-5 text-slate-500">O 是不包含该时刻的结束边界；I/O 会吸附到实际帧边界（VFR 按真实帧表，不用平均帧率估算）。视频导出尚未开放。切换剧集或文案段会清除未提交选区。</p>
  </section>
}

function VideoSelection({project, source, block, commands, located}) {
  const player = useRef(null), previewEnd = useRef(null), draft = useRef(null), snapped = useRef({in: false, out: false}), stepBusy = useRef(false)
  const [url, setUrl] = useState(''), [error, setError] = useState(''), [ready, setReady] = useState(false), [seeking, setSeeking] = useState(false)
  const [position, setPosition] = useState(project.workspace.videoPositions?.[source.id] || 0)
  const positionRef = useRef(position)
  const [start, setStart] = useState(null), [end, setEnd] = useState(null), [editing, setEditing] = useState(null)
  const [muted, setMuted] = useState(false), [keepAudio, setKeepAudio] = useState(false), [notice, setNotice] = useState('')
  const [recording, setRecording] = useState(Boolean(window.__studioRecording))
  const [locatePreview, setLocatePreview] = useState(false)
  const consumedLocate = useRef(null)
  const message = rangeMessage(start, end, source.durationUs)
  const valid = !message && ready && !seeking && !recording && !error
  const committable = valid && !locatePreview
  draft.current = {start, end}
  const persist = () => commands.setVideoWorkspace({sourceId: source.id, positionUs: positionRef.current})
  useEffect(() => {
    let active = true
    mangaDeskBridge.video.playback({projectId: project.id, sourceId: source.id}).then(result => { if (active) setUrl(result.url) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [project.id, source.id])
  useEffect(() => {
    const timer = setInterval(persist, 3000)
    const onRecording = event => {
      setRecording(event.detail)
      if (event.detail && player.current) { player.current.pause(); player.current.muted = true; previewEnd.current = null }
    }
    window.addEventListener('studio:recording', onRecording)
    return () => { clearInterval(timer); persist(); window.removeEventListener('studio:recording', onRecording) }
  }, [source.id])
  useEffect(() => {
    if (!located || located.asset.sourceId !== source.id || !ready || consumedLocate.current === located.requestId) return
    if (!block.assets.some(asset => asset.id === located.asset.id)) return
    consumedLocate.current = located.requestId
    setStart(located.asset.startUs); setEnd(located.asset.endUs); setEditing(null); setLocatePreview(true)
    snapped.current = {in: located.asset.selectionBasis === 'frame', out: located.asset.selectionBasis === 'frame'}
    setKeepAudio(located.asset.audio?.mode === 'keep')
    setNotice('已定位原片段；调整范围请先点击“调整此片段”')
    seek(located.asset.startUs)
  }, [located, ready, block.assets])
  useEffect(() => {
    if (editing && !block.assets.some(asset => asset.id === editing)) { setEditing(null); clear() }
    if (locatePreview && !block.assets.some(asset => asset.id === located?.asset.id)) clear()
  }, [block.assets, editing, locatePreview, located])
  const clear = () => { setStart(null); setEnd(null); previewEnd.current = null; setLocatePreview(false); snapped.current = {in: false, out: false} }
  const seek = timeUs => {
    const video = player.current
    if (!video || !ready) return
    video.pause()
    const target = Math.max(0, Math.min(source.durationUs, timeUs)) / 1000000
    if (Math.abs(video.currentTime - target) > 0.000001) { setSeeking(true); video.currentTime = target }
  }
  // 读取真实帧时间吸附边界；ffprobe 不可用时返回 null，由调用方按时间降级。
  const snap = async (timeUs, direction) => {
    try { return await mangaDeskBridge.video.resolveBoundary({projectId: project.id, sourceId: source.id, timeUs, direction}) } catch { return null }
  }
  const mark = edge => {
    if (!ready || seeking || error || recording || player.current?.seeking) return
    setLocatePreview(false)
    const raw = Math.min(source.durationUs, Math.max(0, Math.round(player.current.currentTime * 1000000)))
    setNotice('')
    void snap(raw, edge === 'in' ? 'frame-start' : 'frame-end').then(result => {
      const value = result?.snappedUs != null ? result.snappedUs : raw
      if (edge === 'in') setStart(value); else setEnd(value)
      snapped.current[edge] = Boolean(result)
      if (result && value !== raw) setNotice(`${edge === 'in' ? 'I' : 'O'} 已吸附到帧边界`)
    })
  }
  const step = delta => {
    const video = player.current
    if (!video || !ready || recording || error || video.seeking || stepBusy.current) return
    video.pause()
    stepBusy.current = true
    const raw = positionRef.current
    void snap(raw, delta > 0 ? 'next-frame' : 'prev-frame').finally(() => { stepBusy.current = false }).then(result => {
      if (result?.snappedUs != null) { previewEnd.current = null; seek(result.snappedUs) }
      else if (!result) seek(raw + delta * 100000)
    })
  }
  const play = async () => {
    if (!ready || recording || error) return
    try { await player.current.play() } catch (reason) { setError(`无法播放：${reason.message}`) }
  }
  const commit = () => {
    if (!committable || player.current?.seeking || draft.current.start == null || draft.current.end == null) return
    if (editing) {
      commands.updateVideoRange({blockId: block.id, assetId: editing, startUs: start, endUs: end})
      setNotice('片段范围已保存，可撤销'); setEditing(null)
    } else {
      commands.addMediaAsset({blockId: block.id, asset: {type: 'video', sourceId: source.id, startUs: start, endUs: end,
        videoStreamIndex: source.video.streamIndex, selectionBasis: snapped.current.in && snapped.current.out ? 'frame' : 'time', audio: {mode: keepAudio ? 'keep' : 'mute', streamIndex: keepAudio ? source.audioStreams[0]?.index : null}}})
      setNotice(`已加入 #${String(block.order + 1).padStart(3, '0')}，第 ${block.assets.length + 1} 项，${((end - start) / 1000000).toFixed(3)} 秒`)
    }
    draft.current = {start: null, end: null}; clear()
  }
  const keyDown = event => {
    if (event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return
    const key = event.key.toLowerCase()
    if (![' ', 'i', 'o', 'enter', 'escape', 'arrowleft', 'arrowright', 'j', 'k', 'l'].includes(key)) return
    event.preventDefault(); event.stopPropagation()
    if (key === 'i') mark('in')
    if (key === 'o') mark('out')
    if (key === 'enter') commit()
    if (key === 'escape') { clear(); setEditing(null) }
    if (key === 'k') player.current?.pause()
    if (key === 'l') void play()
    if (key === ' ') { if (player.current?.paused) void play(); else player.current?.pause() }
    if (['arrowleft', 'arrowright'].includes(key)) {
      if (event.shiftKey) seek(positionRef.current + (key === 'arrowright' ? 1 : -1) * 5000000)
      else step(key === 'arrowright' ? 1 : -1)
    }
    if (key === 'j') seek(positionRef.current - 5000000)
  }
  const usage = project.blocks.flatMap(item => item.assets.filter(asset => asset.type === 'video' && asset.sourceId === source.id).map(asset => ({asset, block: item})))
  return <div tabIndex={0} onKeyDown={keyDown} className="rounded outline-none focus:ring-1 focus:ring-orange-400" aria-label="视频播放器，I 标记起点，O 标记终点，Enter 绑定">
    <p className="mb-2 text-xs text-orange-300">绑定目标：#{String(block.order + 1).padStart(3, '0')} · {editing ? '调整片段' : locatePreview ? '已定位，先调整' : '新增片段'}</p>
    {url && <video ref={player} src={url} preload="metadata" muted={recording || muted} className="aspect-video w-full rounded bg-black" onClick={event => event.currentTarget.parentElement.focus()}
      onLoadedData={() => {
        const video = player.current
        if (!Number.isFinite(video.duration) || Math.abs(video.duration * 1000000 - source.durationUs) > 100000) { setError('播放器与探测时长不一致，暂不能安全选段'); return }
        setReady(true)
        if (positionRef.current > 0) { setSeeking(true); video.currentTime = Math.min(positionRef.current, source.durationUs) / 1000000 }
      }}
      onSeeking={() => setSeeking(true)} onSeeked={() => setSeeking(false)}
      onTimeUpdate={() => {
        const video = player.current, timeUs = Math.round(video.currentTime * 1000000)
        positionRef.current = timeUs; setPosition(timeUs)
        if (previewEnd.current != null && timeUs >= previewEnd.current) { video.pause(); previewEnd.current = null }
      }}
      onPause={persist} onPlay={() => { if (recording) player.current.pause() }}
      onError={() => { setReady(false); setError('此构建无法播放该视频，需要兼容预览副本（尚未开放）') }}/>} 
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    <p className="mt-2 font-mono text-xs">{formatVideoTime(position)} / {formatVideoTime(source.durationUs)} {seeking ? '定位中…' : ready ? '可直接预览' : '未就绪'}</p>
    <input aria-label="视频播放位置" type="range" min="0" max={source.durationUs} step="1000" value={position} disabled={!ready || recording} className="mt-2 w-full" onChange={event => { previewEnd.current = null; seek(Number(event.target.value)) }}/>
    <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={!ready || recording || !!error} onClick={() => player.current.paused ? play() : player.current.pause()}>播放 / 暂停</Button>
      <Button size="sm" variant="secondary" disabled={!ready || seeking || recording || !!error} onClick={() => mark('in')}>标记 I</Button><Button size="sm" variant="secondary" disabled={!ready || seeking || recording || !!error} onClick={() => mark('out')}>标记 O</Button></div>
    <div className="mt-3 space-y-1 text-xs"><p>I：{formatVideoTime(start)}</p><p>O：{formatVideoTime(end)}</p><p>{message || `时长：${((end - start) / 1000000).toFixed(3)} 秒`}</p></div>
    <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={!valid} onClick={() => {
      seek(start); previewEnd.current = end
      const video = player.current
      if (video.seeking) video.addEventListener('seeked', () => { if (previewEnd.current === end) void play() }, {once: true}); else void play()
    }}>预览选区</Button><Button size="sm" disabled={!committable} onClick={commit}>{editing ? '保存范围' : '加入当前段'}</Button><Button size="sm" variant="ghost" onClick={() => { clear(); setEditing(null) }}>取消选区</Button></div>
    {located?.asset.sourceId === source.id && block.assets.some(asset => asset.id === located.asset.id) && !editing && <Button size="sm" className="mt-2" variant="secondary" onClick={() => {
      const asset = block.assets.find(item => item.id === located.asset.id)
      setEditing(asset.id); setStart(asset.startUs); setEnd(asset.endUs); setLocatePreview(false); seek(asset.startUs)
      snapped.current = {in: asset.selectionBasis === 'frame', out: asset.selectionBasis === 'frame'}
    }}>调整此片段</Button>}
    <div className="mt-3 space-y-2 text-xs"><label className="block"><input type="checkbox" checked={!muted} disabled={recording} onChange={event => setMuted(!event.target.checked)}/> 预览时听原声</label>
      <label className="block"><input type="checkbox" checked={keepAudio} disabled={!source.audioStreams.length || !!editing} onChange={event => setKeepAudio(event.target.checked)}/> 新片段交付保留原声（默认静音）</label>
      <p>{source.video.width} × {source.video.height} · {source.video.codec} · {source.audioStreams.length ? '原声音轨 1' : '无原声'}{source.subtitleStreams?.length ? ' · 内嵌字幕未处理' : ''}</p>
      {recording && <p className="text-rose-300">录音中，视频预览已暂停并静音</p>}
    </div>
    {notice && <p role="status" className="mt-3 text-xs text-emerald-300">{notice}</p>}
    <p className="mt-3 text-xs text-slate-500">播放器聚焦：Space 播放 · I/O 选段（自动吸附帧边界） · Enter 加入 · ←/→ 前一帧/后一帧 · Shift+←/→ 跳转 5 秒</p>
    {!!usage.length && <div className="mt-4 space-y-1"><h3 className="text-xs text-slate-400">本集已引用 {usage.length} 次</h3>{usage.map(({asset, block: item}) => <button key={`${item.id}:${asset.id}`} className="block text-left text-xs text-orange-300" onClick={() => { if (item.id !== block.id) commands.selectBlock(item.id); else seek(asset.startUs) }}>#{String(item.order + 1).padStart(3, '0')} · {formatVideoTime(asset.startUs)}–{formatVideoTime(asset.endUs)}</button>)}</div>}
  </div>
}
