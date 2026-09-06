import { PageMedia } from '../../reader/components/PageMedia'

export function SourcePreview({ source, crop, className = 'h-24 w-full' }) {
  if (!source) return <div className={`${className} grid place-items-center bg-slate-900 text-xs text-red-300`}>来源不可用</div>
  if (!crop) return <PageMedia item={source} scale={0.22} className={`${className} object-contain`} />
  const style = { width: `${100 / crop.width}%`, height: `${100 / crop.height}%`, maxWidth: 'none', transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`, transformOrigin: 'top left' }
  return <div className={`${className} overflow-hidden bg-black`}><PageMedia item={source} scale={0.35} className="block" style={style} /></div>
}
