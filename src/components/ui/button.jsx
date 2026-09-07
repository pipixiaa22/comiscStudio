import {cva} from 'class-variance-authority'
import {cn} from '../../lib/utils'

const variants = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:pointer-events-none disabled:opacity-50', {
    variants: {
        variant: {
            default: 'bg-orange-400 text-slate-950 hover:bg-orange-300',
            secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600',
            ghost: 'hover:bg-slate-800 text-slate-300'
        }, size: {default: 'h-9 px-3', sm: 'h-8 px-2.5 text-xs', icon: 'h-9 w-9'}
    }, defaultVariants: {variant: 'default', size: 'default'}
})

export function Button({className, variant, size, ...props}) {
    return <button className={cn(variants({variant, size}), className)} {...props}/>
}
