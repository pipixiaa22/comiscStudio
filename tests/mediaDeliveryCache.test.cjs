const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {MediaDeliveryService} = require('../electron/services/MediaDeliveryService')

async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-delivery-'))
  const projectId = 'project-1'
  const directory = path.join(root, projectId, 'exports', 'assistant-assets')
  await fs.mkdir(directory, {recursive: true})
  return {root, projectId, directory, service: new MediaDeliveryService({root})}
}

test('reports delivered versions and pending temporary files', async () => {
  const {root, projectId, directory, service} = await setup()
  try {
    const published = path.join(directory, 'key-1-abc')
    await fs.mkdir(published, {recursive: true})
    await fs.writeFile(path.join(published, 'manifest.json'), JSON.stringify({key: 'key-1', type: 'image', createdAt: 111}))
    await fs.writeFile(path.join(published, 'media.png'), Buffer.alloc(2048))
    await fs.mkdir(path.join(directory, '.preparing-xyz'), {recursive: true})
    await fs.writeFile(path.join(directory, '.preparing-xyz', 'media.png'), Buffer.alloc(512))

    const stats = await service.stats(projectId)
    assert.equal(stats.entries.length, 1)
    assert.equal(stats.entries[0].key, 'key-1')
    assert.equal(stats.entries[0].type, 'image')
    // Entry size covers the rendered file plus its manifest.
    assert.ok(stats.entries[0].size >= 2048, `expected at least 2048 bytes, got ${stats.entries[0].size}`)
    assert.equal(stats.totalBytes, stats.entries[0].size)
    assert.deepEqual(stats.temporary, {count: 1, bytes: 512})
  } finally {
    await fs.rm(root, {recursive: true, force: true})
  }
})

test('deletes only entries inside the project cache directory', async () => {
  const {root, projectId, directory, service} = await setup()
  try {
    const published = path.join(directory, 'key-1-abc')
    await fs.mkdir(published, {recursive: true})
    assert.equal(await service.remove(projectId, 'key-1-abc'), true)
    assert.equal(await fs.readdir(directory).then(names => names.length), 0)
    await assert.rejects(() => service.remove(projectId, '../../escape'))
  } finally {
    await fs.rm(root, {recursive: true, force: true})
  }
})

test('prunes interrupted temporary renders without touching delivered files', async () => {
  const {root, projectId, directory, service} = await setup()
  try {
    await fs.mkdir(path.join(directory, '.preparing-one'), {recursive: true})
    await fs.mkdir(path.join(directory, '.preparing-two'), {recursive: true})
    await fs.mkdir(path.join(directory, 'key-1-abc'), {recursive: true})
    assert.deepEqual(await service.pruneTemporary(projectId), {removed: 2})
    assert.deepEqual(await fs.readdir(directory), ['key-1-abc'])
  } finally {
    await fs.rm(root, {recursive: true, force: true})
  }
})
