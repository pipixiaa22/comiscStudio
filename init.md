# 漫画解说生产工作台 MangaDesk

## 1. 产品定位

MangaDesk 是一个面向漫画解说、自媒体剧情解说创作者的本地桌面生产工具。

它不负责：

* AI 写文案
* AI 推荐图片
* AI 判断镜头
* AI 配音
* 自动生成最终视频
* 替代剪映

它解决的是：

> 漫画阅读、文案创作、画面选择、分镜整理、素材管理、剪映前置准备之间频繁切换所造成的效率损失。

产品核心原则：

**判断由人完成，机械操作由软件完成。**

完整工作流：

```text
导入漫画
    ↓
高速阅读 / 浏览漫画
    ↓
创建解说 Block
    ↓
自己写文案
    ↓
自己选择画面
    ↓
图片 / 裁切区域绑定当前 Block
    ↓
继续下一 Block
    ↓
故事板检查
    ↓
进入剪映辅助模式
    ↓
复制文案 / 拖入图片
    ↓
剪映文本朗读
    ↓
剪映字幕 / 动效 / BGM / 精剪
    ↓
成片
```

---

# 2. 为什么选择桌面端

本工具不推荐纯 Web 实现。

核心原因不是 UI，而是文件操作。

MangaDesk 会频繁进行：

```text
扫描本地漫画文件夹
读取数百甚至数千张图片
生成缩略图
记录原始路径
导出图片
批量重命名
打开资源管理器
把图片拖出软件
拖入剪映
```

浏览器虽然已经提供 File System Access API，但本地文件访问仍受用户授权和浏览器安全机制约束。

对于这种高度依赖本地素材的生产力软件，桌面程序更加自然。

---

# 3. 推荐技术栈

## 3.1 最终推荐

```text
Desktop
│
├── Electron
│
├── React
│
├── TypeScript
│
├── Vite
│
├── Zustand
│
├── Sharp
│
└── SQLite / Project JSON
```

### UI

```text
React
+
TypeScript
```

用于：

* 漫画浏览器
* Block 编辑器
* Storyboard
* 素材篮
* 图片查看器
* 剪映辅助模式

### 桌面容器

```text
Electron
```

负责：

* 文件系统
* 文件夹选择
* 窗口管理
* Always On Top
* 系统剪贴板
* 原生文件拖拽
* Explorer 打开
* 快捷键
* 导出
* 本地缓存

Electron 官方支持把文件从应用拖到操作系统环境，因此未来可以实现：

```text
MangaDesk 图片
      ↓ 拖
剪映素材区
```

而不需要先：

```text
导出
↓
打开文件夹
↓
找到文件
↓
拖入剪映
```

### 图片处理

推荐：

```text
Sharp
```

负责：

* 生成 thumbnail
* Crop
* Resize
* PNG/JPEG/WebP 输出
* 导出实际素材

### 状态管理

推荐：

```text
Zustand
```

管理当前 UI 状态：

```text
currentBlockId
currentPage
selectedAsset
viewerScale
panelLayout
storyboardMode
clipboardBasket
```

不建议第一版 Redux。

### 项目持久化

第一阶段可以直接：

```text
project.json
```

第二阶段再升级：

```text
SQLite
```

---

# 4. 不需要 Spring Boot

这个项目第一版完全没有必要：

```text
React
↓
HTTP
↓
Spring Boot
↓
Database
```

因为没有：

* 多用户
* 云端账号
* 权限系统
* 网络服务
* AI API
* 多端同步

如果使用 Spring Boot，反而变成：

```text
Electron
↓
React
↓
HTTP
↓
Java
↓
本地文件
```

复杂度没有带来对应价值。

推荐结构：

```text
React Renderer
       │
       │ IPC
       ↓
Electron Main
       │
 ┌─────┼────────┐
 ↓     ↓        ↓
文件   Sharp    SQLite
系统
```

如果未来做：

```text
账号
云同步
团队协作
在线项目
```

再增加 Spring Boot。

---

# 5. 产品核心数据单位：Block

不要使用“字幕”作为核心单位。

核心对象定义为：

```text
NarrationBlock
```

也就是：

> 一个小的剧情 / 解说段落。

例如：

```text
Block #021

文案：

男主本以为事情已经结束，
却没想到真正的危险此刻才刚刚开始。

画面：

[图A]
[图B]
[图C]
```

它进入剪映后可能产生：

```text
字幕1
男主本以为事情已经结束

字幕2
却没想到真正的危险

字幕3
此刻才刚刚开始
```

这是剪映阶段的问题。

MangaDesk 不负责字幕切割。

---

# 6. 核心数据模型

## Project

```ts
interface Project {
  id: string
  name: string

  sourceDirectories: string[]

  blocks: NarrationBlock[]

  createdAt: number
  updatedAt: number
}
```

---

## NarrationBlock

```ts
interface NarrationBlock {
  id: string

  order: number

  text: string

  assets: BlockAsset[]

  note?: string

  status: {
    scriptDone: boolean
    assetDone: boolean
    voiced: boolean
    edited: boolean
    effectDone: boolean
  }
}
```

---

## MangaSource

```ts
interface MangaSource {
  id: string

  path: string

  fileName: string

  width: number
  height: number

  order: number
}
```

---

# 7. 一个非常关键的数据设计：不要立即截图

这是整个软件最值得实现的设计之一。

假设漫画原图：

```text
chapter01/
038.jpg
```

其中只有右下角这一格你想使用。

传统流程：

```text
打开漫画
↓
截图
↓
Crop
↓
保存
↓
命名
↓
加入项目
```

MangaDesk 不应该这样。

用户直接在图片上框选：

```text
┌─────────────────────┐
│                     │
│       原漫画         │
│                     │
│      ┌───────┐      │
│      │选择区 │      │
│      └───────┘      │
│                     │
└─────────────────────┘
```

按：

```text
Enter
```

程序只记录：

```ts
{
  source: "038.jpg",

  crop: {
    x: 0.48,
    y: 0.52,
    width: 0.41,
    height: 0.36
  }
}
```

而不是马上创建：

```text
038_crop_123213.png
```

也就是说：

> 项目阶段保存“裁切信息”，导出阶段才真正生成图片。

---

# 8. BlockAsset

```ts
interface BlockAsset {
  id: string

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

这样：

```text
原漫画
038.jpg
```

可以被：

```text
Block #08
使用整个画面

Block #17
裁脸部

Block #31
裁人物全身
```

三个地方同时使用。

不会产生大量重复图片。

---

# 9. 主界面设计

推荐：

```text
┌────────────────────────────────────────────────────────────┐
│ MangaDesk     项目：XXX                    Storyboard 导出 │
├────────────────┬────────────────────────┬──────────────────┤
│                │                        │                  │
│   漫画浏览器    │      文案编辑器         │ 当前 Block 素材 │
│                │                        │                  │
│ P031           │ Block #018             │ [1] [2] [3]     │
│ P032           │                        │                  │
│ P033           │ 男主刚准备离开，        │                  │
│ P034           │ 身后突然传来了声音。    │                  │
│ P035           │                        │                  │
│ ...            │                        │                  │
│                │      + 下一 Block      │                  │
│                │                        │                  │
├────────────────┴────────────────────────┴──────────────────┤
│  P034    Zoom 100%        当前项目 18 / 64                 │
└────────────────────────────────────────────────────────────┘
```

---

# 10. 左侧：漫画浏览器

这是整个软件最重要的区域之一。

需要支持两种显示方式。

## 模式 A：缩略图瀑布流

```text
[P001] [P002] [P003]

[P004] [P005] [P006]

[P007] [P008] [P009]
```

适合：

> 快速定位大概在哪一段剧情。

要求：

* Virtual Scroll
* 缩略图懒加载
* 缩略图缓存
* Ctrl + 滚轮调整大小

---

## 模式 B：连续漫画模式

类似漫画阅读器：

```text
P031
──────────────

P032
──────────────

P033
──────────────
```

适合：

> 边读漫画边写解说。

---

# 11. 图片浏览最重要的交互

支持：

```text
A / ←
上一张

D / →
下一张

Space
大图预览

Ctrl + 鼠标滚轮
Zoom

F
Fit Window
```

---

# 12. 图片添加方式

用户选中图片后：

```text
Enter
```

加入当前 Block。

或者：

```text
双击图片
```

加入当前 Block。

当前 Block：

```text
#018
```

所有新增素材默认进入：

```text
Block #018
```

不弹窗确认。

---

# 13. 手动画框截图

用户在漫画上：

```text
鼠标左键拖动
```

得到：

```text
Crop Selection
```

例如：

```text
┌────────────────────────┐
│                        │
│       原始漫画          │
│                        │
│    ┌────────────┐      │
│    │ 女主特写    │      │
│    └────────────┘      │
│                        │
└────────────────────────┘
```

按：

```text
Enter
```

直接：

```text
裁切区域 → 当前 Block
```

按：

```text
Esc
```

取消。

这是整个产品非常核心的功能。

因为大量漫画解说真正需要的是：

> 一页里面的某个角色 / 某个格子。

---

# 14. 图片不用真正拆格

第一版不要做：

```text
自动 Panel Detection
AI 漫画拆格
OCR
图像识别
```

全部不需要。

原因：

> 人本来就在看漫画。

直接：

```text
拖框
↓
Enter
```

可能比自动拆格之后再修正还快。

这是典型的：

> 不要自动化判断，而要降低人工判断成本。

---

# 15. 中间：Block 文案编辑器

设计成卡片式。

例如：

```text
┌─────────────────────────────────┐
│ #018                         ✓   │
│                                 │
│ 男主刚准备离开的时候，           │
│ 身后突然传来了一阵熟悉的声音。   │
│                                 │
│ 3 张素材                         │
└─────────────────────────────────┘
```

当前 Block 大尺寸编辑。

前后 Block 小尺寸显示。

例如：

```text
#017
上一段内容……

────────────────────────

#018 CURRENT

男主刚准备离开的时候，
身后突然传来了一阵熟悉的声音。

────────────────────────

#019
下一段……
```

这样用户始终知道剧情上下文。

---

# 16. 快速创建 Block

推荐：

```text
Ctrl + Enter
```

完成当前 Block，并创建下一 Block。

流程：

```text
写文案
↓
选图
↓
Ctrl + Enter
↓
下一 Block
```

---

# 17. Block 快捷操作

```text
Ctrl + Enter
新建下一 Block

Alt + ↑
Block 上移

Alt + ↓
Block 下移

Ctrl + D
复制 Block

Ctrl + Shift + C
复制当前 Block 文案

Ctrl + Backspace
删除 Block
```

---

# 18. 右侧：当前 Block 素材

展示：

```text
当前素材

┌─────┐ ┌─────┐ ┌─────┐
│  1  │ │  2  │ │  3  │
└─────┘ └─────┘ └─────┘
```

支持：

```text
Drag
改变顺序

Delete
删除

Double Click
查看原图

右键
定位原页
```

---

# 19. “定位原图”非常重要

例如：

```text
Block #47
```

里面使用了一张：

```text
P122 Crop
```

点击：

```text
定位原页
```

漫画浏览器立即滚动到：

```text
P122
```

并高亮原来的：

```text
Crop Rect
```

这个功能应该从第一版就做。

---

# 20. 图片使用状态

漫画浏览器中：

```text
P031

P032   ●

P033   ●2

P034

P035   ●
```

代表：

```text
●
使用过一次

●2
使用过两次
```

鼠标悬停：

```text
Used by

#012
#038
```

点击：

```text
#038
```

立即跳转对应 Block。

---

# 21. 收藏

使用：

```text
B
```

收藏当前图片。

显示：

```text
★
```

用途：

> 看到一个不错的画面，但暂时不知道放在哪。

收藏页面：

```text
Favorites

[图]
[图]
[图]
[图]
```

第一版不需要 Tag 系统。

只有：

```text
收藏
```

就已经够用。

---

# 22. 临时素材篮

除了收藏，还需要：

```text
Scratch Basket
```

也就是：

> 我觉得这几张马上可能会用，但暂时没有决定放哪里。

快捷键：

```text
Q
```

加入素材篮。

例如：

```text
素材篮

[A] [B] [C] [D] [E]
```

以后直接拖到 Block。

---

# 23. 为什么“收藏”和“素材篮”要分开

收藏：

```text
长期
这个画面以后可能有用
```

素材篮：

```text
短期
这几个画面正在考虑使用
```

类似：

```text
Favorites
vs
Clipboard
```

这是符合实际创作习惯的。

---

# 24. Storyboard 模式

文案配图完成后：

```text
Storyboard
```

显示：

```text
#001
男主醒来……
[图][图]

────────────────

#002
他发现……
[图]

────────────────

#003
突然……
[图][图][图]

────────────────

#004
⚠ 未选择画面
```

这是整个视频的：

> 静态粗剪预览。

---

# 25. Storyboard 需要检测的问题

自动提示：

```text
⚠ Block 没有文案

⚠ Block 没有图片

⚠ 图片文件不存在

⚠ Crop 超出范围
```

但是不要判断：

```text
图片是否合适
文案是否好
节奏是否合理
```

这些属于人的判断。

---

# 26. Project 状态

顶部：

```text
Project Progress

文案：
62 / 64

素材：
59 / 64

剪映配音：
31 / 64

画面：
27 / 64

动效：
18 / 64
```

Block 状态：

```text
☑ 文案完成
☑ 素材完成
☐ 已配音
☐ 已放图
☐ 动效完成
```

---

# 27. 剪映辅助模式

这是另一个核心功能。

点击：

```text
进入剪映模式
```

打开一个独立小窗口。

Electron BrowserWindow 可以非常适合实现这种独立桌面窗口。

窗口：

```text
┌──────────────────────────────────┐
│  #18 / 64                        │
│                                  │
│  男主刚准备离开的时候，           │
│  身后突然传来了一阵熟悉的声音。   │
│                                  │
│  [复制文案]                      │
│                                  │
│  [图1] [图2] [图3]               │
│                                  │
│  ← 上一段           下一段 →     │
└──────────────────────────────────┘
```

设置：

```text
Always On Top = true
```

始终浮在剪映旁边。

---

# 28. 剪映工作流

最终用户操作：

```text
MangaDesk
#018
↓
复制文案

剪映
↓
粘贴文本
↓
文本朗读

MangaDesk
↓
拖入 图1 图2 图3

剪映
↓
排列
↓
关键帧
↓
动效

MangaDesk
↓
下一段
```

然后：

```text
#019
```

重复。

---

# 29. 极其值得实现：图片直接拖进剪映

Electron 可以实现 Desktop Native File Drag & Drop。

所以：

```text
MangaDesk

[漫画图]
   │
   │ mouse drag
   ↓
剪映素材区
```

应该成为最终交互目标。

---

# 30. Crop 图片拖进剪映的问题

因为 Crop 目前只是：

```text
source.jpg
+
cropRect
```

没有真实文件。

所以第一次拖动 Crop 时：

```text
Crop Asset
↓
生成临时文件
↓
temp/
block018_xxx.png
↓
native drag
↓
剪映
```

缓存：

```text
temp/rendered-assets/
```

相同 crop 不重复生成。

---

# 31. 导出素材包

点击：

```text
Export for CapCut
```

输出：

```text
Episode01/
│
├── images/
│   ├── 001_01.jpg
│   ├── 001_02.jpg
│   │
│   ├── 002_01.jpg
│   │
│   ├── 003_01.jpg
│   └── 003_02.jpg
│
├── script.txt
│
├── storyboard.html
│
└── project.json
```

图片顺序：

```text
Block_Order
+
Asset_Order
```

自动命名：

```text
001_01
001_02

002_01

003_01
003_02
```

导入剪映按名称排序即：

```text
剧情顺序
```

---

# 32. script.txt

输出：

```text
【001】

男主醒来的时候，
发现自己躺在一个完全陌生的地方。


【002】

可更加奇怪的是，
房间里面竟然一个人都没有。


【003】

直到房门突然被人推开。
```

---

# 33. storyboard.html

生成一个可以浏览器打开的离线页面：

```text
#001

文案……

[图][图]


#002

文案……

[图]


#003

文案……

[图][图]
```

用于：

* 审稿
* 留档
* 手机查看
* 视频完成前检查

---

# 34. 文件系统设计

不复制漫画原图。

项目只保存：

```text
source path
```

例如：

```text
D:\Manga\xxx\chapter01\038.jpg
```

项目文件：

```text
D:\MangaDeskProjects\xxx\
```

保存：

```text
project.json
```

以及：

```text
.cache/
```

---

# 35. 推荐项目目录

```text
MangaDeskProject/
│
├── project.json
│
├── project.db
│
├── thumbnails/
│
├── cache/
│
│   └── rendered-assets/
│
└── exports/
```

原漫画：

```text
D:\Manga\
```

保持完全不动。

---

# 36. Thumbnail 系统

不能直接每次加载原始漫画。

假设：

```text
500张
每张 4000×6000
```

直接渲染会严重影响性能。

第一次导入：

```text
Original
↓
Sharp
↓
Thumbnail
```

例如：

```text
320px
```

浏览列表只加载 thumbnail。

点击大图：

```text
再加载原始图片
```

---

# 37. Virtual List

漫画浏览必须：

```text
Virtualized Grid
```

而不能把：

```text
1000张图片
```

全部生成 DOM。

推荐：

```text
@tanstack/react-virtual
```

结构：

```text
只渲染当前屏幕
+
前后少量 buffer
```

这样数千张图依然流畅。

---

# 38. 自动保存

用户不应该需要频繁：

```text
Ctrl + S
```

任何操作：

```text
文案变化
绑定图片
删除图片
Block 移动
Crop
收藏
```

自动：

```text
debounce 300~500ms
↓
save project
```

同时保留：

```text
Ctrl + S
```

手动保存。

---

# 39. Undo / Redo

必须从 V1 就设计。

支持：

```text
Ctrl + Z
Ctrl + Shift + Z
```

作用于：

* 文案
* 图片添加
* 图片删除
* Crop
* 排序
* Block 删除
* Block 排序

否则创作工具使用体验会非常差。

---

# 40. 搜索暂时不用复杂化

V1：

```text
文件名
页码
```

例如输入：

```text
128
```

跳：

```text
P128
```

不用：

```text
OCR
语义搜索
人物搜索
AI搜索
```

---

# 41. 第一版页面结构

```text
/
ProjectHome

/project/:id
Workspace

/storyboard/:id
Storyboard

/export/:id
Export

/capcut/:id
CapCutAssistant
```

---

# 42. React Component 建议

```text
src/
│
├── components/
│
│   ├── MangaGrid/
│   ├── MangaViewer/
│   ├── CropOverlay/
│   ├── BlockEditor/
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
│   ├── viewerStore.ts
│   └── uiStore.ts
│
└── types/
```

Electron：

```text
electron/
│
├── main.ts
├── preload.ts
│
├── ipc/
│   ├── filesystem.ts
│   ├── image.ts
│   ├── project.ts
│   └── nativeDrag.ts
│
└── services/
    ├── ThumbnailService.ts
    ├── ExportService.ts
    └── ProjectService.ts
```

---

# 43. IPC 设计

Renderer 不直接获得：

```text
Node fs
```

通过 preload：

```ts
window.mangaDesk.openDirectory()

window.mangaDesk.scanImages()

window.mangaDesk.generateThumbnail()

window.mangaDesk.renderCrop()

window.mangaDesk.exportProject()

window.mangaDesk.startNativeDrag()
```

避免：

```text
nodeIntegration = true
```

保持 Electron 安全边界。

---

# 44. MVP 开发顺序

## Phase 1

先完成：

```text
创建项目

导入图片目录

Thumbnail

漫画 Grid

大图 Viewer
```

目标：

> 能把一本漫画舒服地看起来。

---

## Phase 2

增加：

```text
Block Editor

新建 Block

Block 排序

文案保存
```

目标：

> 能写完整解说稿。

---

## Phase 3

增加：

```text
图片 → Block

Crop → Block

Block 图片排序

定位原图
```

到这一步已经形成真正核心产品。

---

## Phase 4

增加：

```text
收藏

素材篮

图片 Used 标记

Storyboard
```

---

## Phase 5

增加：

```text
导出

自动命名

script.txt

storyboard.html
```

---

## Phase 6

最后再做：

```text
剪映辅助窗口

Always On Top

复制文案

Native File Drag

临时 Crop Render
```

这会成为整个工具体验上的最后一块拼图。

---

# 45. V1 明确不要做什么

不要第一版就做：

```text
AI

OCR

自动漫画拆格

语义搜索

自动字幕

文本转语音

视频生成

自动关键帧

自动剪映工程

云同步

账号

Spring Boot

微服务

多人协作
```

全部推迟。

---

# 46. 衡量产品是否成功

不要看：

```text
功能多不多
```

看三个指标。

### 指标一

原本：

```text
找到漫画画面
↓
截图
↓
Crop
↓
保存
↓
重命名
↓
找到文件
↓
加入剪映
```

变成：

```text
框选
↓
Enter
```

---

### 指标二

原本：

```text
我要找刚才那张图
```

需要几十秒。

现在：

```text
点击 Block Asset
↓
定位原图
```

1秒。

---

### 指标三

原本不断：

```text
漫画
→ Word
→ Explorer
→ 剪映
→ 漫画
→ Explorer
→ Word
```

最终变成：

```text
MangaDesk
        +
剪映
```

两个软件。

---

# 47. 最终核心 UX

整个产品应该围绕以下循环设计：

```text
                写
                │
                ↓
      看 ← 当前 Block → 选
                │
                ↓
              下一段
```

用户的注意力应该始终停留在：

```text
剧情
文案
画面
```

而不是：

```text
文件路径
图片编号
保存位置
文件名称
软件窗口
```

这就是 MangaDesk 最重要的人机交互目标。

---

# 48. 最终技术选型

推荐：

```text
Electron
React
TypeScript
Vite

Zustand
TanStack Virtual

Sharp

Project JSON
↓
后期 SQLite

Electron IPC
Electron Native Drag
```

第一版不使用：

```text
Spring Boot
Python
Rust
AI模型
远程服务器
```

这套技术栈的目标不是追求技术复杂度最低的安装包，而是：

> 用最低的开发成本，把“本地漫画素材 + React UI + 剪映桌面工作流”打通。
