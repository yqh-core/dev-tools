/**
 * Keyword Map 的数据结构。
 *
 * 为什么单独成文件
 * ------------------------------------------------------------------
 * `src/tools/tools.types.ts` 与 `src/tools/guides.types.ts` 都是同一套做法：
 * 类型与数据分离，避免「类型文件 import 数据文件」形成循环引用。
 * 本文件被 `src/seo/keyword-map.ts`（数据 + 校验）与 `scripts/audit-keyword-map.mjs`
 * 共同引用，单独成文件后两边都能干净地引用。
 */

/**
 * 优先级。沿用 Keyword Map V1 文档 §1 Status 列的记号语义：
 *
 *   P0（原 🟢）先做 / P1（原 🟡）次批 / P2（原 🔵）保留为内链枢纽 / P3（原 🔴）不建议投入
 *
 * ⛔ 用字符串而不用 emoji 做数据值：emoji 进了 JSON-LD / 日志 / diff 之后
 * 无法 grep、无法排序、宽度也不稳定。emoji 只允许出现在人的注释里。
 */
export type KeywordPriority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * 搜索意图的归一化取值。
 *
 * 文档里写的是中文口语（`调试刚需` / `查表` / `生成→复制`），这里落成机器可比较的
 * 闭集 —— `auditKeywordMap` 会校验每个 intent 都落在集合内，写错一个词就构建失败。
 * 这样「意图」才能被聚合统计（例：P0 里有几个 debug 类页面），而不只是装饰性文本。
 */
export type KeywordIntent
  = | 'debug' // 调试刚需：输入坏数据、看内部结构
    | 'format' // 格式化：把数据整理成人能读的样子
    | 'generate' // 生成→复制：产出随机值 / 表达式，拿到即走
    | 'convert' // 转换：两种格式之间来回
    | 'encode' // 编解码：可逆变换（base64 / percent-encoding）
    | 'parse' // 解析：从一段文本里抽出结构化字段
    | 'compute' // 计算：由输入推导数值结果
    | 'inspect' // 查看 / 探测：给一段原始报文，输出解读或评分
    | 'lookup' // 查表：需求是「查」不是「算」（速查表、状态码表）
    | 'reference' // 阅读：整页是知识性内容，工具形态不构成优势

/** 竞争烈度的定性评级。⛔ 不是任何工具的分数，是 top5 域名构成的观察结论。 */
export type KeywordCompetition = 'low' | 'medium' | 'high' | 'very-high';

/** 允许的 priority 集合（audit 的判据来源，⛔ 不要在别处另写一份）。 */
export const KEYWORD_PRIORITIES: readonly KeywordPriority[] = ['P0', 'P1', 'P2', 'P3'];

/** 允许的 intent 集合。 */
export const KEYWORD_INTENTS: readonly KeywordIntent[] = [
  'debug',
  'format',
  'generate',
  'convert',
  'encode',
  'parse',
  'compute',
  'inspect',
  'lookup',
  'reference',
];

/** 允许的 competition 集合。 */
export const KEYWORD_COMPETITIONS: readonly KeywordCompetition[] = ['low', 'medium', 'high', 'very-high'];

/**
 * 一条关键词地图记录 —— 对应 Keyword Map V1 文档 §1 总表的一行。
 *
 * ⛔ 本表**不含任何搜索量数字**（原因见 `src/seo/keyword-map.ts` 头部口径声明）。
 */
export interface KeywordMapEntry {
  /**
   * 工具的**真实路由**，取自 `defineTool()` 里的 `path`。
   *
   * ⛔ 绝不能按目录名或工具显示名拼：本仓库有 3 处已知不一致
   * （`json-viewer/` → `/json-prettify`、`date-time-converter/` → `/date-converter`、
   * `integer-base-converter/` → `/base-converter`），另有 `/hash-text` **没有**
   * `/hash-generator` 这个路由。`auditKeywordMap` 会对着工具注册表逐条比对。
   */
  path: string
  /**
   * 同簇矩阵的兄弟页（文档 §1 第 24 行：6 个 JSON 页随承重墙 `/json-prettify` 一起做）。
   *
   * 它们没有独立的关键词定位（与主页面重叠），所以只登记「随簇一起做」这个事实，
   * 不给它们编造 keyword。同样会被 audit 校验存在于工具注册表。
   */
  alsoPaths?: string[]
  /**
   * 主目标关键词 —— 文档里**真实检索过**的词，取第一个作为代表。
   *
   * ⛔ 不是搜索量最高的词（没有搜索量数据），是「这一轮实际看过 SERP 的词」。
   */
  keyword: string
  /** 同一轮检索里观察到的其余长尾变体（原文照抄，不做归纳改写）。 */
  keywords?: string[]
  /** 归一化后的搜索意图。 */
  intent: KeywordIntent
  /** 投入优先级。 */
  priority: KeywordPriority
  /** 竞争烈度（定性）。 */
  competition: KeywordCompetition
  /**
   * 关联的 forge-notes 文章 slug（`D:\work\forge-notes\docs\posts\<slug>.md`）。
   *
   * ⛔ 只允许取自 `KNOWN_NOTE_SLUGS` 白名单 —— 那个仓库在**本仓库之外**，
   * 没有版本控制，写错一个 slug 在本仓库里是查不出来的，必须靠白名单挡住。
   * 省略表示该页面本轮没有配套文章（⛔ 不为凑数硬塞一篇文章）。
   */
  article?: string
  /**
   * 建议 title —— **线上必须逐字一致**的锁定值。
   *
   * 仅在 `landed: true` 时有意义：它记录的是 `locales/en.yml` 里**当前真实生效**的
   * title，`auditKeywordMap` 每次构建都比对，改回旧值直接判红。
   *
   * ⛔ 注意它与文档 §1「建议 Title」列**可能有意不同** —— 落地时做过微调
   * （见 `keyword-map.ts` 里逐条标注的两处）。锁定的是「已上线的值」，
   * 而不是「文档里的原始建议」：门禁要保护的是线上现状不被悄悄改掉。
   */
  lockedTitle?: string
  /**
   * 是否已落地到 `locales/en.yml`。
   *
   * `false` 表示这页的 title 还是旧值，`proposedTitle` 只是待执行的建议 ——
   * 这类条目**不参与** title 一致性校验（否则 `npm run build` 立刻炸），
   * 但参与其余全部校验。
   */
  landed: boolean
  /**
   * 尚未落地的建议 title（`landed: false` 时使用）。
   *
   * 纯记录用途：让人看见「这一轮打算改成什么」，改 title 时照着它改，
   * 改完把 `landed` 翻成 `true` 并把值搬进 `lockedTitle`，门禁就接管这条 title。
   */
  proposedTitle?: string
  /** 落地的额外前置条件 / 注意事项（文档里明确要求先裁定的项）。 */
  note?: string
}
