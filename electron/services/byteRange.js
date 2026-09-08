// Shared HTTP-style range parsing for the custom protocols that stream project
// files (video playback, PDF paging, narration playback) without copying whole
// files through IPC.
function parseByteRange(header, size) {
  if (!header) return {start: 0, end: size - 1, partial: false}
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || (!match[1] && !match[2])) throw new Error('Invalid range')
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) throw new Error('Invalid range')
  return {start, end, partial: true}
}

module.exports = {parseByteRange}
