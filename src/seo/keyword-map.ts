/**
 * Keyword Map V1 —— 关键词定位的**机器可读单一事实源**。
 *
 * ============================ 口径声明（先读这段） ============================
 *
 * 本表**不含任何搜索量数字**，且这不是遗漏，是数据本身不存在：
 *
 *   - **搜索量（Volume）：全部 N/A。** 产出这张表时没有 Keyword Planner / Ads 账号
 *     权限。表里没有任何一个流量数字，排序依据是**竞争形态、页面契合度、意图强度**
 *     的定性观察。任何下游（页面文案、内链、SOP）都不得把 `priority` 读成流量预测。
 *   - **PAA / AI Overview：27 次真实 SERP 检索（A 组 13 + B 组 14）均未返回这两个
 *     区块。** 原始文档里引用的 FAQ 素材来源是**排名页面自带的 on-page FAQ 原文**
 *     （已逐条标注来源站），**不是** Google PAA。两者不等价，不能对外声称
 *     「来自 Google PAA」。
 *   - **竞争评级是定性判断**（low/medium/high/very-high），依据是 top5 的域名构成
 *     （老品牌域名 vs 新建站 vs 大工具箱 vs 权威文档站），⛔ 不是任何工具的分数。
 *   - **本地化偏差**：检索结果受地域/语言影响（实测出现过 `base64decode.org/ja/`、
 *     `ohtoolbox.com/ko/`、`toolsonline.run/zh/`）。「无强品牌占位」这个结论
 *     带着这个不确定性。
 *
 * 原始研究文档（30 KB，含 10 个簇的分簇证据、top5 域名、FAQ 素材、长尾变体）
 * 在 `D:\work\_ops\digdevbox-keyword-map-v1.md`，**在本仓库之外、不受版本控制**。
 * 本文件只迁移其中「机器可用的结构化数据」（§1 总表），⛔ 不复制整份文档。
 * ⛔ 不编造搜索量数字。⛔ 不编造用户评价 / 星级 / 使用人数。
 *
 * ============================ 为什么值得单独入库 ============================
 *
 * 这张表持续保护所有已落地 title（见 `landed: true` 的条目），但因为它 living
 * 在仓库外且**没有任何机器校验**，任何人把 `locales/en.yml` 的 title 改回旧值都
 * 不会有任何报错 —— 一次「顺手清理」就能悄悄丢掉 7 条已经验证过的定位。
 * `auditKeywordMap()` 就是那道锁：抛错式（throw-on-drift），构建期拦住。
 */
import type { KeywordMapEntry } from './keyword-map.types';
import {
  KEYWORD_COMPETITIONS,
  KEYWORD_INTENTS,
  KEYWORD_PRIORITIES,
} from './keyword-map.types';
import { toolsWithCategory } from '@/tools';

/**
 * forge-notes 里**真实存在**的英文文章 slug 白名单。
 *
 * ⛔ 为什么必须是白名单而不是「相信人写对了」：`D:\work\forge-notes` 在本仓库之外，
 * 没有版本控制、没有 CI。一个拼错的 slug 在本仓库里查不出来，只会在生产站点上
 * 变成一条 404 外链（首页 Blog 卡片 + 工具页 related guides 都会链过去）。
 * 这份白名单只收录已核验 frontmatter、明确标记 `lang: en` 的文章；新增文章必须先
 * 在真实 forge-notes 仓库核对 slug、title、description 和语言，再加入本表。
 *
 * ⛔ 未进入本白名单的文章（尤其是中文内容）不得进入英文主站的 Blog 区块与 related guides。
 */
export const KNOWN_NOTE_SLUGS = [
  'devops-tools-guide',
  'json-formatting-guide',
  'jwt-decoder-guide',
  'regex-testing-guide',
  'uuid-vs-ulid-guide',
  'base64-encoding-guide',
  'unix-timestamp-guide',
  'url-encoding-guide',
  'what-is-a-numeronym',
  'yaml-vs-json-guide',
  'http-status-codes-guide',
] as const;

/** forge-notes 文章的站点根（`notes.digdevbox.com` 是 DigDevBox 站群的一员）。 */
export const NOTES_ORIGIN = 'https://notes.digdevbox.com';

/**
 * Keyword Map §1 总表：11 个原始关键词簇 / 24 行；截至 2026-11-23，PR #65 分支已扩展到 115 条主关键词记录，另有 5 条 aliases，共覆盖 120 条唯一工具路由；新增候选不代表已验证搜索量或流量。
 *
 * 行序与原文档一致（⛔ 不要按 path 重排 —— 序号本身就是「先做哪一批」的阅读顺序）。
 * 字段口径见 `KeywordMapEntry`。
 */
export const CLUSTER_KEYWORD_ENTRIES: KeywordMapEntry[] = [
  {
    path: '/jwt-parser',
    keyword: 'jwt decoder',
    keywords: ['jwt parser online', 'jwt debugger', 'alg: none', 'JWKS/JWK'],
    intent: 'debug',
    priority: 'P0',
    competition: 'low',
    article: 'jwt-decoder-guide',
    landed: true,
    lockedTitle: 'JWT Decoder & Parser — Inspect Header, Payload and Expiration',
    note: '簇 1。关键事实：jwt.io 两次查询均未进 top5；`decoder` 与 `parser` 是两套零重叠的排名域名，两个词都能拿。',
  },
  {
    path: '/json-prettify',
    keyword: 'json formatter',
    keywords: ['json validator online', 'json pretty print online', 'json beautifier', 'JSONL formatter'],
    intent: 'format',
    priority: 'P0',
    competition: 'high',
    article: 'json-formatting-guide',
    landed: true,
    lockedTitle: 'JSON Formatter & Validator — Beautify, Validate, Diff and Convert',
    note: '簇 2 承重墙。关键事实：`prettify` 一词在本次所有 top5 title 里一次都没出现，主流词汇是 formatter / validator / beautify。',
  },
  {
    path: '/api-debugger',
    keyword: 'api debug online',
    keywords: ['curl import online', 'rest client browser', 'api response viewer', 'send http request online'],
    intent: 'debug',
    priority: 'P1',
    competition: 'medium',
    article: 'json-formatting-guide',
    landed: false,
    note: 'WP-003 阶段 B。cURL→发送→响应→WS-2 闭环；中继复用 webstatus SSRF 校验链；部署与隐私文案须单独授权。guide 形状待收口（steps=1），S1\' 冻结期内不进 sitemap。落地时再补 lockedTitle。',
  },
  {
    path: '/json-workspace',
    keyword: 'json workspace',
    keywords: ['json path query online', 'json tree viewer', 'json schema generator', 'json to yaml'],
    intent: 'format',
    priority: 'P1',
    competition: 'medium',
    article: 'json-formatting-guide',
    landed: true,
    lockedTitle: 'JSON Developer Workspace — Format, Query, Tree, Schema & Convert',
    note: '簇 2 扩展。把格式化/树形/JSONPath 查询/schema 推断/转换组合成单一工作台，对标 JSON Crack 的结构理解与数据工作流定位，而非再做一个孤立 formatter。',
  },
  {
    path: '/password-generator',
    keyword: 'password generator',
    keywords: ['strong password generator', 'random password generator', 'secure password generator', 'password generator with symbols'],
    intent: 'generate',
    priority: 'P0',
    competition: 'very-high',
    landed: true,
    // 2026-10-13 新建工具（P3 词表头号目标，OTH/NF 双对手验证缺口）。
    // title 锁定 locales/en.yml 现值，改 title 须三处同步（en.yml / 本表 / zh.yml）。
    lockedTitle: 'Password Generator',
    note: '与 /token-generator 的分工：本页是 crypto.getRandomValues 密码学安全源（可作真实密码），token 页是普通随机源（占位符/邀请码）。OTH 与 NF 均有此工具，属双对手确认缺口。',
  },
  {
    path: '/uuid-generator',
    keyword: 'uuid generator',
    keywords: ['uuid v4', 'uuid v7', 'bulk uuid generator', 'uuid validator / decoder'],
    intent: 'generate',
    priority: 'P0',
    competition: 'high',
    article: 'uuid-vs-ulid-guide',
    landed: true,
    // ⛔ 与原文档「建议 Title」列有意不同：落地时去掉了 `& v7`
    //   （本站该页只产 v4，title 承诺 v7 会与页面能力不符）。锁定线上现值。
    lockedTitle: 'UUID Generator — v4, v1, v3, v5 and NIL IDs',
    note: '簇 3。UUID 侧是单工具强品牌最集中的一簇（uuid.tools / uuidgenerator.co 等域名即关键词）。',
  },
  {
    path: '/nanoid-generator',
    keyword: 'nanoid generator online',
    keywords: ['nanoid id generator', 'short unique id generator', 'url safe id generator', 'nanoid length'],
    intent: 'generate',
    priority: 'P1',
    competition: 'low',
    landed: true,
    lockedTitle: 'Nano ID Generator — Short, URL-safe Unique IDs Online',
    note: '与 uuid / ulid 同簇承接 ID 族长尾；nanoid 词下专用站少，属可进入空档。',
  },
  {
    path: '/color-contrast-checker',
    keyword: 'color contrast checker',
    keywords: ['wcag contrast checker', 'contrast ratio checker', 'aa contrast', 'text contrast checker'],
    intent: 'compute',
    priority: 'P1',
    competition: 'high',
    landed: true,
    lockedTitle: 'Color Contrast Checker — Pass or Fail WCAG AA and AAA',
    note: '无障碍评审刚需，与本轮 Contact 的无障碍反馈类型同源；竞品强但查询量大。',
  },
  {
    path: '/ulid-generator',
    keyword: 'ulid generator online',
    keywords: ['ulid decoder', 'sortable id generator', 'ulid to uuid converter'],
    intent: 'generate',
    priority: 'P0',
    competition: 'low',
    article: 'uuid-vs-ulid-guide',
    landed: true,
    lockedTitle: 'ULID Generator — Time-Ordered, Sortable IDs Online',
    note: '簇 3。本轮观察中**最清晰的品牌空档**：ULID 词下 top5 无一个 ULID 专用域名。',
  },
  {
    path: '/date-converter',
    keyword: 'date converter',
    keywords: ['date format converter', 'iso to date', 'utc converter', 'excel date', 'mongo objectid to date'],
    intent: 'convert',
    priority: 'P0',
    competition: 'medium',
    article: 'unix-timestamp-guide',
    landed: true,
    lockedTitle: 'Date Converter — Formats, Time Zones and ISO 8601',
    note: '簇 4。本轮已裁定拆分：本页只接管 broad「date format converter」意图（ISO 8601 / RFC 3339 / UTC / locale / Excel / Mongo ObjectID / epoch 全部互转），「unix timestamp converter」意图已迁出到 /unix-timestamp-converter。',
  },
  {
    path: '/unix-timestamp-converter',
    keyword: 'unix timestamp converter',
    keywords: ['epoch converter', 'unix time', 'POSIX time', 'Y2038', 'timestamp to date', 'epoch to date'],
    intent: 'convert',
    priority: 'P0',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Unix Timestamp Converter — Epoch to Date, Seconds vs Milliseconds',
    note: '簇 4。从 /date-converter 拆出的 epoch-centric 页：接管「unix timestamp converter」意图（秒 / 毫秒 epoch ↔ 日期），复用共享 datetime 逻辑。',
  },
  {
    path: '/numeronym-generator',
    keyword: 'numeronym',
    keywords: ['numeronym generator', 'numeronym meaning', 'i18n meaning', 'a11y meaning', 'k8s meaning'],
    intent: 'generate',
    priority: 'P0',
    competition: 'medium',
    article: 'what-is-a-numeronym',
    landed: true,
    lockedTitle: 'Numeronym Generator — i18n, a11y & k8s',
    note: 'GSC observed 9 impressions at average position 6.56 plus 1 impression for numeronym generator at position 5. The tool also looks up a fixed dictionary of established forms; it does not invent meanings for arbitrary abbreviations.',
  },
  {
    path: '/eta-calculator',
    keyword: 'eta calculator',
    keywords: ['task completion time calculator', 'processing time calculator', 'batch processing time calculator', 'download time estimator', 'build time estimator'],
    intent: 'compute',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'ETA Calculator — Task Completion Time',
    note: 'The calculator estimates duration and finish time from total units, a processing rate and a start time. Do not target travel ETA or full software-project scheduling; those exceed the current feature.',
  },
  {
    path: '/text-statistics',
    keyword: 'text statistics',
    keywords: ['word counter', 'character counter', 'word count online', 'character count online', 'text byte counter', 'line counter'],
    intent: 'compute',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Word & Character Counter — Text Statistics & Byte Size',
    note: 'The page measures characters, words, lines and UTF-8 byte size. Title is aligned to the actual live feature; validate rendered snippet and CTR after deployment.',
  },
  {
    path: '/regex-tester',
    keyword: 'regular expression tester',
    keywords: ['regex tester online', 'regex expression tester', 'online regex tester javascript', 'JavaScript regex flavor', 'ReDoS', 'greedy vs lazy quantifiers', 'Explain this regex'],
    intent: 'debug',
    priority: 'P0',
    competition: 'low',
    article: 'regex-testing-guide',
    landed: true,
    lockedTitle: 'Regular Expression Tester — JavaScript Regex',
    note: '簇 5。关键事实：regex101.com 与 regexr.com 三次查询均未进 top5。',
  },
  {
    path: '/regex-memo',
    keyword: 'regex cheat sheet',
    keywords: ['regex flags', 'lookahead / lookbehind', 'named capture group', 'backreference'],
    intent: 'lookup',
    priority: 'P0',
    competition: 'low',
    article: 'regex-testing-guide',
    landed: true,
    lockedTitle: 'Regex Cheat Sheet — Complete Regular Expression Reference',
    note: '簇 5。tester 与 cheat sheet 是两套零重叠的排名域名 ⇒ 两个入口可分别拿。',
  },
  {
    path: '/docker-run-to-docker-compose-converter',
    keyword: 'docker run to docker compose converter',
    keywords: ['decomposerize', 'composeverter', 'best practices score'],
    intent: 'convert',
    priority: 'P1',
    competition: 'low',
    article: 'devops-tools-guide',
    landed: true,
    lockedTitle: 'Docker Run to Compose Converter — Generate a compose Service from a Command',
    note: '簇 6。差异空间最大：第 1 名是开源项目的 Docker Hub 镜像页，不是任何品牌站。',
  },
  {
    path: '/chmod-calculator',
    keyword: 'chmod calculator 755',
    keywords: ['chmod 644 / 600 / 777 / 4755', 'setuid setgid sticky bit', 'chmod -R'],
    intent: 'compute',
    priority: 'P1',
    competition: 'low',
    article: 'devops-tools-guide',
    landed: true,
    lockedTitle: 'Chmod Calculator — Unix File Permissions (755, 644, 777)',
    note: '簇 6。竞品几乎不做词汇差异化（title 全是裸功能名），setuid/setgid/sticky 是空档。',
  },
  {
    path: '/prepare-deployment',
    keyword: 'deployment readiness checklist',
    keywords: ['pre-deployment checks', 'dockerfile ci lockfile audit', 'release gate ready blocked'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'low',
    article: 'devops-tools-guide',
    landed: true,
    lockedTitle: 'Prepare Deployment — Pre-Deploy Readiness Gate for Docker, CI & Lockfiles',
    note: '簇 6（devops）。对标 Vercel/Netlify 发布前检查；差异化在浏览器本地四态闸门+证据报告，竞品多为托管平台内置不独立。',
  },
  {
    path: '/crontab-generator',
    keyword: 'crontab generator',
    keywords: ['crontab generator every 5 minutes', '@reboot crontab', 'cron syntax github actions'],
    intent: 'generate',
    priority: 'P1',
    competition: 'low',
    article: 'devops-tools-guide',
    landed: true,
    lockedTitle: 'Crontab Generator — Cron Expressions with Plain-English Preview',
    note: '簇 6。⛔ 两个 intent 混杂（crontab generator 含命令+系统字段 vs 纯 5 字段表达式），页面需先做意图分流。',
  },
  {
    path: '/yaml-prettify',
    keyword: 'yaml formatter online',
    keywords: ['yaml validator', 'yaml to json', 'yaml lint online', 'fix yaml indentation'],
    intent: 'format',
    priority: 'P1',
    competition: 'low',
    landed: true,
    lockedTitle: 'YAML Formatter & Validator — Format YAML Online',
    note: '簇 9。SQL/YAML/XML 三页里最容易打的：头部供给质量明显偏低。',
  },
  {
    path: '/base64-string-converter',
    keyword: 'base64 decode',
    keywords: ['base64 encoder online', 'base64url / URL-safe Base64', 'RFC 4648', 'atob() / btoa()'],
    intent: 'encode',
    priority: 'P1',
    competition: 'high',
    article: 'base64-encoding-guide',
    landed: true,
    lockedTitle: 'Base64 Encoder & Decoder — Padding, URL-Safe, Binary-Safe',
    note: '簇 7。`base64 decode` 的 top5 里 4 条是教程站，其中一篇的立场是「别用在线工具」⇒ 单位成本最高。',
  },
  {
    path: '/base64-file-converter',
    keyword: 'base64 to image decoder online',
    keywords: ['data URI / data:image/png;base64,', 'magic bytes / image signature', 'image to base64'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    article: 'base64-encoding-guide',
    landed: true,
    lockedTitle: 'Base64 to Image — Online Decode, Preview and Download',
    note: '簇 7。`base64 to image` 在 SERP 上是完全独立的域名集群（5/5 全是该类域名）。',
  },
  {
    path: '/hmac-generator',
    keyword: 'hmac generator online',
    keywords: ['webhook signature generator', 'HMAC base64 / base64url output', 'sign API payloads'],
    intent: 'generate',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'HMAC Generator — Sign Messages with SHA-256 Online',
    note: '簇 10。机会明显大于 /hash-text：「签名对不上」是真实高频痛点。',
  },
  {
    path: '/url-encoder',
    keyword: 'url encoder',
    keywords: ['url decoder online', 'percent-encoding', 'double encoding (%2520)', 'encodeURI vs encodeURIComponent'],
    intent: 'encode',
    priority: 'P1',
    competition: 'high',
    article: 'url-encoding-guide',
    landed: true,
    lockedTitle: 'URL Encoder & Decoder — Percent-Encoding, encodeURIComponent Pitfalls',
    note: '簇 8。竞争密度全簇最高（同质化新站互相没有护城河，也没有空档）。',
  },
  {
    path: '/url-parser',
    keyword: 'url parser online',
    keywords: ['parse query parameters from a URL', 'inspect UTM parameters', 'OAuth redirect URI'],
    intent: 'parse',
    priority: 'P1',
    competition: 'high',
    article: 'url-encoding-guide',
    landed: false,
    proposedTitle: 'URL Parser — Inspect Query Parameters and UTM Tags',
    note: '簇 8。同 /url-encoder，做基建，不给首页第一屏。',
  },
  {
    path: '/sql-prettify',
    keyword: 'sql formatter online',
    keywords: ['sql beautifier / pretty print / minify', 'sql formatter mysql / postgresql / t-sql'],
    intent: 'format',
    priority: 'P1',
    competition: 'high',
    landed: true,
    lockedTitle: 'SQL Formatter — Format and Beautify SQL Online',
    note: '簇 9。sqlformat.io 一域名双席位；不打折言数量与报错行列号就没有点击理由。',
  },
  {
    path: '/xml-formatter',
    keyword: 'xml formatter online',
    keywords: ['xml beautifier / pretty print / minifier', 'xml validator well-formed', 'xml to json / xsd'],
    intent: 'format',
    priority: 'P2',
    competition: 'medium',
    landed: true,
    lockedTitle: 'XML Formatter — Beautify, Validate and Minify XML',
    note: '簇 9。内置「well-formed vs valid(XSD)」的区分说明。',
  },
  {
    path: '/hash-text',
    keyword: 'sha256 hash generator online',
    keywords: ['file checksum sha256 / verify', 'hash comparison tool', 'file integrity checker'],
    intent: 'compute',
    priority: 'P2',
    competition: 'high',
    landed: true,
    lockedTitle: 'Hash Generator — MD5, SHA-1, SHA-256 Online',
    note: '簇 10。已完全同质化（hashgenerator.co / freehashgenerator.com 域名即关键词），价值在工具集完整性而非获客。⛔ 路由是 /hash-text，站上没有 /hash-generator。',
  },
  {
    path: '/http-headers',
    keyword: 'http headers checker online',
    keywords: ['OWASP secure headers', 'curl -I analyzer', 'HSTS / CSP score'],
    intent: 'inspect',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    proposedTitle: 'HTTP Header Analyzer — Paste Headers, Get a Security Score',
    note: '簇 10。需改形态：走「用户粘贴 curl -I 输出 → 纯前端解析 + OWASP 打分」，成本与风险都为零（对比 server-side fetch 路线）。',
  },
  {
    path: '/linux-commands',
    keyword: 'linux commands cheat sheet',
    keywords: ['chmod cheatsheet', 'cron cheatsheet', 'systemd cheatsheet'],
    intent: 'reference',
    priority: 'P2',
    competition: 'high',
    landed: false,
    // ⛔ 线上现值是 `Linux commands cheat sheet`（小写 c），与本建议的大小写不一致。
    //   本轮 P2 枢纽页的定位是「不改 title」，所以这里记的是**已知差异**而不是待执行项：
    //   真要改的话把 lockedTitle 填成 'Linux Commands Cheat Sheet' 并把 landed 翻成 true，
    //   门禁会立刻接管这条 title。
    proposedTitle: 'Linux Commands Cheat Sheet',
    note: '簇 6 分发中心。top5 全是文档/教程站，5/5 title 一字不差都是这个 ⇒ 需求是「读」不是「算」，工具形态不构成优势。不指望流量，做内链枢纽。',
  },
  {
    path: '/http-status-codes',
    keyword: 'http status codes',
    keywords: ['HTTP 404 meaning', 'HTTP 429 rate limit', 'IANA status code registry'],
    intent: 'lookup',
    priority: 'P3',
    competition: 'very-high',
    landed: false,
    note: '⛔ 不建议投入。top5 = IANA（第 1、3）+ httpstatuses.io + MDN + W3C，零个工具站进前五 —— Google 判定该 query 的答案是规范注册表。不给首页入口，保留为内链枢纽。原文档的建议 Title 为空（不打算改）。',
  },
  {
    path: '/http-status-checker',
    keyword: 'http status checker website down',
    keywords: ['is it down or just me', 'is my website down for everyone'],
    intent: 'inspect',
    priority: 'P3',
    competition: 'very-high',
    landed: false,
    note: '⛔ 重新定位或砍。top5 无一个 title 写 "HTTP Status Checker"，真实心智词是 "Is It Down?"；且满足该意图必须服务端发起外部请求（成本 + 滥用 + SSRF 防护义务）。原文档的建议 Title 为空。',
  },
  {
    path: '/json-diff',
    alsoPaths: [
      '/json-minify',
      '/json-to-csv',
      '/json-to-yaml-converter',
      '/json-to-xml',
      '/json-to-code',
    ],
    // ⛔ 这一行**没有独立检索词**：原文档的 keyword 列写的是「JSON 簇矩阵承接」，
    //   6 个兄弟页与承重墙 /json-prettify 的意图重叠，不另做定位。
    //   所以这里记的是「承接说明」而不是搜索词，⛔ 不要把它当关键词下游使用。
    keyword: '（无独立检索词 · JSON 簇矩阵承接）',
    keywords: ['json diff', 'json minify', 'json to csv', 'json to yaml converter', 'json to xml'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    article: 'json-formatting-guide',
    landed: false,
    note: '簇 2 矩阵。与 #2 联动一起做：排名页普遍在做 formatter ↔ validator ↔ minifier ↔ diff ↔ repair 的互链闭环，这是可直接复制的模板。竞争度随 /json-prettify。',
  },
  // 2026-11-20 additions: keyword targets selected from authenticated GSC/Bing data.
  // Evidence snapshots and query caveats: docs/seo/gsc-live-snapshot-2026-11-20.md and docs/seo/bing-serp-research-2026-11-20.md.
  // Keep title locks synchronized with locales/en.yml and the generated README.
  // These are existing live titles, locked unchanged; this adds governance/coverage, not metadata rewrites.
  {
    path: '/basic-auth-generator',
    keyword: 'basic auth generator',
    keywords: ['basic authorization generator', 'basic auth header generator', 'web basic auth generator', 'generate basic auth', 'HTTP Basic Authorization header'],
    intent: 'generate',
    priority: 'P0',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Basic Auth Generator — Build an HTTP Authorization Header',
    note: 'Bing Webmaster 28d: page 33 impressions, avg position 6.24; exact query 17 impressions, avg position 5.41; zero clicks. This PR tests a task-first title and clarifies Base64 is not encryption; it is not live until merge/deploy. Validate header/curl examples against the tool before adding copy.',
  },
  {
    path: '/safelink-decoder',
    keyword: 'outlook safelink decoder',
    keywords: ['safelink decoder', 'decode outlook safelink', 'how to open the outlook safelink original url', 'convert outlook safelinke to url', 'original URL from Outlook Safe Links'],
    intent: 'inspect',
    priority: 'P0',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Outlook Safe Links Decoder — Reveal the Original URL',
    note: 'Bing Webmaster 28d: page 23 impressions, avg position 7.00; visible Outlook Safe Links queries around positions 3–10; zero clicks. This PR tests plural “Safe Links” plus “Reveal the Original URL”; not live until merge/deploy. Safety copy distinguishes revealing a destination from verifying it is safe or bypassing Microsoft click-time protection.',
  },
  {
    path: '/percentage-calculator',
    keyword: 'percentage calculator',
    keywords: ['percent calculator', 'calculate percentage', 'percent of a number calculator', 'percentage change calculator', 'percent increase calculator', 'percent decrease calculator', 'what percent of calculator', 'percentage difference calculator', 'discount calculator', 'percent off calculator', 'sales tax calculator', 'reverse percentage calculator', 'percentage points calculator'],
    intent: 'compute',
    priority: 'P0',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Percentage Calculator — Percent of a Number, Change & Discount',
    note: 'GSC 90d: canonical 150 impressions plus slashless variant 74, zero clicks; average positions 9.1667 and 8.2568. One canonical intent/URL only. Query details are substantially anonymized and US page slice did not show this URL. This candidate updates the English snippet to describe the four actual calculator modes and the discount/tax use cases already explained in the page FAQs; do not claim CTR improvement until GSC confirms it.',
  },

  // 2026-11-22 additions: extend existing developer-task clusters using the current tool registry.
  // Candidate phrases only; no volume/KD or verified SERP competition data is available.
  {
    path: '/ipv4-subnet-calculator',
    keyword: 'IPv4 subnet calculator',
    keywords: ['CIDR calculator', 'subnet mask calculator', 'network address calculator', 'usable IP address calculator', 'wildcard mask calculator'],
    intent: 'compute',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'IPv4 Subnet Calculator — CIDR, Netmask & Usable Hosts',
    note: 'Title and description landed against the actual calculator outputs: CIDR, usable hosts, network/broadcast addresses, netmask and wildcard. Competition remains provisional; no volume/KD claims.',
  },
  {
    path: '/ipv4-range-expander',
    keyword: 'IP range to CIDR',
    keywords: ['IPv4 range to CIDR', 'convert IP range to CIDR', 'start and end IP calculator', 'IP range calculator'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Candidate mapping for the tool that converts a start/end IPv4 range into a valid subnet and CIDR notation. Competition is provisional; no volume/KD claims.',
  },
  {
    path: '/text-diff',
    keyword: 'text diff checker',
    keywords: ['compare two texts online', 'text comparison tool', 'find text differences', 'diff checker online'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Text Diff Checker — Compare Two Texts Side by Side',
    note: 'Title and description now describe the existing side-by-side diff editor without claiming unsupported export or syntax-aware features. Competition remains provisional; no volume/KD claims.',
  },
  {
    path: '/text-replacer',
    keyword: 'find and replace text online',
    keywords: ['batch text replacer', 'regex find and replace', 'case insensitive text replacement', 'replace text in multiple lines'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: true,
    lockedTitle: 'Find and Replace Text — Plain Text & Regex Replacer',
    note: 'Title and description match plain-text or regex find/replace, optional case-insensitive matching, deletion via empty replacement and match/output counts. Competition remains provisional; no volume/KD claims.',
  },
  {
    path: '/htpasswd-generator',
    keyword: 'htpasswd generator',
    keywords: ['Apache htpasswd generator', 'Nginx htpasswd generator', 'bcrypt htpasswd generator', 'verify htpasswd entry'],
    intent: 'generate',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'htpasswd Generator & Checker — bcrypt, apr1 and SHA1',
    note: 'Title and description match Apache/Nginx user:hash generation and verification. Supported formats include bcrypt, apr1, SHA1 and plain text; plain text is explicitly not for production. Competition remains provisional; no volume/KD claims.',
  },

  {
    path: '/csv-to-json',
    keyword: 'CSV to JSON converter',
    keywords: ['convert CSV to JSON online', 'CSV parser to JSON', 'CSV file to JSON', 'comma separated values to JSON'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: true,
    lockedTitle: 'CSV to JSON Converter — Preview Rows & Convert Online',
    note: 'Title and description landed against paste-CSV conversion, optional first-row headers, row/column counts, preview, copy/download and parse warnings. Competition remains provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/pdf-merge',
    keyword: 'merge PDF files online',
    keywords: ['combine PDF files', 'join multiple PDFs', 'PDF merger', 'merge PDF documents'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Candidate mapping matches the browser-side workflow requiring at least two PDFs and downloading one merged PDF. Competition is provisional; no volume/KD claim.',
  },
  {
    path: '/ipv6-ula-generator',
    keyword: 'IPv6 ULA generator',
    keywords: ['generate IPv6 unique local address', 'RFC 4193 ULA generator', 'IPv6 private address generator', 'IPv6 /48 prefix generator'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Candidate mapping matches generation of an RFC 4193-style fd00::/48 ULA and first/last /64 blocks from a validated MAC address. Competition is provisional; validate implementation against the RFC before strengthening copy.',
  },
  {
    path: '/user-agent-parser',
    keyword: 'user agent parser',
    keywords: ['parse user agent string online', 'browser user agent checker', 'OS and device from user agent', 'UA string parser'],
    intent: 'parse',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Candidate mapping matches parsing browser, engine, OS, CPU and device details from a supplied user-agent string. Competition is provisional; no volume/KD claim.',
  },
  {
    path: '/phone-parser-and-formatter',
    keyword: 'international phone number parser',
    keywords: ['phone number formatter', 'phone number validator', 'E.164 phone number format', 'parse international phone number'],
    intent: 'parse',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Candidate mapping matches international phone number parsing, validation and national/international formatting. Confirm supported region/extension behavior before claiming universal validation. Competition is provisional.',
  },

  {
    path: '/xml-to-json',
    keyword: 'XML to JSON converter',
    keywords: ['convert XML to JSON online', 'XML parser to JSON', 'XML file to JSON', 'XML to JSON formatter'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches validated XML input, compact XML-to-JavaScript conversion and downloadable JSON output. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/markdown-to-html',
    keyword: 'Markdown to HTML converter',
    keywords: ['convert Markdown to HTML online', 'Markdown HTML preview', 'Markdown to HTML code', 'print Markdown as PDF'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches live Markdown rendering to HTML with copyable output and browser print. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/yaml-to-json-converter',
    keyword: 'YAML to JSON converter',
    keywords: ['convert YAML to JSON online', 'YAML parser to JSON', 'YAML file to JSON', 'YAML to JSON formatter'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches YAML parsing with validation and formatted JSON output. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/slugify-string',
    keyword: 'URL slug generator',
    keywords: ['slugify text online', 'convert text to URL slug', 'SEO slug generator', 'URL friendly string converter'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Matches string-to-slug generation with a 100,000-character input guard. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/case-converter',
    keyword: 'text case converter',
    keywords: ['camel case converter', 'snake case converter', 'pascal case converter', 'uppercase lowercase converter', 'kebab case converter'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches lower/upper, camel, capital, constant, dot, header, param, pascal, path, sentence and snake case outputs. Competition is provisional; no volume/KD/SERP claim.',
  },

  {
    path: '/pdf-split',
    keyword: 'split PDF pages online',
    keywords: ['split PDF into separate pages', 'extract pages from PDF', 'split PDF by page range', 'separate PDF pages'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches splitting each page or a selected page range into separate downloadable PDFs. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/pdf-watermark',
    keyword: 'add watermark to PDF',
    keywords: ['PDF watermark online', 'add text stamp to PDF', 'confidential PDF watermark', 'tile watermark on PDF pages'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches text watermark with font size, opacity, angle and tiled mode. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/pdf-compress',
    keyword: 'compress PDF online',
    keywords: ['reduce PDF file size', 'shrink PDF size', 'PDF size optimizer', 'make PDF smaller'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches browser-side compression with balanced level, size comparison and an 80 MiB input cap; do not promise a guaranteed reduction. Competition is provisional.',
  },
  {
    path: '/image-resize',
    keyword: 'resize image online',
    keywords: ['change image dimensions', 'resize PNG JPG WebP', 'image resizer pixels', 'resize photo by width and height', 'lock image aspect ratio'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches custom width/height, aspect-ratio lock, output format and quality controls. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/image-compress',
    keyword: 'compress image online',
    keywords: ['reduce image file size', 'compress JPEG online', 'compress WebP image', 'image optimizer quality', 'compress image to target KB'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches JPEG/WebP quality control and optional target-KB compression. Competition is provisional; no volume/KD/SERP claim.',
  },
  {
    path: '/image-crop',
    keyword: 'crop image online',
    keywords: ['crop photo to square', 'crop image to 16:9', 'crop PNG JPG WebP', 'free aspect ratio image cropper'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches free, 1:1, 4:3, 3:2, 16:9 and original aspect-ratio crop options with selectable output formats. Competition is provisional.',
  },
  {
    path: '/favicon-generator',
    keyword: 'favicon generator',
    keywords: ['create favicon from PNG', 'generate favicon ICO online', 'website icon generator', 'Apple touch icon generator', 'PWA icon generator'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches multi-size ICO (16/32/48) and PNG (180/512) exports with transparent or white background. Competition is provisional.',
  },
  {
    path: '/image-to-pdf',
    keyword: 'convert images to PDF',
    keywords: ['JPG to PDF converter', 'PNG to PDF online', 'combine photos into one PDF', 'images to PDF converter', 'scan receipts to PDF'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Matches multi-image PDF creation, image inspection, conversion of non-JPEG/PNG formats and margin control. Competition is provisional.',
  },
  // 2026-11-22: GSC-visible routes with small but direct page/query evidence.
  // These remain candidate mappings; no volume/KD/SERP competition score is claimed.
  {
    path: '/morse-code-converter',
    keyword: 'morse code translator',
    keywords: ['morse code converter', 'morse code generator', 'morse conversion', 'text to morse code', 'morse code to text'],
    intent: 'convert',
    priority: 'P2',
    competition: 'high',
    landed: true,
    lockedTitle: 'Morse Code Translator — Encode Text & Decode Morse',
    note: 'GSC last 90 days: 4 page impressions, avg position 43.5; visible queries include "morse code generator" and "morse conversion" (one impression each). SERP spot-check shows focused tools target "Morse Code Translator"; DigDevBox supports text encode/decode for A–Z, digits and listed punctuation, not audio or image decoding. No volume/KD claim.',
  },
  {
    path: '/camera-recorder',
    keyword: 'webcam recorder',
    keywords: ['online webcam recorder', 'webcam video recorder', 'record webcam video online', 'webcam photo capture', 'camera recorder'],
    intent: 'generate',
    priority: 'P2',
    competition: 'high',
    landed: true,
    lockedTitle: 'Webcam Recorder — Record Video & Take Photos Online',
    note: 'GSC last 90 days: 6 page impressions, avg position 44.67; visible variants include "cam recorder", "camera record" and "camera recorder"; do not target competitor-branded "camkeeper". SERP spot-check confirms exact "Webcam Recorder" intent and strong dedicated competitors. DigDevBox supports camera/microphone selection, video recording, pause/resume, still-photo capture and local download; do not claim MP4, trimming or 4K. No volume/KD claim.',
  },
  {
    path: '/lorem-ipsum-generator',
    keyword: 'lorem ipsum generator',
    keywords: ['lipsum generator', 'placeholder text generator', 'dummy text generator', 'lorem ipsum paragraphs'],
    intent: 'generate',
    priority: 'P2',
    competition: 'high',
    landed: false,
    proposedTitle: 'Lorem Ipsum Generator — Placeholder Text for Layouts',
    note: 'GSC last 90 days: 1 visible impression for "lipsum generator" at position 7; page total 1 impression. Candidate phrase cluster is feature-aligned; no volume/KD/competition verification.',
  },
  {
    path: '/rmb-uppercase',
    keyword: 'Chinese RMB uppercase converter',
    keywords: ['RMB amount in Chinese uppercase', 'Chinese yuan uppercase converter', 'Chinese financial numerals', 'convert RMB amount to Chinese words'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    proposedTitle: 'Chinese RMB Uppercase Converter — Financial Amounts in Words',
    note: 'GSC last 90 days: 10 page impressions, avg position 7.1, zero clicks; query rows are anonymized and do not expose the exact search term. Tool converts numeric CNY amounts into Chinese financial uppercase with yuan/jiao/fen and optional RMB prefix. Niche English-language intent candidate; validate query language before changing title. No volume/KD/competition verification.',
  },

  // 2026-11-23: source-audited expansion batch 11. These are candidate intents,
  // not measured-volume or SERP-validated opportunities; no title metadata changed.
  {
    path: '/email-normalizer',
    keyword: 'email normalizer',
    keywords: ['normalize email addresses online', 'email address cleanup', 'bulk email normalization', 'standardize email list'],
    intent: 'parse',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms newline-separated email normalization with per-line parse errors and copyable output. Candidate mapping only; no volume/KD/SERP evidence, and do not imply deliverability verification.',
  },
  {
    path: '/image-color-picker',
    keyword: 'image color picker',
    keywords: ['pick color from image online', 'image color extractor', 'HEX RGB HSL color picker', 'sample pixel color from photo'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms local image loading and canvas pixel sampling with RGB values; verify rendered HEX/HSL output before expanding copy. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/list-converter',
    keyword: 'list converter',
    keywords: ['sort list online', 'remove duplicate lines', 'reverse list order', 'add prefix suffix to each line', 'trim list items'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source model supports trimming, deduplication, sorting, reversing, case conversion, prefixes/suffixes and separators. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/ipv4-address-converter',
    keyword: 'IPv4 address converter',
    keywords: ['IPv4 to decimal converter', 'IP address to binary', 'IPv4 to hexadecimal', 'IPv4 mapped IPv6 converter'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms validated IPv4 conversion to decimal, hexadecimal, binary and IPv4-mapped IPv6 forms. Do not conflate this with subnet/CIDR calculation. Candidate mapping only.',
  },
  {
    path: '/html-wysiwyg-editor',
    keyword: 'HTML WYSIWYG editor',
    keywords: ['online HTML editor', 'visual HTML editor', 'HTML editor with live preview', 'WYSIWYG HTML editor online'],
    intent: 'format',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms a visual HTML editor with formatted HTML output. Candidate mapping only; inspect editor behavior and sanitization boundaries before making security claims. No volume/KD/SERP evidence.',
  },
  {
    path: '/rsa-key-pair-generator',
    keyword: 'RSA key pair generator',
    keywords: ['generate RSA public private key online', 'RSA PEM key generator', 'RSA public key private key pair', 'RSA key size generator'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms RSA key-pair generation and PEM public/private output with configurable bit size. Candidate mapping only; no volume/KD/SERP evidence. Do not claim hardware-backed key storage.',
  },
  {
    path: '/keycode-info',
    keyword: 'JavaScript keycode checker',
    keywords: ['JavaScript key code tester', 'keyboard event key code', 'event.key event.code checker', 'keyboard keycode info'],
    intent: 'inspect',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source listens for keydown and displays key, keyCode, code, location and modifier state. Candidate mapping only; explain legacy keyCode semantics if page copy is expanded.',
  },
  {
    path: '/math-evaluator',
    keyword: 'math expression evaluator',
    keywords: ['evaluate math expressions online', 'mathjs calculator', 'scientific expression evaluator', 'online expression calculator'],
    intent: 'compute',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source evaluates typed expressions with mathjs and distinguishes empty, successful and invalid expressions. Candidate mapping only; do not imply symbolic algebra or graphing.',
  },
  {
    path: '/og-meta-generator',
    keyword: 'Open Graph meta tag generator',
    keywords: ['OG meta tag generator', 'social media meta tags generator', 'Open Graph preview tags', 'website meta title description generator'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Actual registered route is /og-meta-generator (module folder is meta-tag-generator). Tool keywords confirm Open Graph/social title, description and image tag generation. Candidate mapping only.',
  },
  {
    path: '/mime-types',
    keyword: 'MIME type lookup',
    keywords: ['MIME type by file extension', 'file extension to content type', 'MIME type to extension lookup', 'application MIME types list'],
    intent: 'lookup',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source uses the mime-types registry to look up MIME types and extensions with fuzzy search. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/random-port-generator',
    keyword: 'random port generator',
    keywords: ['generate random port number', 'available port number generator', 'TCP UDP port picker', 'random high port generator'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source generates a random port value with refresh/copy controls. Do not claim the port is guaranteed unused on the user machine. Candidate mapping only.',
  },

  {
    path: '/json-to-toml',
    keyword: 'JSON to TOML converter',
    keywords: ['convert JSON to TOML online', 'JSON TOML converter', 'JSON object to TOML', 'JSON to TOML formatter'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms JSON input is parsed and serialized as TOML. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/toml-to-json',
    keyword: 'TOML to JSON converter',
    keywords: ['convert TOML to JSON online', 'TOML JSON converter', 'TOML parser to JSON', 'TOML config to JSON'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms TOML parsing and formatted JSON output with input validation. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/toml-to-yaml',
    keyword: 'TOML to YAML converter',
    keywords: ['convert TOML to YAML online', 'TOML YAML converter', 'TOML config to YAML', 'TOML parser online'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms TOML parsing and YAML serialization. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/yaml-to-toml',
    keyword: 'YAML to TOML converter',
    keywords: ['convert YAML to TOML online', 'YAML TOML converter', 'YAML config to TOML', 'YAML parser to TOML'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms YAML parsing and TOML serialization. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/json-to-get-params',
    keyword: 'JSON to query string converter',
    keywords: ['JSON to URL parameters', 'JSON to GET params', 'query string to JSON', 'URL query string parser', 'nested JSON query parameters'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms bidirectional JSON ↔ GET query-parameter conversion, including nested bracket paths and URL query extraction. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/whois-lookup',
    keyword: 'domain WHOIS lookup',
    keywords: ['domain registration lookup', 'RDAP lookup', 'domain registrar lookup', 'domain expiration lookup'],
    intent: 'lookup',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms domain lookup through the site Pages Function using the RDAP protocol. Candidate mapping only; do not imply a raw WHOIS socket query or complete registry coverage. No volume/KD/SERP evidence.',
  },
  {
    path: '/mac-address-lookup',
    keyword: 'MAC address vendor lookup',
    keywords: ['MAC address lookup', 'MAC vendor lookup', 'MAC OUI lookup', 'MAC address manufacturer lookup'],
    intent: 'lookup',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms local vendor database lookup by the first six normalized hexadecimal characters of a MAC address. Candidate mapping only; unknown vendors may have no match. No volume/KD/SERP evidence.',
  },
  {
    path: '/password-strength-analyser',
    keyword: 'password strength checker',
    keywords: ['password strength test', 'password entropy calculator', 'password crack time estimator', 'brute force password time'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source estimates password length, entropy, score and brute-force crack duration; its own UI excludes dictionary attacks. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/otp-generator',
    keyword: 'TOTP generator online',
    keywords: ['authenticator code generator', 'TOTP code generator', 'time-based one-time password generator', 'TOTP secret QR code'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms secret generation, TOTP codes for previous/current/next time windows and QR rendering. Candidate mapping only; do not claim full OTP validation or account integration. No volume/KD/SERP evidence.',
  },
  {
    path: '/unit-converter',
    keyword: 'unit converter online',
    keywords: ['length unit converter', 'weight unit converter', 'temperature unit converter', 'volume unit converter'],
    intent: 'convert',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source confirms category-based unit conversion with selectable source units and converted result rows. Candidate mapping only; do not claim every physical unit or every measurement system. No volume/KD/SERP evidence.',
  },

  {
    path: '/html-entities',
    keyword: 'HTML entities encoder and decoder',
    keywords: ['HTML entity encoder', 'HTML entity decoder', 'escape HTML characters', 'unescape HTML entities', 'HTML entities reference'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms escape/unescape text controls and a searchable common-entity reference. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/base-converter',
    keyword: 'number base converter',
    keywords: ['binary to decimal converter', 'decimal to hexadecimal converter', 'binary to hex converter', 'base 2 to base 16 converter', 'convert numbers between bases'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms integer conversion between bases 2–64 with binary, octal, decimal, hexadecimal, Base64 and custom output base. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/qrcode-generator',
    keyword: 'QR code generator',
    keywords: ['QR code generator online', 'create QR code from URL', 'text to QR code', 'custom color QR code', 'download QR code PNG'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms QR generation from text or a link, foreground/background colors, error-correction levels and PNG download. Candidate mapping only; no logo, batch or analytics claims. No volume/KD/SERP evidence.',
  },
  {
    path: '/wifi-qrcode-generator',
    keyword: 'WiFi QR code generator',
    keywords: ['WiFi QR code generator', 'create QR code for WiFi password', 'wireless network QR code', 'hidden SSID QR code', 'WPA WiFi QR code'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms WiFi QR creation with SSID, password, hidden-network and enterprise identity fields. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/roman-numeral-converter',
    keyword: 'Roman numeral converter',
    keywords: ['Roman to Arabic converter', 'Arabic to Roman numerals', 'convert Roman numerals online', 'Roman numeral translator'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms bidirectional Roman/Arabic conversion with input validation and a bounded supported numeric range. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/svg-placeholder-generator',
    keyword: 'SVG placeholder generator',
    keywords: ['SVG placeholder image generator', 'custom size SVG placeholder', 'SVG mockup image generator', 'generate SVG placeholder online'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms configurable width, height, text, font size and colors, with SVG/Base64 output and download. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/token-generator',
    keyword: 'random token generator',
    keywords: ['random string generator', 'alphanumeric token generator', 'random password string generator', 'secure token length generator'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms random token output with selectable character groups and length 1–512. Candidate mapping only; inspect RNG implementation before making cryptographic-security claims. No volume/KD/SERP evidence.',
  },
  {
    path: '/ascii-table',
    keyword: 'ASCII table lookup',
    keywords: ['ASCII character table', 'ASCII code lookup', 'decimal to ASCII character', 'hex to ASCII lookup', 'ASCII values chart'],
    intent: 'lookup',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms searchable ASCII character/code entries by character, decimal and hexadecimal representation. Candidate mapping only; no volume/KD/SERP evidence.',
  },


  {
    path: '/ascii-text-drawer',
    keyword: 'ASCII art text generator',
    keywords: ['ASCII text art generator', 'text to ASCII banner', 'FIGlet text generator', 'ASCII banner maker'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms text-to-ASCII-art rendering with selectable FIGlet fonts and output width. Candidate mapping only; font assets load from a CDN, so do not claim offline operation. No volume/KD/SERP evidence.',
  },
  {
    path: '/text-to-unicode',
    keyword: 'text to Unicode converter',
    keywords: ['Unicode to text converter', 'Unicode code point converter', 'text to Unicode escape', 'decimal code points to text'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms bidirectional text/Unicode conversion and text ↔ decimal code-point lists. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/pdf-signature-checker',
    keyword: 'PDF digital signature checker',
    keywords: ['verify PDF signature online', 'check digital signature in PDF', 'PDF certificate signature validator', 'inspect signed PDF'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    note: 'Source confirms local PDF signature inspection and cryptographic integrity/certificate checks for supported detached formats. Unsupported formats, invalid signatures and untrusted/expired certificates are distinguished; do not imply legal certification or universal signature support. No volume/KD/SERP evidence.',
  },
  {
    path: '/mac-address-generator',
    keyword: 'random MAC address generator',
    keywords: ['MAC address generator online', 'generate random MAC addresses', 'MAC address with custom prefix', 'bulk MAC address generator'],
    intent: 'generate',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms generation of 1–100 MAC addresses with optional prefix, case and separator controls. Candidate mapping only; generated addresses are not proof of vendor assignment or device availability. No volume/KD/SERP evidence.',
  },
  {
    path: '/text-to-binary',
    keyword: 'text to binary converter',
    keywords: ['binary to text converter', 'ASCII to binary converter', 'binary code translator', 'convert binary string to text'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms text-to-ASCII-binary and ASCII-binary-to-text conversion with validation for byte groups. Do not claim arbitrary Unicode binary encoding. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/iban-validator-and-parser',
    keyword: 'IBAN validator and parser',
    keywords: ['validate IBAN online', 'IBAN checker', 'IBAN format validator', 'IBAN country code lookup', 'QR-IBAN checker'],
    intent: 'inspect',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms IBAN checksum/structure validation, country and BBAN extraction, friendly formatting and QR-IBAN identification. Do not claim bank-account ownership verification or payment authorization. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/string-obfuscator',
    keyword: 'string obfuscator',
    keywords: ['obfuscate text online', 'mask part of a string', 'hide sensitive text', 'partially redact a string'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms reversible-looking display masking with configurable first/last visible characters and space preservation. Do not describe it as encryption or secure secret storage. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/emoji-picker',
    keyword: 'emoji picker and search',
    keywords: ['search emoji online', 'copy emoji symbols', 'emoji finder by name', 'emoji Unicode code point lookup'],
    intent: 'lookup',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source confirms searchable emoji catalog with names, keywords, groups and Unicode/code-point metadata. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/benchmark-builder',
    keyword: 'benchmark comparison calculator',
    keywords: ['compare benchmark results', 'execution time benchmark comparison', 'calculate benchmark mean and variance', 'compare test suite performance'],
    intent: 'compute',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms user-entered benchmark suite values are compared using mean and variance, sorted by mean, with Markdown/bullet export. It does not execute benchmarks. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/reaction-time-test',
    keyword: 'reaction time test',
    keywords: ['online reaction time test', 'reflex test milliseconds', 'human reaction speed test', 'reaction time average calculator'],
    intent: 'compute',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source confirms a browser reaction-time test with repeated rounds and mean result. Results are device/browser-session measurements, not a clinical or standardized assessment. Candidate mapping only; no volume/KD/SERP evidence.',
  },


  {
    path: '/text-to-nato-alphabet',
    keyword: 'NATO phonetic alphabet converter',
    keywords: ['text to NATO alphabet', 'NATO alphabet translator', 'phonetic alphabet spelling converter', 'convert words to NATO code words'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms text-to-NATO phonetic alphabet conversion for oral transmission. Candidate mapping only; no audio playback or speech recognition claim. No volume/KD/SERP evidence.',
  },
  {
    path: '/bcrypt',
    keyword: 'bcrypt hash generator and checker',
    keywords: ['bcrypt hash generator', 'bcrypt password hash checker', 'compare password with bcrypt hash', 'bcrypt salt rounds generator'],
    intent: 'generate',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms bcrypt hash generation with configurable salt rounds and string/hash comparison using bcryptjs. Candidate mapping only; do not imply server-side account storage or universal production configuration. No volume/KD/SERP evidence.',
  },
  {
    path: '/bip39-generator',
    keyword: 'BIP39 mnemonic generator',
    keywords: ['BIP39 passphrase generator', 'mnemonic to entropy converter', 'entropy to BIP39 mnemonic', 'BIP39 mnemonic validator'],
    intent: 'generate',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source description and component confirm BIP39 mnemonic/passphrase and entropy conversion in both directions, with language selection and validation. Candidate mapping only; do not claim wallet integration, seed custody or independent cryptographic audit. No volume/KD/SERP evidence.',
  },
  {
    path: '/chronometer',
    keyword: 'online stopwatch',
    keywords: ['online chronometer', 'stopwatch with pause and reset', 'elapsed time counter', 'simple stopwatch online'],
    intent: 'compute',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source confirms an elapsed-time counter with start/resume, pause and reset controls. Candidate mapping only; no lap-recording claim. No volume/KD/SERP evidence.',
  },
  {
    path: '/color-converter',
    keyword: 'color format converter',
    keywords: ['HEX to RGB converter', 'RGB to HSL converter', 'CSS color converter', 'convert color codes online', 'HEX RGB HSL color values'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms color parsing/validation and conversion between HEX, RGB, HSL and CSS color formats. Candidate mapping only; no palette generation or contrast analysis claim. No volume/KD/SERP evidence.',
  },
  {
    path: '/device-information',
    keyword: 'browser device information checker',
    keywords: ['screen resolution checker', 'device pixel ratio checker', 'browser user agent viewer', 'screen orientation checker'],
    intent: 'inspect',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source reads local screen dimensions/orientation, color depth, pixel ratio and navigator properties including user agent. Candidate mapping only; do not describe it as a device fingerprint audit or hardware inventory. No volume/KD/SERP evidence.',
  },
  {
    path: '/encryption',
    keyword: 'text encryption and decryption tool',
    keywords: ['encrypt text online', 'decrypt ciphertext online', 'AES text encryptor', 'TripleDES text encryption', 'CryptoJS text decryptor'],
    intent: 'convert',
    priority: 'P2',
    competition: 'high',
    landed: false,
    note: 'Source confirms text encryption/decryption using CryptoJS AES, TripleDES, Rabbit and RC4. RC4 is legacy and this interface is not positioned as a modern authenticated-encryption or production key-management solution. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/git-memo',
    keyword: 'Git commands cheat sheet',
    keywords: ['Git command reference', 'Git commit amend command', 'Git reset command examples', 'Git clone init config commands', 'Git undo last commit'],
    intent: 'lookup',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms a reference sheet for configuration, init/clone, commit/amend, reset and branch rename commands. It is a static command reference, not an interactive Git client. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/temperature-converter',
    keyword: 'temperature converter',
    keywords: ['Celsius to Fahrenheit converter', 'Fahrenheit to Celsius converter', 'Kelvin to Celsius converter', 'Rankine temperature converter', 'temperature scale conversion'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms conversion among Kelvin, Celsius, Fahrenheit, Rankine, Delisle, Newton, Réaumur and Rømer scales. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/fullwidth-converter',
    keyword: 'full-width half-width converter',
    keywords: ['convert full width to half width', 'half width to full width converter', 'fullwidth alphanumeric converter', 'fullwidth punctuation converter'],
    intent: 'convert',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    note: 'Source confirms full-width/half-width conversion using the fixed Unicode offset 0xFEE0, with a punctuation-only mode. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/px-rem-converter',
    keyword: 'px to rem converter',
    keywords: ['rem to px converter', 'CSS px rem calculator', 'convert pixels to rem', 'batch px rem conversion', 'root font size rem calculator'],
    intent: 'convert',
    priority: 'P1',
    competition: 'high',
    landed: false,
    note: 'Source confirms batch px ↔ rem conversion with configurable root font size and decimal precision. Candidate mapping only; no volume/KD/SERP evidence.',
  },
  {
    path: '/today-in-history',
    keyword: 'today in history',
    keywords: ['on this day in history', 'historical events today', 'what happened on this day', 'today historical anniversaries'],
    intent: 'lookup',
    priority: 'P3',
    competition: 'high',
    landed: false,
    note: 'Source loads daily historical events from the site Pages Function endpoint; its own UI notes the event dataset is still growing. Candidate mapping only; not a core developer-tool acquisition target and not a claim of complete historical coverage. No volume/KD/SERP evidence.',
  },

];

/** 全部工具的真实路由集合（`tool.path`，⛔ 不是目录名）。 */
const TOOL_PATHS = new Set(toolsWithCategory.map(tool => tool.path));

/** 工具路由 → i18n 词条 key。
 *
 * 约定：词条 key = 路由去掉前导斜杠（`/json-prettify` → `tools.json-prettify.title`）。
 * 实测 3 处「目录名 ≠ 路由」的工具都遵守这个约定（`json-viewer/` 里的 index.ts
 * 写的就是 `translate('tools.json-prettify.title')`），因此可以从 path 推导。
 */
function i18nKeyOf(path: string): string {
  return path.replace(/^\//, '');
}

/**
 * 构建期数据体检：把「Keyword Map 与线上 reality 漂移」变成构建失败。
 *
 * 抛错式（throw-on-drift），与 `auditToolSeoData()` 同一风格。**不返回警告列表** ——
 * 能被忽略的警告等于没有校验。
 *
 * @param toolTitles `locales/en.yml` 的 `tools` 段（`{ [i18nKey]: { title } }` 的 title 展平），
 *   由调用方（build-seo.mjs / audit-keyword-map.mjs）解析后传入。
 *   ⛔ 不在本模块里读文件：`src/seo/**` 会被 vite ssrLoadModule 加载，保持它无副作用、
 *     无 node 内置依赖，才能在 Node 侧与测试里复用同一份判据。
 */
export function auditKeywordMap(toolTitles: Record<string, string>) {
  const problems: string[] = [];
  const seenPaths = new Set<string>();

  for (const entry of CLUSTER_KEYWORD_ENTRIES) {
    const { path } = entry;

    // —— 路径真实性：目录名 ≠ 路由 path，本仓库有 3 处已知不一致 ——
    if (!TOOL_PATHS.has(path)) {
      problems.push(`${path}: 不是真实工具路由（比对了 tool.path，不是目录名）`);
    }
    if (seenPaths.has(path)) {
      problems.push(`${path}: 路径重复`);
    }
    seenPaths.add(path);

    for (const alsoPath of entry.alsoPaths ?? []) {
      if (!TOOL_PATHS.has(alsoPath)) {
        problems.push(`${path}.alsoPaths: ${alsoPath} 不是真实工具路由`);
      }
      if (seenPaths.has(alsoPath)) {
        problems.push(`${path}.alsoPaths: ${alsoPath} 与其它条目路径重复`);
      }
      seenPaths.add(alsoPath);
    }
    if (entry.alsoPaths && new Set(entry.alsoPaths).size !== entry.alsoPaths.length) {
      problems.push(`${path}.alsoPaths: 内部有重复项`);
    }

    // —— 取值域：写错一个词就构建失败，而不是静默失去可聚合性 ——
    if (!KEYWORD_INTENTS.includes(entry.intent)) {
      problems.push(`${path}: intent 非法 ${JSON.stringify(entry.intent)}，允许 ${KEYWORD_INTENTS.join('|')}`);
    }
    if (!KEYWORD_PRIORITIES.includes(entry.priority)) {
      problems.push(`${path}: priority 非法 ${JSON.stringify(entry.priority)}，允许 ${KEYWORD_PRIORITIES.join('|')}`);
    }
    if (!KEYWORD_COMPETITIONS.includes(entry.competition)) {
      problems.push(`${path}: competition 非法 ${JSON.stringify(entry.competition)}`);
    }
    if (!entry.keyword.trim()) {
      problems.push(`${path}: keyword 为空`);
    }

    // —— 落地状态自洽 ——
    if (entry.landed && !entry.lockedTitle) {
      problems.push(`${path}: landed=true 但没有 lockedTitle（落地了就必须锁住，否则这条 title 没有任何保护）`);
    }
    if (!entry.landed && entry.lockedTitle) {
      problems.push(`${path}: landed=false 却填了 lockedTitle（没落地就没有「线上现值」可锁）`);
    }

    // —— 核心判据：已落地 title 与 locales/en.yml 必须逐字一致 ——
    // 这一条是本文件存在的全部理由：每条 landed title 都经过能力与意图核对，
    // 改回旧值不会有任何报错。逐字比而不是「包含」，因为 em dash / 空格 / 大小写
    // 任意一处漂移都会让 SERP 侧的字面匹配失效。
    if (entry.landed && entry.lockedTitle) {
      const i18nKey = i18nKeyOf(path);
      const actual = toolTitles[i18nKey];
      if (actual === undefined) {
        problems.push(`${path}: locales/en.yml 缺少词条 tools.${i18nKey}.title`);
      }
      else if (actual !== entry.lockedTitle) {
        problems.push(
          `${path}: title 已漂移 —— locales/en.yml 是 ${JSON.stringify(actual)}，`
          + `keyword-map 锁定的是 ${JSON.stringify(entry.lockedTitle)}`,
        );
      }
    }

    // —— 文章 slug 必须在真实存在的白名单里 ——
    if (entry.article && !(KNOWN_NOTE_SLUGS as readonly string[]).includes(entry.article)) {
      problems.push(
        `${path}: article ${JSON.stringify(entry.article)} 不在 KNOWN_NOTE_SLUGS 白名单里`
        + '（forge-notes 在本仓库之外，拼错查不出来，只会在生产上变成 404 外链）',
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`[seo/keyword-map] Keyword Map 数据有问题:\n  - ${problems.join('\n  - ')}`);
  }

  return {
    total: CLUSTER_KEYWORD_ENTRIES.length,
    /** 纳入 title 锁定保护的条数（改这些 title 会直接让构建失败）。 */
    lockedTitles: CLUSTER_KEYWORD_ENTRIES.filter(entry => entry.landed).length,
    /** 待落地：landed=false，改完把值搬进 lockedTitle 并翻成 true。 */
    pendingTitles: CLUSTER_KEYWORD_ENTRIES.filter(entry => !entry.landed).map(entry => entry.path),
    byPriority: KEYWORD_PRIORITIES.map(
      priority => `${priority}=${CLUSTER_KEYWORD_ENTRIES.filter(entry => entry.priority === priority).length}`,
    ),
    byIntent: KEYWORD_INTENTS
      .map(intent => ({ intent, count: CLUSTER_KEYWORD_ENTRIES.filter(e => e.intent === intent).length }))
      .filter(({ count }) => count > 0),
    withArticle: CLUSTER_KEYWORD_ENTRIES.filter(entry => entry.article).length,
    /** 口径声明的机器可读副本：⛔ 搜索量恒为 N/A，下游不得当成流量预测。 */
    searchVolume: 'N/A' as const,
  };
}
