// Geometry for the thumbnail grid.  Windowing needs an exact row height, so the
// card is built from fixed numbers instead of measured text metrics:
//   card = thumbnail box + label line + card padding + border
export const GRID_PADDING = 16
export const GRID_GAP = 12
export const LABEL_HEIGHT = 22
export const CARD_CHROME = LABEL_HEIGHT + 12 + 2

// A portrait page is roughly 0.72 as wide as it is tall; cards narrower than that
// would shrink the page below the requested thumbnail height.
const MIN_CARD_RATIO = 0.72

export const THUMB_SIZES = [
    {id: 's', label: '小', height: 120},
    {id: 'm', label: '中', height: 180},
    {id: 'l', label: '大', height: 260}
]

export function thumbHeightOf(id) {
    return (THUMB_SIZES.find(size => size.id === id) || THUMB_SIZES[1]).height
}

export function stepThumbSize(id, direction) {
    const index = THUMB_SIZES.findIndex(size => size.id === id)
    const next = Math.max(0, Math.min(THUMB_SIZES.length - 1, (index < 0 ? 1 : index) + direction))
    return THUMB_SIZES[next].id
}

export function gridWindow({viewWidth, viewHeight, scrollTop, count, thumbHeight, overscan = 3}) {
    const inner = Math.max(1, viewWidth - GRID_PADDING * 2)
    const minimumCard = Math.round(thumbHeight * MIN_CARD_RATIO)
    const columns = Math.max(1, Math.floor((inner + GRID_GAP) / (minimumCard + GRID_GAP)))
    const cardHeight = thumbHeight + CARD_CHROME
    const rowStride = cardHeight + GRID_GAP
    const rowCount = Math.ceil(count / columns)
    const firstRow = Math.max(0, Math.floor((scrollTop - GRID_PADDING) / rowStride) - overscan)
    const lastRow = Math.min(rowCount, Math.ceil((scrollTop + viewHeight - GRID_PADDING) / rowStride) + overscan)
    const firstIndex = Math.min(count, firstRow * columns)
    const lastIndex = Math.min(count, lastRow * columns)
    return {
        inner,
        columns,
        cardHeight,
        rowStride,
        rowCount,
        firstIndex,
        lastIndex,
        // Spacers keep the scroll height correct while only a window is mounted.
        topPadding: GRID_PADDING + firstRow * rowStride,
        bottomPadding: GRID_PADDING + Math.max(0, rowCount - lastRow) * rowStride
    }
}

// The rail above the grid shows one page large; it grows with the panel so a wide
// browser doubles as a quick review surface.
export function previewHeightFor(viewWidth) {
    return Math.round(Math.min(Math.max(viewWidth * 0.9, 220), 460))
}

// PDF pages are rasterized at this scale, so a thumbnail stays sharp at any size
// without rasterizing at full resolution.
export function thumbnailRenderScale(thumbHeight, devicePixelRatio = 1) {
    const base = Math.max(0.12, Math.min(0.6, thumbHeight / 900))
    return Number((base * Math.max(1, Math.min(2, devicePixelRatio))).toFixed(3))
}
