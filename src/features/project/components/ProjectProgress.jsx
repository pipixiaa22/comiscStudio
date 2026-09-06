const fields = [['scriptDone', '文案'], ['assetDone', '素材'], ['voiced', '配音'], ['edited', '剪辑'], ['effectDone', '特效']]
export function ProjectProgress({ blocks }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">{fields.map(([key, label]) => <span key={key}>{label} {blocks.filter(block => block.status?.[key]).length}/{blocks.length}</span>)}</div>
}
