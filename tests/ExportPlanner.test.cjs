const test = require('node:test')
const assert = require('node:assert/strict')
const {createExportPlan, sourceFile, sourcePage, validatePackageName} = require('../electron/services/ExportPlanner')

const source = {id: 'source-1', path: 'D:/source/page.png', mediaType: 'image'}
const block = {id: 'block-1', text: 'A line of narration', status: {scriptDone: true, assetDone: true}, assets: [{id: 'asset-1', sourceId: source.id, order: 0}]}

test('creates deterministic image export paths from block and asset order', () => {
  const result = createExportPlan({id: 'project-1', narration: {mode: 'text'}, sources: [source], blocks: [block]}, {format: 'png'})
  assert.deepEqual(result.errors, [])
  assert.equal(result.plan.assets[0].file, 'images/001_01.png')
  assert.equal(result.plan.assets[0].source, source)
})

test('rejects unsafe package names and invalid crop ranges', () => {
  assert.ok(validatePackageName('CON'))
  assert.ok(validatePackageName('export/name'))
  const invalid = createExportPlan({id: 'project-1', narration: {mode: 'text'}, sources: [source], blocks: [{...block, assets: [{...block.assets[0], crop: {x: 0.9, y: 0, width: 0.2, height: 1}}]}]})
  assert.ok(invalid.errors.some(error => error.code === 'INVALID_CROP'))
})

test('resolves PDF page paths without changing regular image paths', () => {
  assert.equal(sourceFile({pdfPath: 'D:/book.pdf', path: 'D:/book.pdf#page=7'}), 'D:/book.pdf')
  assert.equal(sourcePage({path: 'D:/book.pdf#page=7'}), 7)
  assert.equal(sourceFile(source), source.path)
})
