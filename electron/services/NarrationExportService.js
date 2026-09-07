const fs = require('fs/promises')
const path = require('path')

const sampleRate = 48000
const bytesPerSecond = sampleRate * 2
const wavHeader = dataSize => { const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(36 + dataSize, 4); header.write('WAVE', 8); header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(bytesPerSecond, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(dataSize, 40); return header }
function takePath(projectRoot, relativePath) { const file = path.resolve(projectRoot, relativePath || ''); if (!file.startsWith(path.join(projectRoot, 'audio') + path.sep) || path.extname(file) !== '.wav') throw new Error('Invalid narration take path'); return file }
async function readTake(projectRoot, take, voice) {
  const data = await fs.readFile(takePath(projectRoot, take.relativePath)); if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE' || data.readUInt32LE(24) !== sampleRate || data.readUInt16LE(22) !== 1 || data.readUInt16LE(34) !== 16) throw new Error('Narration take is not a valid 48 kHz mono WAV')
  const maxMs = Math.floor((data.length - 44) / bytesPerSecond * 1000), startMs = Math.max(0, Number(voice.trimStartMs) || 0), endMs = voice.trimEndMs == null ? maxMs : Number(voice.trimEndMs)
  if (!Number.isFinite(endMs) || endMs - startMs < 200 || endMs > maxMs) throw new Error('Narration take trim is invalid')
  const start = 44 + Math.floor(startMs / 1000 * bytesPerSecond / 2) * 2, end = 44 + Math.floor(endMs / 1000 * bytesPerSecond / 2) * 2
  return { pcm: data.subarray(start, end), durationMs: Math.round((end - start) / bytesPerSecond * 1000), takeId: take.id }
}
async function validateNarration(project, projectRoot) {
  const errors = []
  for (const block of project.blocks) { const voice = block.voice || {}; if (voice.narrationRequired === false) continue; const take = (voice.takes || []).find(item => item.id === voice.activeTakeId); if (!take) { errors.push({ code: 'MISSING_NARRATION', blockId: block.id, message: `Block ${block.order + 1} requires a narration take` }); continue } try { await readTake(projectRoot, take, voice) } catch (error) { errors.push({ code: 'INVALID_NARRATION', blockId: block.id, message: `Block ${block.order + 1}: ${error.message}` }) } }
  return errors
}
async function writeNarration(root, plan, projectRoot) {
  const chunks = [], blocks = []; let offset = 0
  for (const entry of plan.entries) {
    const voice = entry.block.voice || {}, take = (voice.takes || []).find(item => item.id === voice.activeTakeId), startMs = offset
    let rendered = null
    if (voice.narrationRequired !== false) rendered = await readTake(projectRoot, take, voice)
    if (rendered) { chunks.push(rendered.pcm); offset += rendered.durationMs }
    const endMs = offset, gapAfterMs = entry.position === plan.entries.length ? 0 : Math.max(0, Number(voice.gapAfterMs ?? plan.project.narration?.defaultGapAfterMs ?? 300) || 0)
    if (gapAfterMs) { chunks.push(Buffer.alloc(Math.round(gapAfterMs / 1000 * bytesPerSecond))); offset += gapAfterMs }
    blocks.push({ blockId: entry.block.id, position: entry.position, startMs, endMs, gapAfterMs, takeId: rendered?.takeId || null, silent: !rendered })
  }
  const pcm = Buffer.concat(chunks); await fs.mkdir(path.join(root, 'audio'), { recursive: true }); await fs.writeFile(path.join(root, 'audio', 'narration.wav'), Buffer.concat([wavHeader(pcm.length), pcm])); await fs.writeFile(path.join(root, 'audio', 'timing.json'), JSON.stringify({ version: 1, sampleRate, durationMs: offset, blocks }, null, 2), 'utf8')
  return { file: 'audio/narration.wav', timingFile: 'audio/timing.json', durationMs: offset, blocks }
}
module.exports = { validateNarration, writeNarration }
