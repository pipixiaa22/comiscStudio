# MangaDesk Phase 2 开发文档

> 主题：Block 文案编辑与项目持久化  
> 前置条件：Phase 1 已能导入漫画目录、浏览缩略图并查看原图  
> 阶段目标：用户能够在同一个项目中从头到尾写完一份有序、可恢复的漫画解说稿

## 1. 本阶段交付范围

Phase 2 必须交付：

- 创建、选择、编辑、复制、删除和排序 `NarrationBlock`
- 展示当前 Block 及相邻 Block 的文案上下文
- `Ctrl + Enter` 完成当前 Block 并创建下一 Block
- 文案和 Block 结构自动保存到 `project.json`
- `Ctrl + S` 立即保存，并显示保存状态
- Block 操作的 Undo / Redo
- 关闭并重新打开应用后恢复项目、漫画目录和当前编辑位置

本阶段不交付：

- 图片绑定、Crop、Block 素材排序（Phase 3）
- 收藏、素材篮、图片 Used 标记、Storyboard（Phase 4）
- 导出、剪映辅助窗口、AI、OCR、账号和云同步
- SQLite；V1 继续使用可读、可迁移的 JSON

## 2. 基于当前仓库的实现约束

当前代码是 Electron + React 19 + Vite 的 JavaScript 原型，入口为 `main.js`、`preload.js` 和 `src/App.jsx`。Phase 2 不把“全量迁移 TypeScript”作为前置任务，避免范围失控；新增模型应使用集中定义的工厂函数、运行时校验和 JSDoc 类型。后续可以独立迁移到 TypeScript。

必须保持 Electron 安全边界：

```text
React Renderer
    ↓ 仅调用 window.mangaDesk
preload（contextBridge）
    ↓ ipcRenderer.invoke
Electron Main
    ↓
ProjectService / 本地文件系统
```

- `contextIsolation: true`
- `nodeIntegration: false`
- Renderer 不直接使用 `fs`、`path` 或任意 Node API
- IPC 参数必须校验；只允许读写当前项目文件

## 3. 核心用户流程

### 3.1 首次进入

1. 用户点击“导入漫画目录”。
2. 应用扫描图片并以目录名创建项目。
3. 自动创建第一个空 Block，编号显示为 `#001`。
4. 光标自动进入当前 Block 文案编辑框。
5. 项目保存为 MangaDesk 管理的项目文件，之后可从“最近项目”恢复。

项目文件位置建议使用：

```text
app.getPath('userData')/projects/<project-id>/project.json
```

该路径不修改、不污染漫画原图目录。`project.json` 内仅保存原图路径和项目数据。

### 3.2 连续写稿

```text
编辑当前 Block 文案
        ↓
Ctrl + Enter
        ↓
当前 Block scriptDone = true
        ↓
在当前 Block 后插入新 Block
        ↓
切换并聚焦新 Block
```

若当前 Block 后已经存在一个完全空的 Block，则直接进入它，不重复创建空 Block。

### 3.3 恢复工作

应用启动时读取最近一次成功打开的项目：

- 源目录存在：恢复图片列表、当前页、当前 Block 和编辑滚动位置
- 源目录不存在：仍允许编辑文案，并显示“源目录不可用”，不可静默丢失项目
- 项目 JSON 损坏：保留原文件，尝试读取 `.bak`，并向用户显示可理解的错误

## 4. 数据模型

### 4.1 项目文件版本

```js
/** @typedef {Object} Project */
{
  schemaVersion: 1,
  id: "uuid",
  name: "chapter01",
  sourceDirectories: ["D:\\Manga\\chapter01"],
  sources: [],
  blocks: [],
  workspace: {
    currentBlockId: "uuid",
    currentSourceId: "uuid-or-null"
  },
  createdAt: 1770000000000,
  updatedAt: 1770000000000
}
```

`schemaVersion` 必须从 Phase 2 开始写入，为 Phase 3 增加素材字段以及未来迁移预留入口。

### 4.2 NarrationBlock

```js
{
  id: "uuid",
  order: 0,
  text: "男主刚准备离开……",
  assets: [],
  note: "",
  status: {
    scriptDone: false,
    assetDone: false,
    voiced: false,
    edited: false,
    effectDone: false
  },
  createdAt: 1770000000000,
  updatedAt: 1770000000000
}
```

规则：

- `id` 使用 `crypto.randomUUID()`，不可用数组下标或 `order` 作为身份
- `order` 在内存和落盘前始终归一化为从 `0` 开始的连续整数
- Block 编号是按当前顺序计算的展示值，不持久化 `#001` 这样的字符串
- `assets` 在 Phase 2 固定为空数组，为 Phase 3 保持模型兼容
- `scriptDone` 由用户通过 `Ctrl + Enter` 或状态按钮明确设置；继续编辑已完成文案时自动恢复为 `false`
- 删除最后一个 Block 后必须立即补建一个空 Block，项目永远至少有一个 Block

## 5. UI 与布局

Phase 1 的双栏工作区升级为三栏：

```text
┌──────────────────────────────────────────────────────────────────┐
│ MangaDesk  项目名             已保存        3 / 24       导入目录 │
├────────────────────┬────────────────────────────┬────────────────┤
│ 漫画浏览器          │ Block 文案编辑器           │ 当前 Block     │
│                    │                            │                │
│ [P001] [P002]      │ #007 上一段摘要            │ 阶段状态       │
│ [P003] [P004]      │ ─────────────────────────  │ 文案 ✓         │
│                    │ #008 CURRENT               │ 素材 —         │
│                    │ [多行文案编辑框]            │                │
│                    │ ─────────────────────────  │ 快捷键提示     │
│                    │ #009 下一段摘要            │                │
├────────────────────┴────────────────────────────┴────────────────┤
│ P034 · Zoom 100%                         Block 8 / 24 · 已保存    │
└──────────────────────────────────────────────────────────────────┘
```

建议宽度：漫画栏 `32%`、编辑栏 `48%`、状态栏 `20%`；窗口小于 `1180px` 时右侧状态栏可折叠，但编辑器不可被隐藏。

### 5.1 Block 编辑器

- 当前 Block 使用大尺寸 `textarea`，支持换行和中文输入法
- 上一个、下一个 Block 显示编号及最多两行摘要；点击可切换
- Block 列表提供全局顺序浏览，至少可通过当前卡片上下导航
- 空文案显示占位：“在这里写这一段解说……”
- 文案字数仅作信息展示，不设置质量判断或字数限制
- 输入时只更新本地状态；自动保存由统一保存调度器处理

### 5.2 保存状态

顶部或状态栏显示以下互斥状态：

```text
已保存
正在保存…
有未保存修改
保存失败 · 重试
```

保存失败不得清空 dirty 状态；后续修改或点击“重试”可以再次保存。

## 6. 快捷键与交互规则

| 快捷键 | 行为 | 边界规则 |
|---|---|---|
| `Ctrl + Enter` | 完成当前 Block，并进入/创建下一 Block | 输入法组合期间不触发 |
| `Alt + ↑` | 当前 Block 上移一位 | 首项禁用 |
| `Alt + ↓` | 当前 Block 下移一位 | 末项禁用 |
| `Ctrl + D` | 复制当前 Block 并插入其后 | 阻止浏览器默认收藏行为 |
| `Ctrl + Shift + C` | 复制当前文案 | 通过 Electron clipboard IPC；为空时禁用 |
| `Ctrl + Backspace` | 删除当前 Block | 文本框内默认用于删词，因此仅在编辑框未聚焦时触发；编辑器内用显式删除按钮 |
| `Ctrl + S` | 立即保存 | 阻止浏览器“保存网页” |
| `Ctrl + Z` | Undo | 编辑框原生输入与项目命令不得重复撤销 |
| `Ctrl + Shift + Z` / `Ctrl + Y` | Redo | Windows 两种习惯均支持 |

键盘监听必须忽略 `event.isComposing === true`，防止中文输入法回车误创建 Block。A/D、Space 等 Phase 1 浏览快捷键在 `input`、`textarea` 或可编辑元素聚焦时不得触发。

## 7. 状态管理与命令设计

当前 `App.jsx` 中散落的状态应拆分为：

```text
projectStore
├── project
├── currentBlockId
├── dirty / saveState
├── undoStack / redoStack
└── Block actions

viewerStore（可先保留 React state）
├── images / selectedSource
├── search
└── preview
```

可以引入 Zustand，也可以先以 `useReducer + Context` 实现；无论选哪种，业务变更都必须通过命令式 action，禁止组件直接修改嵌套项目对象。

建议 action：

```js
createBlock({ afterBlockId })
updateBlockText({ blockId, text })
setBlockScriptDone({ blockId, done })
duplicateBlock({ blockId })
deleteBlock({ blockId })
moveBlock({ blockId, direction })
selectBlock(blockId)
undo()
redo()
```

### Undo / Redo 粒度

- 新建、复制、删除、排序：每次操作一条历史记录
- 连续文案输入：按一次编辑会话合并；建议在 700ms 无输入、失焦或切换 Block 时封口
- Undo/Redo 后同样标记 dirty 并触发自动保存
- 自动保存、选择 Block、切换漫画页不进入历史栈
- 历史只保存在内存中，重启后不恢复；建议最多 100 条

## 8. 自动保存与原子写入

Renderer 中项目数据变化后 debounce `400ms` 调用：

```js
window.mangaDesk.saveProject(project)
```

Electron Main 的写入顺序：

```text
校验 project.id / schemaVersion / blocks
        ↓
写入 project.json.tmp
        ↓
将现有 project.json 复制或轮换为 project.json.bak
        ↓
原子替换 project.json
        ↓
返回 { savedAt, updatedAt }
```

要求：

- 同一项目保存串行执行，不能让旧请求覆盖新请求
- Renderer 为每次保存附带递增 `revision`；只接受当前最新 revision 的结果更新 UI
- 应用关闭前若仍有未保存修改，应尝试 flush；失败时提示用户，不可静默退出
- JSON 使用 UTF-8、2 空格缩进，便于人工检查与恢复
- 主进程校验最终路径仍位于 `userData/projects/<project-id>/` 内，防止路径穿越

## 9. IPC 合约

在 `preload.js` 暴露最小 API：

```js
window.mangaDesk = {
  chooseDirectory(),
  createProject(payload),
  loadRecentProject(),
  loadProject(projectId),
  saveProject(project),
  copyText(text)
}
```

建议返回统一结果：

```js
{ ok: true, data: ... }
{ ok: false, error: { code: "PROJECT_WRITE_FAILED", message: "..." } }
```

Renderer 只展示安全、可理解的信息；详细堆栈留在主进程日志。

## 10. 建议目录调整

```text
src/
├── App.jsx
├── components/
│   ├── BlockEditor.jsx
│   ├── BlockNavigator.jsx
│   ├── BlockStatus.jsx
│   └── SaveIndicator.jsx
├── stores/
│   ├── projectStore.js
│   └── history.js
├── models/
│   ├── project.js
│   └── validation.js
└── hooks/
    ├── useAutosave.js
    └── useShortcuts.js

electron/
└── services/
    └── ProjectService.js
```

当前 `main.js` 可以继续作为入口，但文件读写逻辑应迁入 `ProjectService`，IPC 注册应保持薄层。

## 11. 实施顺序

1. 定义项目 schema、Block 工厂函数和兼容旧内存项目的迁移函数。
2. 实现主进程 ProjectService、IPC、preload API 和原子保存。
3. 引入 projectStore，迁移 `project`、当前 Block 和 dirty 状态。
4. 实现 BlockEditor、相邻 Block 导航及状态栏。
5. 实现新建、复制、删除、移动和连续编号。
6. 接入自动保存、手动保存、错误提示与最近项目恢复。
7. 接入快捷键和输入法保护。
8. 实现命令历史与 Undo / Redo。
9. 执行单元测试、集成测试和人工验收。

## 12. 测试重点

### 单元测试

- 插入、复制、删除、上移、下移后 `order` 连续且稳定
- 删除当前 Block 后选择合理的相邻 Block
- 删除唯一 Block 会补建空 Block
- 编辑已完成 Block 会令 `scriptDone` 变为 `false`
- 连续文本输入正确合并历史，结构操作不合并
- schema 缺省字段能迁移，非法结构被拒绝

### 集成测试

- 保存后重启，Block 数量、顺序、文案和当前 Block 完整恢复
- 快速连续输入与排序不会发生旧保存覆盖新保存
- 保存失败后 UI 保持 dirty，并能成功重试
- 源漫画目录暂时不可用时文案仍可打开和保存
- 中文输入法确认候选不会触发 `Ctrl + Enter` 以外的误操作

### 性能基线

- 500 个 Block 的切换和编辑无明显卡顿
- 单次文案输入不触发 React 全量漫画缩略图重渲染
- 自动保存不高于一次/400ms，保存期间仍可继续输入

## 13. 完成定义（Definition of Done）

以下条件全部满足才算 Phase 2 完成：

- 用户可创建至少 100 个 Block 并顺畅编辑整篇文案
- Block 可复制、删除、上下移动，编号始终正确
- `Ctrl + Enter` 可形成连续写稿闭环
- 文案、顺序和完成状态会自动保存，重启应用后完整恢复
- `Ctrl + S`、Undo / Redo 和保存失败重试有效
- 快捷键不会干扰 textarea、中文输入法或 Phase 1 漫画浏览
- 项目写入采用临时文件 + 备份，失败不会破坏上一份可用数据
- Phase 1 的目录导入、图片搜索、A/D 切换和大图预览无回归

Phase 2 的最终验收语句：

> 导入一本漫画后，用户无需打开 Word，也能在 MangaDesk 中按剧情顺序写完、调整并可靠保存整份解说稿。
