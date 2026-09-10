const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../src/features/library/model/thumbnailGrid.js')

test('derives the writable width before choosing columns', async () => {
  const {gridWindow, GRID_PADDING} = await load()
  const narrow = gridWindow({viewWidth: 360, viewHeight: 800, scrollTop: 0, count: 100, thumbHeight: 180})
  const wide = gridWindow({viewWidth: 900, viewHeight: 800, scrollTop: 0, count: 100, thumbHeight: 180})
  assert.equal(narrow.inner, 360 - GRID_PADDING * 2)
  assert.ok(wide.columns > narrow.columns, 'a wider panel must fit more columns')
  assert.equal(narrow.columns, 2)
})

test('wider thumbnails mean fewer columns', async () => {
  const {gridWindow} = await load()
  const view = {viewWidth: 360, viewHeight: 800, scrollTop: 0, count: 100}
  assert.equal(gridWindow({...view, thumbHeight: 120}).columns, 3)
  assert.equal(gridWindow({...view, thumbHeight: 180}).columns, 2)
  assert.equal(gridWindow({...view, thumbHeight: 260}).columns, 1)
})

test('card height and row stride follow the thumbnail size exactly', async () => {
  const {gridWindow, CARD_CHROME, GRID_GAP} = await load()
  const metrics = gridWindow({viewWidth: 360, viewHeight: 800, scrollTop: 0, count: 10, thumbHeight: 180})
  assert.equal(metrics.cardHeight, 180 + CARD_CHROME)
  assert.equal(metrics.rowStride, metrics.cardHeight + GRID_GAP)
})

test('windows only the visible rows plus overscan', async () => {
  const {gridWindow, GRID_PADDING} = await load()
  const metrics = gridWindow({viewWidth: 360, viewHeight: 600, scrollTop: 0, count: 500, thumbHeight: 180})
  assert.equal(metrics.rowCount, 250)
  assert.equal(metrics.firstIndex, 0)
  // Far fewer than the 500 sources are mounted.
  assert.ok(metrics.lastIndex < 40, `expected a small window, got ${metrics.lastIndex}`)
  assert.equal(metrics.topPadding, GRID_PADDING)
})

test('spacers keep the scrollable height stable while scrolled', async () => {
  const {gridWindow, GRID_PADDING} = await load()
  const metrics = gridWindow({viewWidth: 360, viewHeight: 600, scrollTop: 1000, count: 500, thumbHeight: 180})
  assert.ok(metrics.firstIndex > 0)
  const total = metrics.topPadding + (metrics.lastIndex - metrics.firstIndex) / metrics.columns * metrics.rowStride + metrics.bottomPadding
  const expected = GRID_PADDING * 2 + metrics.rowCount * metrics.rowStride - 12
  assert.ok(Math.abs(total - expected) < metrics.rowStride, `content height drifted: ${total} vs ${expected}`)
})

test('never exceeds the source count at the very bottom', async () => {
  const {gridWindow} = await load()
  const count = 7
  const metrics = gridWindow({viewWidth: 360, viewHeight: 600, scrollTop: 100000, count, thumbHeight: 180})
  assert.ok(metrics.lastIndex <= count)
  assert.ok(metrics.firstIndex <= count)
  assert.equal(metrics.bottomPadding, 16)
})

test('handles an empty list and an unmeasured viewport', async () => {
  const {gridWindow} = await load()
  const empty = gridWindow({viewWidth: 360, viewHeight: 600, scrollTop: 0, count: 0, thumbHeight: 180})
  assert.equal(empty.firstIndex, 0)
  assert.equal(empty.lastIndex, 0)
  assert.equal(empty.rowCount, 0)
  const unmeasured = gridWindow({viewWidth: 0, viewHeight: 0, scrollTop: 0, count: 0, thumbHeight: 180})
  assert.ok(unmeasured.columns >= 1)
})

test('steps thumbnail sizes within bounds', async () => {
  const {stepThumbSize, thumbHeightOf, THUMB_SIZES} = await load()
  assert.equal(stepThumbSize('s', -1), 's')
  assert.equal(stepThumbSize('s', 1), 'm')
  assert.equal(stepThumbSize('m', 1), 'l')
  assert.equal(stepThumbSize('l', 1), 'l')
  assert.equal(stepThumbSize('l', -1), 'm')
  assert.equal(stepThumbSize('unknown', 1), 'l')
  assert.equal(thumbHeightOf('unknown'), THUMB_SIZES[1].height)
})

test('scales the preview with the panel and keeps it bounded', async () => {
  const {previewHeightFor} = await load()
  assert.equal(previewHeightFor(0), 220)
  assert.ok(previewHeightFor(400) > previewHeightFor(300))
  assert.equal(previewHeightFor(5000), 460)
})

test('rasterizes PDF thumbnails larger than they are displayed', async () => {
  const {thumbnailRenderScale} = await load()
  const scale = thumbnailRenderScale(180, 2)
  assert.ok(scale * 900 >= 180, 'bitmap must be at least as tall as the displayed thumbnail')
  assert.equal(thumbnailRenderScale(120, 1), thumbnailRenderScale(120, 0))
  assert.ok(thumbnailRenderScale(120, 1) < thumbnailRenderScale(260, 1))
})
