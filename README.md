# 字体测试样张

> [!NOTE]
> 本项目所有代码由 *Deepseek Flash* 模型生成

用 Markdown 写正文、用一棵 TOML 配置字体，构建成**一个自包含的 HTML 文件**，用来挑选字体、检查排印质量。

零依赖，只用 Node 标准库；产物是纯静态页面，可以直接双击打开，也可以发给别人看。

- 正文与样式全部内联进 `index.html`，不依赖网络、不需要构建工具链
- 中文 / 西文 / 中西混排 / 数字 / 字母 / 标点各有专段，粗体、斜体全覆盖
- 页面上可以现场换字体：枚举系统字体、载入本地字体文件、中西文分别设置或统一设置
- 字体是否真的生效，用 canvas 实测给出绿/红点，而不是靠肉眼看回退

许可证：[Unlicense](LICENSE)（公有领域）。

## 快速开始

```bash
node build.mjs            # 生成 index.html
node build.mjs --open     # 生成后用默认浏览器打开
node build.mjs --serve    # 生成后起本地服务器 http://localhost:4173/
node build.mjs --watch    # 监听源文件，改动即重建
```

需要 Node 18 或更新的版本（项目没装任何 npm 包，`npm install` 也不需要）。

想用页面上的「检测系统字体」「打开字体文件夹」，请用 `--serve` 从 `http://localhost:4173/` 访问；直接双击 `index.html` 时这两项会被浏览器限制，其余功能照常。

## 目录结构

| 文件 | 作用 |
| :--- | :--- |
| `content.md` | 样张正文，普通 Markdown。想测别的文本就改这里 |
| `font.toml` | 字体、字号、行高、配色等全部可调项 |
| `style.css` | 版面样式，所有数值走 CSS 变量，由 `font.toml` 注入 |
| `app.js` | 页面交互：字号行高、字体面板、字体检测、拖放载入，构建时内联进 HTML |
| `build.mjs` | 构建脚本：TOML 解析 + Markdown 渲染 + 生成 `index.html` + 静态服务器 |
| `index.html` | 构建产物，可单独分发 |
| `LICENSE` | Unlicense（公有领域）全文 |
| `package.json` | 只提供 `npm run build / watch / serve / open` 之类的快捷命令 |

工作流很短：

```text
content.md ─┐
font.toml ──┼─→ node build.mjs ─→ index.html（CSS + 正文 + JS 全内联）
style.css ──┤
app.js ─────┘
```

## font.toml

字体栈写法与 CSS 一致：逗号分隔，带空格的族名要加引号。

```toml
[meta]
title = "字体测试样张"      # 页面标题，也显示在左上角

[base]
latin = "'JetBrains Maple Mono'"                     # 西文：字母、数字、西文标点
cjk = "'HarmonyOS Sans SC', 'Microsoft YaHei'"       # 中文：汉字、中文标点
mono = "'JetBrains Maple Mono'"                      # 行内代码、表格数字
unified = ""                                         # 非空则中西文共用这一个字体
size = "18px"
line-height = 1.9
letter-spacing = "0.01em"
text-align = "left"        # left | justify
bold-weight = 700          # 粗体字重

[headings]
latin = ""                 # 留空则沿用 base.latin
cjk = ""                   # 留空则沿用 base.cjk
weight = 600

[style]
background = "#f6f4ef"     # 页面底色
card = "#fffdf9"           # 卡片 / 信息条底色
foreground = "#191919"     # 正文颜色
muted = "#6b6660"          # 次要文字
accent = "#9a3412"         # 强调色（序号、链接、按钮）
rule = "#e2ddd3"           # 分隔线
code-bg = "#eee9dd"        # 行内代码底色
measure = "46rem"          # 版心宽度

[features]
ligatures = true           # 连字：liga / calt，false 时显式关闭
tabular-numbers = false    # 等宽数字：tnum，页面顶部开关可即时切换
```

配置与 CSS 变量的对应关系：

| 配置项 | CSS 变量 | 说明 |
| :--- | :--- | :--- |
| `base.latin` + `base.cjk` | `--font-text` | 正文与标题的字体栈（拼接规则见下） |
| `base.mono` | `--font-mono` | 行内代码、信息条、页脚 |
| `base.size` | `--fs` | 正文字号，也决定顶部滑杆初值 |
| `base.line-height` | `--lh` | 行高 |
| `base.letter-spacing` | `--ls` | 字距 |
| `base.text-align` | `--align` | 段落对齐 |
| `base.bold-weight` / `headings.weight` | `--fw-bold` / `--fw-head` | 粗体、标题字重 |
| `headings.*` | `--font-head` | 标题字体栈 |
| `style.*` | `--bg / --card / --fg / --muted / --accent / --rule / --code-bg / --measure` | 配色与版心 |
| `features.*` | `--features` | `font-feature-settings` |

### 字体栈拼接规则

`--font-text` 不是简单的 `latin, cjk`，而是：

```text
--font-text: 〈latin 去掉通用族〉, 〈cjk〉
```

西文栈末尾的 `sans-serif`、`serif`、`monospace` 这类**通用族会被自动删掉**。否则回退链会在 `sans-serif` 处终止，后面的中文字体永远不会被用到——浏览器只会按字符逐个回退，绝不跨过已命中的通用族。

### 中西统一字体

`base.unified` 非空时直接用它做 `--font-text`，不再拼 `latin` / `cjk`：

```toml
unified = "'HarmonyOS Sans SC'"
```

适合只用一款同时带汉字和拉丁字形的字体（思源黑体、微软雅黑、霞鹜文楷等）。页面字体面板里的「中西统一」槽位对应这个设置。

### 测试本地字体文件

不想装字体也能试，加 `[[face]]` 段，`family` 必须和字体栈里的名字一致：

```toml
[[face]]
family = "Test Sans"
file = "./fonts/TestSans-Regular.woff2"   # 相对 index.html 的路径
weight = 400
style = "normal"                          # normal | italic

[[face]]
family = "Test Sans"
file = "./fonts/TestSans-Bold.woff2"
weight = 700
```

每个 `[[face]]` 生成一条 `@font-face`。注意 `index.html` 本身会把 CSS 内联进去，但字体文件仍是外部引用：分发 HTML 时要连字体文件一起带上，或者改用下面面板里的「载入字体文件」。

## 页面功能

- **顶部工具条**：字号滑杆（13–32px）、行高滑杆（1.2–2.6）、等宽数字开关、重置。
- **信息条**：当前生效的西文 / 中文两段字体栈，改字体后实时更新。
- 工具条和信息条都是 `position: sticky`，滚动时一起钉在顶部；工具条会换行，高度由 `ResizeObserver` 实测后写进 `--topbar-h`，信息条拿它当 `top` 偏移，窄屏下也不会错位。
- **分屏对比**：顶部「分屏对比」把样张并排成左右两栏，每栏用不同字体，滚动时按百分比联动，详见下节。
- **页脚字体可用性**：对 `font.toml` 里出现的每个字族用 canvas 实测，绿点表示本机已安装，红点表示已回退到后继字体。

### 字体面板（右上角「字体…」）

| 功能 | 说明 |
| :--- | :--- |
| 槽位切换 | 「西文 / 中文 / 中西统一 / 对比 B」四选一，点哪个就改哪个；进入分屏对比后，栏头左侧的按钮会直接定位到对应槽位 |
| 检测系统字体 | 优先用 [Local Font Access API](https://developer.mozilla.org/docs/Web/API/Local_Font_Access_API)（`queryLocalFonts()`）枚举本机全部字族；不支持或被拒绝时退回 canvas 探测内置候选清单，并在面板上写明失败原因 |
| 字体列表 | 每行用该字体自身渲染 `永 Aa 0123` 做预览，可按名字搜索；点一下应用，刷新后由 `localStorage` 记住，点「恢复 font.toml」回到配置值 |
| 载入字体文件 | 选 `.woff2 / .woff / .ttf / .otf / .ttc`，或直接把文件拖到页面上。文件名里的 `Bold / Light / Italic / Semibold` 等关键词会被解析成对应的 `weight`、`style`，同族多个文件自动合并，可按真实粗体、斜体对比 |
| 打开字体文件夹 | 由本地服务器把这些目录在资源管理器中打开：Windows 的 `C:\Windows\Fonts` 与 `%LOCALAPPDATA%\Microsoft\Windows\Fonts`，macOS / Linux 的对应目录。服务端白名单校验，只允许打开字体目录 |

几点限制：

- 枚举系统字体与打开文件夹需要 `node build.mjs --serve` + `http://localhost:4173/`，并且「检测系统字体」必须是**真实点击**（浏览器要求用户手势，脚本模拟的点击会得到 `SecurityError`）。
- 在 `file://` 下打开时，这两项不可用；探测器、字体切换、载入字体文件都正常工作。
- 载入的字体文件只活在当前页面会话（`FontFace` + Blob URL），刷新就没了。

### 分屏对比

点顶部「分屏对比」（或面板里的「对比 B」槽位）进入，再点一次退出。

- 左右两栏是同一份 `content.md` 的两个副本，共享 `font.toml` 的字号、行高、字距、配色，只有字体栈各自独立：A 栏正文用当前字体栈、标题沿用 `font.toml` 的标题字体，B 栏正文和标题都用被对比的字体。
- **A 栏**永远用页面上当前生效的字体栈，跟着字号滑杆和面板里的选择实时变；**B 栏**用面板「对比 B」槽位选的字体，没选过时回退成 `font.toml` 的原始配置，栏头会标上 `（font.toml）`。所以默认状态就是「你改过的字体 vs 配置默认」。
- 同步滚动按**滚动进度百分比**对齐，而不是像素——两侧字体不同、总高度往往不一样，按比例才能保证两栏始终看着同一段文字。用鼠标滚轮、拖动滚动条、键盘 `PageDown` 滚任意一栏，另一栏跟着走。
- 对比期间整页不再滚动，两栏各自滚动，顶上工具条和信息条照旧钉着；退出后恢复普通排版。
- 窗口窄于 880px 时自动变成上下两栏，同步规则不变。

## 写正文

`content.md` 用的是本仓库自带的小渲染器，支持常用语法的子集：

- 标题 `#`～`######`，会生成 `id` 便于锚点跳转
- 段落、`**粗体**`、`*斜体*`、`***粗斜体***`、行内代码（一对反引号包裹）
- 无序列表 `- * +`、有序列表 `1. 2.`，续行需缩进两个空格
- 引用 `>`、围栅代码块（连写三个反引号开头，其后可写语言名）、分隔线 `---`
- 表格（含 `:---` / `:---:` / `---:` 对齐控制，渲染成 `al-c` / `al-r` 类）、链接、图片、`<br>`

表格单元格里的竖线要转义（在前面加一个反斜线），或者整格包成行内代码；样张里把斜线、竖线单独放在表格外的一段，避免和表格分隔符打架。

## 命令行

| 命令 | 说明 |
| :--- | :--- |
| `node build.mjs` | 构建 `index.html`，并打印当前生效的字族清单 |
| `node build.mjs --watch` | 监听 `content.md` / `font.toml` / `style.css` / `app.js`，改动后自动重建（80ms 防抖） |
| `node build.mjs --serve [端口]` | 先构建，再在 `127.0.0.1` 上起静态服务器，默认 4173 端口；同时提供 `/api/health`、`/api/reveal` |
| `node build.mjs --open` | 构建后用系统默认浏览器打开 `index.html`（`start` / `open` / `xdg-open`） |

## 设计备忘

几个踩过的坑，改代码前值得先看一眼：

- **通用族必须删**：见上文拼接规则。漏删的后果是中文字体静默失效，看起来像「字体没装上」。
- **`dialog` 要补 `:not([open])`**：`dialog.panel { display: flex }` 会盖过浏览器默认的 `dialog:not([open]) { display: none }`，不显式补一行，关闭状态的对话框仍占满布局。
- **可用性探测用三段基线**：canvas 对每个字族分别以 `monospace`、`sans-serif`、`serif` 为基线各量一次，任一宽度差 > 0.01 视为已安装。单基线会把「和基线本来就同宽」的字体误判为缺失。
- **工具条高度用 JS 量**：`flex-wrap` 下高度随视口变化，纯 CSS 的 `top: 104px` 之类的硬编码在窄屏会露馅。
- **`\u0000` 占位符**：渲染器用 `\u0000` 包住行内代码和 `<br>`，防止后续的强调替换动到它们；写文件时要注意别让它变成真正的 NUL 字符。

## 许可证

[Unlicense](LICENSE) —— 公有领域。随便用，不署名、不附带条件。
