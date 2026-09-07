export function isValidCrop(crop) {
    if (crop == null) return true
    const values = ['x', 'y', 'width', 'height'].map(key => crop[key])
    return values.every(Number.isFinite) && crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001
}

export function normalizeCrop(crop) {
    if (!crop) return undefined
    const x = Math.max(0, Math.min(1, crop.x))
    const y = Math.max(0, Math.min(1, crop.y))
    const width = Math.max(0, Math.min(1 - x, crop.width))
    const height = Math.max(0, Math.min(1 - y, crop.height))
    const round = value => Math.round(value * 1e6) / 1e6
    return {x: round(x), y: round(y), width: round(width), height: round(height)}
}

export function isUsableCrop(crop, width, height) {
    return isValidCrop(crop) && crop.width * width >= 8 && crop.height * height >= 8
}

export function cropKey(crop) {
    if (!crop) return 'page'
    return ['x', 'y', 'width', 'height'].map(key => Number(crop[key]).toFixed(6)).join(':')
}
