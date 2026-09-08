const test = require('node:test')
const assert = require('node:assert/strict')
const {parseVideoProbe} = require('../electron/services/VideoProbeService')

const base = {
  streams: [{index: 0, codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', duration: '12', start_time: '0', field_order: 'progressive', width: 1920, height: 1080, time_base: '1/1000', avg_frame_rate: '25/1'}],
  format: {duration: '12', start_time: '0'}
}

test('marks a compatible H.264 MP4 preview as pending', () => {
  const source = parseVideoProbe(base, 'D:/clip.mp4', {size: 12, mtimeMs: 1})
  assert.equal(source.preview.status, 'pending')
  assert.equal(source.durationUs, 12000000)
})

test('retains unsupported preview reason for incompatible containers', () => {
  const source = parseVideoProbe(base, 'D:/clip.webm', {size: 12, mtimeMs: 1})
  assert.equal(source.preview.status, 'unsupported')
  assert.match(source.preview.reason, /兼容预览/)
})
