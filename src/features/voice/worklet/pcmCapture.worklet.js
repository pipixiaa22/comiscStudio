// Runs on the audio rendering thread.  It forwards mono float frames to the
// renderer in ~4096-sample blocks instead of one message per 128-sample
// quantum, keeping the main thread free while recording.
const BLOCK_SIZE = 4096

class PcmCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        this.buffer = new Float32Array(BLOCK_SIZE)
        this.offset = 0
        this.active = true
        this.port.onmessage = event => { if (event.data?.stop) this.active = false }
    }

    process(inputs) {
        const channel = inputs[0]?.[0]
        if (channel && this.active) {
            let read = 0
            while (read < channel.length) {
                const take = Math.min(BLOCK_SIZE - this.offset, channel.length - read)
                this.buffer.set(channel.subarray(read, read + take), this.offset)
                this.offset += take
                read += take
                if (this.offset === BLOCK_SIZE) {
                    this.port.postMessage(this.buffer)
                    this.buffer = new Float32Array(BLOCK_SIZE)
                    this.offset = 0
                }
            }
        }
        return true
    }
}

registerProcessor('pcm-capture', PcmCaptureProcessor)
