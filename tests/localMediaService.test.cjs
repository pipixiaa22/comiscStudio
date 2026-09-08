const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const {parseByteRange} = require('../electron/services/byteRange')
const {LocalMediaService} = require('../electron/services/LocalMediaService')

test('parses full, closed, open-ended and suffix ranges', () => {
  assert.deepEqual(parseByteRange(null, 100), {start: 0, end: 99, partial: false})
  assert.deepEqual(parseByteRange('bytes=10-19', 100), {start: 10, end: 19, partial: true})
  assert.deepEqual(parseByteRange('bytes=10-', 100), {start: 10, end: 99, partial: true})
  assert.deepEqual(parseByteRange('bytes=-10', 100), {start: 90, end: 99, partial: true})
})

test('rejects malformed or unsatisfiable ranges', () => {
  assert.throws(() => parseByteRange('items=1-2', 100))
  assert.throws(() => parseByteRange('bytes=-', 100))
  assert.throws(() => parseByteRange('bytes=50-10', 100))
  assert.throws(() => parseByteRange('bytes=100-120', 100))
})

test('serves only registered tokens with range support', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'studio-media-'))
  const file = path.join(directory, 'page.pdf')
  await fs.writeFile(file, Buffer.from('%PDF-1.7 test payload'))
  const service = new LocalMediaService()
  try {
    const {url} = service.register('pdf', file)
    assert.match(url, /^studio-media:\/\/pdf\//)
    const missing = await service.respond(new Request('studio-media://pdf/unknown'))
    assert.equal(missing.status, 404)

    const whole = await service.respond(new Request(url))
    assert.equal(whole.status, 200)
    assert.equal(whole.headers.get('accept-ranges'), 'bytes')
    assert.equal(whole.headers.get('content-type'), 'application/pdf')
    assert.equal(whole.headers.get('access-control-allow-origin'), '*')
    assert.equal(await whole.text(), '%PDF-1.7 test payload')

    const partial = await service.respond(new Request(url, {headers: {range: 'bytes=0-3'}}))
    assert.equal(partial.status, 206)
    assert.equal(partial.headers.get('content-range'), 'bytes 0-3/21')
    assert.equal(await partial.text(), '%PDF')

    const unsatisfiable = await service.respond(new Request(url, {headers: {range: 'bytes=99-120'}}))
    assert.equal(unsatisfiable.status, 416)
  } finally {
    await fs.rm(directory, {recursive: true, force: true})
  }
})
