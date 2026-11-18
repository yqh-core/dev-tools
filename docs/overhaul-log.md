# 主站改造记录（2026-11-18）

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
