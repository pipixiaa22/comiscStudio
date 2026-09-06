import { Check, Image as ImageIcon } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent } from '../../../components/ui/card'
import { ScrollAreaBox } from '../../../components/ui/scroll-area'
import { pageNumber, textSummary } from '../../../shared/lib/pageNumber'

export function BlockEditor({ block, index, previous, next, onSelectBlock, onChangeText, onBlurText, onComplete }) {
  return <section className="flex min-h-0 flex-col border-r border-slate-700 bg-[#11151d]">
    <div className="flex h-14 items-center border-b border-slate-700 px-5"><ImageIcon className="mr-2 h-4 w-4 text-orange-300" /><b className="text-sm">Block 文案编辑器</b><span className="ml-auto text-xs text-slate-500">Ctrl + Enter 完成并新建</span></div>
    <ScrollAreaBox className="min-h-0 flex-1"><div className="mx-auto max-w-2xl space-y-3 p-5">
      {previous && <button onClick={() => onSelectBlock(previous.id)} className="w-full rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-left text-xs text-slate-500"><b>#{pageNumber(index - 1)} 上一段</b><p className="mt-1 line-clamp-2">{textSummary(previous.text)}</p></button>}
      <Card className="border-orange-400/40"><CardContent><div className="mb-3 flex items-center"><div><div className="text-xs font-bold text-orange-300">#{pageNumber(index)} CURRENT</div><h1 className="mt-1 text-lg font-bold">当前解说段落</h1></div><Button className="ml-auto" variant="secondary" size="sm" onClick={onComplete}><Check className="h-4 w-4" />完成</Button></div>
        <textarea autoFocus value={block.text} onChange={event => onChangeText(block.id, event.target.value)} onBlur={onBlurText} placeholder="在这里写这一段解说……" className="min-h-64 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-4 text-[15px] leading-7 outline-none focus:border-orange-400" />
        <div className="mt-3 flex text-xs text-slate-500"><span>{block.text.length} 字</span><span className="ml-auto">{block.status.scriptDone ? '文案已完成' : '编辑中'}</span></div>
      </CardContent></Card>
      {next && <button onClick={() => onSelectBlock(next.id)} className="w-full rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-left text-xs text-slate-500"><b>#{pageNumber(index + 1)} 下一段</b><p className="mt-1 line-clamp-2">{textSummary(next.text)}</p></button>}
    </div></ScrollAreaBox>
  </section>
}
