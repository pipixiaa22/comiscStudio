// The extension is explicit so the pure geometry can also be loaded by Node's
// ESM resolver in tests/cropDrag.test.cjs; Vite resolves either form.
import {normalizeCrop} from './crop.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// Corners first, then edge midpoints: the same list drives the rendered handles
// and the resize branch, so the two can never drift apart.
export const CROP_HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']

export const CROP_CURSORS = {
    nw: 'nwse-resize',
    se: 'nwse-resize',
    ne: 'nesw-resize',
    sw: 'nesw-resize',
    n: 'ns-resize',
    s: 'ns-resize',
    w: 'ew-resize',
    e: 'ew-resize'
}

export const CROP_HANDLE_POSITIONS = {
    nw: {left: '0%', top: '0%'},
    n: {left: '50%', top: '0%'},
    ne: {left: '100%', top: '0%'},
    w: {left: '0%', top: '50%'},
    e: {left: '100%', top: '50%'},
    sw: {left: '0%', top: '100%'},
    s: {left: '50%', top: '100%'},
    se: {left: '100%', top: '100%'}
}

// Drawing a brand-new selection from two normalized points.
export function cropFromDrag(start, point) {
    return normalizeCrop({
        x: Math.min(start.x, point.x),
        y: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y)
    })
}

// Sliding the whole selection; it stops at the image edges instead of leaving them.
export function moveCrop(origin, delta) {
    return normalizeCrop({
        x: clamp(origin.x + delta.x, 0, Math.max(0, 1 - origin.width)),
        y: clamp(origin.y + delta.y, 0, Math.max(0, 1 - origin.height)),
        width: origin.width,
        height: origin.height
    })
}

// Dragging one handle. The opposite edge stays anchored, so a selection can be
// shrunk and grown again freely; it never inverts, it just stops at `minimum`.
export function resizeCrop(origin, handle, point, minimum) {
    // An existing selection smaller than the floor keeps its size instead of
    // being forced to grow as soon as it is touched.
    const minWidth = Math.min(minimum.width, origin.width)
    const minHeight = Math.min(minimum.height, origin.height)
    let left = origin.x
    let top = origin.y
    let right = origin.x + origin.width
    let bottom = origin.y + origin.height
    if (handle.includes('w')) left = clamp(point.x, 0, right - minWidth)
    if (handle.includes('e')) right = clamp(point.x, left + minWidth, 1)
    if (handle.includes('n')) top = clamp(point.y, 0, bottom - minHeight)
    if (handle.includes('s')) bottom = clamp(point.y, top + minHeight, 1)
    return normalizeCrop({x: left, y: top, width: right - left, height: bottom - top})
}
