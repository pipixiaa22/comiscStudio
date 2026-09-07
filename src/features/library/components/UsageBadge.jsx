import {Button} from '../../../components/ui/button'
import {pageNumber} from '../../../shared/lib/pageNumber'

export function UsageBadge({usage, blocks, onSelectReference}) {
    if (!usage?.count) return null
    const grouped = [...usage.references.reduce((map, reference) => {
        const entry = map.get(reference.blockId) || {...reference, count: 0};
        entry.count += 1;
        map.set(reference.blockId, entry);
        return map
    }, new Map()).values()]
    return <details className="relative">
        <summary className="cursor-pointer list-none rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] text-white"
                 onClick={event => event.stopPropagation()}>●{usage.count > 1 ? usage.count : ''}</summary>
        <div
            className="absolute right-0 z-20 mt-1 w-40 rounded border border-slate-600 bg-slate-950 p-1 shadow-xl">{grouped.map(reference => {
            const index = blocks.findIndex(block => block.id === reference.blockId);
            return <Button key={reference.blockId} size="sm" variant="ghost"
                           className="h-7 w-full justify-start text-xs" onClick={event => {
                event.stopPropagation();
                onSelectReference(reference)
            }}>#{pageNumber(index)} · {reference.count} 次</Button>
        })}</div>
    </details>
}
