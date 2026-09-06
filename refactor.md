# MangaDesk 前端模块化重构方案

> 依据：当前 `src/App.jsx`、`main.js`、`preload.js`、`electron/services/ProjectService.js`  
> 日期：2026-09-06  
> 目标：在不改变现有产品功能的前提下，将项目拆成可独立理解、修改和验证的模块，为 Phase 4、Phase 5 留出稳定扩展点。

## 1. 结论

当前 `src/App.jsx` 约 33 KB、1069 行，同时承担以下职责：

- 项目模型创建与归一化
- Block 和素材的 reducer、Undo/Redo
- 项目加载、导入、自动保存
- 当前页、搜索、大图开关、阅读偏好等 UI 状态
- 全局快捷键分发
- PDF 文档缓存和页面 Canvas 渲染
- Browser、Reader、Editor、Status、Welcome 等完整视图
- Crop、分页、缩放、拖动画面等交互

建议采用“按业务功能组织，公共基础能力下沉”的结构。`App.jsx` 最终只负责应用壳、页面状态切换和 Provider 装配；Block、漫画浏览、阅读器、项目持久化分别拥有自己的组件、状态和服务。

本次重构应渐进完成。每迁移一个模块就构建并验证，避免一次性重写造成行为回归。现有项目继续使用 JavaScript/JSX；是否迁移 TypeScript 另立任务，不与本轮结构重构绑定。

## 2. 当前耦合与风险

### 2.1 业务逻辑和 UI 绑在同一个文件

`makeBlock`、`normal`、`apply`、`reducer` 与所有页面组件共同存在。修改数据模型时需要穿过大量视图代码，修改视图又容易碰到保存或历史逻辑。Phase 4 新增收藏、素材篮、Used 标记和 Storyboard 后，单文件复杂度会继续快速增长。

### 2.2 持久状态和临时 UI 状态边界不清

当前 `SELECT` 和 `SOURCE` 都通过 `apply` 修改 Project，同时设置 dirty 并进入 Undo 栈。这意味着：

- 仅切换 Block 或漫画页也会产生项目历史
- 浏览几十页会挤掉真正有价值的文案/素材 Undo 记录
- 选择页面会触发自动保存
- Undo 可能表现为“跳回刚才看过的页”，而非撤销创作操作

建议把状态分为三层：

| 状态层 | 示例 | 是否保存 | 是否进入 Undo |
|---|---|---:|---:|
| 项目内容 | blocks、text、assets、完成状态、收藏、素材篮 | 是 | 是 |
| 工作区偏好 | currentBlockId、currentSourceId、阅读模式、分栏宽度 | 可保存 | 否 |
| 瞬时 UI | 搜索词、Reader 是否打开、加载态、Crop 草稿、拖动状态 | 否 | 否 |

工作区偏好可以低优先级保存，但不能与创作历史共用一套命令。

### 2.3 文案输入历史粒度错误

`TEXT` 每次触发都调用 `structuredClone`，并把整个旧 Project 放入最多 100 条历史。结果是每输入一个字符都会：

- 深拷贝完整项目
- 创建一条 Undo 记录
- 触发 dirty 和自动保存调度
- 可能导致大型项目输入卡顿

文案输入应立即更新当前 Block，但以一次编辑会话作为历史记录。建议在首次输入时记录 `beforeText`，连续输入 700ms、失焦或切换 Block 后封口为一条命令。保存仍可 debounce 400ms，与 Undo 合并窗口分别实现。

### 2.4 自动保存状态不完整

当前保存成功只更新 `saveState`，没有将 reducer 中的 `dirty` 清回 false，也没有 revision 防止旧保存响应覆盖新保存状态。`save` 使用渲染时闭包中的 project，快速编辑和并发保存存在状态误报风险。

重构后由独立 `useProjectAutosave` 负责：

- 对最新 Project 快照 debounce
- 保存请求携带递增 revision
- 同一时间最多一个请求，期间变化在请求完成后继续保存
- 只有保存的 revision 等于当前 revision 时才显示“已保存”
- 失败保留 dirty，并允许重试
- `Ctrl + S` 调用 flush，而非复制一套保存逻辑

### 2.5 模型规则在 Renderer 和 Main 重复

`makeBlock/normal` 同时存在于 `App.jsx` 和 `ProjectService.js`。两边未来容易出现字段保留规则不同，特别是 Phase 4 增加 favorites、scratchBasket 后可能被其中一侧归一化时丢弃。

领域 schema、迁移和归一化规则应只有一个权威实现。由于 Renderer 与 Electron Main 的模块体系不同，推荐把纯 JavaScript 领域代码放在 `shared/domain/`，使用双方均可加载的 CommonJS 或迁移为统一 ESM。短期若模块体系不调整，至少共享无 Electron/DOM 依赖的 JSON schema 与测试样例，并明确 Main 是最终持久化校验边界。

### 2.6 PDF 生命周期属于独立基础能力

`docs`、`loadPdf`、`PageMedia` 和 `Reader` 混在应用入口中。缓存目前以路径永久保留，除失败外不清除，也没有在项目切换/窗口关闭时销毁 PDF document。Reader 同时负责分页、缩放、尺寸测量、拖动、快捷键和渲染状态，后续加入 Crop 会更加难改。

PDF 文档缓存、页面渲染和阅读器状态应分别拆开：

- `PdfDocumentRepository`：加载、复用、失败移除、释放
- `PageMedia`：只负责图片或 PDF 页的统一展示
- `useReaderController`：分页、缩放、适应模式、页码输入
- `ReaderDialog`：组合工具栏、画布区域和状态提示

### 2.7 快捷键散落且缺少作用域

App 和 Reader 各注册全局 keydown。Phase 4 再增加 B、Q、Delete 后，焦点、模态层、输入法和不同面板之间容易冲突。

建议建立单一快捷键路由，按优先级处理：

```text
输入法组合 / 原生输入控件
    ↓
Dialog / Reader / Crop
    ↓
当前面板（素材、收藏、素材篮）
    ↓
漫画浏览
    ↓
Block 全局命令
```

每个功能通过 hook 注册作用域，Dialog 打开时自动压住底层快捷键。

### 2.8 当前可见的小问题

- Header 中项目名称重复渲染两次。
- `Status` 目前没有 BlockAsset 列表，后续需要独立素材组件，不能继续扩大 Status。
- `hydrate` 每个 item 都线性查找 sources，大项目是 O(n²)，应先建立规范化路径到 Source 的 Map。
- `Browser` 使用 `all.indexOf(x)` 求页码，每张卡片又做一次线性搜索；应在 selector 中预计算项目序号。
- 视图组件直接 dispatch 字符串 action，调用方需要知道 reducer 内部协议，复用和测试困难。
- `alert` 直接散落在流程中，不利于统一错误提示、测试和后续国际化。

这些问题应在对应模块迁移时修复，不需要先做一次无边界的“清理提交”。

## 3. 目标架构

```text
Renderer
│
├── app                 应用装配、页面/布局入口
├── features
│   ├── project         项目加载、创建、保存状态
│   ├── blocks          Block 编辑与命令
│   ├── library         漫画来源、搜索、缩略图浏览
│   ├── reader          大图阅读、分页、缩放
│   └── assets          BlockAsset、Crop、排序与定位
├── shared
│   ├── components      通用 UI，不含业务含义
│   ├── hooks           通用 React hook
│   ├── lib             路径、编号、坐标等纯函数
│   └── bridge          preload API 的 Renderer 包装
│
Preload                 最小、白名单化 IPC API
│
Electron Main
│
├── ipc                 IPC 注册和参数校验
└── services            文件系统、项目、来源扫描
```

依赖方向必须单向：

```text
app → features → shared
              ↘ shared/domain
electron/ipc → electron/services → shared/domain
```

约束：

- `shared` 不依赖任何 feature
- feature 之间通过公开入口或 action 协作，不直接读取对方内部文件
- React 组件不直接调用 `window.mangaDesk`
- Electron service 不包含 React/UI 逻辑
- reducer、selector、校验、坐标计算保持纯函数，可脱离 Electron 测试

## 4. 推荐目录结构

```text
src/
├── app/
│   ├── App.jsx
│   ├── AppProviders.jsx
│   ├── WorkspacePage.jsx
│   └── AppHeader.jsx
│
├── features/
│   ├── project/
│   │   ├── components/
│   │   │   ├── Welcome.jsx
│   │   │   └── SaveIndicator.jsx
│   │   ├── hooks/
│   │   │   ├── useProjectBootstrap.js
│   │   │   ├── useProjectImport.js
│   │   │   └── useProjectAutosave.js
│   │   ├── projectApi.js
│   │   └── index.js
│   │
│   ├── blocks/
│   │   ├── components/
│   │   │   ├── BlockEditor.jsx
│   │   │   ├── BlockContextCard.jsx
│   │   │   └── BlockStatusPanel.jsx
│   │   ├── model/
│   │   │   ├── blockFactory.js
│   │   │   ├── blockCommands.js
│   │   │   └── blockSelectors.js
│   │   └── index.js
│   │
│   ├── library/
│   │   ├── components/
│   │   │   ├── MangaBrowser.jsx
│   │   │   ├── MangaBrowserHeader.jsx
│   │   │   ├── SourcePreview.jsx
│   │   │   ├── SourceGrid.jsx
│   │   │   └── SourceCard.jsx
│   │   ├── hooks/
│   │   │   └── useSourceSelection.js
│   │   ├── sourceSelectors.js
│   │   └── index.js
│   │
│   ├── reader/
│   │   ├── components/
│   │   │   ├── ReaderDialog.jsx
│   │   │   ├── ReaderToolbar.jsx
│   │   │   ├── ReaderCanvas.jsx
│   │   │   └── ReaderStatus.jsx
│   │   ├── hooks/
│   │   │   ├── useReaderController.js
│   │   │   ├── usePan.js
│   │   │   └── useViewportSize.js
│   │   └── index.js
│   │
│   └── assets/
│       ├── components/
│       │   ├── BlockAssetList.jsx
│       │   └── CropOverlay.jsx
│       ├── model/
│       │   ├── assetCommands.js
│       │   └── cropGeometry.js
│       └── index.js
│
├── store/
│   ├── ProjectStoreProvider.jsx
│   ├── projectReducer.js
│   ├── projectActions.js
│   ├── projectSelectors.js
│   └── history.js
│
├── shared/
│   ├── bridge/
│   │   └── mangaDeskBridge.js
│   ├── components/
│   │   └── ui/
│   ├── hooks/
│   │   ├── useShortcutScope.js
│   │   └── useLatest.js
│   └── lib/
│       ├── ids.js
│       ├── pageNumber.js
│       └── pathKey.js
│
└── main.jsx

shared/
└── domain/
    ├── projectSchema.js
    ├── projectMigrations.js
    └── projectNormalize.js

electron/
├── ipc/
│   ├── registerProjectIpc.js
│   ├── registerSourceIpc.js
│   └── registerSystemIpc.js
└── services/
    ├── ProjectService.js
    ├── SourceScanService.js
    └── PdfMetadataService.js
```

目录不需要一次全部创建。只创建当前迁移步骤实际用到的文件，避免出现大量空壳抽象。

## 5. App.jsx 重构后的职责

目标中的 `App.jsx` 应控制在约 80–150 行，只保留：

```jsx
export default function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}

function AppShell() {
  const { project, bootState } = useProject()

  if (bootState === 'loading') return <AppLoading />

  return (
    <div className="app-shell">
      <AppHeader />
      {project ? <WorkspacePage /> : <Welcome />}
      <ReaderDialog />
    </div>
  )
}
```

`App.jsx` 不应再包含：业务 reducer、PDF.js 初始化、IPC 调用、Canvas 渲染、Block 变更实现、快捷键条件链或大型 JSX 子组件。

## 6. 状态管理方案

### 6.1 保留 useReducer，先拆 Context

当前项目尚未安装 Zustand。为降低重构变量，第一阶段保留 `useReducer`，将它移动到 `src/store/` 并通过 Context 暴露稳定接口。完成模块边界后，再根据性能和开发体验决定是否引入 Zustand。

不建议在同一轮同时完成目录重构、状态库替换和 TypeScript 迁移，否则回归时难以定位原因。

Provider 对组件暴露领域操作，而非裸 dispatch：

```js
const {
  project,
  currentBlock,
  history,
  commands: {
    updateBlockText,
    completeBlock,
    moveBlock,
    duplicateBlock,
    deleteBlock,
    addAsset,
    undo,
    redo
  }
} = useProjectStore()
```

组件不再知道 `"TEXT"`、`"COMPLETE"` 等字符串协议。action type 可以留在 store 内部，并集中定义为常量。

### 6.2 Project state 结构

```js
{
  content: project,       // 真正的项目内容
  workspace: {
    currentBlockId,
    currentSourceId
  },
  history: {
    undo,
    redo,
    activeTextEdit
  },
  persistence: {
    revision,
    savedRevision,
    status,
    error
  }
}
```

Reader、搜索词、加载态等不放进 Project store。它们留在相应 feature 的局部状态或轻量 Context 中，避免任意 UI 更新重渲染整个工作区。

### 6.3 Selector

集中提供派生数据：

```js
selectCurrentBlock(state)
selectBlockIndex(state, blockId)
selectSourceById(state, sourceId)
selectOrderedSources(state)
selectFilteredSources(state, query)
selectBlockAssets(state, blockId)
```

建立 `sourceById`、规范化 path key 等索引，避免组件重复 `find`、`filter` 和 `indexOf`。索引可由 `useMemo` 或 store selector 创建，不写回 project.json。

## 7. 领域命令与 Undo/Redo

将 reducer 内的数组操作提取为纯领域命令：

```js
createBlock(project, { afterBlockId })
updateBlockText(project, { blockId, text })
completeBlock(project, { blockId })
moveBlock(project, { blockId, direction })
duplicateBlock(project, { blockId })
deleteBlock(project, { blockId })
addAsset(project, { blockId, sourceId, crop })
```

每个函数明确输入、输出和不变量：

- 不直接读取 React state
- 不使用全局 current Block
- ID、时间可通过依赖参数注入，便于测试
- 返回新 Project 或明确的 command result
- 始终归一化 order
- 找不到目标时返回受控错误，不能对 undefined 继续写入

Undo 建议从“整个 Project 快照/每按键一条”升级为命令历史。V1 可以保留快照实现，但必须合并文本编辑，并排除选择、打开 Reader 和搜索等 UI 操作。后续项目变大时再考虑 patch/inverse patch。

推荐历史条目：

```js
{
  type: 'block.text.edit',
  label: '编辑 Block #018 文案',
  before: { blockId, text },
  after: { blockId, text },
  timestamp
}
```

删除或复制 Block 等结构操作可以先保留局部实体快照。历史上限按条数和估算内存双重限制，避免含大量素材的项目占用失控。

## 8. Project 模块

### 8.1 Renderer API 包装

新增 `projectApi.js` 或 `shared/bridge/mangaDeskBridge.js`，统一处理 preload 返回值：

```js
export async function loadRecentProject() {
  const result = await window.mangaDesk.loadRecentProject()
  if (!result?.ok) throw new ProjectApiError(result?.error)
  return result.data
}
```

组件和 hook 不再各自解析 `{ ok, data, error }`，也不直接使用 alert。错误由页面级 ErrorBanner/Toast 呈现。

### 8.2 Bootstrap 与 Import

`useProjectBootstrap` 只负责启动恢复及状态：`idle/loading/ready/error`。`useProjectImport` 负责选择来源、空目录判断、创建项目、hydrate sources 和切换项目。导入 PDF 与目录共享内部流程，仅选择来源的方法不同。

hydrate 优化：

```js
const sourceIdByPath = new Map(
  project.sources.map(source => [pathKey(source.path), source.id])
)

const hydrated = items.map(item => ({
  ...item,
  sourceId: sourceIdByPath.get(pathKey(item.path))
}))
```

其中 `pathKey` 在 Windows 下统一分隔符并按不区分大小写比较。PDF 页身份应沿用稳定 Source ID，不能只依赖展示字符串。

### 8.3 自动保存

`useProjectAutosave` 监听内容 revision 和需要保存的 workspace revision。所有保存入口都进入同一队列：

```text
项目发生变化
  → revision + 1
  → debounce 400ms
  → 保存最新快照
  → 若保存期间又有变化，继续保存最新 revision
  → savedRevision === revision 时显示已保存
```

hook 卸载或窗口关闭时按既有产品策略 flush。保存成功不应把 Main 返回的 `updatedAt` 当成整份新项目覆盖当前编辑中的 Project。

## 9. Library（漫画浏览器）模块

拆分职责：

- `MangaBrowser`：栏位容器，组合头部、预览和 Grid
- `MangaBrowserHeader`：标题、总页数、搜索输入
- `SourcePreview`：当前页概要及放大入口
- `SourceGrid`：列表布局、滚动定位、未来虚拟化
- `SourceCard`：单个来源卡片与选中状态

`MangaBrowser` 通过语义 props 工作：

```jsx
<MangaBrowser
  sources={visibleSources}
  selectedSourceId={currentSourceId}
  onSelectSource={selectSource}
  onOpenReader={openReader}
  onAddSourceToBlock={addSourceToCurrentBlock}
/>
```

组件内部不修改 Project，不直接 dispatch reducer action。搜索可以保留在 Library feature 本地。页码由预计算的 source view model 提供：

```js
{ source, projectIndex, documentPage, documentPageCount, isSelected }
```

为未来 `@tanstack/react-virtual` 预留 `SourceGrid` 边界；本轮可先保持现有 map，拆分完成后再单独引入虚拟化。

## 10. Reader 与媒体渲染模块

### 10.1 PageMedia

移动到 `features/reader/components/PageMedia.jsx` 或更通用的 `features/library/media/`。它只接收 Source 和渲染参数，通过回调报告 dimensions/status，不负责分页和 Dialog。

图片和 PDF 的差异隐藏在媒体层：

```jsx
<PageMedia
  source={source}
  renderScale={renderScale}
  priority
  onReady={handleReady}
  onError={handleError}
/>
```

### 10.2 PdfDocumentRepository

建议在 Renderer service 中封装：

```js
get(pdfPath)
retry(pdfPath)
release(pdfPath)
releaseAll()
```

Repository 负责调用 bridge 读取 PDF、交给 pdfjs、缓存 Promise、失败后清除、项目切换时 destroy。组件不得直接操作全局 Map。

### 10.3 Reader Controller

把 Reader 的状态计算移入 `useReaderController`：

- 当前文档 pages 与 active index
- 页码输入与错误
- fitPage/fitWidth/manual scale
- goPrevious/goNext/goToPage
- zoomIn/zoomOut/setFitMode
- 渲染状态和 retry

`usePan` 单独处理 Pointer Capture、scrollLeft/Top；`useViewportSize` 封装 ResizeObserver。ReaderDialog 只组合 UI，并使用自己的快捷键 scope。

## 11. Block 与 Assets 模块

当前 `Editor` 拆为：

- `BlockEditor`：当前 Block 编辑卡
- `BlockContextCard`：前后文摘要
- `BlockEditorHeader`：编号和完成按钮（可按实际复杂度合并）

当前 `Status` 拆为：

- `BlockStatusPanel`：完成状态和 Block 操作
- `HistoryControls`：Undo/Redo
- `BlockAssetList`：素材列表，属于 assets feature

`BlockEditor` 使用受控文本和 `useBlockTextEditing`。它不接收整个 blocks 数组和裸 dispatch，只接收需要的数据与回调：

```jsx
<BlockEditor
  block={currentBlock}
  previous={previousBlock}
  next={nextBlock}
  onChangeText={updateText}
  onComplete={completeBlock}
  onNavigate={selectBlock}
/>
```

Phase 3 的 Crop 坐标计算、素材添加和排序放在 assets feature，不能重新塞回 Browser 或 Status。Phase 4 的 Favorites、ScratchBasket、UsageIndex、Storyboard 也以并列 feature 扩展。

## 12. 快捷键架构

建议提供 `useShortcutScope`：

```js
useShortcutScope({
  id: 'workspace',
  enabled: !readerOpen,
  priority: 10,
  bindings: {
    'Ctrl+S': flushSave,
    'Ctrl+Enter': completeCurrentBlock,
    'Space': openCurrentSource,
    'ArrowLeft': previousSource,
    'ArrowRight': nextSource
  }
})
```

Reader 使用更高 priority。hook 统一完成以下判断：

- `event.isComposing`
- input、textarea、select、contenteditable
- Ctrl/Alt/Shift/Meta 标准化
- `preventDefault` 与是否继续向低优先级传播
- 组件卸载时取消注册

如果暂时不建立注册中心，至少先拆成 `useWorkspaceShortcuts` 和 `useReaderShortcuts`，并把共同的 editable 判断放在 shared helper 中。

## 13. Electron 主进程同步重构

当前 `main.js` 同时包含窗口创建、目录递归扫描、PDF 扫描和全部 IPC 注册。前端拆分后，应顺手把对应主进程职责拆开，但不要改变 preload 公共 API：

```text
main.js
├── createMainWindow()
├── registerProjectIpc(projectService)
├── registerSourceIpc(sourceScanService)
└── registerSystemIpc()
```

`SourceScanService` 负责目录、单图和 PDF 页面扫描；`ProjectService` 只负责项目路径、迁移、原子保存、备份和最近项目。IPC 文件只校验输入、调用 service、转为统一 result。

preload 保持最小白名单。为 API 按领域分组可提高可读性，但会影响调用方，建议在第二阶段兼容旧方法后再切换：

```js
window.mangaDesk.project.loadRecent()
window.mangaDesk.project.save(project)
window.mangaDesk.sources.choosePdf()
window.mangaDesk.sources.chooseDirectory()
window.mangaDesk.pdf.read(path)
window.mangaDesk.system.copyText(text)
```

如果暂时保持扁平 API，Renderer bridge 也能先提供上述领域化接口，避免同时修改 preload。

## 14. 分阶段迁移计划

### Step 0：建立安全基线

- 记录当前关键流程：启动恢复、导入图片目录、导入 PDF、切页、大图阅读、编辑/完成 Block、素材添加、保存和重启恢复。
- 执行当前 build，记录现有警告。
- 为领域 reducer 和 ProjectService 添加少量高价值测试，覆盖数据不会丢失。
- 修复 Header 重复项目名，作为独立的小变更。

完成标准：重构前行为和已知问题有可复核基线。

### Step 1：提取纯函数，不移动 UI

- 提取 ids、pageNumber、pathKey。
- 提取 blockFactory、projectNormalize、projectSelectors。
- 将 reducer、history 移到 `src/store/`。
- App 仍使用原来的 useReducer，确保 UI 行为不变。

完成标准：`App.jsx` 不再定义数据模型和 reducer；纯函数测试通过。

### Step 2：建立 ProjectStoreProvider

- Provider 包装 reducer。
- 暴露 selectors 和语义 commands。
- 区分 project content、workspace 和 transient UI。
- SELECT/SOURCE 移出 Undo；合并文本编辑历史。

完成标准：组件不再接收裸 dispatch；Undo 只撤销创作操作。

### Step 3：提取 Project 生命周期

- 建立 projectApi bridge。
- 提取 bootstrap、import、autosave hooks。
- 加入 revision 保存队列和统一错误状态。
- AppHeader 使用 SaveIndicator。

完成标准：App 不直接调用 `window.mangaDesk`，保存状态与实际 revision 一致。

### Step 4：拆工作区组件

- 提取 AppHeader、Welcome、WorkspacePage。
- 提取 blocks、library、assets 的视图组件。
- 将搜索和 Source 选择放到 library controller。

完成标准：`App.jsx` 只负责装配；Browser/Editor/Status 不在 App 文件中。

### Step 5：拆 Reader 和 PDF 服务

- 提取 PageMedia、PdfDocumentRepository。
- 提取 ReaderDialog、Toolbar、Canvas、controller hooks。
- 在项目切换和卸载时释放 PDF 资源。
- 将 Reader 快捷键放到独立 scope。

完成标准：PDF.js import、缓存和 Canvas 生命周期不出现在 App；阅读器功能无回归。

### Step 6：拆 Electron main

- 拆 IPC 注册与 SourceScanService。
- 将共享 schema/迁移作为唯一规则来源。
- 保持 preload API 兼容，随后再领域化。

完成标准：main.js 仅负责应用生命周期和装配；ProjectService 不丢弃新字段。

### Step 7：性能和扩展验证

- 用实际 196 页 PDF 和大型图片目录验证。
- 检查 React 重渲染，确保输入文案不会重渲染全部 SourceCard。
- 为 Phase 4 创建 feature 空间时只定义公开接口，不提前写空组件。

完成标准：Phase 4 可新增模块而无需修改 Reader、PDF 缓存或 Block reducer 内部。

## 15. 建议测试策略

当前 `npm test` 仍是占位命令。建议引入 Vitest 和 React Testing Library，但测试重点放在容易因重构损坏的行为，不追求组件快照覆盖率。

### 15.1 纯函数测试

- projectNormalize 保留 blocks、assets、Crop 及未知的兼容字段
- Block 创建、完成、复制、删除、排序保持连续 order
- 文案编辑合并为一条历史
- SELECT/SOURCE 不进入 Undo
- pathKey 与 source hydration 在 Windows 路径大小写下正确
- Reader 的 fit/zoom/page 边界计算

### 15.2 Hook/组件测试

- 自动保存只保存最新 revision，失败后保持 dirty
- Reader 打开后 Workspace 快捷键失效，关闭后恢复
- 中文输入法期间不触发完成或翻页
- SourceCard 选择、放大和添加不会互相冒泡
- BlockEditor 输入不导致无关 SourceGrid 更新（可结合 Profiler 人工验证）

### 15.3 Electron 服务测试

- 创建、保存、备份、损坏后恢复
- normalize 不清空 assets 和未来 Phase 4 字段
- PDF 多页扫描生成稳定、可重新匹配的来源身份
- IPC 对非法路径和参数返回受控错误

### 15.4 人工回归

每一步迁移后执行：

```text
打开最近项目
→ 导入 PDF
→ 搜索并切页
→ 打开 Reader、缩放、翻页、关闭
→ 编辑并完成 Block
→ 添加整页/Crop 素材
→ Undo/Redo
→ 保存并重启验证
```

## 16. 代码约定

- 一个组件文件主要导出一个业务组件；仅很小且不可复用的子组件可同文件保留。
- 组件负责展示和用户事件，hook 负责流程，纯函数负责数据变化，service/bridge 负责外部 I/O。
- 禁止 feature 组件直接调用 `window.mangaDesk`。
- 禁止通过 props 传递裸 dispatch；使用语义回调或 commands。
- 禁止在 reducer 中调用 IPC、DOM、PDF.js 或计时器。
- action 和 selector 使用稳定 ID，不用当前数组下标作为身份。
- 错误进入统一状态/提示组件，避免业务代码散落 alert。
- 文件名使用完整业务名，如 `BlockStatusPanel.jsx`，不使用难理解的 `Status.jsx`。
- `index.js` 只暴露 feature 的公共 API，外部不引用其内部深层路径。
- 暂不为了“复用”抽象只有一个调用点、几行 JSX 的组件；以职责边界为判断标准。

## 17. 完成定义

重构完成应满足：

- `App.jsx` 只负责 Provider、应用壳和顶层页面组合，约 80–150 行。
- Browser、Reader、Editor、Status、Welcome 已移动到对应 feature。
- 项目模型、reducer、selector、history 不存在于 React 页面文件。
- React 组件不直接访问 preload API；IPC 调用经 bridge/API/hook。
- PDF 文档缓存可在失败时重试、项目切换时释放。
- 切页、搜索和打开 Reader 不污染 Undo 历史。
- 连续文案输入不会每字符深拷贝并保存 100 份完整 Project。
- 自动保存能区分当前 revision 和已保存 revision，不把旧响应显示为最新成功。
- Renderer 和 Main 对项目字段保留、迁移和校验规则一致。
- 当前图片/PDF 导入、阅读、Block 编辑、配图、保存与恢复流程全部通过回归。
- Phase 4 能通过新 feature 接入收藏、素材篮、Used 标记和 Storyboard，无需再次拆解 App.jsx。

## 18. 推荐首先执行的改动

第一批建议只完成 Step 0–2：提取领域纯函数和 reducer、建立 ProjectStoreProvider、修正 Undo 边界及文本历史粒度。这一批直接降低数据风险，也为后续拆 UI 提供稳定接口。

第二批完成 Project 生命周期和 App/Workspace 组件拆分；第三批独立处理 Reader/PDF 和 Electron Main。每批保持可构建、可运行、可回退，避免形成长期不可用的重构分支。
