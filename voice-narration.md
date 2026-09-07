# MangaDesk 语音录制与剪映字幕工作流开发文档

> 主题：按 Block 录制真人旁白，并通过剪映识别音频生成字幕  
> 日期：2026-09-06  
> 依据：`init.md`、`phase5.md`、当前模块化代码和现有导出实现  
> 产品目标：用户在选择漫画素材后，可以选择写文案或直接录旁白；选择语音工作流时，导出可直接导入剪映的音频，并且 MangaDesk 不生成字幕文件。

## 1. 产品结论

建议新增项目级“旁白方式”：

```text
文字文案
真人录音
```

项目级选择决定当前生产流程和导出规则。每个 Block 仍保留文字与录音数据，切换方式不会删除另一种内容；只有当前旁白方式参与完成度判断和最终导出。

真人录音采用“每个 Block 单独录制、导出时合并为一条旁白”的方式：

```text
选择当前 Block 素材
        ↓
参考画面或已有文案录音
        ↓
试听 / 重录 / 选择最佳 Take
        ↓
进入下一 Block
        ↓
导出 narration.wav
        ↓
导入剪映
        ↓
剪映：识别字幕
```

单独录制便于局部重来，合并音频便于用户在剪映中只导入一次。MangaDesk 不进行语音识别，也不根据录音自动生成字幕。

## 2. 必须遵守的导出规则

当前代码的 `ExportService` 会无条件调用 `writeSubtitles()` 并写出 `subtitles.srt`。新增功能后，导出行为必须由 `narrationMode` 明确控制：

| 旁白方式 | 音频产物 | `subtitles.srt` | 文案文件 |
|---|---|---|---|
| `text` 文字文案 | 不生成 | 生成 | 生成 `script.txt` |
| `voice` 真人录音 | 生成 `audio/narration.wav` | **绝不生成** | 默认不生成；用户可选“附带录音参考文案”生成 `reference/script.txt` |

语音模式不允许生成空的 `subtitles.srt`、占位 SRT 或按文字估时的字幕。导出清单必须明确记录：

```json
{
  "narrationMode": "voice",
  "subtitlesGenerated": false,
  "subtitleSource": "capcut-audio-recognition"
}
```

导出完成页显示：

> 已生成真人旁白，未生成字幕文件。请将 `audio/narration.wav` 导入剪映后使用“识别字幕”。

切换到语音方式时不删除现有 `text`。它可以继续作为提词内容，但默认不会出现在语音导出包中，避免用户误把文字稿或估时 SRT 当作已经和录音同步的字幕。

## 3. 功能范围

本功能必须包含：

- 项目级文字/语音旁白方式切换
- 麦克风授权、设备选择和输入音量检测
- 当前 Block 开始、暂停、继续、停止录音
- 录音计时和实时音量反馈
- 每个 Block 多个 Take、试听、选择、重录和删除
- 当前 Take 的非破坏性头尾裁剪
- 录音状态自动保存与异常恢复
- 语音完成度、缺失录音和录音文件损坏检查
- 导出合并旁白 WAV、Block 时间映射和可选独立片段
- 语音模式下禁止字幕生成
- Undo/Redo 与录音文件生命周期的安全处理

本功能不包含：

- MangaDesk 内语音转文字
- 自动字幕、字幕切句或时间轴校准
- AI 降噪、声音克隆、变声、TTS
- 多轨混音、BGM、音效或专业 DAW 能力
- 自动创建剪映工程
- 云端上传或远程保存录音

## 4. 用户体验设计

### 4.1 旁白方式入口

项目 Header 或 Project Progress 附近提供“旁白方式”选择：

```text
旁白方式  [文字文案 ▾]
          ├─ 文字文案
          └─ 真人录音
```

首次切换到真人录音时显示一次简短说明：

- 录音按 Block 保存，可分别重录。
- 导出时生成一条合并旁白。
- 不生成字幕，请在剪映中识别音频。
- 原有文案会保留，可作为提词稿。

用户确认后立即切换。再次切换无需重复确认，除非当前正在录音。录音进行中切换方式、项目、Block 或关闭应用时，必须先处理当前录音。

### 4.2 Block 编辑区

语音模式下，当前 Block 中部采用上下结构：

```text
┌─────────────────────────────────────────────┐
│ #018 · 真人录音                    03 / 64  │
│                                             │
│ 参考文案（可选，保留但不导出字幕）          │
│ [男主刚准备离开，身后突然传来了声音……]      │
│                                             │
│ 输入设备  [麦克风阵列 ▾]       音量 ▂▃▆▅   │
│                                             │
│               00:12.4                      │
│          [● 开始录音 / ■ 停止]              │
│                                             │
│ Take 3  ▶ ━━━━━━━ 00:12.4   当前使用        │
│ Take 2  ▶ ━━━━━  00:10.8   [设为当前]       │
│ Take 1  ▶ ━━━━━━ 00:11.6   [设为当前]       │
└─────────────────────────────────────────────┘
```

文字编辑框继续存在并标记为“参考文案”。用户可以边看文字边录，不强迫用户在两种输入方式之间丢失已有成果。

### 4.3 录音主流程

1. 用户选中 Block。
2. 输入音量条持续显示设备是否收到声音，但在用户点击录音前不得保存音频。
3. 点击“开始录音”。首次使用时请求麦克风权限。
4. 可选 3 秒倒计时，默认关闭；偏好保存在本机。
5. 录音期间显示红色状态、计时、音量和“暂停/停止”。
6. 停止后立刻保存为一个新 Take，并自动播放前不自动开始，避免突然出声。
7. 用户点击播放试听；满意则保持“当前使用”，不满意可重录。
8. 点击“完成并下一段”，当前 Block 标记录音完成并进入下一 Block。

停止后生成的新 Take 默认设为当前 Take。旧 Take 保留，方便比较和回退，不覆盖原文件。

### 4.4 录音状态机

```text
idle
  → requestingPermission
  → ready
  → recording
  ↔ paused
  → finalizing
  → review

任意设备/写入错误 → error → ready/retry
```

`finalizing` 期间禁用重复点击开始录音，显示“正在保存录音…”。只有主进程确认文件落盘且元数据有效后，才把 Take 加入 Project。

### 4.5 导航保护

录音期间发生以下动作时不得静默丢弃：

- 切换 Block
- 切换项目或导入新来源
- 进入 Storyboard/导出
- 关闭应用

统一提示：

```text
当前正在录音
[停止并保存] [放弃本次录音] [继续录音]
```

暂停状态也视为正在录音。放弃只删除本次 `.recording` 临时文件，不影响已有 Take。

## 5. 项目数据模型

### 5.1 Project

```ts
interface Project {
  // 现有字段……
  narration: {
    mode: 'text' | 'voice'
    defaultGapAfterMs: number
  }
}
```

默认迁移值：

```js
{ mode: 'text', defaultGapAfterMs: 300 }
```

旧项目继续保持文字工作流，不因升级自动切到录音。

### 5.2 NarrationBlock

```ts
interface NarrationBlock {
  // 现有字段……
  voice: {
    activeTakeId: string | null
    takes: VoiceTake[]
    trimStartMs: number
    trimEndMs: number | null
    gapAfterMs: number
    narrationRequired: boolean
  }
}
```

`narrationRequired` 默认为 `true`。若某个 Block 只用于画面过渡、不需要旁白，用户必须明确勾选“此段无旁白”，即设置为 `false`；系统不能因为没有录音就猜测它是静音段落。

### 5.3 VoiceTake

```ts
interface VoiceTake {
  id: string
  relativePath: string
  format: 'wav'
  codec: 'pcm_s16le'
  channels: 1
  sampleRate: 48000
  durationMs: number
  fileSize: number
  createdAt: number
  deviceLabel?: string
  processing: {
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
  }
  checksum?: string
}
```

Project JSON 只保存相对路径和元数据，不保存 Base64 音频。推荐文件位置：

```text
MangaDeskProject/
├── project.json
└── audio/
    ├── takes/
    │   └── <blockId>/
    │       ├── <takeId>.wav
    │       └── <takeId>.wav
    ├── recording/
    │   └── <sessionId>.pcm.part
    └── trash/
```

如果当前项目仍保存在 Electron `userData/projects/<id>/`，音频目录与对应 `project.json` 放在同一项目目录下。项目移动能力未来必须把两者作为整体处理。

### 5.4 状态规则

语音模式下：

```text
status.voiced =
  narrationRequired === false
  或 activeTake 存在且文件有效且 trim 后时长 > 0
```

`voiced` 应由录音状态派生或由领域命令同步维护，不允许用户在没有有效录音时手动勾选“已配音”。删除当前 Take 后自动选择最新的可用 Take；没有可用 Take 时设为 false。

文字模式下保留当前 `voiced` 的既有含义，避免破坏旧项目。Project Progress 在真人录音模式中将“配音”文案改成“录音”。

## 6. 录音格式与音频质量

### 6.1 项目录音格式

建议保存为：

```text
WAV
PCM 16-bit little-endian
48 kHz
Mono
```

理由：兼容性高、无有损重编码、便于裁切和拼接，单声道人声不会浪费双声道空间。大约占用 5.5 MB/分钟，适合作为本地桌面项目的可编辑源文件。

不要直接把浏览器产生的临时 Blob URL 写入 Project；也不要把浏览器可能生成的 WebM/Opus 当成唯一项目源文件，否则后续导出与剪映兼容性受运行环境影响。

### 6.2 采集设置

默认请求单声道，并在设备支持时开启：

- 回声消除
- 噪声抑制
- 自动增益

设置页允许高级用户关闭这些处理。开始录音前显示实时电平：

- 长时间低于阈值：提示“没有检测到声音，请检查麦克风”。
- 持续接近削波：提示“音量过高，请远离麦克风或降低输入音量”。
- 只做提醒，不自动停止或修改系统音量。

不要在 V1 自动做响度标准化、压缩或 AI 降噪。导出时保持用户试听到的声音，避免产生意外音色变化。

### 6.3 非破坏性裁剪

用户可以设置 Take 的有效起点和终点，Project 只保存毫秒值，原 WAV 不改写。试听和导出共同应用 trim，确保“听到的”和“导出的”一致。

V1 只提供头尾裁剪，不提供任意中段剪切。裁剪后不足 200ms 视为无效，阻止设为完成。

## 7. 录音文件写入与恢复

### 7.1 推荐采集链路

Renderer 使用 `getUserMedia` 获得音频流，通过 `AudioWorklet` 取得 PCM 数据；按约 0.5–1 秒批量发送可转移的 ArrayBuffer 给 Main。Main 逐块追加到本项目受控的 `.pcm.part` 文件，避免把整段录音长期堆在 Renderer 内存。

停止时：

```text
关闭采集流
    ↓
flush 最后数据块
    ↓
Main 写入正确 WAV Header
    ↓
生成 <takeId>.wav.tmp
    ↓
校验时长、大小、声道和采样率
    ↓
原子改名为 <takeId>.wav
    ↓
返回 VoiceTake 元数据
    ↓
Renderer 将 Take 写入 Project 并自动保存
```

不要为完成该功能默认引入完整 FFmpeg。如果采用 MediaRecorder 作为第一版采集方式，则必须提供稳定的 WAV 转换链路并确认打包许可、体积和剪映兼容性，不能仅更改文件扩展名。

### 7.2 崩溃恢复

每个录音临时文件旁保存最小 session 元数据：项目 ID、Block ID、采样率、声道、已写入字节数和开始时间。项目重新打开时发现可恢复 `.part`：

- 数据足够：提示“发现未完成录音”，允许恢复为 Take 或删除。
- 数据不足/损坏：提示无法恢复并允许清理。
- 不自动把恢复文件设为当前 Take。

只有属于当前项目且通过路径校验的临时文件可以恢复或删除。

### 7.3 Take 删除与 Undo

删除 Take 时先移动到 `audio/trash/`，再更新 Project。Undo 将文件移回并恢复元数据。清空回收区必须是显式项目维护动作；不得在一次普通自动保存后立即永久删除，否则 Undo 会恢复一条无法播放的记录。

关闭项目时可提示可清理空间大小，但不要自动删除未选中的 Take。用户录音具有不可轻易重建的价值，应优先保护。

## 8. 麦克风权限与隐私

- 只在用户点击“开始录音”或“测试麦克风”后请求权限。
- 应用启动、打开项目、进入语音模式时不自动录音。
- Electron 只允许当前受信任应用窗口申请音频采集权限；拒绝视频、屏幕等无关权限。
- 麦克风使用期间显示持续、醒目的录音状态，不能只靠系统托盘提示。
- 停止录音后立即停止 MediaStream tracks，释放麦克风占用。
- 录音完全保存在本地项目中，不上传网络。
- 权限被拒绝时说明如何在 Windows 隐私设置中开启，并提供“重新检测”。
- 设备拔出、系统休眠、默认设备切换时停止当前录音并保留已写入的可恢复数据。

设备偏好属于本机设置，不写入 Project；`deviceId` 在不同电脑上不稳定。Project 可记录 Take 当时的设备 label 供排查，但恢复项目时不能强制要求同名设备存在。

## 9. 播放与 Take 管理

一个 Block 同时只能播放一个 Take，切换 Block、开始录音或播放另一个 Take 时停止当前播放。播放器提供：

- 播放/暂停
- 当前时间/有效时长
- 波形或简化进度条
- 头尾裁剪手柄
- 设为当前 Take
- 重命名备注（可选）
- 删除

波形是帮助定位停顿的视觉工具，不需要专业音频编辑精度。波形峰值数据可以缓存为小型 sidecar 或 Project 元数据，不能每次渲染都读取整段 WAV。

更换当前 Take、修改 trim、修改段后间隔和删除 Take 均进入 Undo。开始/暂停/播放位置、输入电平和录音计时不进入 Undo。

## 10. 快捷键与焦点规则

以可见按钮为主，快捷键用于高频操作：

| 快捷键 | 条件 | 行为 |
|---|---|---|
| `R` | 语音面板有焦点、无文本输入、未录音 | 开始录音 |
| `R` | 正在录音 | 停止并保存 |
| `P` | 当前 Take 存在、语音面板有焦点 | 播放/暂停试听 |
| `Ctrl + Enter` | 不在录音 finalizing | 完成当前 Block 并进入下一段 |
| `Esc` | 正在录音 | 打开停止/放弃确认，不直接丢弃 |

不使用 Space 作为录音播放快捷键，因为现有 Reader 使用 Space 打开/关闭。`Ctrl + R` 也不使用，避免与 Electron 页面刷新习惯冲突。

`input`、`textarea`、`select`、`contenteditable` 和中文输入法组合期间不响应 R/P。录音 Dialog/面板通过现有 `useShortcutScope` 注册高于 Workspace 的作用域，防止 A/D 翻页等底层操作误触。

## 11. 语音导出设计

### 11.1 预检

语音模式下，导出预检增加：

| 问题 | 级别 | 处理 |
|---|---|---|
| 必须录音的 Block 没有 active Take | 阻断 | 跳回对应 Block 录音，或明确设为无旁白 |
| active Take 文件不存在/不可读 | 阻断 | 选择其他 Take 或重新录音 |
| WAV 元数据与 Project 不一致 | 阻断 | 重新检查/修复录音 |
| trim 越界或有效时长为 0 | 阻断 | 调整裁剪 |
| 峰值持续过低或存在削波 | 警告 | 可试听后确认继续，不自动处理 |
| 有参考文案但没有录音 | 阻断 | 文案不能替代语音模式的录音 |
| 明确设置为无旁白 | 通过 | 按 gap 生成静音区间 |

导出预检顶部必须显示：

```text
旁白方式：真人录音
字幕文件：不生成
剪映操作：导入 narration.wav 后识别字幕
```

### 11.2 合并规则

按 Block order 依次读取 active Take，应用 trim，然后拼接。每个 Block 后加入 `gapAfterMs` 静音，最后一个 Block 默认不追加尾部静音。统一输出：

```text
48 kHz / 16-bit / Mono WAV
```

如果某个 Take 的采样率不同，在导出服务中进行高质量重采样；不得仅修改 Header。V1 项目录音应统一为 48 kHz，使大多数导出无需重采样。

默认输出结构：

```text
Episode01/
├── images/
├── audio/
│   ├── narration.wav
│   └── timing.json
├── storyboard.html
└── project.json
```

可选“同时导出各 Block 录音”，关闭为默认。开启后增加：

```text
audio/clips/
├── 001.wav
├── 002.wav
└── 003.wav
```

界面明确提示用户导入 `narration.wav`，避免把合并音频和片段同时拖入剪映造成重复声音。

### 11.3 timing.json

```json
{
  "version": 1,
  "sampleRate": 48000,
  "durationMs": 86420,
  "blocks": [
    {
      "blockId": "...",
      "position": 1,
      "startMs": 0,
      "endMs": 12400,
      "gapAfterMs": 300,
      "takeId": "...",
      "silent": false
    }
  ]
}
```

该文件用于追溯音频与 Block 的关系，并为未来剪映辅助模式提供基础。它不是字幕文件，也不包含自动识别文字。

### 11.4 Storyboard 和项目快照

语音模式的 `storyboard.html` 在每个 Block 展示录音时长和合并后的时间范围；参考文案可以展示，但标注“录音参考文案”。离线 Storyboard 默认不内嵌音频，可提供一个指向合并旁白的播放器。

导出 `project.json` 的 manifest 增加：

```json
{
  "narration": {
    "mode": "voice",
    "file": "audio/narration.wav",
    "timingFile": "audio/timing.json",
    "subtitlesGenerated": false
  }
}
```

### 11.5 任务原子性

沿用 Phase 5 的 `.partial` 临时目录和整体发布策略。音频合并、图片渲染、HTML 和 manifest 任一失败都不得发布“成功”素材包。取消导出时关闭音频文件句柄，再清理本任务临时目录。

## 12. 代码模块设计

基于当前已经拆分后的目录，新增独立 voice feature：

```text
src/
└── features/
    └── voice/
        ├── components/
        │   ├── NarrationModeSelector.jsx
        │   ├── VoiceRecorderPanel.jsx
        │   ├── RecordingControls.jsx
        │   ├── InputLevelMeter.jsx
        │   ├── TakeList.jsx
        │   ├── TakePlayer.jsx
        │   └── TrimControl.jsx
        ├── hooks/
        │   ├── useMicrophoneDevices.js
        │   ├── useVoiceRecorder.js
        │   └── useTakePlayer.js
        ├── model/
        │   ├── voiceCommands.js
        │   ├── voiceSelectors.js
        │   └── voiceValidation.js
        └── audio/
            └── pcm-worklet.js

electron/
├── ipc/
│   └── registerVoiceIpc.js
└── services/
    ├── VoiceRecordingService.js
    ├── WavWriter.js
    └── NarrationExportService.js
```

职责边界：

- React 组件只展示状态、接受用户操作。
- `useVoiceRecorder` 管理浏览器采集状态，不直接决定项目数据。
- `VoiceRecordingService` 只处理当前项目的录音 session 和受控路径。
- `voiceCommands` 将完成的 Take 加入 Block、切换 active Take、更新 trim。
- `NarrationExportService` 校验并拼接音频，不生成字幕。
- `ExportPlanner` 根据 `project.narration.mode` 生成互斥产物计划。
- `ExportWriters.writeSubtitles` 只在 text 模式调用。

现有 `BlockEditor` 可以组合 `VoiceRecorderPanel`，但不要把麦克风、PCM 和播放器逻辑重新写进 BlockEditor。`BlockStatusPanel` 根据 narration mode 显示“配音/录音”状态与规则。

## 13. IPC 合约

推荐 preload 暴露语义化 API：

```ts
voice.startSession({ projectId, blockId, sampleRate, channels })
voice.appendChunk({ sessionId, sequence, pcmBuffer })
voice.pauseSession(sessionId)
voice.resumeSession(sessionId)
voice.finishSession(sessionId)
voice.discardSession(sessionId)
voice.listRecoverableSessions(projectId)
voice.recoverSession(sessionId)
voice.trashTake({ projectId, relativePath })
voice.restoreTake({ projectId, trashId })
voice.readTake({ projectId, relativePath })
```

实际命名可沿用当前扁平 bridge，但组件只通过 `mangaDeskBridge.voice` 访问。Main 必须校验：

- projectId 已由当前窗口打开并登记
- blockId/sessionId 属于该项目
- sequence 连续，重复 chunk 不二次写入
- 解析后的文件路径始终位于项目 audio 目录内
- 单 chunk 和单 session 有合理大小/时长限制
- session 完成或丢弃后拒绝继续追加

不要向 Renderer 暴露任意文件写入或任意路径音频读取能力。

## 14. 状态、保存和 Undo/Redo

以下进入 Project 历史：

- 完成录音并新增 Take
- 切换 active Take
- 修改 trim
- 修改 gapAfterMs
- 标记“此段无旁白”
- 删除/恢复 Take
- 切换项目旁白方式

以下不进入 Project 历史：

- 麦克风电平
- 录音中的计时与暂停状态
- 当前播放位置
- 展开/折叠 Take 列表
- 本机选择的输入设备

音频文件和 JSON 变更需要协调：先安全完成文件操作，再提交 Project command。项目自动保存失败时 Take 文件仍保留并显示“录音已保存，项目状态待重试”；不得因为 JSON 保存失败删除用户刚录的音频。

Undo 新增 Take 时移除 Project 引用并把文件移至 trash；Redo 恢复。Project 历史记录存相对路径和 trash token，不把 PCM 放进内存历史。

## 15. 实施顺序

### Step 1：模型与导出规则先行

- 增加 narration/voice 数据模型和 schema 迁移。
- 修改 Project Normalize，保证 Take 元数据不丢失。
- 修改 ExportPlanner，使 text/voice 产物互斥。
- 先增加测试：voice 模式绝不调用 `writeSubtitles`。

### Step 2：录音底层

- 实现麦克风权限、设备列表和输入电平。
- 实现 AudioWorklet PCM 采集、Main 临时写入和 WAV finalize。
- 处理暂停、停止、设备拔出和恢复 session。

### Step 3：Block 录音体验

- 增加旁白方式选择和 VoiceRecorderPanel。
- 实现 Take 列表、试听、active Take、重录与安全删除。
- 接入录音期间导航保护和快捷键作用域。

### Step 4：非破坏性编辑与完成状态

- 实现头尾 trim 和段后间隔。
- 接入 voiced 派生状态、Project Progress 和 Storyboard 检查。
- 接入 Undo/Redo、trash 和自动保存。

### Step 5：语音导出

- 合并 active Take 为 narration.wav。
- 生成 timing.json 和可选 clips。
- 更新 Storyboard、manifest、预检和完成页面。
- 验证导入剪映并使用“识别字幕”的真实流程。

## 16. 测试与验收

### 16.1 录音

- 首次授权允许、拒绝、系统禁用三种路径均有明确反馈。
- 开始前不写音频，停止后释放麦克风。
- 暂停部分不计入有效旁白或按明确设计生成，不出现随机长静音。
- 10 秒、10 分钟录音均不把全部 PCM 常驻 Renderer 内存。
- 设备拔出、休眠、应用异常后已有数据可恢复或安全删除。
- 同一 Block 连续录制 3 个 Take，能试听并切换当前 Take。

### 16.2 数据完整性

- 旧项目迁移后仍为 text 模式，现有文案和素材不变。
- 重启后 active Take、trim、gap 和文件均能恢复。
- 删除、Undo、Redo 后 Project 引用与真实文件一致。
- 项目保存失败不会删除新 Take。
- 路径穿越、伪造 sessionId、重复 chunk 被 Main 拒绝。

### 16.3 导出

- text 模式继续生成 `script.txt` 与 `subtitles.srt`，不生成 narration.wav。
- voice 模式生成 `audio/narration.wav` 与 `timing.json`，目录中不存在 `subtitles.srt`。
- voice 模式即使所有 Block 都有 text，也绝不生成 SRT。
- voice 模式参考文案默认不生成；启用后只生成 `reference/script.txt`。
- trim、Block 顺序和 gap 在合并音频中准确体现。
- 无旁白 Block 只产生明确的静音/间隔，不出现错误引用。
- 缺少必须录音、文件损坏和无效 trim 会阻断导出。
- 取消或磁盘写入失败不会发布残缺素材包。
- narration.wav 可在剪映中正常导入、播放，并可触发剪映“识别字幕”。

### 16.4 用户任务验收

让目标用户完成：

```text
选择素材
→ 切换真人录音
→ 录制两个 Block
→ 重录其中一个
→ 导出
→ 导入剪映
→ 使用剪映识别字幕
```

验收关注：用户是否知道正在为哪个 Block 录音、是否能判断哪个 Take 会被导出、是否会误把 clips 和 narration 同时导入、是否能理解为什么导出包没有 SRT。

## 17. 完成定义

以下全部满足才算功能完成：

- 用户可在项目中清晰选择文字或真人录音工作流。
- 每个 Block 可录制、暂停、试听、重录并选择 active Take。
- 录音保存为项目内本地 WAV，异常退出具备恢复路径。
- 参考文案与录音相互独立，切换模式不会丢数据。
- 语音完成状态与真实有效 Take 一致。
- 导出按 Block 顺序生成可用的 `narration.wav` 和时间映射。
- voice 模式的任何导出路径都不会创建 `subtitles.srt`。
- 导出完成页明确引导用户在剪映中识别旁白生成字幕。
- 录音权限、设备失败、文件损坏和导出失败不会造成静默数据丢失。
- 现有文字模式、图片/PDF 浏览、素材绑定、Storyboard 和导出流程无回归。

## 18. 与现有文档及代码的衔接

本功能扩展 `init.md` 中“剪映辅助”工作流，但仍遵循 MangaDesk 不负责字幕切割和最终视频制作的边界。

实施时需要同步修订 `phase5.md` 的导出产物说明：文字模式维持现有脚本/SRT；语音模式改为音频产物并禁止字幕。当前 `electron/services/ExportService.js` 中无条件执行：

```js
await writeSubtitles(temporary, plan.entries)
```

必须改为基于导出计划的显式条件，推荐形式：

```js
if (plan.narrationMode === 'text') {
  await writeScript(...)
  await writeSubtitles(...)
} else {
  await writeNarrationAudio(...)
  await writeTimingManifest(...)
}
```

条件应来自服务端重新校验后的 Project 快照，不能只相信 Renderer 传入的“不要字幕”布尔值。这样才能保证所有导出入口遵守同一规则。
