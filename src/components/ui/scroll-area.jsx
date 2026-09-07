import * as ScrollArea from '@radix-ui/react-scroll-area'
import {cn} from '../../lib/utils'

export function ScrollAreaBox({className, children}) {
    return <ScrollArea.Root className={cn('overflow-hidden', className)}><ScrollArea.Viewport
        className="h-full w-full rounded-[inherit]">{children}</ScrollArea.Viewport><ScrollArea.Scrollbar
        className="flex w-2 touch-none p-px" orientation="vertical"><ScrollArea.Thumb
        className="flex-1 rounded-full bg-slate-600"/></ScrollArea.Scrollbar></ScrollArea.Root>
}
