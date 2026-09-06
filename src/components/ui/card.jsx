import { cn } from '../../lib/utils'
export function Card({className,...props}){return <section className={cn('rounded-xl border border-slate-700 bg-slate-800/80',className)} {...props}/>}
export function CardContent({className,...props}){return <div className={cn('p-4',className)} {...props}/>}
