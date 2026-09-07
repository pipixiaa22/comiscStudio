const fs = require('fs/promises')
const path = require('path')

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const pad = (value, width) => String(value).padStart(width, '0')
const subtitleCharsPerSecond = 4.5
const subtitleMaxChars = 22
const subtitleLineChars = 14

function splitSubtitleText(value) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n').trim()
  if (!text) return []
  const units = []
  for (const paragraph of text.split(/\n+/)) {
    let rest = paragraph.trim().replace(/\s+/g, ' ')
    while (rest.length > subtitleMaxChars) {
      const window = rest.slice(0, subtitleMaxChars)
      let cut = -1
      for (let index = window.length - 1; index >= Math.ceil(subtitleMaxChars / 2); index -= 1) {
        if (/[，。！？；、,.!?;:： ]/.test(window[index])) { cut = index + 1; break }
      }
      if (cut < 1) cut = subtitleMaxChars
      units.push(rest.slice(0, cut).trim().replace(/[，,]+$/, ''))
      rest = rest.slice(cut).trim()
    }
    if (rest) units.push(rest.replace(/[，,]+$/, ''))
  }
  return units.filter(Boolean).map(unit => {
    if (unit.length <= subtitleLineChars) return unit
    let breakAt = -1
    for (let index = Math.min(subtitleLineChars, unit.length - 1); index >= Math.ceil(subtitleLineChars / 2); index -= 1) {
      if (/[，。！？；、,.!?;:： ]/.test(unit[index])) { breakAt = index + 1; break }
    }
    if (breakAt < 1) breakAt = subtitleLineChars
    return `${unit.slice(0, breakAt).trim()}\n${unit.slice(breakAt).trim()}`
  })
}

function estimateSubtitleDuration(text) {
  const spokenUnits = Array.from(text.replace(/\s/g, '')).length
  return Math.max(1200, Math.min(6000, Math.round((0.8 + spokenUnits / subtitleCharsPerSecond) * 1000)))
}

function formatSrtTime(milliseconds) {
  const total = Math.max(0, Math.floor(milliseconds))
  const hours = Math.floor(total / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const ms = total % 1000
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(ms, 3)}`
}

async function writeScript(root, entries, blockDigits) {
  const body = entries.map(entry => `【${pad(entry.position, blockDigits)}】\r\n\r\n${String(entry.block.text || '').replace(/\r?\n/g, '\r\n')}`).join('\r\n\r\n\r\n') + '\r\n'
  await fs.writeFile(path.join(root, 'script.txt'), body, 'utf8')
}

async function writeSubtitles(root, entries) {
  let offset = 0
  const cues = entries.flatMap(entry => splitSubtitleText(entry.block.text)).map((text, index) => {
    const duration = estimateSubtitleDuration(text)
    const cue = `${index + 1}\r\n${formatSrtTime(offset)} --> ${formatSrtTime(offset + duration)}\r\n${text}\r\n`
    offset += duration
    return cue
  })
  await fs.writeFile(path.join(root, 'subtitles.srt'), `\ufeff${cues.join('\r\n')}`, 'utf8')
}

async function writeStoryboard(root, plan, exportedAt) {
  const cards = plan.entries.map(entry => {
    const images = entry.assets.length ? entry.assets.map(asset => `<figure><img src="${encodeURI(asset.file)}" loading="lazy" alt="${escapeHtml(asset.file)}"><figcaption>${escapeHtml(path.basename(asset.file))}</figcaption></figure>`).join('') : '<p class="empty">未选择画面</p>'
    const text = entry.block.text ? escapeHtml(entry.block.text) : '<span class="empty">（空文案）</span>'
    return `<article><header><b>#${pad(entry.position, plan.blockDigits)}</b><span>${entry.assets.length} 项素材</span></header><div class="text">${text}</div><section>${images}</section></article>`
  }).join('\n')
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(plan.project.name)} · Storyboard</title><style>body{margin:0;background:#11151d;color:#e6edf3;font:15px/1.65 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1100px;margin:auto;padding:24px}h1{margin:0}header.meta{margin:0 0 20px;color:#9da7b3}article{margin:16px 0;padding:18px;border:1px solid #344050;border-radius:10px;background:#181e29}article header{display:flex;justify-content:space-between;color:#ffbd75}.text{white-space:pre-wrap;margin:14px 0}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}figure{margin:0;background:#0b0e14}img{display:block;width:100%;height:auto;max-height:500px;object-fit:contain}figcaption{padding:5px 8px;color:#9da7b3;font-size:12px}.empty{color:#ffcf79}@media print{body{background:#fff;color:#111}article{break-inside:avoid;background:#fff;border-color:#bbb}img{max-height:none}}</style><main><h1>${escapeHtml(plan.project.name)}</h1><header class="meta">导出时间：${escapeHtml(new Date(exportedAt).toLocaleString())} · ${plan.entries.length} 个 Block</header>${cards}</main></html>`
  await fs.writeFile(path.join(root, 'storyboard.html'), html, 'utf8')
}

module.exports = { writeScript, writeSubtitles, writeStoryboard }
