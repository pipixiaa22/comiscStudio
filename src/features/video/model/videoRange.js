export function formatVideoTime(timeUs) {
  if (!Number.isSafeInteger(timeUs) || timeUs < 0) return '—'
  const ms = Math.floor(timeUs / 1000)
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}
export function rangeMessage(startUs, endUs, durationUs) {
  if (startUs == null || endUs == null) return '请先标记 I 和 O'
  if (![startUs, endUs, durationUs].every(Number.isSafeInteger) || startUs < 0 || endUs > durationUs) return '时间超出视频范围'
  if (endUs <= startUs) return 'O 必须晚于 I，请重新标记'
  return ''
}
