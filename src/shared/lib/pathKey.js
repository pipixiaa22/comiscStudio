export function pathKey(path) {
  return String(path || '').replace(/\\/g, '/').toLowerCase()
}
