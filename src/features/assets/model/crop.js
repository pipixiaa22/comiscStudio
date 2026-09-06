export function isValidCrop(crop) {
  if (crop == null) return true
  const values = ['x', 'y', 'width', 'height'].map(key => crop[key])
  return values.every(Number.isFinite) && crop.width > 0 && crop.height > 0 && crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001
}

export function cropKey(crop) {
  if (!crop) return 'page'
  return ['x', 'y', 'width', 'height'].map(key => Number(crop[key]).toFixed(6)).join(':')
}
