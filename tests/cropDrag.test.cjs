const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../src/features/assets/model/cropDrag.js')

const minimum = {width: 0.01, height: 0.01}

test('draws a selection from any drag direction', async () => {
  const {cropFromDrag} = await load()
  assert.deepEqual(cropFromDrag({x: 0.2, y: 0.3}, {x: 0.5, y: 0.6}), {x: 0.2, y: 0.3, width: 0.3, height: 0.3})
  // Dragging up and to the left must produce the same rectangle.
  assert.deepEqual(cropFromDrag({x: 0.5, y: 0.6}, {x: 0.2, y: 0.3}), {x: 0.2, y: 0.3, width: 0.3, height: 0.3})
})

test('shrinks and grows a selection again from the same handle', async () => {
  const {resizeCrop} = await load()
  const origin = {x: 0.2, y: 0.2, width: 0.4, height: 0.4}
  const shrunk = resizeCrop(origin, 'se', {x: 0.4, y: 0.4}, minimum)
  assert.deepEqual(shrunk, {x: 0.2, y: 0.2, width: 0.2, height: 0.2})
  const grown = resizeCrop(origin, 'se', {x: 0.9, y: 0.9}, minimum)
  assert.deepEqual(grown, {x: 0.2, y: 0.2, width: 0.7, height: 0.7})
})

test('anchors the opposite edge for every handle', async () => {
  const {resizeCrop, CROP_HANDLES} = await load()
  const origin = {x: 0.3, y: 0.3, width: 0.4, height: 0.4}
  for (const handle of CROP_HANDLES) {
    const next = resizeCrop(origin, handle, {x: 0.5, y: 0.5}, minimum)
    const keepsLeft = !handle.includes('w')
    const keepsTop = !handle.includes('n')
    if (keepsLeft) assert.equal(next.x, origin.x, `${handle} must keep the left edge`)
    if (keepsTop) assert.equal(next.y, origin.y, `${handle} must keep the top edge`)
    assert.ok(next.x >= 0 && next.y >= 0)
    assert.ok(next.x + next.width <= 1.000001 && next.y + next.height <= 1.000001)
  }
})

test('never inverts past the opposite edge, it stops at the minimum', async () => {
  const {resizeCrop} = await load()
  const origin = {x: 0.2, y: 0.2, width: 0.4, height: 0.4}
  const collapsed = resizeCrop(origin, 'se', {x: 0, y: 0}, minimum)
  assert.deepEqual(collapsed, {x: 0.2, y: 0.2, width: 0.01, height: 0.01})
  const flipped = resizeCrop(origin, 'nw', {x: 0.9, y: 0.9}, minimum)
  assert.deepEqual(flipped, {x: 0.59, y: 0.59, width: 0.01, height: 0.01})
})

test('keeps an already tiny selection instead of forcing it to grow', async () => {
  const {resizeCrop} = await load()
  const tiny = {x: 0.5, y: 0.5, width: 0.002, height: 0.002}
  const next = resizeCrop(tiny, 'se', {x: 0.5, y: 0.5}, minimum)
  assert.equal(next.width, 0.002)
  assert.equal(next.height, 0.002)
})

test('clamps the whole selection inside the page while moving', async () => {
  const {moveCrop} = await load()
  const origin = {x: 0.3, y: 0.3, width: 0.4, height: 0.4}
  assert.deepEqual(moveCrop(origin, {x: 0.1, y: -0.1}), {x: 0.4, y: 0.2, width: 0.4, height: 0.4})
  assert.deepEqual(moveCrop(origin, {x: 5, y: 5}), {x: 0.6, y: 0.6, width: 0.4, height: 0.4})
  assert.deepEqual(moveCrop(origin, {x: -5, y: -5}), {x: 0, y: 0, width: 0.4, height: 0.4})
})

test('moves a full-page selection without sliding it off', async () => {
  const {moveCrop} = await load()
  const full = {x: 0, y: 0, width: 1, height: 1}
  assert.deepEqual(moveCrop(full, {x: 0.5, y: 0.5}), {x: 0, y: 0, width: 1, height: 1})
})
