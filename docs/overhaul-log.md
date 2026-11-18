# 主站改造记录（2026-11-18）

## 站长修正（本轮按此执行）

- 目标市场是美国 / 英文用户。不做 `/zh/` 独立 URL，也不为中文再预渲染一套 HTML。可抓取正文保持英文。界面里的中文只留给语言切换器，不新增可索引中文页。
- 不新增大批页面或 guides。SEO 扩页保持冻结。工作放在现有工具的质量和体验上。
- 分析客户端冻结：没有新埋点，没有改用户身份或存储方式，没有接入 Plausible 或其他分析服务。广告位 id 与 Plausible 密钥继续留空。

## 下线（301 到仍在线上的最近工具）

源码目录还在，路由已从 `src/tools/index.ts` 拿掉，`public/_redirects` 同时覆盖工具页和 `/guides/...`（带不带尾斜杠都有）。guides 旧条目留在文件里，避免为下线去改写说明正文；`auditToolSeoData` 用 `src/tools/retired.ts` 把这些 path 当成已退休。

| 下线 | 301 到 | 原因 |
| --- | --- | --- |
| /today-in-history | /date-converter/ | 不是开发者工具，还要联网 |
| /reaction-time-test | /eta-calculator/ | 反应测试，没有开发者搜索需求 |
| /chronometer | /eta-calculator/ | 秒表，和 ETA 重复且更弱 |
| /benchmark-builder | /eta-calculator/ | 手工计时，输出粗糙 |
| /camera-recorder | /image-compress/ | 摄像头录制，不是代码工具，包也很重 |
| /text-to-nato-alphabet | /text-to-unicode/ | 北约音标，开发者搜索量可忽略 |
| /numeronym-generator | /slugify-string/ | 玩具缩写 |
| /string-obfuscator | /hash-text/ | 遮一截字符串，哈希已经覆盖「不要明文」 |
| /keycode-info | /device-information/ | 按键码查询，需求被设备信息页盖住 |
| /html-wysiwyg-editor | /markdown-to-html/ | 编辑器又重又糙，写内容用 Markdown |
| /random-port-generator | /token-generator/ | 随机端口是一次性数字 |
| /svg-placeholder-generator | /image-resize/ | 占位图需求低，缩放仍在 |
| /roman-numeral-converter | /base-converter/ | 罗马数字不是开发者日常换算 |
| /morse-code-converter | /text-to-unicode/ | 摩尔斯电码，编码玩具 |
| /email-normalizer | /list-converter/ | 邮箱归一被列表去重盖住，仓库里早有下线草案 |
| /ipv6-ula-generator | /ipv4-subnet-calculator/ | ULA 生成极窄，子网计算器是网络规划入口 |

留下并加强的高频工具：JSON（含 minify / 树 / 错误定位）、Base64、JWT、正则（原有可视化）、Cron、时间戳（date-converter 与 unix-timestamp 都留着，它们打的词不一样）、URL、Hash（新增按文件字节计算）、UUID、YAML/JSON/CSV、Diff、颜色（加大色块）、SQL（非法语句不再把页面打崩，并显示解析错误）。

JSON minify 这个独立页留下了。它在关键词表里是 JSON 簇的一条，而且 "json minify" 是独立检索词，并进格式化页会丢这个入口。

## 体验

- 每个有文本框的工具页都能上传文件、从 URL 载入、把文本文件拖进去。单份上限 2 MB。URL 在浏览器里拉，跨域失败会说明原因，不走新的后端。
- JSON 格式化：Pretty / Tree / Minify。JSON5 报错带位置，"Show the error" 会选中出错的字符。超过 10 万字符的高亮输出改成纯文本，避免 highlight.js 卡住。
- YAML 报错带行号和列号。SQL 格式化失败时显示 sql-formatter 的错误，不再让计算属性抛出去。
- Hash 增加「Hash a file」，用文件字节做摘要，上限 8 MB，不上传。
- 颜色转换顶部加一块 96px 色板。
- 首页标题加大，Hero 下有 8 个分类入口（簇图标 + 色相）。工具卡片的图标收到统一的圆角色块里，颜色跟任务簇走。
- 构建期用 sharp 给每个预渲染页面写 `dist/og/<slug>.png`（1200×630）。`og:image` 和 `twitter:image` 指向这张图，不再全站共用一张 jpg。

## 三轮对照复盘（对照 2026-11-18 总复盘包）

对照文件：`reports/02`、`reports/04` 的 P1-A，`tables/04` 主站行，`tables/05` 的 B05/B20，`tables/06` 的 GROWTH-MATRIX。API Studio 的 B06–B15 不在本仓库改运行时。

### 第一轮：计划与阻塞

- P1-A「不扩目录充数」：已下线 16 个低需求工具并 301，工具数从 120 收到 104。没有新工具页，没有新 guide。
- P1-A「高意图工具要有说明、示例、限制、错误恢复、FAQ、相关工具」：原有 guides 还在。本轮给 JSON / YAML / SQL 补了能看懂的错误，给所有文本工具加了上传、拖放和从 URL 载入。
- P1-A「不说全站都在本地」：关于页、FAQ 和首页隐私段改成点名 WHOIS 与 HTTP 状态检测。不再提已下线的「历史上的今天」。
- B05 最新 GSC/CF 流量：没有账号，不能补。不编造数字。
- B20 分析客户端冻结：没有新事件，没有改身份或存储，没有接 Plausible。
- B06–B15 API Studio：没有改 runner、脚本、变量、CSV、报告或 CLI。入口文案可以以后再统一，这轮不碰 `src/tools/api-debugger/` 的运行时代码。

### 第二轮：竞品差距矩阵

矩阵对主站的判断是：目录广度有用，但竞争力不靠工具数量；缺的是品牌权威、外链、真实美国流量、复访、付费/API/团队，以及工具级抽测。

- 能在这个仓库做的抽测：JSON 树/压缩/错误定位、文件哈希、YAML 行列、SQL 错误、颜色色板、大文件不走高亮。这些是对 JSONLint / 格式化站的功能差距，不是流量差距。
- 外链、排名、复访、付费：没有一方数据，也不在这次改代码能证明的范围。记为未做，不写成已完成。
- 矩阵写「历史 117 工具」。当前注册表是 104。差出来的是这轮下线，不是漏计。

### 第三轮：文案和还没到商业手感的地方

- 改了首页四条理由、隐私段、赞助句，以及 JSON、YAML、SQL、JWT、Base64、哈希、CSV、URL、日期、时间戳这些说明。去掉 “Simply convert”、“right in your browser”、“nothing leaves your browser” 这种每页复读。
- 高意图工具的输入标签改成短句：JSON、YAML、SQL、Token、Text。JWT 写明不校验签名。
- 没改 keyword map 锁死的 `<title>`。没重写 82 篇 guides 正文：那是已有说明，整篇重写会变成新的 SEO 正文，和冻结冲突。
- 还没到的：没有在真实手机上做键盘和读屏验收；没有 Lighthouse 分数；OG 图是构建期纯色卡片，不是设计师出的每工具插画。这些需要站长在线上或设计稿上决定。

## 明确没做

- 没有 `/zh/` 路由，没有中文预渲染，没有改 hreflang 为多 URL。
- 没有新的 guide 文章，没有新的工具页。
- 没有 Plausible、没有新的分析事件。


事实记录。对照的是这些公开站点当时能看到的产品形态：it-tools.tech、CyberChef、transform.tools、jsonformatter.org、10015.io，以及 codebeautify / DevUtils / 在线工具类站点的公开页面结构。

## 对标结论

- **it-tools.tech**：侧栏 + 卡片网格 + Ctrl/Cmd K。工具页几乎只有输入区，没有独立说明、FAQ、相关工具，也没有每页 SEO。本站原本就在这套骨架上，说明和 SEO 已经超过它；壳层仍是同一套渐变侧栏，工具区被限制在约 600px。
- **transform.tools**：按「从哪种格式转出」分组，编辑区宽，复制顺手，有一张站点级 OG 图。它不解决收藏、最近使用、多语言和工具说明。
- **jsonformatter.org**：JSON 树、本地下载、本地记住上次内容、示例和 FAQ 是用户会留下来的原因。痛点是广告和登录分享打断编辑区。
- **10015.io**：首页是搜索 + Featured + 按类目铺开的工具卡，OG 图统一。类目清楚，单工具页的说明深度参差。
- **CyberChef**：配方管道、大文件下载、F1 帮助。交互模型不同，不适合整站照搬；值得学的是「输出太大就给文件」和键盘帮助。
- **codebeautify / 大量中文工具站**：类目全、说明长，但广告贴着输入框，工具质量不齐。DevUtils 是 macOS 客户端，不是可对标的网页信息架构。

本轮要超过的点：宽工作区、JSON 树和默认可下载、搜索能被 `?q=` 打开（对应站点 SearchAction）、草稿留在本地、赞助位在结果外面且没有广告位 id 时不渲染空框架。

## 这次落地的改动

- 全局壳：去掉侧栏渐变头图，改成令牌色的品牌条；顶栏吸顶，命令面板仍是 Ctrl/Cmd K，并增加未聚焦输入框时按 `/` 打开。明暗色继续走 `dd-tokens` 和 Naive 主题。
- 首页：收藏、最近使用、新工具挪到热门工具之前（没有数据时不渲染，预渲染 HTML 不变）。搜索框标出 `Ctrl/⌘ K`。`?q=` 在客户端挂载后同步到搜索框，供 SearchAction 使用；预渲染仍输出完整目录。
- 工具页：标题区和工作区最大宽度 1100px，双栏工具可以并排。动作条增加分享到 X、系统分享（浏览器支持时）、恢复上次主输入。`?` 在非输入状态下展开/收起说明。客户端路由切换时补上 canonical、OG、Twitter（含 `twitter:image:alt`）。预渲染侧 `usePageSeo` 同步带上 alt。
- JSON Formatter（`/json-prettify`）：Pretty / Tree 切换，树由 `buildJsonTree` 生成；格式化结果默认可下载。`TextareaCopyable` 与 `FormatTransformer` 的下载默认改为开启，转换类输出带下载按钮。
- 文本 diff 维持 Monaco diff 编辑器，本轮没有重写。
- 粘性：收藏、最近使用、PWA（`vite-plugin-pwa` + `registerSW`）是原有能力。新增按工具 path 存在 localStorage 的主输入草稿，单条上限 20 万字符，超限不覆盖旧草稿。
- 变现：`SponsorSlot`。未配置 `VITE_ADSENSE_SLOT` 时只显示一行赞助说明和 `/contact` 链接，放在工具结果下方和首页热门工具之后。AdSense 脚本仍是 `index.html` 里已有的 `ca-pub-7944759654100814`。
- SEO：`index.html` 的 WebSite JSON-LD 增加 `SearchAction`，target 为 `https://digdevbox.com/?q={search_term_string}`。每工具的 SoftwareApplication / BreadcrumbList / FAQPage、sitemap、robots 沿用构建期 `scripts/build-seo.mjs`，没有改那条管线的契约。
- 测试：`home-search`、`tool-draft`、`json-tree` 三个单元测试。

## 原先做过、这次接上的部分

- 工具页说明、示例、FAQ、工作流、相关工具、预渲染和 sitemap 已经在仓库里，并且和客户端读同一份 guides。这次没有推倒重写。
- 收藏、最近使用、命令面板、深浅色、PWA 已存在。这次改的是位置、壳层和草稿。
- JSON 格式化已经用 `useStorage` 记住原文。树形视图和下载是补上的输出能力。

## 没有做完 / 需要站长决定

- **广告位 id**：没有填写真实 AdSense ad unit。配 `VITE_ADSENSE_SLOT` 后 `SponsorSlot` 才会渲染 `<ins class="adsbygoogle">`。不要在没拿到 id 之前放占位框。
- **每工具独立 OG 图**：现在全站共用 `https://digdevbox.com/og-image.jpg`（代码常量 `?v=2`，`index.html` 开发模板是 `?v=3`）。要做「一工具一图」需要设计稿或边缘函数，这次没有生成 120 张图。
- **域名与密钥**：canonical 固定 `https://digdevbox.com`。Plausible 仍由 `VITE_TRACKER_ENABLED` / `VITE_PLAUSIBLE_DOMAIN` / `VITE_PLAUSIBLE_API_HOST` 控制，仓库里没有填密钥。
- **工具质量淘汰**：没有下线工具。构建期已有示例覆盖和文案门禁；肉眼不可用的工具需要站长指定名单后再删，避免 sitemap 和内链一起断。
- **多语言 URL**：界面可切中文，但可抓取的 HTML 仍是英文（`URL_LOCALIZED = false`）。中文独立 URL 会改变 hreflang 策略，这次没开。
- **Lighthouse**：本环境没有对线上或完整生产包跑 Lighthouse 分数。PWA、预渲染和令牌色对比是原有基础；1100px 工作区和吸顶顶栏需要在真实域名上再测一次。
