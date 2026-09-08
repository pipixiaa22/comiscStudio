# A5 媒体工具与平台发布

在目标系统安装依赖后运行 `pnpm package:check`，检查通过再运行 `pnpm package:app`。
输出是 `release/<时间戳>/` 下的 macOS `.app` 或 Windows 应用目录；安装器、签名与公证属于发布验收，当前不将未签名目录称为正式安装包。
保留应用名 `Electron`，与原无 name 的 package.json 默认 userData 目录一致，避免品牌改名导致旧项目失联。

每个目标架构独立准备 `resources/<darwin|win32>-<arm64|x64>/media-tools/`：

- `ffmpeg` / `ffprobe`（Windows 使用 `.exe`），固定版本、目标架构、可独立运行；macOS 不允许依赖 Homebrew 动态库。
- `manifest.json`，格式见下面示例。版本行与 configuration 字符串须与各自 `-version` 输出一致。
- 清单中列出的许可文件及所选二进制对应的分发材料。由发布者提供实际构建的材料，不用其他构建的许可证替代。

```json
{
  "platform": "darwin",
  "arch": "arm64",
  "licenses": ["LICENSE.txt", "BUILD-SOURCE.txt"],
  "ffmpeg": {
    "version": "实际 ffmpeg -version 首行",
    "sourceUrl": "实际二进制/构建来源地址",
    "configure": "实际 configuration: ... 行",
    "sha256": "实际文件的 64 位小写 SHA-256"
  },
  "ffprobe": {
    "version": "实际 ffprobe -version 首行",
    "sourceUrl": "实际二进制/构建来源地址",
    "configure": "实际 configuration: ... 行",
    "sha256": "实际文件的 64 位小写 SHA-256"
  }
}
```

脚本检查文件哈希、平台/架构声明、版本与构建参数、许可文件、H.264/AAC 解码和 libx264/AAC/PNG 编码能力。检查失败不生成发布目录。工具复制到应用 resources/media-tools，正式运行不回退 PATH 或开发环境变量。

## 必须记录的人工验收

分别在 Windows x64、macOS arm64（如发布 x64 则额外测试）无 FFmpeg/PATH 配置的机器填写系统、Electron、媒体工具、剪映版本与结果：

1. 启动应用，导入 H.264/AAC 样本，准备静音与保留原声片段，观察排队、进度、取消与重试。
2. PNG 封面原生拖动到剪映，播放核对首尾帧/原声；取消拖动不改变“放画面”。
3. 修改 In/Out 再准备，生成新路径；关闭应用和剪映后重开旧工程，旧素材仍可读取。
4. 清理可重建缓存后旧交付文件仍在；删除交付文件属于用户显式操作，不属于缓存清理。
5. 快速切项目、改选段、关辅助窗口、退出应用，旧任务不回写新会话；失败没有成功残包。
6. 验证代码签名/公证或 Windows 安装流程，并记录安全提示和安装后运行结果。

上述平台与剪映项目验收未经实际执行时，A5 不标记为正式发布通过。
