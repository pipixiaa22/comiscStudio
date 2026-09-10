# UI 黑白简约风改造方案

> 项目：MangaDesk / CommentaryDesk  
> 日期：2026-09-10  
> 状态：设计与实施方案，尚未修改界面代码  
> 依据：`项目架构说明.md` 与当前仓库源码。

## 1. 改造目标与范围

将现有「深蓝黑底 + 橙色强调」改为以白色、黑色、中性灰为主的简约工作台。默认采用浅色主题：白色编辑区、浅灰辅助区、黑色主要按钮，减少装饰色与厚重卡片，让漫画素材、文案和当前操作成为视觉重点。

风格参考用户指定的 [ChatGPT 官网](https://chatgpt.com/)。这里借鉴简洁、克制、内容优先的方向；下文色值、尺寸与组件规范均为本项目建议值，不代表官网内部设计参数，也不照搬聊天页面的布局。

本期范围：

- 统一配色、字体层级、圆角、边框、交互反馈及基础控件。
- 覆盖欢迎页、项目中心、漫画/动漫工作台、阅读器、配音、分镜、导出和剪映辅助窗口。
- 保留三栏工作流、拖拽、快捷键、窗口尺寸适配和现有业务行为。
- 统一主窗口与辅助窗口的启动底色，避免白色界面出现前闪现深色背景。

本期不加入主题切换，不修改项目数据结构、IPC 协议、素材处理逻辑和导出结果。后续如需深色模式，可基于本次建立的语义变量扩展。

## 2. 当前代码现状

| 位置 | 已确认的现状 | 改造方向 |
| --- | --- | --- |
| `src/index.css` | body 使用 `#0f1219`，抽屉与滚动条有独立硬编码颜色 | 建立全局主题变量，统一页面、抽屉与滚动条 |
| `tailwind.config.js` | `theme.extend` 为空 | 映射语义颜色，支持透明度修饰符 |
| `components.json` | `baseColor: slate`、`cssVariables: true` | 调整为 neutral；实际换肤仍需修改 CSS 和组件 |
| `src/components/ui/button.jsx` | 主按钮与焦点环为橙色，次按钮/幽灵按钮为 slate 色 | 统一按钮变体及键盘焦点 |
| `src/components/ui/card.jsx` | 默认半透明深色卡片 | 白底、细边框、减少容器嵌套 |
| `src/components/ui/scroll-area.jsx` | 滑块使用 `bg-slate-600` | 使用统一滚动条变量 |
| `src/App.jsx`、`src/main.jsx` | 主容器、通知、错误边界仍为深色 | 一并迁移，包含启动失败状态 |
| `src/app/`、`src/features/` | 大量 `slate`、`orange`、`amber`、`emerald` 和任意色值 | 按用途迁移，检查条件分支、hover、focus、selected |
| `main.js`、`electron/services/AssistantWindowService.js` | BrowserWindow 背景为 `#11141c` | 同步默认浅色启动底色 |

项目已采用 shadcn 风格的本地组件组织方式，Button 使用 CVA，ScrollArea 使用 Radix。不能假设已具备完整 shadcn 组件库，也不能只改 `components.json` 就完成换肤。

## 3. 视觉规范

### 3.1 配色与语义变量

色彩使用中性灰，避免原有 slate 的蓝灰倾向。

| 变量 | 建议色值 | 用途 |
| --- | --- | --- |
| `background` | `#FFFFFF` | 页面、编辑主区域 |
| `foreground` | `#171717` | 正文、主要图标 |
| `surface` | `#F7F7F7` | 素材侧栏、检查器背景 |
| `card` / `card-foreground` | `#FFFFFF` / `#171717` | 独立信息容器 |
| `popover` / `popover-foreground` | `#FFFFFF` / `#171717` | 菜单、提示、弹层 |
| `primary` / `primary-foreground` | `#171717` / `#FFFFFF` | 主要动作 |
| `primary-hover` | `#303030` | 主按钮悬停 |
| `secondary` / `secondary-foreground` | `#F2F2F2` / `#262626` | 次按钮、辅助操作 |
| `muted` / `muted-foreground` | `#F5F5F5` / `#666666` | 弱背景、辅助文字 |
| `accent` / `accent-foreground` | `#EBEBEB` / `#171717` | 列表悬停、菜单高亮；此处不表示彩色品牌色 |
| `selected` | `#E8E8E8` | 选中行、活动文案块 |
| `border` | `#E5E5E5` | 容器分隔线 |
| `input` | `#8A8A8A` | 需要明确识别的输入边界 |
| `ring` | `#171717` | 键盘焦点环 |
| `destructive` / `destructive-foreground` | `#B42318` / `#FFFFFF` | 删除确认、失败、录制中的必要提醒 |
| `media-background` / `media-foreground` | `#202020` / `#FFFFFF` | 阅读画布、播放器及画布上浮层 |
| `overlay` | `#000000`，使用 40% 透明度 | 模态遮罩 |
| `scrollbar` | `#A3A3A3` | 滚动条滑块 |

默认界面不再使用橙色品牌强调。完成、收藏、选中、保存成功采用文字和图形表达。错误与录制允许少量红色，并同时提供明确文字；素材本身的颜色保持原样。

### 3.2 字体、尺寸与留白

- 延续本地字体栈：`Inter, "Segoe UI", "Microsoft YaHei", sans-serif`，不增加网络字体依赖。
- 页面标题 20–24px / 600；区块标题 14–16px / 600；控件和正文 14px；辅助信息 12px。
- 文案编辑正文建议 15–16px、行高 1.7；时间码使用等宽数字，避免播放时宽度跳动。
- 间距使用 4、8、12、16、24px；常规面板内边距 16–20px。
- 输入框与按钮圆角 8px，卡片 12px，弹窗 16px；胶囊圆角仅用于状态标签。
- 普通按钮高 36px，紧凑工具栏可保留 32px；图标按钮可点击区域至少 32×32px。
- 常驻面板默认无阴影，菜单/弹窗使用轻阴影。避免给每一层容器增加边框和卡片背景。

### 3.3 状态表达

| 状态 | 表达规范 |
| --- | --- |
| 默认 | 白底或透明背景，深灰文字 |
| 悬停 | 浅灰背景，100–150ms 颜色过渡 |
| 按下 | 比悬停略深的灰底；黑色按钮使用独立按下色 |
| 选中 | 浅灰底 + 深色边线/勾选图标；附 `aria-selected` 或适合控件的状态属性 |
| 键盘焦点 | 2px 实线深色环 + 2px 背景间隔，不与选中状态混用 |
| 禁用 | 禁止交互并降低视觉强度；不要把只读信息一并淡化 |
| 加载 | 旋转图标或进度条 + 说明文字；防止重复提交 |
| 成功 | 勾选图标 +「已保存」「已完成」 |
| 警告 | 提醒图标 + 原因及处理动作，使用中性容器 |
| 错误 | 少量红色图标/文字 + 可执行的恢复入口 |

## 4. 各模块改造方案

| 模块 / 文件 | 具体调整 | 必须保留的辨识度 |
| --- | --- | --- |
| `app/AppHeader.jsx` | 白底、细底边线；MangaDesk 标识改为黑色；视图切换使用灰底选中态；降低普通工具按钮权重 | 项目名、保存中/失败、当前工作区始终可辨 |
| `app/WorkspacePage.jsx` | 素材侧栏与检查器浅灰，中央编辑区白色；保留可拖动分栏 | 分隔条支持 hover 和键盘焦点；抽屉遮罩清楚 |
| `project/components/Welcome.jsx`、`ProjectCenter.jsx` | 白底、黑色线性图标；项目条目使用轻边框；搜索框统一 | 归档、重命名、空列表、加载失败分别展示 |
| `library/components/MangaBrowser.jsx`、`UsageBadge.jsx` | 移除橙色缩略图边框；选中使用双层边框/勾选；引用数量改灰色标签 | 收藏与已引用不能只靠背景深浅区分 |
| `blocks/components/BlockEditor.jsx` | 白色书写区；活动块浅灰底+左侧深色标记；次操作弱化 | 当前块、批量选择、输入焦点分别表达 |
| `blocks/components/BlockStatusPanel.jsx` | 减少卡片套卡片；五项进度使用复选框+文字 | 完成/待处理状态不能只用色块区分 |
| `assets/components/BlockAssetList.jsx`、`ScratchBasket.jsx` | 白色或浅灰容器；统一删除、排序、加入操作 | 拖拽目标、选中素材、来源丢失 |
| `assets/components/SourcePreview.jsx`、`reader/components/PageMedia.jsx` | 容器与错误占位统一；保留素材原色 | 不给图片或视频添加灰度滤镜 |
| `reader/components/ReaderDialog.jsx` | 工具栏白色，画布中性深灰；裁剪框改黑白双线；控制点白底黑边 | 裁剪边界在黑页、白页、复杂画面上均可见 |
| `video/components/VideoWorkspace.jsx`、`VideoAssetSummary.jsx` | 外围操作区浅色，播放器深色；统一时间字段与引用列表 | 当前选区实线边框、已引用区间纹理/较矮条、收藏刻度带图标、播放头双层线 |
| `voice/components/VoiceRecorderPanel.jsx` | 常态黑白灰；录制中使用小红点+计时文字；停止/暂停清晰分离 | 录制、暂停、试听、处理中、失败均有文字提示 |
| `storyboard/components/StoryboardView.jsx` | 白底条目、灰色进度；问题清单减少彩色装饰 | 缺文案、缺画面、来源丢失仍可定位 |
| `export/components/ExportView.jsx` | 参数按分组排列；导出动作黑底白字；进度条深灰 | 底图颜色选项保留真实色值，仅更换其选中边框 |
| `capcut/components/CapCutAssistant.jsx` | 与主窗口一致的白底灰分区；统一连接中/空状态/错误状态 | 小窗口中保留拖拽、复制与准备进度 |
| `App.jsx`、`main.jsx` | 全局通知、加载和错误边界同步浅色主题 | 错误文本在独立页面也有足够对比度 |

顶栏与每个局部操作组通常只保留一个黑色主按钮，其他操作用 secondary、outline 或 ghost。当前主要动作随上下文确定，例如编辑区为完成并继续、导出页为开始导出。

第一期保留当前响应式规则：1180px 以下检查器转抽屉，960px 以下隐藏左侧素材栏。对应宽度下验证主题和工具栏，不在配色改造中另行调整导航结构。

## 5. React + shadcn 实施方式

### 5.1 建立统一主题模块（必须执行）

采用「单一颜色源 → 自动生成 CSS 变量 → 组件使用语义名称」的结构。所有应用界面颜色统一放在根目录 `theme/`，不允许各业务模块自行维护色板。

```text
theme/
  tokens.json                 唯一颜色源：色值、语义名称、透明度、媒体专用颜色
  README.md                   变量用途、使用约束、修改与生成方式
scripts/
  generate-theme.cjs          校验颜色配置并生成 CSS 变量
src/
  shared/theme/
    tokens.generated.css     自动生成，禁止手改
  index.css                  引入生成文件，定义全局基础样式
tailwind.config.js           只映射语义名称，不保存具体色值
```

上述为建议新增结构，本次仅交付文档，尚未创建主题模块。

**职责与引用方式：**

- `theme/tokens.json` 保存第 3 节完整颜色规范，使用扁平语义键，例如 `background`、`primary`、`primary-foreground`、`primary-hover`、`media-background`。具体颜色以 HEX 保存，遮罩透明度等数字参数也集中配置。
- 生成脚本把 HEX 转成 HSL 通道值，输出 `:root` 下的 CSS 变量。输出顺序固定，不带生成时间，支持 `--check` 比较文件是否与配置一致。
- `src/index.css` 在 Tailwind 指令之前引入生成文件，不再重复声明颜色。保留布局、字体与媒体查询；抽屉和原生滚动条同样引用变量。
- Tailwind 配置只承担「语义类名 → CSS 变量」映射；例如 `bg-primary` 对应 `--primary`。映射中的名称列表可以维护，颜色值不得复制。
- React 组件优先使用 `bg-background`、`text-foreground` 等语义类名。必须使用内联样式时引用 `var(...)`，不能填入新的颜色常量。
- `main.js` 与 `electron/services/AssistantWindowService.js` 直接通过 CommonJS 读取同一份 `theme/tokens.json` 的 `background` 值，用作 BrowserWindow 底色。渲染层不导入 Electron API，也不为此新增 IPC。
- 打包配置必须包含 `theme/tokens.json`，并在打包后验证主窗口和辅助窗口能读取它。

配置示意如下，实际需要补齐完整色板：

```json
{
  "colors": {
    "background": "#FFFFFF",
    "foreground": "#171717",
    "surface": "#F7F7F7",
    "primary": "#171717",
    "primary-foreground": "#FFFFFF",
    "primary-hover": "#303030",
    "media-background": "#202020"
  },
  "opacity": {
    "overlay": 0.4
  }
}
```

**使用约束：**

1. 业务组件禁止新增 `text-orange-*`、`bg-slate-*`、`bg-[#...]` 和内联 HEX/RGB 等主题颜色；黑、白、灰也必须使用对应语义名称。
2. 同一色值可以对应多个不同用途的变量，例如 card 与 background。不要因为现在相同就强行合并，避免以后修改卡片背景时连带改变整页。
3. 业务模块确有特殊需求时，向公共主题增加有清晰用途的变量，如媒体裁剪边界；不得新建局部色板。
4. 素材原色、用户选择的导出底图颜色属于内容数据，不受界面主题扫描规则限制；对例外按文件和用途明确列出，避免粗暴替换。
5. Button 的所有变体、hover/pressed/focus、错误与录制状态、裁剪黑白双线、视频时间带各状态都从主题读取。所需新状态先补充 tokens，再实现组件。
6. 渐变、透明遮罩和阴影中的颜色也属于主题；布局尺寸和阴影几何参数可以保留在样式层。

**生成与检查：**

- 建议增加 `theme:generate` 与 `theme:check` 脚本；check 校验键名、颜色格式、必需变量、透明度范围和生成结果一致性。
- 在现有 `dev`、`build` 命令前显式执行生成脚本，保证 `start` 和打包所走的构建链也生成最新变量，不依赖隐式生命周期行为。
- 开发服务器运行期间，修改颜色配置后需要重新生成；如需即时换色，再给生成脚本增加 watch。第一期不必加入复杂构建依赖。
- 将生成 CSS 纳入版本管理，自动检查保证它与源文件同步；禁止手工编辑生成文件。
- 在项目检查流程中增加主题硬编码扫描，按明确例外跳过素材色板；这样后续新增页面不会再次出现颜色散落。

以后修改主题的流程固定为：**修改 `theme/tokens.json` → 生成 → 检查 → 预览关键页面**。只修改已有颜色值时无需改业务组件；新增语义名称时才需要同步 Tailwind 映射。

### 5.2 CSS 变量与 Tailwind 映射

下面展示生成后的变量及全局样式结构，变量来自主题模块，不能在 `src/index.css` 再手写一份。采用当前 Tailwind 3 可用的 HSL 写法，例如：

```css
@layer base {
  :root {
    color-scheme: light;
    --background: 0 0% 100%;
    --foreground: 0 0% 9%;
    --surface: 0 0% 97%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 100%;
    --border: 0 0% 90%;
    --ring: 0 0% 9%;
    --radius: 0.5rem;
  }

  body {
    background: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

上面是结构示例，实施时应完整补齐第 3 节全部变量，准确色值以该表为准。为媒体画布设置局部深色前景和控件样式，避免白色页面的全局文字色进入深色遮罩。

在 `tailwind.config.js` 的 `theme.extend.colors` 中逐项映射，例如：

```js
colors: {
  background: 'hsl(var(--background) / <alpha-value>)',
  foreground: 'hsl(var(--foreground) / <alpha-value>)',
  surface: 'hsl(var(--surface) / <alpha-value>)',
  primary: {
    DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
    foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
  },
  border: 'hsl(var(--border) / <alpha-value>)',
  ring: 'hsl(var(--ring) / <alpha-value>)',
}
```

同样补齐 secondary、muted、accent、card、popover、input、selected、destructive、media 等映射，再使用 `bg-background`、`text-muted-foreground`、`border-border` 等类名。所有文档中提到的 hover 变量也必须有对应映射。

### 5.3 统一基础组件

1. 保留 Button 当前调用接口，在 CVA 中替换颜色并补充 `outline`、`destructive` 变体；不要通过升级生成器覆盖现有自定义组件。
2. Card 默认白底、细边框；通过调用处决定是否需要卡片，移除覆盖主题的 `className`。
3. 原生滚动条和 Radix ScrollArea 使用同一颜色规范。
4. 盘点 `src/components/ui/` 全部现有组件，包含分隔条等交互控件，逐个检查主题残留。
5. 对重复 input、textarea、select 样式提供轻量本地封装或共享类名，保留受控值、事件、ref 和可访问名称。
6. 仅在确有交互需求时补充 Radix/shadcn 组件；不为换配色整体替换菜单或引入另一套 UI 框架。

### 5.4 按语义替换业务样式

| 原写法示例 | 目标写法 / 处理 |
| --- | --- |
| 主页面 `bg-[#0f1219]` | `bg-background` |
| 辅助面板 `bg-[#181c25]` | `bg-surface` |
| `text-slate-100` / `text-slate-300` | 按文字权重分配 foreground 或 muted-foreground |
| `border-slate-700` | 容器用 border-border，输入框用 border-input |
| `bg-orange-400 text-slate-950` | 主动作使用 Button 默认变体 |
| `focus-visible:ring-orange-300` | `focus-visible:ring-ring`，增加背景间隔 |
| 橙色选中边框 | selected 背景 + 深色边线/勾选 |
| 绿色完成标签 | 中性标签 + Check 图标 + 完成文字 |

不能机械地把全部 `bg-black` 改白色：播放器、素材预览与裁剪遮罩应按媒体语义处理。不能删除导出底图选项的色值，也不能改变导出渲染服务的背景参数。

对原生 checkbox、range、select、文本选区、placeholder、Tooltip、空状态和滚动条进行专项检查，避免残留系统蓝色或橙色。主窗口与助手的 `backgroundColor` 从 `theme/tokens.json` 读取，默认结果为 `#FFFFFF`，不在两个窗口文件中复制颜色常量。

## 6. 实施阶段与交付物

| 阶段 | 工作内容 | 完成条件 |
| --- | --- | --- |
| 1：主题基础 | 统一 theme 模块、生成与检查脚本、CSS 变量、Tailwind 映射、Button/Card/ScrollArea、主容器 | 唯一颜色源生效；生成检查通过；白底黑字、按钮各状态可读 |
| 2：核心工作流 | 顶栏、素材栏、文案、检查器、项目中心 | 完成一次导入→写文案→绑定素材，视觉层级统一 |
| 3：媒体与辅助页面 | 阅读裁剪、视频时间带、配音、分镜、导出、剪映助手 | 所有特殊状态可辨，媒体和导出颜色不变 |
| 4：清理验收 | 全局残留扫描、窗口启动色、尺寸与键盘回归 | 完成验收清单，提交前后截图和验证记录 |

建议分阶段提交，提交描述可用「建立黑白主题变量」「统一工作台界面样式」「完善媒体交互与主题验收」。本方案不要求变更业务 store 或历史栈。

## 7. 验收标准

### 7.1 视觉与可访问性

- [ ] 默认呈现白色主区域、浅灰辅助区和黑色主要动作；无装饰性橙色与蓝灰底。
- [ ] 普通文字对比度目标至少 4.5:1，大字至少 3:1；需要依靠视觉边界识别的控件和状态目标至少 3:1。实施时测量实际前景/背景组合，不能只检查变量表。
- [ ] 所有可操作元素有可见键盘焦点；选中和焦点状态可同时分辨。
- [ ] 完成、收藏、录制、警告、错误均有文字或图标，不单靠颜色。
- [ ] 裁剪框在纯黑、纯白和复杂素材上均可见；时间带重叠区间仍可分辨。
- [ ] 深色媒体画布上的文字、加载层和错误提示仍然清晰。
- [ ] 按钮 hover、active、disabled、loading 状态不出现白底白字或黑底黑字。
- [ ] 主窗口、剪映辅助窗口、启动失败页、菜单、抽屉与原生表单保持一致。

### 7.2 功能回归

- [ ] 新建/打开项目、搜索、重命名、归档、自动保存及保存失败提示。
- [ ] 导入图片/PDF、阅读翻页、缩放、裁剪、加入素材篮和绑定当前块。
- [ ] 文案编辑、批量选择、排序、拆分/合并、撤销/重做。
- [ ] 视频播放、In/Out、已引用范围、收藏、定位与绑定。
- [ ] 录音、暂停、续录、试听、裁剪、删除/恢复。
- [ ] 分镜检查、导出预检、进度、取消、打开结果和辅助窗口拖拽。
- [ ] 宽屏、1180px 与 960px 断点两侧、辅助窗口最小尺寸下无新增溢出；检查器抽屉与分栏拖动正常。

### 7.3 验证方法

以当前 `package.json` 为准执行 `pnpm test` 和 `pnpm build`，再通过 `pnpm start` 在 Electron 内进行上述手动回归。当前 test 已指向 `node --test tests/*.test.cjs`；当前未配置 lint 脚本，不将架构说明中提及的 lint 当作现成命令。

构建与纯函数测试通过不能替代视觉检查。至少留存：工作台、项目中心、阅读裁剪、视频选区、录音中、导出进度、窄窗口检查器和剪映助手的前后截图。

扫描 `src/` 中的 orange、amber、emerald、slate、十六进制颜色及内联样式，逐项确认残留用途。允许主题定义、媒体用途与真实导出色板；最终应无未解释的业务页面硬编码主题色。不提交生成的 `dist/` 文件。

## 8. 完成定义

本次改造完成后，新增页面可以直接使用共享组件和语义颜色获得统一外观；现有工作台以黑白灰为主，创作内容保持原色，编辑、裁剪、录音和导出的操作状态仍然清晰。交付应包含源码改动、验证记录与主要页面截图，本文件作为实施和验收依据。
