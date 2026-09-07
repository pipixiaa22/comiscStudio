import {formatVideoTime} from '../model/videoRange'

export function VideoAssetSummary({asset, source}) {
  return <div className="rounded bg-slate-900 p-3 text-left text-xs text-slate-300">
    <b className="block truncate text-orange-300">视频 · {source?.fileName || '来源不可用'}</b>
    <span className="mt-2 block font-mono">{formatVideoTime(asset.startUs)} → {formatVideoTime(asset.endUs)}</span>
    <span className="mt-1 block">{((asset.endUs - asset.startUs) / 1000000).toFixed(3)} 秒 · 交付：{asset.audio?.mode === 'keep' ? '保留原声' : '静音'}</span>
  </div>
}
