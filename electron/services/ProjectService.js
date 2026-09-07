const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const { normalizeProjectShape } = require('../../src/shared/domain/projectNormalize')

const now = () => Date.now()
const id = () => crypto.randomUUID()
function block(order = 0) { const time = now(); return { id: id(), order, text: '', assets: [], note: '', status: { scriptDone: false, assetDone: false, voiced: false, edited: false, effectDone: false }, voice: { activeTakeId: null, takes: [], trimStartMs: 0, trimEndMs: null, gapAfterMs: 300, narrationRequired: true }, createdAt: time, updatedAt: time } }
function normalize(project) {
  if (!project || typeof project !== 'object' || typeof project.id !== 'string' || !Array.isArray(project.blocks)) throw new Error('项目数据无效')
  return normalizeProjectShape(project, block, now())
}
class ProjectService {
  constructor(userData) { this.root = path.join(userData, 'projects'); this.recentFile = path.join(userData, 'recent-project.json'); this.queues = new Map() }
  file(id) { const root = path.resolve(this.root); const target = path.resolve(root, id, 'project.json'); if (!target.startsWith(root + path.sep)) throw new Error('非法项目路径'); return target }
  async create({ name, sourceDirectory, sources = [] }) { const time = now(); const cleanSources = sources.map(source => ({ id: id(), path: source.path, fileName: source.name, kind: source.kind, pdfPath: source.pdfPath, pageNumber: source.pageNumber })); const project = normalize({ schemaVersion: 2, id: id(), name, sourceDirectories: [sourceDirectory], sources: cleanSources, blocks: [block(0)], favorites: [], scratchBasket: [], workspace: {}, createdAt: time, updatedAt: time }); await this.save(project); return project }
  async save(raw) { const project = normalize(structuredClone(raw)); const job = async () => { const file = this.file(project.id); await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`, bak = `${file}.bak`; await fs.writeFile(tmp, JSON.stringify(project, null, 2), 'utf8'); try { await fs.copyFile(file, bak) } catch (error) { if (error.code !== 'ENOENT') throw error } await fs.rename(tmp, file); await fs.writeFile(this.recentFile, JSON.stringify({ id: project.id }), 'utf8'); return project }
    const queued = (this.queues.get(project.id) || Promise.resolve()).then(job); this.queues.set(project.id, queued.catch(() => {})); return queued
  }
  async load(id) { const file = this.file(id); try { return normalize(JSON.parse(await fs.readFile(file, 'utf8'))) } catch (error) { try { return normalize(JSON.parse(await fs.readFile(`${file}.bak`, 'utf8'))) } catch { throw error } } }
  async recent() { try { const { id } = JSON.parse(await fs.readFile(this.recentFile, 'utf8')); return await this.load(id) } catch { return null } }
}
module.exports = { ProjectService }
