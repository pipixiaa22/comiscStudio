const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const {normalizeProjectShape} = require('../../src/shared/domain/projectNormalize')

const {prepareSourceAdditions} = require('../../src/shared/domain/mediaAsset')

const now = () => Date.now()
const id = () => crypto.randomUUID()

function block(order = 0) {
    const time = now();
    return {
        id: id(),
        order,
        text: '',
        assets: [],
        note: '',
        status: {scriptDone: false, assetDone: false, voiced: false, edited: false, effectDone: false},
        voice: {
            activeTakeId: null,
            takes: [],
            trimStartMs: 0,
            trimEndMs: null,
            gapAfterMs: 300,
            narrationRequired: true
        },
        createdAt: time,
        updatedAt: time
    }
}

function normalize(project) {
    if (!project || typeof project !== 'object' || typeof project.id !== 'string' || !Array.isArray(project.blocks)) throw new Error('项目数据无效')
    return normalizeProjectShape(project, block, now())
}

class ProjectService {
    constructor(userData) {
        this.root = path.join(userData, 'projects');
        this.recentFile = path.join(userData, 'recent-project.json');
        this.queues = new Map()
    }

    file(id) {
        const root = path.resolve(this.root);
        const target = path.resolve(root, id, 'project.json');
        if (!target.startsWith(root + path.sep)) throw new Error('非法项目路径');
        return target
    }

    async create({name, sourceDirectory, sources = []}) {
        const time = now();
        const cleanSources = prepareSourceAdditions([], sources, id);
        const project = normalize({
            schemaVersion: 3,
            id: id(),
            name,
            sourceDirectories: [sourceDirectory],
            sources: cleanSources,
            blocks: [block(0)],
            favorites: [],
            scratchBasket: [],
            workspace: {},
            createdAt: time,
            updatedAt: time
        });
        await this.save(project);
        return project
    }

    async save(raw) {
        const project = normalize(structuredClone(raw));
        const job = async () => {
            const file = this.file(project.id);
            await fs.mkdir(path.dirname(file), {recursive: true});
            const tmp = `${file}.tmp`, bak = `${file}.bak`;
            await fs.writeFile(tmp, JSON.stringify(project, null, 2), 'utf8');
            try {
                await fs.copyFile(file, bak)
            } catch (error) {
                if (error.code !== 'ENOENT') throw error
            }
            await fs.rename(tmp, file);
            await fs.writeFile(this.recentFile, JSON.stringify({id: project.id}), 'utf8');
            return project
        }
        const queued = (this.queues.get(project.id) || Promise.resolve()).then(job);
        this.queues.set(project.id, queued.catch(() => {
        }));
        return queued
    }

    async load(id) {
        const file = this.file(id);
        let raw
        try {
            raw = JSON.parse(await fs.readFile(file, 'utf8'))
        } catch (error) {
            try {
                raw = JSON.parse(await fs.readFile(`${file}.bak`, 'utf8'))
            } catch {
                throw error
            }
        }
        // A valid but unsupported schema must never silently open an older backup.
        return normalize(raw)
    }

    async recent() {
        try {
            const {id} = JSON.parse(await fs.readFile(this.recentFile, 'utf8'));
            return await this.load(id)
        } catch {
            return null
        }
    }

    async list({archived = false} = {}) {
        const entries = await fs.readdir(this.root, {withFileTypes: true}).catch(() => [])
        const projects = []
        for (const entry of entries) {
            if (!entry.isDirectory()) continue
            try {
                const project = await this.load(entry.name)
                if (Boolean(project.archived) === Boolean(archived)) projects.push({
                    id: project.id,
                    name: project.name,
                    updatedAt: project.updatedAt || project.createdAt,
                    blockCount: project.blocks.length,
                    progress: project.blocks.filter(block => block.status?.scriptDone && block.status?.assetDone).length,
                    archived: Boolean(project.archived)
                })
            } catch {
            }
        }
        return projects.sort((left, right) => right.updatedAt - left.updatedAt)
    }

    async rename(id, name) {
        const project = await this.load(id);
        const value = String(name || '').trim();
        if (!value || value.length > 120) throw new Error('项目名称无效');
        project.name = value;
        return this.save(project)
    }

    async archive(id, archived = true) {
        const project = await this.load(id);
        project.archived = Boolean(archived);
        return this.save(project)
    }

    async relocateSources(id, replacements) {
        const project = await this.load(id), map = new Map(Object.entries(replacements || {}))
        for (const source of project.sources) {
            const next = map.get(source.id);
            if (!next) continue;
            source.path = next.path;
            source.pdfPath = next.pdfPath;
            if (next.fileName) source.fileName = next.fileName
        }
        return this.save(project)
    }
}

module.exports = {ProjectService}
