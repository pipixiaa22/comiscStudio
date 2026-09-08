const fs = require('fs/promises')
const fss = require('fs')
const path = require('path')
const crypto = require('crypto')

const SAMPLE_RATE = 48000
const CHANNELS = 1
const BYTES_PER_SAMPLE = 2
function takeFile(root, relativePath) { const file = path.resolve(root, relativePath || ''); if (!file.startsWith(path.join(root, 'audio') + path.sep) || path.extname(file) !== '.wav') throw new Error('Invalid take path'); return file }

function wavHeader(dataSize) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + dataSize, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(CHANNELS, 22)
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, 28); header.writeUInt16LE(CHANNELS * BYTES_PER_SAMPLE, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(dataSize, 40)
  return header
}

class VoiceRecordingService {
  constructor(projectService) { this.projectService = projectService; this.sessions = new Map() }
  root(projectId) { const root = path.resolve(this.projectService.root, projectId); if (!root.startsWith(path.resolve(this.projectService.root) + path.sep)) throw new Error('Invalid project'); return root }
  async verify(projectId, blockId) { const project = await this.projectService.load(projectId); if (!project.blocks.some(block => block.id === blockId)) throw new Error('Block does not belong to project'); return project }
  async start({ projectId, blockId, sampleRate = SAMPLE_RATE, channels = CHANNELS, deviceLabel }) {
    if (sampleRate !== SAMPLE_RATE || channels !== CHANNELS) throw new Error('Recording format must be 48 kHz mono PCM')
    await this.verify(projectId, blockId)
    const id = crypto.randomUUID(), root = this.root(projectId), recording = path.join(root, 'audio', 'recording'), file = path.join(recording, `${id}.pcm.part`)
    await fs.mkdir(recording, { recursive: true }); await fs.writeFile(file, Buffer.alloc(0)); await fs.writeFile(path.join(recording, `${id}.json`), JSON.stringify({ id, projectId, blockId, sampleRate, channels, deviceLabel, createdAt: Date.now() }), 'utf8')
    this.sessions.set(id, { id, projectId, blockId, file, sequence: 0, bytes: 0, deviceLabel, status: 'recording' })
    return { sessionId: id, sampleRate, channels }
  }
  async append({ sessionId, sequence, pcmBuffer }) {
    const session = this.sessions.get(sessionId)
    if (!session || !['recording', 'paused'].includes(session.status)) throw new Error('Recording session is unavailable')
    if (session.status === 'paused') throw new Error('Recording session is paused')
    if (!Number.isInteger(sequence) || sequence !== session.sequence) throw new Error('Recording chunk sequence is invalid')
    const chunk = Buffer.from(pcmBuffer)
    if (!chunk.length || chunk.length > SAMPLE_RATE * BYTES_PER_SAMPLE * 3 || chunk.length % 2) throw new Error('Recording chunk is invalid')
    if (session.bytes + chunk.length > 1024 * 1024 * 1024) throw new Error('Recording exceeds the 1 GB safety limit')
    await fs.appendFile(session.file, chunk); session.bytes += chunk.length; session.sequence += 1
    return { bytes: session.bytes }
  }
  pause(sessionId) { const session = this.sessions.get(sessionId); if (!session || session.status !== 'recording') throw new Error('Recording cannot be paused'); session.status = 'paused' }
  resume(sessionId) { const session = this.sessions.get(sessionId); if (!session || session.status !== 'paused') throw new Error('Recording cannot be resumed'); session.status = 'recording' }
  async finish(sessionId) {
    const session = this.sessions.get(sessionId); if (!session || !['recording', 'paused'].includes(session.status)) throw new Error('Recording cannot be finalized')
    session.status = 'finalizing'; const durationMs = Math.round(session.bytes / (SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE) * 1000)
    if (durationMs < 200) throw new Error('Recording must be at least 200 ms')
    const takeId = crypto.randomUUID(), root = this.root(session.projectId), directory = path.join(root, 'audio', 'takes', session.blockId), target = path.join(directory, `${takeId}.wav`), temporary = `${target}.tmp`
    await fs.mkdir(directory, { recursive: true }); await fs.writeFile(temporary, wavHeader(session.bytes)); await new Promise((resolve, reject) => fss.createReadStream(session.file).pipe(fss.createWriteStream(temporary, { flags: 'a' })).on('finish', resolve).on('error', reject)); await fs.rename(temporary, target)
    await fs.rm(session.file, { force: true }); await fs.rm(session.file.replace(/\.pcm\.part$/, '.json'), { force: true }); this.sessions.delete(sessionId)
    return { id: takeId, relativePath: path.posix.join('audio', 'takes', session.blockId, `${takeId}.wav`), format: 'wav', codec: 'pcm_s16le', channels: CHANNELS, sampleRate: SAMPLE_RATE, durationMs, fileSize: session.bytes + 44, createdAt: Date.now(), deviceLabel: session.deviceLabel, processing: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
  }
  async discard(sessionId) { const session = this.sessions.get(sessionId); if (session) { this.sessions.delete(sessionId); await fs.rm(session.file, { force: true }); await fs.rm(session.file.replace(/\.pcm\.part$/, '.json'), { force: true }); return true } for (const candidate of await fs.readdir(this.projectService.root, { withFileTypes: true })) { if (!candidate.isDirectory()) continue; const recording = path.join(this.root(candidate.name), 'audio', 'recording'); const meta = path.join(recording, `${sessionId}.json`); try { await fs.access(meta); await fs.rm(path.join(recording, `${sessionId}.pcm.part`), { force: true }); await fs.rm(meta, { force: true }); return true } catch {} } return false }
  async listRecoverable(projectId) { const recording = path.join(this.root(projectId), 'audio', 'recording'); const entries = await fs.readdir(recording).catch(() => []); const sessions = []; for (const entry of entries.filter(name => name.endsWith('.json'))) { try { const meta = JSON.parse(await fs.readFile(path.join(recording, entry), 'utf8')); const stat = await fs.stat(path.join(recording, `${meta.id}.pcm.part`)); if (meta.projectId === projectId && stat.size >= SAMPLE_RATE * 2 / 5) sessions.push({ ...meta, bytes: stat.size }) } catch {} } return sessions }
  async recover(sessionId) { const candidates = await fs.readdir(this.projectService.root, { withFileTypes: true }); for (const candidate of candidates.filter(item => item.isDirectory())) { const recording = path.join(this.root(candidate.name), 'audio', 'recording'); try { const meta = JSON.parse(await fs.readFile(path.join(recording, `${sessionId}.json`), 'utf8')); const stat = await fs.stat(path.join(recording, `${sessionId}.pcm.part`)); this.sessions.set(sessionId, { ...meta, file: path.join(recording, `${sessionId}.pcm.part`), sequence: 0, bytes: stat.size, status: 'paused' }); return this.finish(sessionId) } catch {} } throw new Error('Recoverable recording was not found') }
  async trashTake({ projectId, relativePath }) { const root = this.root(projectId), file = takeFile(root, relativePath), trashId = crypto.randomUUID(), target = path.join(root, 'audio', 'trash', `${trashId}.wav`); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.rename(file, target); return { trashId, relativePath } }
  async restoreTake({ projectId, trashId, relativePath }) { const root = this.root(projectId), source = path.join(root, 'audio', 'trash', `${trashId}.wav`), target = takeFile(root, relativePath); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.rename(source, target); return true }
  // Returns the validated take path for streaming playback, so a whole WAV is
  // never copied through IPC.
  resolveTake({ projectId, relativePath }) { const root = this.root(projectId), file = takeFile(root, relativePath); return file }
}
module.exports = { VoiceRecordingService, SAMPLE_RATE, CHANNELS }
