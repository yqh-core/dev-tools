/**
 * 工具簇（cluster）—— 工具页「相关工具 / 工作流」内链的**唯一来源**。
 *
 * ## 为什么要有这一层
 *
 * 此前 related 的规则是「同分类、排除自身、取前 8」。分类是**数据库视角**
 * （Converter 22 / Crypto 12 / Development 17 …），不是用户视角：
 * `/json-prettify` 属于 Development，于是它的相关工具里出现了 `/git-memo`、
 * `/chmod-calculator` —— 用户是来格式化 JSON 的，这些链接对他毫无意义，
 * 而且把权重散给了不相干的页面。
 *
 * 簇按**用户任务**组织：JSON 的人想的是 format / minify / diff / 转 CSV / 转 YAML，
 * 不是「我在 Converter 分类里」。
 *
 * ## 设计约束（改动前请先读）
 *
 * 1. **一个 path 可以出现在多个簇里**（例如 `/base64-string-converter` 既是
 *    Base64 工具、也是解 JWT 的上下游）。此时**主簇 = 定义顺序上第一个包含它的簇**，
 *    取值行为因此是确定的、可测的 —— 不要把顺序当无关紧要的东西随便调整。
 * 2. **顺序即工作流**：簇内顺序表达「先做什么、再做什么」，workflow 区块按这个顺序
 *    渲染。调顺序 = 改产品语义。
 * 3. **簇成员不足时由同分类兜底补齐**（见 `resolveRelated`）。簇是「优先」，不是「唯一」，
 *    这样单个小簇（如 regex 只有 2 个成员）也能给出够用的推荐，不会退化成空区块。
 * 4. 成员 path 必须是真实存在的工具路由 —— 由 `src/seo/tool-page.ts` 的
 *    `auditToolSeoData()` 在构建期校验，写错会让 `npm run build` 直接失败。
 *
 * ## 本文件不生产文案
 *
 * 只声明「哪些工具属于同一个任务」，簇的显示名走 i18n 词条 `clusters.<id>`
 * （en / zh 必须成对，`build-seo.mjs` 与真实页读同一批词条）。
 */

export interface ToolCluster {
  /** i18n 词条后缀：`clusters.<id>`，同时用于构建期报错定位。 */
  id: string
  /** 簇内工具路由，顺序 = 工作流顺序（详见文件头第 2 条）。 */
  members: string[]
}

/**
 * 簇定义。
 *
 * 顺序要点：越「专属」的簇越靠前，因为主簇取第一个匹配。
 * 例如 `/base64-string-converter` 同时属于 base64 与 jwt，base64 在前 →
 * 它的主簇是 base64（符合直觉），而 jwt 簇仍然能通过它拿到上下游关系。
 */
export const TOOL_CLUSTERS: ToolCluster[] = [
  {
    id: 'json',
    members: [
      '/json-prettify',
      '/json-minify',
      '/json-diff',
      '/json-to-csv',
      '/csv-to-json',
      '/json-to-yaml-converter',
      '/yaml-to-json-converter',
      '/json-to-xml',
      '/xml-to-json',
      '/json-to-toml',
      '/toml-to-json',
      '/json-to-code',
      '/json-to-get-params',
    ],
  },
  {
    id: 'yaml',
    members: [
      '/yaml-prettify',
      '/yaml-to-json-converter',
      '/json-to-yaml-converter',
      '/yaml-to-toml',
      '/toml-to-yaml',
    ],
  },
  {
    id: 'xml',
    members: [
      '/xml-formatter',
      '/json-to-xml',
      '/xml-to-json',
    ],
  },
  {
    id: 'jwt',
    members: [
      '/jwt-parser',
      '/base64-string-converter',
      '/date-converter',
      '/unix-timestamp-converter',
    ],
  },
  {
    id: 'base64',
    members: [
      '/base64-string-converter',
      '/base64-file-converter',
    ],
  },
  {
    id: 'ids',
    members: [
      '/uuid-generator',
      '/ulid-generator',
      '/nanoid-generator',
      '/token-generator',
      '/password-generator',
      '/otp-generator',
      '/bip39-generator',
    ],
  },
  {
    // 单位 / 度量换算。/unit-converter 本身已覆盖长度·重量·温度等族，
    // 这几个是各自独立的高频换算页，归到同一「换算」任务下。
    id: 'convert',
    members: [
      '/unit-converter',
      '/temperature-converter',
      '/px-rem-converter',
    ],
  },
  {
    // 数制 / 数值表示换算（进制、罗马数字、人民币大写）。
    id: 'numeric',
    members: [
      '/base-converter',
      '/roman-numeral-converter',
      '/rmb-uppercase',
    ],
  },
  {
    // 计算器类（表达式求值、百分比）。
    id: 'math',
    members: [
      '/math-evaluator',
      '/percentage-calculator',
    ],
  },
  {
    // 结构化标识的校验 / 解析（电话、IBAN）。
    id: 'parse',
    members: [
      '/iban-validator-and-parser',
      '/phone-parser-and-formatter',
    ],
  },
  {
    id: 'image',
    members: [
      '/image-resize',
      '/image-compress',
      '/image-crop',
      '/image-color-picker',
      '/image-to-pdf',
      '/favicon-generator',
      '/base64-file-converter',
      '/svg-placeholder-generator',
      '/qrcode-generator',
      '/wifi-qrcode-generator',
      '/camera-recorder',
      '/color-converter',
      '/color-contrast-checker',
    ],
  },
  {
    id: 'pdf',
    members: [
      '/pdf-merge',
      '/pdf-split',
      '/pdf-watermark',
      '/pdf-compress',
      '/pdf-signature-checker',
    ],
  },
  {
    id: 'regex',
    members: [
      '/regex-tester',
      '/regex-memo',
    ],
  },
  {
    id: 'devops',
    members: [
      '/chmod-calculator',
      '/crontab-generator',
      '/docker-run-to-docker-compose-converter',
      '/linux-commands',
      '/git-memo',
    ],
  },
  {
    id: 'url',
    members: [
      '/url-encoder',
      '/url-parser',
      '/safelink-decoder',
      '/slugify-string',
      '/html-entities',
    ],
  },
  {
    id: 'http',
    members: [
      '/http-status-codes',
      '/http-status-checker',
      '/http-headers',
      '/user-agent-parser',
      '/device-information',
      '/mime-types',
      '/basic-auth-generator',
    ],
  },
  {
    id: 'ip',
    members: [
      '/ipv4-subnet-calculator',
      '/ipv4-range-expander',
      '/ipv4-address-converter',
      '/ipv6-ula-generator',
      '/mac-address-generator',
      '/mac-address-lookup',
      '/whois-lookup',
    ],
  },
  {
    id: 'hash',
    members: [
      '/hash-text',
      '/hmac-generator',
      '/bcrypt',
      '/encryption',
      '/rsa-key-pair-generator',
      '/password-strength-analyser',
      '/htpasswd-generator',
    ],
  },
  // —— 原单一 `text` 簇有 15 个成员，而 resolveRelated 按簇内顺序 slice(0, max=6)：
  //    第 7 位及以后的工具（rmb-uppercase 第15、numeronym-generator 第12、
  //    morse-code-converter 第11）在任何同簇页的「相关工具」里结构性不出现，
  //    与语义相关性无关。拆成三个 ≤6 成员的语义小簇修掉该缺陷（F5-01，2026-10-20）。
  //    三个簇互不相交 ⇒ 主簇归属唯一、workflow 顺序仍在各自任务内成立。
  {
    // 把文本转成另一种编码 / 表示形式。
    id: 'text-encoding',
    members: [
      '/text-to-unicode',
      '/text-to-binary',
      '/text-to-nato-alphabet',
      '/morse-code-converter',
      '/numeronym-generator',
      '/ascii-text-drawer',
    ],
  },
  {
    // 对文本本身做改写与统计。
    id: 'text-transform',
    members: [
      '/case-converter',
      '/fullwidth-converter',
      '/text-replacer',
      '/list-converter',
      '/string-obfuscator',
      '/text-statistics',
    ],
  },
  {
    // 剩下的比较 / 生成类，保持 id 不变以复用既有 en/zh 词条。
    id: 'text',
    members: [
      '/text-diff',
      '/lorem-ipsum-generator',
    ],
  },
  {
    id: 'date',
    members: [
      '/date-converter',
      '/unix-timestamp-converter',
      '/eta-calculator',
      '/chronometer',
    ],
  },
];

/** 主簇索引：path → 第一个包含它的簇（多归属时的取值规则，见文件头）。 */
const PRIMARY = new Map<string, ToolCluster>();
for (const cluster of TOOL_CLUSTERS) {
  for (const path of cluster.members) {
    if (!PRIMARY.has(path)) {
      PRIMARY.set(path, cluster);
    }
  }
}

/** 取某工具的主簇；不属于任何簇时返回 undefined（调用方需按兜底处理）。 */
export function clusterOf(path: string): ToolCluster | undefined {
  return PRIMARY.get(path);
}

/** 全部簇 id，供构建期校验 i18n 词条是否齐全。 */
export const CLUSTER_IDS: string[] = TOOL_CLUSTERS.map(cluster => cluster.id);

export interface RelatedOptions<T extends { path: string; category?: string }> {
  /** 当前工具路由（不带尾斜杠）。 */
  path: string
  /** 当前工具所属分类，用于簇内成员不足时兜底。 */
  category: string
  /** 候选集：客户端是 store 里的 tools（当前语言），构建期是 toolsWithCategory（en）。 */
  tools: T[]
  /** 返回条数上限。 */
  max?: number
}

/**
 * 相关工具：同簇优先 → 同分类兜底。
 *
 * 为什么还要兜底：单个小簇（regex 只有 2 个成员）如果只给簇内结果，
 * 区块会短得不像一个区块；而「同分类」虽然弱，也比留空强。
 * 顺序上簇成员永远排在前面 —— 兜底只补数量，不抢位置。
 */
export function resolveRelated<T extends { path: string; category?: string }>(
  { path, category, tools, max = 6 }: RelatedOptions<T>,
): T[] {
  const cluster = clusterOf(path);
  const picked: T[] = [];
  const used = new Set<string>([path]);

  const push = (item: T | undefined) => {
    if (item && !used.has(item.path)) {
      used.add(item.path);
      picked.push(item);
    }
  };

  if (cluster) {
    // 按簇内顺序取，而不是按 tools 数组顺序 —— 顺序即工作流语义。
    for (const memberPath of cluster.members) {
      push(tools.find(tool => tool.path === memberPath));
    }
  }

  if (picked.length < max && category) {
    for (const tool of tools) {
      if (tool.category === category) {
        push(tool);
      }
      if (picked.length >= max) {
        break;
      }
    }
  }

  return picked.slice(0, max);
}

export interface WorkflowItem<T> {
  item: T
  /** 是否为当前工具（UI 上标记「you are here」）。 */
  current: boolean
}

/**
 * 工作流链条：当前工具所在簇的完整成员序列（含自身位置标记）。
 *
 * 与 related 的区别：related 是「你可能还需要什么」（排除自身、可兜底），
 * workflow 是「这件事的完整流程长什么样」（包含自身、只取簇内、不兜底）。
 * 两者共用同一份簇数据，所以页面上不会出现「related 说 A、workflow 说 B」的错位。
 */
export function resolveWorkflow<T extends { path: string }>(
  { path, tools, max = 8 }: { path: string; tools: T[]; max?: number },
): WorkflowItem<T>[] {
  const cluster = clusterOf(path);
  if (!cluster) {
    return [];
  }

  // 簇成员多于 max 时，以当前项为中心开窗口 —— 保证当前项一定在链条里可见，
  // 否则链条就成了「别人的工作流」，对理解当前步骤没有帮助。
  let members = cluster.members;
  const index = members.indexOf(path);
  if (members.length > max && index >= 0) {
    let start = Math.max(0, index - Math.floor((max - 1) / 2));
    const end = Math.min(members.length, start + max);
    start = Math.max(0, end - max);
    members = members.slice(start, end);
  }

  const items: WorkflowItem<T>[] = [];
  for (const memberPath of members) {
    const item = tools.find(tool => tool.path === memberPath);
    if (item) {
      items.push({ item, current: memberPath === path });
    }
  }
  return items;
}
