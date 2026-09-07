const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const {createExportPlan, validatePackageName, sourceFile} = require('./ExportPlanner')
const {renderAsset} = require('./AssetRenderer')
const {writeScript, writeSubtitles, writeStoryboard} = require('./ExportWriters')
const {validateNarration, writeNarration} = require('./NarrationExportService')

class ExportService {
    constructor(projectService = null, renderService = null) {
        this.projectService = projectService;
        this.renderService = renderService;
        this.destinations = new Map();
        this.projects = new Map();
        this.jobs = new Map()
    }

    projectRoot(projectId) {
        if (!this.projectService?.root) throw new Error('Voice export service is unavailable');
        return path.resolve(this.projectService.root, projectId)
    }

    registerDestination(directory) {
        const token = crypto.randomUUID();
        this.destinations.set(token, {directory: path.resolve(directory), createdAt: Date.now()});
        return {token, path: directory}
    }

    registerProjectSources(project) {
        if (!project || typeof project.id !== 'string' || !Array.isArray(project.sources)) return
        this.projects.set(project.id, project.sources.map(source => ({...source})))
    }

    resolveSnapshot(projectSnapshot) {
        if (!projectSnapshot || typeof projectSnapshot.id !== 'string') return {error: 'Project structure is invalid'}
        const sources = this.projects.get(projectSnapshot.id)
        if (!sources) return {error: 'Project sources are not registered in the main process. Reopen the project and try again.'}
        return {project: {...structuredClone(projectSnapshot), sources: structuredClone(sources)}}
    }

    async preflight({projectSnapshot, options, packageName, destinationToken}) {
        const error = validatePackageName(packageName)
        const resolved = this.resolveSnapshot(projectSnapshot)
        const result = resolved.error ? {
            errors: [{code: 'UNAUTHORIZED_PROJECT', message: resolved.error}],
            warnings: [],
            plan: null
        } : createExportPlan(resolved.project, options)
        if (error) result.errors.push({code: 'INVALID_NAME', message: error})
        const destination = this.destinations.get(destinationToken)
        if (!destination) result.errors.push({code: 'INVALID_DESTINATION', message: '请重新选择导出目录'})
        else {
            try {
                await fs.access(destination.directory, require('fs').constants.W_OK)
            } catch {
                result.errors.push({code: 'UNWRITABLE_DESTINATION', message: '目标目录不可写'})
            }
        }
        if (result.plan?.narrationMode === 'voice') result.errors.push(...await validateNarration(result.plan.project, this.projectRoot(result.plan.project.id)))
        if (result.plan) {
            if (result.plan.assets.some(asset => asset.type === 'video') && !(this.renderService && await this.renderService.available())) result.errors.push({code: 'FFMPEG_UNAVAILABLE', message: '导出视频需要可用的 ffmpeg 工具链；开发环境可设置 COMISC_FFMPEG_PATH'})
            const checked = new Set()
            for (const asset of result.plan.assets) {
                const file = sourceFile(asset.source)
                if (checked.has(file)) continue
                checked.add(file)
                try {
                    await fs.access(file, require('fs').constants.R_OK)
                } catch {
                    result.errors.push({code: 'SOURCE_UNAVAILABLE', message: `来源不可读：${file}`})
                }
            }
        }
        return {
            errors: result.errors,
            warnings: result.warnings,
            assetCount: result.plan?.assets.length || 0,
            imageCount: result.plan?.assets.filter(asset => asset.type !== 'video').length || 0,
            videoCount: result.plan?.assets.filter(asset => asset.type === 'video').length || 0,
            blockCount: result.plan?.entries.length || 0
        }
    }

    start({projectSnapshot, options, packageName, destinationToken, projectRevision}, send) {
        const jobId = crypto.randomUUID(),
            job = {id: jobId, cancelled: false, status: 'validating', output: null, error: null, children: new Set()}
        this.jobs.set(jobId, job)
        void this.run(job, {
            projectSnapshot: structuredClone(projectSnapshot),
            options,
            packageName,
            destinationToken,
            projectRevision
        }, send)
        return {jobId}
    }

    cancel(jobId) {
        const job = this.jobs.get(jobId);
        if (!job || job.status === 'finalizing' || job.status === 'succeeded') return false;
        job.cancelled = true;
        for (const child of job.children) child.kill()
        return true
    }

    async run(job, input, send) {
        const emit = update => send('export:progress', {jobId: job.id, ...update})
        let temporary
        try {
            const resolved = this.resolveSnapshot(input.projectSnapshot)
            if (resolved.error) throw new Error(resolved.error)
            input.projectSnapshot = resolved.project
            const preflight = await this.preflight(input)
            if (preflight.errors.length) throw new Error(preflight.errors.map(item => item.message).join('；'))
            const destination = this.destinations.get(input.destinationToken).directory
            const planResult = createExportPlan(input.projectSnapshot, input.options);
            const plan = planResult.plan
            const output = path.join(destination, input.packageName);
            temporary = path.join(destination, `.mangadesk-export-${job.id}.partial`)
            if (await exists(output)) throw new Error('同名素材包已存在，请修改名称')
            await fs.mkdir(path.join(temporary, 'images'), {recursive: true})
            await fs.mkdir(path.join(temporary, 'videos'), {recursive: true})
            await fs.writeFile(path.join(temporary, '.mangadesk-export'), job.id, 'utf8')
            job.status = 'rendering';
            emit({stage: 'rendering', completed: 0, total: plan.assets.length})
            const manifestAssets = []
            for (let index = 0; index < plan.assets.length; index += 1) {
                if (job.cancelled) throw new Error('EXPORT_CANCELLED')
                const asset = plan.assets[index];
                const output = path.join(temporary, asset.file)
                let result
                if (asset.type === 'video') {
                    try {
                        result = await this.renderService.renderClip({
                            source: asset.source,
                            clip: asset,
                            output,
                            poster: output.replace(/\.mp4$/i, '.jpg'),
                            children: job.children
                        })
                    } catch (error) {
                        if (job.cancelled) throw new Error('EXPORT_CANCELLED')
                        throw error
                    }
                } else {
                    result = await renderAsset(asset, output, input.options)
                }
                const base = {blockId: asset.blockId, assetId: asset.assetId, sourceId: asset.sourceId, type: asset.type, file: asset.file.replace(/\\/g, '/')}
                manifestAssets.push(asset.type === 'video' ? {
                    ...base,
                    startUs: asset.startUs,
                    endUs: asset.endUs,
                    videoStreamIndex: asset.videoStreamIndex,
                    audio: asset.audio,
                    selectionBasis: asset.selectionBasis,
                    sourceFingerprint: asset.source?.fingerprint || null,
                    width: result.width,
                    height: result.height,
                    durationUs: result.durationUs,
                    audioStreams: result.audioStreams?.length || 0,
                    frameIntervalUs: result.frameIntervalUs,
                    codec: result.codec,
                    encoder: result.encoder,
                    toolVersion: result.toolVersion
                } : {...base, ...result})
                emit({stage: 'rendering', completed: index + 1, total: plan.assets.length})
            }
            if (job.cancelled) throw new Error('EXPORT_CANCELLED')
            job.status = 'writingDocuments';
            emit({stage: 'writingDocuments', completed: plan.assets.length, total: plan.assets.length})
            const exportedAt = Date.now()
            const narration = plan.narrationMode === 'voice' ? await writeNarration(temporary, plan, this.projectRoot(plan.project.id)) : null
            if (plan.narrationMode === 'text') {
                await writeScript(temporary, plan.entries, plan.blockDigits);
                await writeSubtitles(temporary, plan.entries)
            }
            await writeStoryboard(temporary, plan, exportedAt)
            const snapshot = {
                ...plan.project,
                exportManifest: {
                    version: 1,
                    exportedAt,
                    projectRevision: input.projectRevision,
                    options: {
                        format: input.options.format || 'jpeg',
                        jpegQuality: input.options.jpegQuality || 92,
                        pdfDpi: input.options.pdfDpi || 200,
                        maxEdge: input.options.maxEdge || null,
                        canvas: {
                            width: input.options.canvasWidth || 1920,
                            height: input.options.canvasHeight || 1080,
                            backgroundColor: input.options.backgroundColor || '#F4EBD9'
                        },
                        renderer: 'sharp-v1',
                        video: plan.assets.some(asset => asset.type === 'video') ? {
                            encoder: 'libx264',
                            crf: 18,
                            container: 'mp4',
                            audioCodec: 'aac',
                            framePolicy: 'preserve-source-timing',
                            reencoded: true
                        } : null,
                        subtitles: plan.narrationMode === 'text' ? {
                            generated: true,
                            format: 'srt',
                            timing: 'estimated-reading-speed-v1',
                            charsPerSecond: 4.5,
                            maxCueChars: 22
                        } : {generated: false, source: 'capcut-audio-recognition'}
                    },
                    narration: narration ? {
                        mode: 'voice',
                        file: narration.file,
                        timingFile: narration.timingFile,
                        subtitlesGenerated: false
                    } : {mode: 'text', subtitlesGenerated: true},
                    assets: manifestAssets
                }
            }
            await fs.writeFile(path.join(temporary, 'project.json'), JSON.stringify(snapshot, null, 2), 'utf8')
            await fs.unlink(path.join(temporary, '.mangadesk-export')).catch(() => {
            })
            if (job.cancelled) throw new Error('EXPORT_CANCELLED')
            job.status = 'finalizing';
            emit({stage: 'finalizing', completed: plan.assets.length, total: plan.assets.length})
            if (await exists(output)) throw new Error('同名素材包已存在，请修改名称')
            await fs.rename(temporary, output);
            temporary = null;
            job.output = output;
            job.status = 'succeeded';
            emit({stage: 'succeeded', completed: plan.assets.length, total: plan.assets.length, output})
        } catch (error) {
            const cancelled = error.message === 'EXPORT_CANCELLED'
            job.status = cancelled ? 'cancelled' : 'failed';
            job.error = cancelled ? null : error.message
            if (temporary) await fs.rm(temporary, {recursive: true, force: true}).catch(() => {
            })
            emit({stage: job.status, completed: 0, total: 0, error: job.error})
        }
    }

    outputFor(jobId) {
        const job = this.jobs.get(jobId);
        if (!job?.output || job.status !== 'succeeded') throw new Error('导出任务尚未完成');
        return job.output
    }
}

async function exists(target) {
    try {
        await fs.access(target);
        return true
    } catch {
        return false
    }
}

module.exports = {ExportService}
