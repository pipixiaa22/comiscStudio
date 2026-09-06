# MangaDesk Phase 3 开发文档

> 主题：漫画画面与 Block 绑定  
> 前置条件：Phase 2 已完成 Block 编辑、排序、项目保存和 Undo / Redo  
> 阶段目标：用户在阅读漫画时，可将整页或手动画出的裁切区域直接加入当前 Block，并随时从素材反向定位原图

## 1. 本阶段交付范围

Phase 3 必须交付：

- 当前漫画整页加入当前 Block
- 在大图 Viewer 上拖框选区并加入当前 Block
- Block 素材缩略图展示、选择、删除和拖拽排序
- 从 Block 素材定位原始漫画页
- 对 Crop 素材定位时恢复并高亮原裁切框
- 所有素材操作纳入自动保存和 Undo / Redo
- 原图缺失、Crop 非法等数据异常的明确提示

本阶段不交付：

- 真正生成 Crop 图片文件；只保存归一化裁切参数
- 自动拆格、AI、OCR 或图像内容判断
- 收藏、素材篮、全局 Used 标记和 Storyboard（Phase 4）
- 导出、临时 Crop 渲染和拖入剪映（Phase 5/6）

## 2. 核心设计原则

### 2.1 原图不可变

MangaDesk 不复制、不裁切、不重命名用户的漫画原图。Phase 3 项目只记录：

```text
sourceId + cropRect + asset order
```

### 2.2 裁切延迟渲染

框选后不要立即创建 `038_crop_xxx.png`。同一张原图可以在不同 Block 中以不同 Crop 重复使用，真实文件只在后续导出或 Native Drag 时生成。

### 2.3 操作围绕当前 Block

整页或 Crop 一经确认，直接加入 `currentBlockId`，不弹二次确认。若当前 Block 不存在，操作禁用并提示先创建 Block。

## 3. 数据模型

### 3.1 MangaSource

Phase 1 的图片扫描结果需要获得稳定 `id` 并持久化：

```js
{
  id: "uuid",
  path: "D:\\Manga\\chapter01\\038.jpg",
  fileName: "038.jpg",
  width: 4000,
  height: 6000,
  order: 37
}
```

规则：

- `sourceId` 不得使用临时数组下标
- 同一项目再次扫描时，以规范化绝对路径匹配已有 Source 并复用 `id`
- Windows 路径比较应大小写不敏感；展示仍保留原始路径文本
- 新文件获得新 ID，缺失文件保留原记录并标记不可用，不能导致既有素材引用丢失
- `width`、`height` 来自真实图片元数据；加载失败时允许为 `null`，但不可创建 Crop

### 3.2 BlockAsset

```js
{
  id: "uuid",
  sourceId: "source-uuid",
  crop: {
    x: 0.48,
    y: 0.52,
    width: 0.41,
    height: 0.36
  },
  order: 0,
  createdAt: 1770000000000
}
```

整页素材不写 `crop`：

```js
{
  id: "uuid",
  sourceId: "source-uuid",
  order: 1,
  createdAt: 1770000000100
}
```

规则：

- Crop 使用相对原图的归一化坐标，四个数均为 `0..1`
- 必须满足 `width > 0`、`height > 0`、`x + width <= 1`、`y + height <= 1`
- 浮点数落盘保留最多 6 位小数，减少无意义 diff
- 同一 Source/Crop 允许多次加入；这是有效创作行为，不自动去重
- 删除或移动素材后，将当前 Block 内的 `order` 归一化为连续整数
- `assetDone` 不因“至少一张图”自动设为 true；它是用户明确确认的工作状态。删除素材后若素材变为 0，则必须自动设为 false

## 4. 归一化 Crop 坐标

Viewer 中图片通常经过 contain 缩放并带有留白，不能直接用容器坐标计算 Crop。必须以图片实际渲染矩形为基准：

```js
const x = (selectionLeft - imageRect.left) / imageRect.width
const y = (selectionTop - imageRect.top) / imageRect.height
const width = selectionWidth / imageRect.width
const height = selectionHeight / imageRect.height
```

处理要求：

- Pointer 起点和终点都裁剪到 `imageRect` 范围内
- 支持从任意方向拖动，最终转换成左上角 + 宽高
- 小于 `8 × 8 CSS px` 的选区视为误触，不进入可确认状态
- 图片缩放、Fit Window 或窗口尺寸变化后，已保存 Crop 仍能按归一化坐标准确重绘
- EXIF Orientation 必须由图片显示层统一处理；屏幕坐标和导出坐标必须采用同一方向约定
- GIF 等动态格式可作为整页素材；V1 若无法可靠裁切，应禁用 Crop 并给出原因

## 5. 主要用户流程

### 5.1 整页加入 Block

```text
选择漫画页
    ↓
Enter 或双击缩略图
    ↓
创建无 crop 的 BlockAsset
    ↓
追加到当前 Block 素材末尾
    ↓
选中新素材并自动保存
```

如果 Viewer 中存在活动 Crop，`Enter` 表示确认 Crop，而不是加入整页。

### 5.2 框选加入 Block

```text
在 Viewer 原图区域按下左键
    ↓
拖动显示选择框与遮罩
    ↓
松开后进入“待确认”状态
    ↓
Enter：加入当前 Block
Esc：取消
```

确认成功后清除临时选区；Block 素材栏滚动到新素材。不要弹窗打断“框选 → Enter”的闭环。

### 5.3 素材排序与删除

- 鼠标拖动素材卡片改变当前 Block 内顺序
- 拖动时显示插入位置，不允许拖到其他 Block（跨 Block 移动留待后续）
- 选中素材后按 `Delete` 删除；输入框聚焦时不得触发
- 卡片同时提供可发现的删除按钮，避免键盘成为唯一入口
- 删除后选择下一个素材；若不存在则选择上一个；都不存在则清空选择

### 5.4 定位原图

素材卡片双击或右键菜单“定位原图”：

1. 根据 `sourceId` 找到 MangaSource。
2. 清除搜索过滤或切换到可显示该 Source 的浏览状态。
3. 漫画 Grid/连续阅读器滚动到目标页并选中。
4. Viewer 加载原图。
5. 若素材含 Crop，重绘该 Crop 并以醒目边框高亮约 2 秒；之后保留淡色轮廓，直到用户取消或开始新选区。
6. 若原图缺失，保留当前工作区并显示“原图不可用”，提供显示原路径的入口，不得跳到错误页面。

定位目标：正常本地磁盘下，从点击到目标页进入可视区域不超过 1 秒（不含首次超大原图解码）。

## 6. UI 调整

主界面在 Phase 2 三栏结构上完善右栏：

```text
┌────────────────────┬──────────────────────────┬───────────────────┐
│ 漫画浏览器          │ Block 文案               │ 当前 Block 素材    │
│                    │ #018                    │                   │
│ [P031] [P032]      │ 文案……                  │ [1 整页] [2 Crop] │
│ [P033] [P034]      │                          │ [3 Crop]          │
│                    │                          │                   │
│                    │                          │ 拖动排序           │
├────────────────────┴──────────────────────────┴───────────────────┤
│ P034 · 选区 1600×1200       Block 18 / 64 · 素材 3 · 已保存       │
└──────────────────────────────────────────────────────────────────┘
```

### 6.1 CropOverlay

视觉状态：

- `idle`：无选区
- `drawing`：正在拖动，实时显示边框和外部暗色遮罩
- `pending`：松开待确认，显示尺寸与“Enter 添加 / Esc 取消”
- `located`：由 BlockAsset 反向定位得到的高亮框
- `disabled`：图片元数据不可用或格式暂不支持

选区手柄调整不是 Phase 3 必需项；若没有实现，用户可按 Esc 后重新框选。

### 6.2 BlockAssetList

每张卡片至少显示：

- 裁切后的视觉预览；可通过 CSS `object-position/overflow` 或 Canvas 生成内存预览，但不落真实 Crop 文件
- 当前顺序编号
- `整页` 或 `Crop` 标识
- 原页编号，例如 `P038`
- 缺失原图警告
- 定位原图和删除操作

若使用 CSS 预览，应验证横图、竖图和极窄 Crop 不变形；不能简单 `object-fit: cover` 后展示错误区域。

## 7. 快捷键优先级

| 快捷键/操作 | 行为 |
|---|---|
| `Enter` | 有 pending Crop 时确认 Crop；否则把当前整页加入 Block |
| `Esc` | 依次取消 pending Crop、located 高亮或大图预览 |
| 双击漫画缩略图 | 加入整页；大图预览改由 Space 控制，避免行为冲突 |
| `Delete` | 删除当前选中的 BlockAsset |
| `A` / `←` | 上一漫画页 |
| `D` / `→` | 下一漫画页 |
| `Space` | 打开/关闭大图预览 |
| `F` | Fit Window，并重算 Overlay 显示位置 |

统一优先级：

```text
输入法组合 / 文本输入
    > 模态层与 Crop
    > BlockAsset 操作
    > 漫画浏览
    > 全局 Block 快捷键
```

在 `textarea`、`input`、`contenteditable` 聚焦时，除显式 Ctrl/Alt 组合外，不触发 Enter、Delete、A、D、Space、F。

## 8. 状态与 Actions

新增状态：

```js
{
  selectedAssetId: null,
  cropDraft: null,
  cropMode: "idle",
  locatedAssetId: null
}
```

新增项目 actions：

```js
addWholeSourceToBlock({ blockId, sourceId })
addCropToBlock({ blockId, sourceId, crop })
removeAsset({ blockId, assetId })
moveAsset({ blockId, assetId, toIndex })
selectAsset(assetId)
locateAsset({ blockId, assetId })
```

新增 Viewer actions：

```js
beginCrop(point)
updateCrop(point)
finishCrop(point)
cancelCrop()
showLocatedCrop({ sourceId, crop })
clearLocatedCrop()
scrollToSource(sourceId)
```

项目 action 必须不可变更新；临时 Crop 草稿和 located 高亮是 UI 状态，不写入 `project.json`。只有确认后的 BlockAsset 才持久化。

## 9. Undo / Redo 与自动保存

下列操作各形成一条独立历史记录：

- 加入整页素材
- 确认 Crop 素材
- 删除素材
- 一次完整拖拽排序

下列操作不进入历史：

- 开始、调整或取消未确认 Crop
- 选择素材
- 定位原图、切换漫画页、打开预览

Undo/Redo 后：

- 保证 `order` 连续
- 尽可能恢复合理的 `selectedAssetId`
- 标记项目 dirty 并走 Phase 2 自动保存
- 不应改变用户当前正在编辑的文案内容，除非撤销目标本身就是先前的文案命令

## 10. Source 扫描与持久化

Phase 1 的 `scanImages()` 只返回 path/name/url。Phase 3 前应升级为：

```js
{
  path,
  fileName,
  width,
  height,
  order
}
```

`url` 是运行时展示字段，不应写入 `project.json`；打开项目时按安全协议重新构造。若 Electron 对 `file://` 加载存在限制，建议注册只读自定义协议（如 `mangadesk-media://`），并仅解析当前项目已登记的 Source，避免暴露任意本地文件。

重新扫描算法：

1. 规范化扫描到的绝对路径。
2. 与项目已有 `sources` 按路径匹配。
3. 匹配项保留 ID 并刷新元数据。
4. 新路径创建新 Source。
5. 未扫描到但仍被 BlockAsset 引用的 Source 保留并标记 `missing: true`。
6. 未被引用的缺失 Source 也不自动删除；清理由未来显式功能完成。

## 11. 建议组件与文件

```text
src/
├── components/
│   ├── MangaViewer/
│   │   ├── MangaViewer.jsx
│   │   └── CropOverlay.jsx
│   └── BlockAssetList/
│       ├── BlockAssetList.jsx
│       ├── BlockAssetCard.jsx
│       └── AssetContextMenu.jsx
├── stores/
│   ├── projectStore.js
│   └── viewerStore.js
├── models/
│   ├── asset.js
│   └── crop.js
└── lib/
    └── coordinates.js

electron/
├── ipc/
│   └── images.js
└── services/
    └── ImageMetadataService.js
```

拖拽排序可选用轻量库，也可使用 Pointer Events 实现。无论方案如何，必须支持键盘可达的“前移/后移”操作，不能只有鼠标拖动。

## 12. 异常与边界处理

- 当前无 Block：禁用加入素材，并聚焦/创建第一个 Block
- 当前无漫画页：Enter 不执行，显示简短提示
- 原图在操作间被删除：素材保留，显示 missing 状态
- Source 尺寸未知：允许整页加入，禁用 Crop
- Crop 接近边缘产生浮点越界：保存前 clamp，并再次校验
- 重复快速按 Enter：一次按键只添加一次；保存未完成不应阻止继续操作
- 切换页或 Block 时存在 pending Crop：默认取消，并给出轻量提示，不自动把选区加到错误 Block
- 删除包含素材的 Block：沿用 Phase 2 删除确认策略，Undo 可完整恢复其素材
- 搜索过滤期间定位原图：定位动作优先，自动清除过滤并说明原因
- 重新排序 Source 后：BlockAsset 仍按 `sourceId` 引用，不受页码变化影响

## 13. 实施顺序

1. 为 MangaSource 建立稳定 ID、尺寸元数据和重扫描合并逻辑。
2. 定义 BlockAsset/Crop 校验、工厂函数和 Phase 2 项目迁移。
3. 实现整页加入当前 Block、素材列表与自动保存。
4. 实现 CropOverlay、坐标换算、确认/取消流程。
5. 实现素材选择、删除、拖拽及键盘排序。
6. 实现从素材定位 Source、虚拟列表滚动和 Crop 高亮。
7. 接入 Undo / Redo、快捷键优先级和输入法保护。
8. 完成缺失文件、非法 Crop 和重新扫描的容错。
9. 执行坐标单测、项目集成测试与大项目人工验收。

## 14. 测试重点

### 坐标单元测试

- 图片与容器同比例、横向留白、纵向留白三种 contain 布局
- 从左上到右下和反向拖动得到相同归一化结果
- 起点/终点越过图片边界时正确 clamp
- 缩放前后同一 Crop 显示在同一图像内容区域
- `x + width`、`y + height` 浮点误差不会产生越界数据

### Store 单元测试

- 整页/Crop 追加顺序正确
- 删除、任意位置移动后 order 连续
- 撤销删除恢复原 ID、Crop 和顺序
- 删除最后一张素材会将 `assetDone` 设为 false
- 同 Source 多次使用不会互相覆盖

### 集成测试

- 添加整页和 Crop 后重启，素材与预览完整恢复
- 从第 100+ 页素材定位原图时，虚拟列表正确滚动
- 搜索过滤下定位原图仍能成功
- 原图丢失后项目仍可打开、编辑、保存及撤销其他操作
- 中文输入框聚焦时 Enter/Delete/A/D 不会误操作素材或图片

### 人工视觉验收

至少使用以下素材检查 Crop 精度：

- 竖向长图、横图、方图
- 4K 以上大图
- Viewer 放大、缩小、Fit Window
- 靠近四边和四角的 Crop
- 极窄但合法的横向/纵向 Crop

## 15. 性能基线

- 1000 个 MangaSource、200 个 Block、每 Block 10 个素材时，Block 切换无明显卡顿
- Crop 拖动保持接近屏幕刷新率，不在每次 pointermove 更新整个 projectStore
- BlockAsset 预览不加载无关原图；可见区域外延迟加载
- 定位原图不重新扫描整个目录
- 添加或排序素材不触发全部漫画缩略图重渲染

## 16. 完成定义（Definition of Done）

以下条件全部满足才算 Phase 3 完成：

- 当前页可通过 Enter 或双击直接加入当前 Block
- 用户能在 Viewer 拖框，并以“框选 → Enter”两步生成 Crop 引用
- Crop 数据只保存归一化坐标，不产生新的图片文件
- BlockAsset 可预览、选择、删除、鼠标拖拽排序和键盘排序
- 任一素材均可在 1 秒左右定位对应原页；Crop 能恢复高亮
- 素材增删排序支持 Undo / Redo，并由 Phase 2 自动保存可靠持久化
- 缺失原图或非法 Crop 不会导致项目崩溃或数据丢失
- Phase 1 阅读能力和 Phase 2 连续写稿流程无回归

Phase 3 的最终验收语句：

> 用户可以一边阅读漫画、一边写当前 Block，并用“整页 Enter”或“框选 → Enter”快速配图；之后从任何 Block 素材都能立即回到它的原始漫画位置。
