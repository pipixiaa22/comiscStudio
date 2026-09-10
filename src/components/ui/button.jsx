import {cva} from 'class-variance-authority'
import {cn} from '../../lib/utils'

const variants = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
    variants: {
        variant: {
            default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
            outline: 'border border-input bg-background hover:bg-accent',
            ghost: 'hover:bg-accent text-foreground',
            destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
        }, size: {default: 'h-10 px-3', sm: 'h-9 px-2.5 text-xs', icon: 'h-9 w-9'}
    }, defaultVariants: {variant: 'default', size: 'default'}
})

export function Button({className, variant, size, ...props}) {
    return <button className={cn(variants({variant, size}), className)} {...props}/>
}
