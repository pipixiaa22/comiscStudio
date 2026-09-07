# MangaDesk Phase 6 开发文档

> 主题：剪映辅助窗口、窗口置顶、文案复制、原生文件拖出与按需 Crop 渲染  
> 依据：`init.md` 第 7–8、26–30、34–35、38–39、41–45 节  
> 前置条件：Phase 3 配图、Phase 4 状态管理与 Storyboard、Phase 5 图片实体生成已完成  
> 阶段目标：用户在剪映旁逐段查看文案、复制正文、拖入实际图片并记录制作进度，减少反复切换主工作区。

## 1. 范围与实施约定

| 本阶段交付 | 结果 |
|---|---|
| 独立辅助窗口 | 显示当前 Block、完整文案、按顺序排列的素材和前后段导航 |
| Always On Top | 默认置顶，可取消，记住窗口位置和尺寸 |
| 复制文案 | 一键复制当前段正文，明确显示成功或失败 |
| Native File Drag | 将已生成的单张图片拖到系统或剪映素材区 |
| 按需实体生成 | 整页、Crop、PDF 页面生成清晰的真实文件，相同内容复用渲染 |
| 制作进度 | 人工更新已配音、已放图、动效完成，同步主工作区并保存 |

不增加自动剪映工程、模拟点击、自动粘贴、字幕切割、配音生成、视频或关键帧生成。批量拖出整段素材可后续增强，V1 先保证单张拖出可靠。用户仍在剪映内完成导入、排列及精剪。

窗口尺寸、同步协议、缓存保留方式、冷启动拖动策略是本方案的实施约定；`init.md` 没有规定这些细节。继续使用现有 JavaScript/JSX、React reducer 与 Project JSON，不以 TypeScript、Zustand 或 SQLite 迁移为前置条件。

## 2. 当前代码基线与接入点

| 现有模块 | Phase 6 接入方式 |
|---|---|
| `main.js` | 当前仅创建主窗口；增加辅助窗口管理及 IPC 注册 |
| `preload.js`、`src/shared/bridge/mangaDeskBridge.js` | 增加受限辅助窗口桥接与事件取消订阅 |
| `src/App.jsx` | 当前使用视图状态；增加辅助窗口入口和独立启动分支 |
| `src/store/ProjectStoreProvider.jsx` | 主窗口继续持有唯一可写项目、历史和业务命令 |
| `src/features/project/hooks/useProjectAutosave.js` | 继续作为唯一自动保存入口 |
| `electron/services/AssetRenderer.js` | 复用方向处理、Crop 和 PDF 渲染，拆分最终画布策略 |
| `electron/services/ExportPlanner.js` | 复用 Source 解析、排序及输入检查能力 |
| `electron/ipc/registerSystemIpc.js` | 已有剪贴板写入能力，补充辅助窗口调用者和返回值处理 |

当前 `AssetRenderer` 会将输出放入默认 1920×1080 背景画布。辅助窗口默认拖出素材自身比例的图片，因此应增加明确的 `layout: 'source' | 'canvas'` 或等价参数：Phase 5 保持现有画布行为，Phase 6 使用 source。不能直接调用现有默认参数，导致拖出的 Crop 带上额外背景。

代码已有真人录音模式。本阶段保留现有录音字段与流程：`narrationMode === 'voice'` 时沿用录音派生状态，辅助窗口不能手动覆盖 `voiced`；其他模式允许人工标记已配音。录音文件拖出不列入本阶段必交付项。

## 3. 用户工作流与窗口内容

1. 在工作区或 Storyboard 点击“剪映辅助”，从当前 Block 打开窗口。
2. 把窗口放在剪映旁，按需调整尺寸或关闭置顶。
3. 点击“复制文案”，到剪映粘贴并使用其文本朗读功能。
4. 按素材卡片上的顺序，把准备好的图片逐张拖入剪映素材区。
5. 在剪映完成对应操作后，人工勾选状态。
6. 点击“下一段”，继续下一 Block。

窗口建议初始 420×640、最小 340×420；尺寸为开发起点，需实际检查中文长文案、系统缩放和小屏幕。顶部显示项目名、`#018 / 64`、置顶开关和“回到工作区”；中部显示完整只读文案、复制按钮、素材序号及实际 Crop 预览；底部显示制作状态与上一段/下一段。

文案保留换行并允许选择，长文案和多素材区域可滚动，导航保持可达。素材显示“准备中 / 可拖入 / 失败”，失败卡片保留位置并提供重试。辅助窗口不承担文案编辑、素材排序和裁切修改；“回到工作区”定位当前段供修改。

无项目时禁用入口；无 Block 时显示空态，禁用复制、拖出和导航。第一段禁用上一段，最后一段禁用下一段，不循环跳转、不创建新段。空文案禁用复制；没有图片显示“此段尚未配图”，仍可复制文案和切段。

## 4. 窗口生命周期与置顶

全应用只保留一个辅助窗口实例。重复点击入口恢复并聚焦已有窗口；窗口关闭时释放引用、监听器和订阅，再打开时重新获取快照。使用独立的非模态 BrowserWindow，主窗口最小化时辅助窗口仍可操作。

主窗口持有项目写入权，因此关闭主窗口时需先完成现有未保存数据、录音和导出退出处理，再关闭辅助窗口；不能留下失去项目宿主的可操作窗口。主窗口 Renderer 崩溃或重载时，辅助窗口进入“正在重新连接”，禁用业务操作，握手成功后恢复。

默认开启置顶，允许用户切换并在应用偏好中记忆。使用 `setAlwaysOnTop`，无需最高系统窗口层级；置顶不表示持续抢占键盘焦点。后台同步、素材渲染完成和状态更新均不能主动聚焦窗口。相关 API 见 [Electron BrowserWindow 文档](https://www.electronjs.org/docs/latest/api/browser-window#winsetalwaysontopflag-level-relativelevel)。

位置、尺寸和置顶偏好属于应用设置，不进入 Project、Undo 或导出快照。恢复时按当前显示器可用区域修正边界，保证标题栏可见；覆盖断开外接屏及改变缩放后的场景。macOS 全屏空间及不同系统窗口管理器的表现单独实测，不承诺跨所有全屏空间置顶。

辅助页可通过 `loadFile` 的 hash 加载为 `#/capcut`，复用构建入口；在挂载工作区 Provider、项目恢复和自动保存之前分流到辅助根组件，避免第二个窗口自动加载旧项目并写回。无需为此整体迁移路由框架。

## 5. 多窗口状态一致性

### 5.1 单一写入方

主窗口 reducer 是项目唯一写入方；Main 负责会话、窗口、消息转发和文件任务；辅助窗口只保存展示快照并发送业务意图。禁止辅助窗口自行读取 project.json 作为实时状态，或挂载第二套独立历史/自动保存服务。

主窗口在辅助窗口打开时发布当前内存快照，后续项目变更发布更新。辅助窗口导航使用独立 `assistantBlockId`：首次进入取工作区当前段，之后不会因主窗口浏览其他段落而跳走；点击“回到工作区”才同步工作区选中段。

### 5.2 会话与消息合约

```ts
interface AssistantSnapshot {
  sessionId: string
  projectId: string
  revision: number
  sequence: number
  projectName: string
  narrationMode: string
  blocks: AssistantBlock[] // 稳定 ID、顺序、正文、状态、素材及必要来源描述
  saveStatus: string
  saveError?: string
}

interface AssistantCommand {
  sessionId: string
  projectId: string
  requestId: string
  baseRevision: number
  blockId: string
  type: 'setStatus' | 'locateBlock'
  payload: object
}
```

类型示例仅表达合约，实施采用现有 JavaScript 风格并补运行时校验。`revision` 使用现有项目修订号；`sequence` 是当前会话单调递增的消息序号，用于区分同一修订号下的保存状态变化。重新加载或切换项目必须更换 `sessionId`。

先订阅再请求快照，按 session 与 sequence 丢弃重复或迟到消息。V1 可发送完整的精简项目快照，但不包含图片字节、PDF 内容或录音二进制；更新可合并，窗口重新连接时全量恢复。素材预览按可见区加载。

辅助状态操作提交给主窗口，校验项目、Block、允许字段和 `baseRevision` 后进入现有命令层，再返回成功回执与新快照。修订号过期时返回冲突并刷新，让用户重新操作，不能用旧快照覆盖新状态。`requestId` 去重，重发不产生第二条 Undo。回执前显示处理中；保存失败仍显示“未保存”并沿用主窗口重试能力。

切换项目时立即清空旧窗口内容、撤销旧拖动 token 并建立新会话。删除当前 Block 后定位删除前位置的后继，无后继则前驱；全部删除进入空态。重排或 Undo/Redo 后以稳定 ID 保持当前段，再计算实时编号，不能把 `#018` 当作身份。

## 6. 文案复制、进度与快捷键

复制内容仅为当前 Block 正文，保留中文、emoji、空白和换行，不附加编号、备注、文件名，也不润色或拆字幕。以请求携带的会话、Block 和修订号匹配已展示正文；版本失效则先刷新并提示重新复制，避免不知情复制另一版。

只有主进程剪贴板写入成功后显示“已复制 #018”；异常显示失败并可重试。复制后不自动切段，不标记已配音，不自动切换或控制剪映。空白判断使用 `trim()`，真正复制时保留原文。

`voiced / edited / effectDone` 继续表示人工工作状态，录音模式例外遵循现有派生规则。调用原生命令只说明开始拖动，不能证明剪映成功导入，所以不得自动勾选“已放图”。状态操作进入主窗口现有历史，Undo/Redo 后两窗口一致。

提供上一段/下一段按钮；窗口有焦点且不处于输入、文本选择或模态操作时可用左右方向键导航，`Ctrl/Cmd + Shift + C` 复制全文。所有快捷操作提供可见按钮。中文输入法组合期间不响应业务快捷键；不注册会截获剪映输入的全局快捷键。

## 7. 原生拖出与冷缓存处理

### 7.1 拖动时序

Electron 官方流程是在 DOM `dragstart` 中通过 preload 发消息，由主进程调用触发窗口的 `webContents.startDrag`。辅助窗口拖动必须使用辅助窗口的 `event.sender`，不能固定使用主窗口。见 [Electron 原生文件拖拽指南](https://www.electronjs.org/docs/latest/tutorial/native-file-drag-drop)。

渲染不能成为拖动手势中的长时间等待：进入当前 Block 后低并发准备其素材，可预取下一段少量素材；未准备好时卡片提供“准备素材”，显示进度并禁用文件拖动。冷缓存拖动尝试触发准备并提示“准备后请再次拖动”，不在数秒后无用户手势地启动拖出。

准备完成返回绑定会话、素材内容版本和窗口身份的 opaque token。`dragstart` 阻止网页默认拖动，通过 preload 的 `send` 提交 token；主进程快速核对 token、会话和文件就绪状态后调用 `startDrag`。不能在此阶段重新执行 PDF 渲染或整图编码。

传入真实绝对文件路径与有效拖动图标，文件必须已落盘；不能把 data URL、blob URL、缩略图 URL 或项目 JSON 当作图片拖出。`startDrag` 参数说明见 [Electron webContents 文档](https://www.electronjs.org/docs/latest/api/web-contents#contentsstartdragitem)。

### 7.2 失败与降级

来源丢失、Crop 无效、PDF 页不可用、磁盘空间不足、编码失败分别定位到具体素材，允许修复后重试；某张失败不妨碍其他已准备素材。拖动前文件被外部删除时撤销 token，重新准备，不交付不存在的路径。

取消拖动或目标拒绝接收均不修改项目。UI 不显示未经确认的“剪映导入成功”。提供“打开素材所在目录”，用户可从文件管理器拖入或在剪映选择导入；也可返回 Phase 5 导出完整素材包。文件打开只能使用主进程登记的交付文件。

应用内素材排序与原生拖出采用不同入口/作用域。本阶段默认只在辅助窗口提供原生拖出，避免改变现有 BlockAssetList 的排序手势。

## 8. 渲染规则、缓存与文件寿命

### 8.1 输出一致性

复用 Phase 5 的 Source 解析、EXIF 方向、PDF 物理页、归一化 Crop 和像素边界规则。图片基于原图，PDF 默认 200 DPI；默认 PNG、保持素材自身比例，不添加视频画布背景。预览与交付使用相同方向及裁切规则，不能截取 DOM 或缩略图作为交付文件。

大图/PDF 任务放入受限后台执行器；建议初始并发 2，先处理当前段。渲染前检查页像素预算，超限明确提示降低尺寸/DPI，不能悄悄降清晰度。具体预算随样本实测确定。

### 8.2 渲染缓存

```text
renderKey = hash(
  sourceIdentity + sourceFingerprint + pdfPage + orientation
  + normalizedCrop + layout + maxEdge + pdfDpi
  + format + quality + background + rendererVersion
)
```

整页 Crop 使用明确哨兵；来源指纹至少包含文件大小和修改时间，并在渲染前后核对。该检查不是文件系统快照，也不能保证发现保留大小和时间的外部改写；提供“重新生成”强制绕过缓存，必要时采用内容哈希增强识别。

相同 key 合并为一个进行中任务，多个引用共享结果；失败不写入 ready 状态。先写唯一 `.partial` 文件，编码和校验成功后发布。Crop、来源或输出选项改变时使用新 key，旧异步结果不能覆盖新卡片。

### 8.3 可清理缓存与对外交付文件分离

剪辑软件可能持续引用导入路径；不能假设拖入后已复制文件。因此 `init.md` 的“临时 Crop Render”解释为按需生成，不能解释为关闭窗口立即删除。

建议由 ProjectService 解析实际项目目录，增加下列受控目录：

```text
cache/rendered-assets/                 # 可重建，可按预算清理
exports/assistant-assets/
  <deliveryId>/
    018_01.png                         # 真正对外拖出的稳定文件
    manifest.json                     # 来源 ID、内容 key、生成时间及输出选项
```

交付时将完成的缓存复制到独立交付目录，禁止使用指向可清理缓存的符号链接。一个素材版本首次准备创建交付文件，重复拖动复用同一路径；相同 Crop 的不同引用可复用底层渲染，但保留各自交付记录。目录 ID 防止编号或版本冲突，文件编号采用准备时的 Block/素材位置。辅助单张拖出不保证跨版本文件名排序，批量剧情排序使用 Phase 5 素材包。

Block 重排、Crop 修改、删除引用或重开应用均不能重命名、覆盖、自动删除旧交付文件；生成新版本时创建新目录。缓存允许清理未被任务占用的条目，已交付目录不纳入 LRU、退出或启动清理。

在首次准备说明和目录管理入口告知“剪映可能引用此目录，请在剪辑完成前保留”。交付文件仅通过明确的项目素材管理操作清理，需显示具体目录和失联影响；本阶段可只提供查看占用及打开目录，不实现删除界面。移动或删除整个项目仍可能使外部引用失效，不声称已解决跨目录重定位。

## 9. IPC、安全边界与模块建议

建议桥接合约，最终命名遵循现有项目风格：

```ts
assistant.open()
assistant.setAlwaysOnTop(flag)
assistant.getSnapshot()
assistant.onSnapshot(callback) // 返回取消订阅函数
assistant.sendCommand(command)
assistant.copyBlockText({ sessionId, blockId, revision })
assistant.prepareAsset({ sessionId, blockId, assetId, revision })
assistant.onAssetState(callback)
assistant.startNativeDrag(token) // send；不在此调用内等待渲染
assistant.openAssetDirectory(token)
```

主窗口快照发布使用专用通道，仅允许登记的主窗口发送。其他命令按登记窗口身份、顶层 frame、当前会话、项目和字段白名单校验；辅助窗口只持有完成本阶段操作所需的 API。保持 `contextIsolation: true`、`nodeIntegration: false`，阻止辅助窗口任意外部导航和弹窗。

Renderer 不指定任意读写路径；主进程根据受控快照解析来源，根据 token 查交付文件。仅接受已就绪、归属当前窗口/会话的拖动 token。项目切换或窗口销毁使 token 失效，但不删除已交付文件。新增返回值统一成功/错误结构，不继续扩大现有桥接返回格式不一致的问题。

建议新增：

- `src/features/capcut/components/CapCutAssistant.jsx`：辅助窗口根视图。
- `src/features/capcut/components/AssistantAssetCard.jsx`：预览、准备、重试与拖动。
- `src/features/capcut/hooks/useAssistantSession.js`：订阅、命令回执、重连与导航。
- `electron/services/AssistantWindowService.js`：窗口实例和偏好恢复。
- `electron/services/AssistantSessionService.js`：宿主身份、快照、命令路由及 token。
- `electron/services/RenderedAssetCache.js`：缓存 key、并发合并与交付文件生成。
- `electron/ipc/registerAssistantIpc.js`：桥接注册及调用者校验。

复用现有渲染器和主窗口状态 action；辅助视图不复制第二套业务 reducer。事件取消订阅需精确移除本监听器，不使用会误伤其他窗口/组件的全局清空。

## 10. 实施顺序

1. 明确宿主窗口、会话协议和辅助入口，完成独立只读窗口及单实例生命周期。
2. 接入内存快照、导航、项目切换、重连及删除/重排后的定位。
3. 实现正文复制、人工状态命令、回执、Undo 与保存失败反馈。
4. 拆分 AssetRenderer 的 source/canvas 策略，验证原有导出行为保持一致。
5. 完成 PNG 整页/Crop/PDF 准备、缓存复用、稳定交付目录和版本失效处理。
6. 接入真实拖动事件、受控 token、错误提示及打开目录降级。
7. 完成置顶偏好、屏幕边界恢复、键盘作用域和焦点行为。
8. 进行真实剪映跨应用验收及既有项目/录音/导出回归，记录平台差异。

## 11. 测试与验收

| 场景 | 通过标准 |
|---|---|
| 重复打开、关闭重开 | 始终单实例，无重复订阅、重复命令或第二个保存器 |
| 未保存正文打开辅助窗口 | 展示主窗口最新内存内容，不回退到磁盘版本 |
| 两窗口修改/Undo/Redo | 人工状态、编号及素材同步；旧修订命令不覆盖新状态 |
| 删除当前段、重排、项目切换 | 按稳定 ID 导航；新项目不显示旧文案或使用旧 token |
| 主窗口关闭/崩溃/恢复 | 正常关闭完成原有退出流程；断连禁用操作，恢复后重新握手 |
| 复制中文、emoji、多行正文 | 剪贴板与正文一致，无额外编号；失败无成功提示 |
| 空项目、空段、末段 | 空态和按钮禁用准确，不自动新建或循环 |
| 置顶、取消置顶、双屏恢复 | 切换生效，标题栏可达，后台事件不抢剪映焦点 |
| 图片整页和 Crop | 正确方向、边界、比例，无默认 1920×1080 背景误入 |
| PDF 整页、Crop、旋转页 | 正确物理页、清晰度和坐标，不拖出 PDF 本体 |
| 冷缓存、大图和重复请求 | 准备中反馈明确；再次拖动可用；同 key 不重复渲染 |
| 缺失来源、非法 Crop、磁盘满 | 明确失败及重试入口，不启动无效文件拖出 |
| 快速切段及输出选项变更 | 旧结果不覆盖新素材，不发生跨段错图 |
| 拖动取消、目标拒绝 | 项目及制作状态不变，不误报导入成功 |
| 拖到 Finder/Explorer、剪映 | 接收实际 PNG，内容与预览一致；记录目标软件版本 |
| 退出应用后重开剪映工程 | 已交付素材仍可读取，清理渲染缓存不使引用失效 |
| 修改 Crop、重排后重开旧剪映工程 | 旧交付路径和内容不变，新拖出对应新版本 |
| 录音模式 | 已配音展示沿用派生规则，辅助命令不能手动覆盖 |
| 原有工作流回归 | 自动保存、撤销、素材排序、录音及 Phase 5 画布导出正常 |

自动化优先覆盖缓存 key、导航边界、会话失效、命令去重、source/canvas 输出差异与交付文件生命周期；文件测试使用独立临时目录。当前 `pnpm test` 为错误占位，实施测试时需替换为可运行命令。`pnpm build` 检查构建，使用 `pnpm start` 进行真实窗口和跨应用拖动验收；浏览器内拖动模拟不能替代操作系统测试。

性能样本建议 200 个 Block、1000 次引用，混合普通图片和扫描 PDF。记录机器、系统/Electron/剪映版本、DPI、峰值内存、首次准备时间和缓存命中时间。目标为已同步段落导航反馈 ≤ 200ms，缓存就绪拖动不触发重新编码，后台准备不阻塞导航与复制；这些是开发目标，需实测确认。

优先验证实际支持的 Windows、macOS 环境；未测试的平台明确标为未验证。完成定义：用户可在置顶窗口逐段复制文案、拖入正确实际图片并保存人工进度；多窗口不会覆盖项目，交付文件在退出和重新编辑后仍保持稳定，Phase 5 导出与现有录音流程无回归。
