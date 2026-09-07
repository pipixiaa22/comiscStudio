# CommentaryDesk 开发文档 V1.0

> 定位：本地优先的视觉内容解说生产工作台  
> 当前两大板块：漫画解说、动漫解说  
> 核心原则：**创作判断由人完成，机械操作由软件完成。**  
> 目标：降低“看原始素材 → 写文案 → 选画面 → 整理素材 → 导入剪映”之间的切换成本。

---

# 1. 项目背景

在漫画解说、动漫解说等内容制作中，真正耗时的往往不是写文案本身，而是大量重复的机械操作：

- 在原始素材中来回翻找画面
- 截图、裁切、保存
- 视频找时间点、截片段
- 重命名素材
- 记录某段文案对应哪些图片或视频
- 在文案、文件夹、播放器、剪映之间频繁切换
- 找到之前已经用过的素材
- 将素材重新整理成剪映可以直接使用的顺序

CommentaryDesk 的目标不是替代剪映，也不是自动创作，而是将这些重复操作压缩掉。

---

# 2. 产品定位

CommentaryDesk 是一个：

> **文案 + 原始视觉素材 + 人工分镜绑定 + 剪映前置整理工具**

它不是：

- AI 写作工具
- AI 图片推荐工具
- AI 分镜决策工具
- 自动成片工具
- 视频剪辑软件
- 字幕软件
- 剪映替代品

核心职责：

```text
原始漫画 / 动漫
        ↓
人工理解剧情
        ↓
自己写文案
        ↓
自己选择最合适的画面
        ↓
文案 Block ↔ 图片 / 视频片段绑定
        ↓
故事板检查
        ↓
剪映辅助模式
        ↓
拖入剪映
        ↓
文本朗读 / 字幕 / 动效 / BGM / 精剪
```

---

# 3. 产品核心思想

## 3.1 人负责判断

以下内容不自动化：

- 哪张图最有情绪
- 哪个动漫镜头最适合当前文案
- 应该使用人物特写还是环境镜头
- 是否使用静止画面
- 是否使用连续动作
- 哪一段应该留白
- 哪个镜头应该快速切换
- 哪个表情最能表达人物情绪

这些都属于创作者自己的导演判断。

---

## 3.2 软件负责减少操作

软件负责：

- 快速浏览大量素材
- 快速定位
- 快速裁切
- 快速设置视频 In / Out
- 一键绑定当前文案块
- 自动记录对应关系
- 已使用素材标记
- 收藏
- 临时素材篮
- 故事板总览
- 素材顺序管理
- 自动命名
- 导出
- 剪映辅助窗口
- 临时生成真实图片或视频片段

---

# 4. 产品命名

不再使用 MangaDesk 作为主产品名称，因为工具未来不仅处理漫画。

推荐名称：

```text
CommentaryDesk
```

中文：

```text
解说工作台
```

项目内部可分：

```text
CommentaryDesk
├── 漫画工作区
├── 视频工作区
├── Storyboard
└── 剪映辅助模式
```

---

# 5. 技术形态

## 5.1 推荐：桌面端

不推荐第一版做纯 Web。

核心原因：

- 需要大量访问本地文件
- 需要扫描漫画目录
- 需要读取大视频
- 需要生成缩略图
- 需要临时生成裁切图
- 需要临时截取视频
- 需要本地缓存
- 需要原生拖拽文件到剪映
- 需要 Always On Top 小窗口
- 需要打开资源管理器
- 需要稳定保存本地项目

---

# 6. 推荐技术栈

```text
Electron
React
TypeScript
Vite

Zustand
TanStack Virtual

Sharp
FFmpeg
ffprobe

SQLite
或第一阶段 Project JSON
```

---

# 7. 为什么使用 Electron

推荐 Electron，而不是第一版直接使用 Tauri。

优势：

- React / TypeScript 开发效率高
- 本地文件能力成熟
- 多窗口简单
- Always On Top 简单
- 原生拖拽能力成熟
- 文件系统处理方便
- 调用 FFmpeg / Sharp 简单
- 不需要额外学习 Rust

如果未来特别关注安装包大小、资源占用，可以再考虑 Tauri。

---

# 8. 不推荐 Spring Boot

第一版不需要：

```text
Electron
↓
React
↓
HTTP
↓
Spring Boot
↓
本地文件
```

原因：

- 没有多用户
- 没有服务端业务
- 没有账号系统
- 没有权限系统
- 没有云同步
- 没有多人协作
- 没有 API 网关需求

Spring Boot 会增加复杂度，但没有实际收益。

未来需要云同步或团队协作时再增加后端。

---

# 9. 总体架构

```text
React Renderer
      │
      │ IPC
      ↓
Electron Main
      │
├── ProjectService
├── FileSystemService
├── ImageService
│      └── Sharp
├── VideoService
│      ├── FFmpeg
│      └── ffprobe
├── ThumbnailService
├── ExportService
├── NativeDragService
└── CacheService
```

---

# 10. 核心数据模型

整个软件最重要的数据单位不是字幕，而是：

```text
NarrationBlock
```

即：

> 一个完整的小型叙事 / 解说单元。

---

# 11. NarrationBlock

示例：

```text
Block #018

文案：

男主本以为事情已经结束，
却没有想到真正危险的人，
其实一直就在他的身边。

素材：

[漫画图]
[动漫片段]
[漫画特写]
```

数据结构：

```ts
interface NarrationBlock {
  id: string

  order: number

  text: string

  assets: MediaAsset[]

  note?: string

  status: {
    scriptDone: boolean
    assetDone: boolean
    voiced: boolean
    placed: boolean
    effectDone: boolean
  }

  createdAt: number
  updatedAt: number
}
```

---

# 12. MediaAsset 统一抽象

```ts
type MediaAsset =
  | ImageAsset
  | VideoAsset
```

---

# 13. ImageAsset

```ts
interface ImageAsset {
  id: string

  type: "image"

  sourceId: string

  crop?: {
    x: number
    y: number
    width: number
    height: number
  }

  order: number
}
```

---

# 14. VideoAsset

```ts
interface VideoAsset {
  id: string

  type: "video"

  sourceId: string

  startTime: number
  endTime: number

  crop?: {
    x: number
    y: number
    width: number
    height: number
  }

  order: number
}
```

---

# 15. Source 统一抽象

项目不应该写死：

```text
MANGA
ANIME
```

推荐：

```ts
type MediaSource =
  | ImageSource
  | VideoSource
```

这样未来可以混合：

```text
漫画
+
动漫
+
电影
+
电视剧
+
PV
+
截图
```

---

# 16. Project

```ts
interface Project {
  id: string

  name: string

  sources: MediaSource[]

  blocks: NarrationBlock[]

  favorites: FavoriteItem[]

  createdAt: number
  updatedAt: number
}
```

---

# 17. 工作区设计

主界面统一为三栏：

```text
┌──────────────────┬────────────────────────┬──────────────────┐
│                  │                        │                  │
│   素材浏览区      │       文案 Block       │ 当前 Block 素材  │
│                  │                        │                  │
│                  │                        │                  │
├──────────────────┴────────────────────────┴──────────────────┤
│ 状态栏 / 当前项目 / 当前 Block / 使用情况                    │
└──────────────────────────────────────────────────────────────┘
```

中间和右边共享。

左边根据媒体类型不同变化。

---

# 18. 漫画工作区

漫画核心循环：

```text
浏览
↓
看到合适画面
↓
整页 / 框选
↓
Enter
↓
加入当前 Block
```

---

# 19. 漫画素材浏览器

支持两种模式。

## 19.1 缩略图模式

```text
[P001] [P002] [P003]

[P004] [P005] [P006]

[P007] [P008] [P009]
```

用途：

- 快速找剧情位置
- 扫描整话
- 查找之前看到的画面

必须使用 Virtual Scroll。

推荐：

```text
@tanstack/react-virtual
```

---

# 20. 连续阅读模式

```text
P031
──────────────

P032
──────────────

P033
──────────────
```

适合：

- 正常看漫画
- 边读边写
- 连续寻找上下文画面

---

# 21. 漫画快捷键

```text
A / ←
上一张

D / →
下一张

Space
大图预览

F
适应窗口

Ctrl + 滚轮
缩放

Enter
当前图片加入当前 Block

B
收藏

Q
加入临时素材篮
```

---

# 22. 漫画虚拟裁切

这是漫画模块的核心功能。

用户框选：

```text
┌─────────────────────┐
│                     │
│       原漫画         │
│                     │
│     ┌────────┐      │
│     │ 选择区  │      │
│     └────────┘      │
│                     │
└─────────────────────┘
```

按：

```text
Enter
```

立即加入当前 Block。

但此时不生成真实图片。

只记录：

```json
{
  "source": "038.jpg",
  "crop": {
    "x": 0.48,
    "y": 0.52,
    "width": 0.41,
    "height": 0.36
  }
}
```

只有：

- 拖入剪映
- 导出

时才真正通过 Sharp 生成图片。

---

# 23. 为什么不第一版自动漫画拆格

不做：

- AI Panel Detection
- OCR
- 自动识别人物
- 自动判断格子
- 自动推荐

原因：

> 人已经在看漫画，拖框 + Enter 的成本非常低。

自动拆格反而可能产生大量错误和修正成本。

---

# 24. 动漫 / 视频工作区

视频核心循环：

```text
播放
↓
找到合适镜头
↓
I
↓
继续播放
↓
O
↓
Enter
↓
加入当前 Block
```

---

# 25. 视频播放器

需要：

- 播放 / 暂停
- 前进 / 后退
- 精确 Seek
- 时间码显示
- In / Out
- 缩略图时间轴
- 当前选择区域
- 单帧 / 小步定位

---

# 26. 视频核心快捷键

推荐沿用传统剪辑软件习惯：

```text
Space
播放 / 暂停

J
倒放 / 后退播放

K
暂停

L
向前播放

← / →
小步移动

Shift + ← / →
大步跳转

I
设置 In

O
设置 Out

Enter
当前 In-Out 加入 Block

B
收藏

Q
加入素材篮
```

---

# 27. 视频时间轴缩略图

普通进度条不够。

导入视频后使用 FFmpeg：

```text
每 2 秒
或
每 5 秒
```

生成缩略图。

例如：

```text
00:00 [图]
00:05 [图]
00:10 [图]
00:15 [图]
...
```

目的：

> 让用户通过视觉快速找场景，而不是反复拖进度条。

---

# 28. 整集视觉总览

24 分钟动画可以每 10 秒生成一张：

```text
00:00 [ ][ ][ ][ ][ ][ ]
01:00 [ ][ ][ ][ ][ ][ ]
02:00 [ ][ ][ ][ ][ ][ ]
...
```

用户可以快速：

```text
大致定位剧情
↓
点击
↓
进入播放器
↓
精确设置 I / O
```

---

# 29. VideoAsset 同样采用虚拟片段

选中：

```text
EP03
08:21.500
→
08:24.900
```

项目只记录：

```json
{
  "source": "EP03.mp4",
  "start": 501.5,
  "end": 504.9
}
```

不立即生成：

```text
clip_018_01.mp4
```

只有拖入剪映或导出时才真正生成。

---

# 30. FFmpeg Service

负责：

- ffprobe 获取 metadata
- 生成缩略图
- 截帧
- 截取视频
- 生成 Proxy
- 导出片段
- 临时渲染

---

# 31. Proxy 设计

后期支持：

```text
4K
HEVC
10bit
高码率
```

第一次导入：

```text
原始视频
↓
生成 720p H.264 Proxy
```

浏览使用 Proxy。

时间码仍以原始视频为基准。

最终导出使用原片。

V1 可以不实现，但数据模型要预留。

---

# 32. Block 文案编辑器

中间区域采用 Block 卡片，而不是一整篇普通文本。

示例：

```text
#017
上一段……

────────────────────────

#018 CURRENT

男主刚准备离开的时候，
身后突然传来了一阵熟悉的声音。

────────────────────────

#019
下一段……
```

这样创作者始终能看到上下文。

---

# 33. Block 基本操作

```text
Ctrl + Enter
完成当前 Block 并新建下一 Block

Alt + ↑
Block 上移

Alt + ↓
Block 下移

Ctrl + D
复制 Block

Ctrl + Shift + C
复制当前文案

Delete / 自定义
删除当前 Block
```

---

# 34. 为什么 Block 不是字幕

例如：

```text
Block：

女主没有回答，
只是默默把桌上的信推到男主面前。
```

进入剪映后可能自动拆成：

```text
女主没有回答

只是默默把桌上的信

推到男主面前
```

字幕粒度由剪映决定。

CommentaryDesk 管的是：

> 叙事块。

---

# 35. 当前 Block 素材区

右侧：

```text
当前素材

[图1] [图2] [视频1] [图3]
```

支持：

- 拖动排序
- 删除
- 双击预览
- 定位原图
- 定位原视频时间
- 查看使用位置
- 拖出到剪映

---

# 36. 定位原素材

漫画：

```text
Block Asset
↓
定位原页
↓
跳到 P122
↓
显示 Crop 区域
```

视频：

```text
Block Asset
↓
定位原视频
↓
跳到 EP05 12:38
```

这是必须从 V1 设计的功能。

---

# 37. 已使用标记

漫画：

```text
P031
P032 ●
P033 ●2
P034
```

视频：

时间轴可显示：

```text
已使用区间
```

鼠标悬停：

```text
Used by:
#012
#038
```

点击即可跳转 Block。

---

# 38. 收藏

快捷键：

```text
B
```

用途：

> 这个画面以后可能会用，但现在还没有决定。

收藏支持：

- 图片
- 图片 Crop
- 视频时间点
- 视频区间

V1 不做复杂 Tag。

---

# 39. 临时素材篮

快捷键：

```text
Q
```

与收藏不同：

收藏：

```text
长期保存
```

素材篮：

```text
当前创作过程中临时使用
```

例：

```text
Scratch Basket

[图A]
[视频B]
[图C]
[视频D]
```

以后直接拖入当前 Block。

---

# 40. Storyboard 模式

用于整体检查：

```text
#001
文案……
[图][图]

────────────────

#002
文案……
[视频3.2s]

────────────────

#003
文案……
[图][视频2.1s][图]

────────────────

#004
⚠ 未配素材
```

---

# 41. Storyboard 检查项

软件可以检查：

- Block 没有文案
- Block 没有素材
- 原始文件不存在
- Crop 无效
- 视频区间无效
- endTime <= startTime
- Source 丢失

不要检查：

- 文案好不好
- 图片合不合适
- 情绪是否正确
- 镜头是否合理

这些属于创作者。

---

# 42. 剪映辅助模式

完成 Storyboard 后：

```text
进入剪映模式
```

Electron 打开独立小窗口：

```text
┌────────────────────────────────┐
│ #18 / 64                       │
│                                │
│ 男主刚准备离开的时候，          │
│ 身后突然传来了一阵熟悉的声音。  │
│                                │
│ [复制文案]                     │
│                                │
│ [图1] [视频1] [图2]            │
│                                │
│ ← 上一段            下一段 →   │
└────────────────────────────────┘
```

窗口：

```text
Always On Top = true
```

---

# 43. 剪映阶段标准工作流

```text
CommentaryDesk
#018
↓
复制文案

剪映
↓
粘贴
↓
文本朗读
↓
生成字幕 / 调整字幕

CommentaryDesk
↓
拖入素材

剪映
↓
排列
↓
关键帧
↓
缩放 / 平移
↓
蒙版 / 动效
↓
BGM / 音效

CommentaryDesk
↓
下一 Block
```

---

# 44. 原生 Drag Out

最终目标：

漫画：

```text
虚拟 Crop
↓
拖
↓
后台 Sharp 生成 temp PNG
↓
拖入剪映
```

视频：

```text
虚拟 VideoAsset
↓
拖
↓
后台 FFmpeg 生成 temp MP4
↓
拖入剪映
```

用户不需要感知临时文件。

---

# 45. 临时缓存目录

```text
.cache/
│
├── thumbnails/
│
├── rendered-images/
│
├── rendered-videos/
│
└── proxies/
```

相同素材不重复生成。

---

# 46. 导出剪映素材包

输出：

```text
Episode01/
│
├── images/
│   ├── 001_01.png
│   ├── 001_02.png
│   ├── 002_01.png
│   └── ...
│
├── videos/
│   ├── 003_01.mp4
│   ├── 004_01.mp4
│   └── ...
│
├── script.txt
├── storyboard.html
└── project.json
```

---

# 47. 自动命名规则

```text
<BlockOrder>_<AssetOrder>
```

例如：

```text
001_01.png
001_02.png

002_01.mp4

003_01.png
003_02.mp4
```

导入剪映按名称排序后天然保持剧情顺序。

---

# 48. script.txt

示例：

```text
【001】

男主醒来的时候，
发现自己来到了一个陌生地方。


【002】

然而更加奇怪的是，
这里竟然完全看不到任何人。


【003】

直到远处突然传来一声巨响。
```

---

# 49. storyboard.html

生成离线 HTML：

```text
#001

文案……

[素材预览]

#002

文案……

[素材预览]
```

用途：

- 审稿
- 项目留档
- 手机浏览
- 检查素材顺序

---

# 50. 项目目录

```text
CommentaryDeskProject/
│
├── project.json
│
├── project.db
│
├── .cache/
│   ├── thumbnails/
│   ├── rendered-images/
│   ├── rendered-videos/
│   └── proxies/
│
└── exports/
```

---

# 51. 原始素材不复制

原漫画和原视频保持原位置。

项目只保存：

```text
source path
```

例如：

```text
D:\Media\Manga\xxx\chapter01\038.jpg
```

或：

```text
D:\Media\Anime\xxx\EP03.mkv
```

---

# 52. Thumbnail 系统

漫画：

```text
4000×6000 原图
↓
Sharp
↓
320px 缩略图
```

视频：

```text
原视频
↓
FFmpeg
↓
时间轴缩略图
```

列表只加载 Thumbnail。

打开 Viewer 时再加载原素材。

---

# 53. 自动保存

所有操作自动保存：

- 文案变化
- Block 添加
- Block 删除
- Block 排序
- 素材绑定
- Crop
- 视频 I/O
- 收藏
- 素材篮

建议：

```text
debounce 300~500ms
```

同时保留：

```text
Ctrl + S
```

---

# 54. Undo / Redo

V1 就需要支持：

```text
Ctrl + Z
Ctrl + Shift + Z
```

覆盖：

- 文案
- Block
- 素材添加
- 素材删除
- 排序
- Crop
- 视频区间
- 收藏

---

# 55. React 目录建议

```text
src/
│
├── components/
│   ├── SourceBrowser/
│   ├── MangaGrid/
│   ├── MangaViewer/
│   ├── CropOverlay/
│   ├── VideoPlayer/
│   ├── VideoTimeline/
│   ├── ThumbnailTimeline/
│   ├── BlockEditor/
│   ├── BlockList/
│   ├── BlockAssetList/
│   ├── ScratchBasket/
│   ├── FavoritePanel/
│   ├── Storyboard/
│   └── StatusBar/
│
├── pages/
│   ├── ProjectHome.tsx
│   ├── Workspace.tsx
│   ├── Storyboard.tsx
│   └── CapCutAssistant.tsx
│
├── stores/
│   ├── projectStore.ts
│   ├── blockStore.ts
│   ├── viewerStore.ts
│   └── uiStore.ts
│
└── types/
```

---

# 56. Electron 目录

```text
electron/
│
├── main.ts
├── preload.ts
│
├── ipc/
│   ├── filesystem.ts
│   ├── project.ts
│   ├── image.ts
│   ├── video.ts
│   ├── export.ts
│   └── nativeDrag.ts
│
└── services/
    ├── ProjectService.ts
    ├── ThumbnailService.ts
    ├── ImageService.ts
    ├── VideoService.ts
    ├── ExportService.ts
    ├── CacheService.ts
    └── NativeDragService.ts
```

---

# 57. IPC API 建议

Renderer 不直接访问 Node fs。

通过 preload：

```ts
window.commentaryDesk.openDirectory()

window.commentaryDesk.scanImages()

window.commentaryDesk.scanVideos()

window.commentaryDesk.generateImageThumbnail()

window.commentaryDesk.generateVideoThumbnail()

window.commentaryDesk.renderImageCrop()

window.commentaryDesk.renderVideoClip()

window.commentaryDesk.exportProject()

window.commentaryDesk.startNativeDrag()
```

---

# 58. Electron 安全建议

不要：

```text
nodeIntegration = true
```

推荐：

```text
contextIsolation = true
nodeIntegration = false
preload IPC bridge
```

---

# 59. MVP 开发顺序

## Phase 1：公共核心

先完成：

```text
Project
NarrationBlock
MediaAsset
自动保存
Undo / Redo
```

---

## Phase 2：漫画 MVP

实现：

```text
导入图片目录
Thumbnail
漫画 Grid
漫画 Viewer
Block Editor
图片 → Block
手动 Crop → Block
定位原图
```

这一步完成后软件已经可以正式用于漫画项目。

---

## Phase 3：漫画体验增强

增加：

```text
收藏
素材篮
Used 标记
Storyboard
导出图片
script.txt
```

---

## Phase 4：视频 MVP

实现：

```text
导入视频
ffprobe
Video Player
Thumbnail Timeline
I / O
VideoAsset → Block
定位原时间
```

---

## Phase 5：视频体验增强

增加：

```text
整集缩略图总览
收藏时间点
临时视频素材篮
视频导出
Proxy
```

---

## Phase 6：剪映辅助

实现：

```text
Always On Top
复制文案
Block 上一段 / 下一段
Native Drag
虚拟图片临时渲染
虚拟视频临时渲染
```

---

# 60. V1 明确不做

第一版不要做：

- AI 写文案
- AI 推荐图片
- AI 镜头判断
- OCR
- 自动漫画拆格
- 自动人物识别
- 自动视频场景识别
- AI 字幕
- TTS
- 自动视频生成
- 自动剪映工程
- 云同步
- 登录
- Spring Boot
- 微服务
- 多人协作
- 插件系统

---

# 61. 第一优先级 UX

真正最值得打磨的三个交互：

## 漫画

```text
框一下
↓
Enter
```

## 动漫

```text
I
↓
O
↓
Enter
```

## 共同

```text
写文案
↓
绑定
↓
Ctrl + Enter
↓
下一 Block
```

如果这三个循环足够顺，产品就成立。

---

# 62. 人机交互原则

用户注意力应该始终停留在：

```text
剧情
文案
画面
```

不应该停留在：

```text
路径
文件名
截图软件
导出目录
图片编号
视频剪切工具
```

---

# 63. 产品成功标准

## 漫画场景

传统：

```text
找图
↓
截图
↓
裁切
↓
保存
↓
命名
↓
加入剪映
```

目标：

```text
框选
↓
Enter
```

---

## 动漫场景

传统：

```text
播放器找到位置
↓
记录时间
↓
打开剪辑工具
↓
截片段
↓
导出
↓
命名
↓
加入剪映
```

目标：

```text
I
↓
O
↓
Enter
```

---

## 文案与素材

传统：

```text
文案工具
↔
漫画
↔
播放器
↔
文件夹
↔
剪映
```

目标：

```text
CommentaryDesk
+
剪映
```

---

# 64. 长期扩展方向

以后可以自然扩展：

```text
电影解说
电视剧解说
游戏剧情解说
纪录片解说
漫画原作 vs 动画对比
多来源混合项目
```

由于底层采用：

```text
NarrationBlock
+
MediaAsset
```

所以不需要重写核心。

---

# 65. 最终产品抽象

CommentaryDesk 最终不是“漫画工具”，也不是“动漫工具”。

真正的抽象是：

> **人工将一段解说文案，与一个或多个视觉素材片段建立关系。**

数据模型：

```text
NarrationBlock
      │
      ├── Text
      │
      └── Media[]
             │
      ┌──────┴──────┐
      ↓             ↓
    Image         Video
      │             │
    Crop          In / Out
```

---

# 66. 最终技术选型总结

```text
Electron
React
TypeScript
Vite

Zustand
TanStack Virtual

Sharp

FFmpeg
ffprobe

Project JSON
↓
稳定后 SQLite

Electron IPC
Electron BrowserWindow
Electron Native Drag
```

---

# 67. 第一版最小可用版本建议

如果希望最快做出真正能用的版本，只做：

```text
1. 创建项目

2. 导入漫画目录

3. 漫画高速浏览

4. NarrationBlock 文案编辑

5. 框选漫画区域

6. Enter 绑定当前 Block

7. Block 素材排序

8. 定位原图

9. Storyboard

10. 自动保存
```

先真实做一条漫画解说。

根据实际使用中的痛点，再继续开发动漫模块。

但底层数据模型从第一天就使用统一的：

```text
MediaAsset
```

而不是写死 ImageAsset。

这样第二阶段加入 Anime / Video 时，不需要重构整个项目。

---

# 68. 开发核心原则

最后保留四条：

> **不要替用户做创作决定。**

> **不要为了“智能”增加额外操作。**

> **不要生成用户不需要管理的中间文件。**

> **任何高频动作都应该尽可能压缩到一个快捷键或一次拖拽。**

这四条应该作为 CommentaryDesk 后续所有功能设计的判断标准。
