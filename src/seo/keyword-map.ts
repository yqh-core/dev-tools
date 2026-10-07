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
 * 这张表此前已经在驱动 7 条 title 落地（见 `landed: true` 的条目），但因为它 living
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
 * 实测该目录 23 个文件 = 1 个 index.md + 22 篇正文，其中 `lang: en` 的只有 5 篇。
 *
 * ⛔ 这 5 篇之外的 17 篇是中文（AdSense / 跨境电商 / SEO / VitePress 等），
 * **不得**进入英文主站的 Blog 区块与 related guides。
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
  'yaml-vs-json-guide',
  'http-status-codes-guide',
] as const;

/** forge-notes 文章的站点根（`notes.digdevbox.com` 是 DigDevBox 站群的一员）。 */
export const NOTES_ORIGIN = 'https://notes.digdevbox.com';

/**
 * Keyword Map §1 总表：11 个关键词簇 / 24 行。
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
    lockedTitle: 'JWT Decoder & Parser — Decode JSON Web Tokens Online',
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
    lockedTitle: 'JSON Formatter & Validator — Beautify and Validate JSON Online',
    note: '簇 2 承重墙。关键事实：`prettify` 一词在本次所有 top5 title 里一次都没出现，主流词汇是 formatter / validator / beautify。',
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
    lockedTitle: 'UUID Generator — Free Online UUID v4 Generator',
    note: '簇 3。UUID 侧是单工具强品牌最集中的一簇（uuid.tools / uuidgenerator.co 等域名即关键词）。',
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
    lockedTitle: 'ULID Generator — Sortable, Time-Ordered IDs Online',
    note: '簇 3。本轮观察中**最清晰的品牌空档**：ULID 词下 top5 无一个 ULID 专用域名。',
  },
  {
    path: '/date-converter',
    keyword: 'unix timestamp converter',
    keywords: ['epoch converter', 'unix time', 'POSIX time', 'Y2038'],
    intent: 'convert',
    priority: 'P0',
    competition: 'medium',
    landed: true,
    // ⛔ 与原文档「建议 Title」列有意不同：落地时补了 `Online` 后缀。
    lockedTitle: 'Unix Timestamp Converter — Epoch to Date & Time Online',
    note: '簇 4。⛔ 定位冲突未裁定：`date converter online`（日期格式互转）与 `unix timestamp converter`（时间戳↔日期）top5 零重叠，两个 intent 挤在同一页。锁定的是当前已上线值，改前须先裁定。',
  },
  {
    path: '/regex-tester',
    keyword: 'regex tester online',
    keywords: ['online regex tester javascript', 'ReDoS', 'greedy vs lazy quantifiers', 'Explain this regex'],
    intent: 'debug',
    priority: 'P0',
    competition: 'low',
    article: 'regex-testing-guide',
    landed: true,
    lockedTitle: 'Regex Tester — Test Regular Expressions Online',
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
    landed: false,
    proposedTitle: 'Docker Run to Compose Converter — Generate docker-compose.yml Online',
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
    landed: false,
    proposedTitle: 'Chmod Calculator — Unix File Permissions (755, 644, 777)',
    note: '簇 6。竞品几乎不做词汇差异化（title 全是裸功能名），setuid/setgid/sticky 是空档。',
  },
  {
    path: '/crontab-generator',
    keyword: 'crontab generator',
    keywords: ['crontab generator every 5 minutes', '@reboot crontab', 'cron syntax github actions'],
    intent: 'generate',
    priority: 'P1',
    competition: 'low',
    article: 'devops-tools-guide',
    landed: false,
    proposedTitle: 'Crontab Generator — Build Cron Expressions Online',
    note: '簇 6。⛔ 两个 intent 混杂（crontab generator 含命令+系统字段 vs 纯 5 字段表达式），页面需先做意图分流。',
  },
  {
    path: '/yaml-prettify',
    keyword: 'yaml formatter online',
    keywords: ['yaml validator', 'yaml to json', 'yaml lint online', 'fix yaml indentation'],
    intent: 'format',
    priority: 'P1',
    competition: 'low',
    landed: false,
    proposedTitle: 'YAML Formatter & Validator — Format YAML Online',
    note: '簇 9。SQL/YAML/XML 三页里最容易打的：头部供给质量明显偏低。',
  },
  {
    path: '/base64-string-converter',
    keyword: 'base64 decode',
    keywords: ['base64 encoder online', 'base64url / URL-safe Base64', 'RFC 4648', 'atob() / btoa()'],
    intent: 'encode',
    priority: 'P1',
    competition: 'high',
    landed: false,
    proposedTitle: 'Base64 Encoder & Decoder — Encode and Decode Text Online',
    note: '簇 7。`base64 decode` 的 top5 里 4 条是教程站，其中一篇的立场是「别用在线工具」⇒ 单位成本最高。',
  },
  {
    path: '/base64-file-converter',
    keyword: 'base64 to image decoder online',
    keywords: ['data URI / data:image/png;base64,', 'magic bytes / image signature', 'image to base64'],
    intent: 'convert',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    proposedTitle: 'Base64 to Image — Decode and Preview Online',
    note: '簇 7。`base64 to image` 在 SERP 上是完全独立的域名集群（5/5 全是该类域名）。',
  },
  {
    path: '/hmac-generator',
    keyword: 'hmac generator online',
    keywords: ['webhook signature generator', 'HMAC base64 / base64url output', 'sign API payloads'],
    intent: 'generate',
    priority: 'P1',
    competition: 'medium',
    landed: false,
    proposedTitle: 'HMAC Generator — Sign Messages with SHA-256 Online',
    note: '簇 10。机会明显大于 /hash-text：「签名对不上」是真实高频痛点。',
  },
  {
    path: '/url-encoder',
    keyword: 'url encoder',
    keywords: ['url decoder online', 'percent-encoding', 'double encoding (%2520)', 'encodeURI vs encodeURIComponent'],
    intent: 'encode',
    priority: 'P1',
    competition: 'high',
    landed: false,
    proposedTitle: 'URL Encoder & Decoder — Percent-Encode URLs Online',
    note: '簇 8。竞争密度全簇最高（同质化新站互相没有护城河，也没有空档）。',
  },
  {
    path: '/url-parser',
    keyword: 'url parser online',
    keywords: ['parse query parameters from a URL', 'inspect UTM parameters', 'OAuth redirect URI'],
    intent: 'parse',
    priority: 'P1',
    competition: 'high',
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
    landed: false,
    proposedTitle: 'SQL Formatter — Format and Beautify SQL Online',
    note: '簇 9。sqlformat.io 一域名双席位；不打折言数量与报错行列号就没有点击理由。',
  },
  {
    path: '/xml-formatter',
    keyword: 'xml formatter online',
    keywords: ['xml beautifier / pretty print / minifier', 'xml validator well-formed', 'xml to json / xsd'],
    intent: 'format',
    priority: 'P2',
    competition: 'medium',
    landed: false,
    proposedTitle: 'XML Formatter — Beautify, Validate and Minify XML',
    note: '簇 9。内置「well-formed vs valid(XSD)」的区分说明。',
  },
  {
    path: '/hash-text',
    keyword: 'sha256 hash generator online',
    keywords: ['file checksum sha256 / verify', 'hash comparison tool', 'file integrity checker'],
    intent: 'compute',
    priority: 'P2',
    competition: 'high',
    landed: false,
    proposedTitle: 'Hash Generator — MD5, SHA-1, SHA-256 Online',
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
    landed: false,
    note: '簇 2 矩阵。与 #2 联动一起做：排名页普遍在做 formatter ↔ validator ↔ minifier ↔ diff ↔ repair 的互链闭环，这是可直接复制的模板。竞争度随 /json-prettify。',
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
    // 这一条是本文件存在的全部理由：7 条 title 已经过 SERP 研究落地，
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
