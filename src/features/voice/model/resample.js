// Streaming linear resampler used when a capture device cannot run at the
// project's fixed 48 kHz narration format.  Chunks arrive as Float32Array
// frames; the returned function yields the resampled frames for that chunk and
// keeps the fractional read position across chunks so no sample is dropped or
// repeated at chunk boundaries.
export function createResampler(inputRate, outputRate) {
    if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate <= 0 || outputRate <= 0) throw new Error('采样率无效')
    const ratio = inputRate / outputRate
    let position = 0
    let previous = 0
    let started = false
    return function push(chunk) {
        if (!chunk?.length) return new Float32Array(0)
        if (ratio === 1) return chunk
        if (!started) {
            // Start on the first real sample instead of a synthetic leading zero.
            previous = chunk[0]
            started = true
        }
        // Virtual array V = [previous, ...chunk]; V[0] belongs to the previous
        // chunk, so a sample at fractional position p reads V[floor(p)] and
        // interpolates towards V[floor(p) + 1].
        const available = chunk.length + 1
        const output = []
        while (position + 1 < available) {
            const index = Math.floor(position)
            const fraction = position - index
            const left = index === 0 ? previous : chunk[index - 1]
            const right = chunk[index]
            output.push(left + (right - left) * fraction)
            position += ratio
        }
        // Move the read position into the next chunk's coordinate space.
        previous = chunk[chunk.length - 1]
        position -= chunk.length
        return Float32Array.from(output)
    }
}

// Converts float samples to the 16-bit PCM the recorder writes to disk.
export function toInt16(samples) {
    const pcm = new Int16Array(samples.length)
    for (let index = 0; index < samples.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, samples[index]))
        pcm[index] = sample < 0 ? sample * 32768 : sample * 32767
    }
    return pcm
}
