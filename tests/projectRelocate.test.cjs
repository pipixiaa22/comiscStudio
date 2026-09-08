const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {ProjectService} = require('../electron/services/ProjectService')

async function setup() {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-project-'))
  const service = new ProjectService(userData)
  const project = await service.save({
    schemaVersion: 3,
    id: 'project-1',
    name: '测试项目',
    sources: [
      {id: 'image-1', path: path.join(userData, 'old', 'page01.png'), mediaType: 'image', fileName: 'page01.png'},
      {id: 'pdf-1', path: `${path.join(userData, 'old', 'book.pdf')}#page=7`, mediaType: 'image', fileName: 'book.pdf', pdfPath: path.join(userData, 'old', 'book.pdf'), pageNumber: 7}
    ],
    blocks: [{id: 'block-1', text: '', assets: []}]
  })
  return {userData, service, project}
}

test('relocates an image source to a new folder and registers that folder', async () => {
  const {userData, service} = await setup()
  try {
    const target = path.join(userData, 'moved')
    const project = await service.relocateSource('project-1', {sourceId: 'image-1', newPath: target, kind: 'directory'})
    const source = project.sources.find(item => item.id === 'image-1')
    assert.equal(source.path, path.join(target, 'page01.png'))
    assert.equal(source.fileName, 'page01.png')
    assert.ok(project.sourceDirectories.includes(target))
  } finally {
    await fs.rm(userData, {recursive: true, force: true})
  }
})

test('relocating a PDF page keeps its page number and requires a PDF', async () => {
  const {userData, service} = await setup()
  try {
    const target = path.join(userData, 'new-book.pdf')
    await fs.writeFile(target, '%PDF-1.7')
    const project = await service.relocateSource('project-1', {sourceId: 'pdf-1', newPath: target, kind: 'file'})
    const source = project.sources.find(item => item.id === 'pdf-1')
    assert.equal(source.pdfPath, target)
    assert.equal(source.path, `${target}#page=7`)
    await assert.rejects(() => service.relocateSource('project-1', {sourceId: 'pdf-1', newPath: path.join(userData, 'not-a.pdf.png'), kind: 'file'}), /PDF/)
  } finally {
    await fs.rm(userData, {recursive: true, force: true})
  }
})

test('rejects unknown sources and relative replacement paths', async () => {
  const {userData, service} = await setup()
  try {
    await assert.rejects(() => service.relocateSource('project-1', {sourceId: 'missing', newPath: path.join(userData, 'x.png'), kind: 'file'}), /来源不存在/)
    await assert.rejects(() => service.relocateSource('project-1', {sourceId: 'image-1', newPath: 'relative/page.png', kind: 'file'}), /有效的替换位置/)
  } finally {
    await fs.rm(userData, {recursive: true, force: true})
  }
})
