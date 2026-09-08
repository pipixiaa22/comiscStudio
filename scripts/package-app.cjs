const fs = require('fs/promises')
const path = require('path')
const {checkMediaToolchain, validateBundle, runTool} = require('../electron/services/MediaToolchainService')

async function main() {
  const root = path.resolve(__dirname, '..')
  if (!['darwin', 'win32'].includes(process.platform)) throw new Error('发布构建请在目标 macOS 或 Windows 系统执行')
  const resourcesPath = path.join(root, 'resources', `${process.platform}-${process.arch}`)
  const tools = path.join(resourcesPath, 'media-tools')
  await validateBundle(tools)
  const report = await checkMediaToolchain({packaged: true, resourcesPath})
  if (process.platform === 'darwin') {
    for (const binary of [report.ffmpeg, report.ffprobe]) {
      const libraries = await runTool('/usr/bin/otool', ['-L', binary])
      const paths = libraries.split('\n').slice(1).map(line => line.trim().split(' ')[0]).filter(Boolean)
      if (paths.some(file => !file.startsWith('/usr/lib/') && !file.startsWith('/System/Library/'))) throw new Error('请提供不依赖 Homebrew 或外部动态库的独立媒体工具')
    }
  }
  if (process.argv.includes('--check')) { console.log(JSON.stringify(report, null, 2)); return }
  const {build} = await import('vite')
  await build({root})
  const {packager} = await import('@electron/packager')
  const electronVersion = require('electron/package.json').version
  const out = path.join(root, 'release', `${Date.now()}`)
  const outputs = await packager({dir: root, name: 'Electron', appVersion: '0.1.0', electronVersion,
    platform: process.platform, arch: process.arch, out, overwrite: false, asar: false,
    extraResource: [tools], prune: true,
    ignore: [/^\/(resources|release|tests|scripts|\.git|\.codex|\.agents|\.pnpm-store)(\/|$)/, /\.md$/]})
  await fs.writeFile(path.join(out, 'build-report.json'), JSON.stringify({createdAt: new Date().toISOString(), platform: process.platform,
    arch: process.arch, electronVersion, toolchain: report, outputs, acceptance: 'pending-clean-machine-and-capcut'}, null, 2))
  console.log(outputs.join('\n'))
}

main().catch(error => { console.error(`打包检查失败：${error.message}`); process.exitCode = 1 })
