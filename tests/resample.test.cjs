const test = require('node:test')
const assert = require('node:assert/strict')

const load = () => import('../src/features/voice/model/resample.js')

test('passes samples through unchanged when rates match', async () => {
  const {createResampler} = await load()
  const push = createResampler(48000, 48000)
  const input = Float32Array.from([0.1, 0.2, 0.3])
  assert.equal(push(input), input)
})

test('upsamples a constant signal without changing its value', async () => {
  const {createResampler} = await load()
  const push = createResampler(44100, 48000)
  const output = push(new Float32Array(4410).fill(0.5))
  assert.ok(Math.abs(output.length - 4800) <= 1, `expected ~4800 samples, got ${output.length}`)
  for (const sample of output) assert.ok(Math.abs(sample - 0.5) < 1e-6)
})

test('keeps one continuous output stream across chunk boundaries', async () => {
  const {createResampler} = await load()
  const push = createResampler(24000, 48000)
  const first = push(Float32Array.from({length: 240}, (_, index) => index / 240))
  const second = push(Float32Array.from({length: 240}, (_, index) => 1 + index / 240))
  const output = [...first, ...second]
  // 480 input samples at 24 kHz is 0.02 s, i.e. 960 samples at 48 kHz.
  assert.ok(Math.abs(output.length - 960) <= 2, `expected ~960 samples, got ${output.length}`)
  // A ramp must stay monotonic: no sample is repeated or skipped at the seam.
  for (let index = 1; index < output.length; index += 1) assert.ok(output[index] >= output[index - 1] - 1e-6)
})

test('converts float samples to clamped 16-bit PCM', async () => {
  const {toInt16} = await load()
  const pcm = toInt16(Float32Array.from([-2, -1, 0, 1, 2]))
  assert.deepEqual([...pcm], [-32768, -32768, 0, 32767, 32767])
})
