/**
 * 工具页 SEO 数据层 —— 101 个工具页的**唯一来源**。
 *
 * 被两处消费，因此必须集中定义（同 `src/seo/routes.ts` 的理由）：
 *   1. `scripts/build-seo.mjs` —— 逐工具页渲染骨架 + 生成 sitemap 的工具部分
 *   2. `src/seo/ToolSeoPage.vue` —— 构建期渲染正文（H1 / 简介 / 使用说明 / 分类）
 *
 * ## 内容来源（工程红线：不得虚构）
 *
 * 本模块**不生产任何新文案**，只把既有真实数据组装起来：
 *   - 工具名 / 一句话描述 ← `defineTool()` 里的 `tools.<key>.title` / `description`
 *     （101/101 均为真实差异化文案，非模板拼接；按 i18n 默认语言 en 取值）
 *   - 使用说明 ← `src/tools/guides.en.ts` 的 `GUIDES[path]`（101/101 条人工编写，
 *     与 `guides.zh.ts` 的 key 一一对应，由 `auditToolSeoData` 强制校验）
 *   - 分类 ← `toolsByCategory` 的聚合结果
 *
 * 缺失即缺失：取不到 guide 的工具**不会**被补上「输入内容→点击按钮→查看结果」
 * 这类机械文案（那是低价值内容政策里的「自动生成内容」形态）。覆盖率由
 * `build-seo.mjs` 打印出来，缺口按待办处理而不是靠凑字数掩盖。
 */
import { GUIDES } from '@/tools/guides.en';
import { GUIDES as GUIDES_ZH } from '@/tools/guides.zh';
import type { ToolGuide } from '@/tools/guides.types';
import { toolsWithCategory } from '@/tools';
import { CLUSTER_IDS, TOOL_CLUSTERS, clusterOf, resolveRelated, resolveWorkflow } from './clusters';

export interface ToolSeoEntry {
  /** 工具路由，不带尾斜杠，如 `/uuid-generator`。 */
  path: string
  /** 工具名（i18n 默认语言）。 */
  name: string
  /**
   * 页面 H1：title 的核心词（em dash 前半段）。
   *
   * Keyword Map V1（G-01a）的定位策略：`<title>` 带长尾后缀打搜索结果，
   * H1 保持短核心词。title 无 em dash 的工具派生结果 === name，行为不变。
   * 与 `tool.layout.vue` 的 `toolH1` 同一规则，保证 SSG / CSR 两边逐字一致。
   */
  h1: string
  /** `tools.<key>.description` 的真实文案（i18n 默认语言）。 */
  description: string
  /** 所属分类名（来自 toolsByCategory）。 */
  category: string
  /** 人工编写的使用说明；无则为 null，此时骨架不输出使用说明段落。 */
  guide: ToolGuide | null
  /**
   * 同任务（簇）优先的相关工具，簇内不足时由同分类补齐。
   *
   * 旧的「同分类前 8」会把 `/json-prettify` 链向 `/git-memo`（同属 Development），
   * 对用户毫无意义，也把内链权重散给不相干页面。详见 `src/seo/clusters.ts`。
   */
  related: { path: string, name: string }[]
  /** 所属任务簇 id（i18n 词条 `clusters.<id>`）；不属于任何簇时为 null。 */
  cluster: string | null
  /** 同簇的完整工作流链条（含当前项标记）；不属于任何簇时为空数组。 */
  workflow: { path: string, name: string, current: boolean }[]
}

/** 同簇互链的条数上限：只做「相邻工具发现」，不做全站链接堆砌。 */
const MAX_RELATED = 6;
/** 工作流链条的最大节点数：再长就不是「流程」而是目录了。 */
const MAX_WORKFLOW = 8;

/**
 * 被用作重定向源的路径（`redirectFrom`）。
 *
 * 这些路径是 301 的**来源**，不是可索引页面：给它们生成 index.html 会让
 * 「搜索引擎抓到的 URL」和「站内链接指向的 URL」变成两个。因此一律排除，
 * 同时也不要收进 sitemap。
 */
const REDIRECT_SOURCES = new Set(
  toolsWithCategory.flatMap(tool => tool.redirectFrom ?? []),
);

function buildEntries(): ToolSeoEntry[] {
  const seen = new Set<string>();
  const entries: ToolSeoEntry[] = [];

  for (const tool of toolsWithCategory) {
    const path = tool.path;

    // —— 数据完整性：这里抛错比构建出 101 个错误页面便宜得多 ——
    if (!path || !path.startsWith('/') || path === '/') {
      throw new Error(`[seo/tool-page] 工具路径非法: ${JSON.stringify(path)}（必须是以 / 开头且非根路径）`);
    }
    if (seen.has(path)) {
      throw new Error(`[seo/tool-page] 工具路径重复: ${path}`);
    }
    seen.add(path);

    const description = String(tool.description ?? '').trim();
    if (!description) {
      throw new Error(`[seo/tool-page] ${path} 的 description 为空，工具页正文将失去主体内容`);
    }
    // translate() 在找不到 i18n key 时会把 key 原样返回，那种情况等于没翻译。
    if (description.startsWith('tools.') || description === tool.name) {
      throw new Error(`[seo/tool-page] ${path} 的 description 疑似未翻译: ${description}`);
    }
    if (REDIRECT_SOURCES.has(path)) {
      throw new Error(
        `[seo/tool-page] ${path} 同时是工具路径与重定向源，语义冲突：`
        + '要么它是可索引页面，要么它是 301 来源，不能两者都是',
      );
    }

    const related = resolveRelated({
      path,
      category: tool.category,
      tools: toolsWithCategory,
      max: MAX_RELATED,
    }).map(({ path: p, name }) => ({ path: p, name }));

    const workflow = resolveWorkflow({
      path,
      tools: toolsWithCategory,
      max: MAX_WORKFLOW,
    }).map(({ item, current }) => ({ path: item.path, name: item.name, current }));

    entries.push({
      path,
      name: String(tool.name ?? '').trim(),
      h1: String(tool.name ?? '').trim().split(' — ')[0],
      description,
      category: tool.category,
      guide: GUIDES[path] ?? null,
      related,
      cluster: workflow.length > 0 ? (clusterOf(path)?.id ?? null) : null,
      workflow,
    });
  }

  return entries;
}

/** 全部可索引工具页，顺序与 `toolsByCategory` 一致。 */
export const TOOL_SEO_PAGES: ToolSeoEntry[] = buildEntries();

const BY_PATH = new Map(TOOL_SEO_PAGES.map(entry => [entry.path, entry]));

export function getToolSeoEntry(path: string): ToolSeoEntry | undefined {
  return BY_PATH.get(path);
}

/**
 * 构建期数据体检：把「口径漂移」变成构建失败，而不是静默少渲染几个页面。
 *
 * 返回统计信息供 `build-seo.mjs` 打印（覆盖率要看得见，缺口才不会被忽略）。
 */
export function auditToolSeoData() {
  // guides 的 key 必须都是真实工具路径，否则说明它已经和路由脱节
  // （改过工具 path 却忘了改说明 → 该工具的使用说明会静默失效）。
  // 两份语言各查一遍。
  for (const [lang, table] of [['en', GUIDES], ['zh', GUIDES_ZH]] as const) {
    const staleKeys = Object.keys(table).filter(key => !BY_PATH.has(key));
    if (staleKeys.length > 0) {
      throw new Error(
        `[seo/tool-page] src/tools/guides.${lang}.ts 存在与任何工具路径都不匹配的 key: ${staleKeys.join(', ')}`,
      );
    }
  }

  // 语言完整性：en / zh 的 key 集合必须完全一致。
  // 只补一种语言时，另一种语言的工具页会**静默**没有使用说明 ——
  // 界面上看不出任何报错，所以必须在构建期拦下。
  const enKeys = new Set(Object.keys(GUIDES));
  const zhKeys = new Set(Object.keys(GUIDES_ZH));
  const missingInZh = [...enKeys].filter(key => !zhKeys.has(key));
  const missingInEn = [...zhKeys].filter(key => !enKeys.has(key));
  if (missingInZh.length > 0 || missingInEn.length > 0) {
    throw new Error(
      '[seo/tool-page] guides 语言数据不一致：'
      + `${missingInZh.length > 0 ? `zh 缺少 ${missingInZh.join(', ')}` : ''}`
      + `${missingInEn.length > 0 ? `${missingInZh.length > 0 ? '；' : ''}en 缺少 ${missingInEn.join(', ')}` : ''}`,
    );
  }

  // 反向：工具不含 guide 是允许的（新工具还没写说明），但要报数、不掩盖。
  const withoutGuide = TOOL_SEO_PAGES.filter(entry => !entry.guide).map(entry => entry.path);

  // 知识型内容（about / faqs）的语言成对性：骨架预渲染走 en，真实页面跟随用户语言。
  // 只补一种语言时，另一侧会静默少一整段内容（界面无报错），所以构建期直接拦下。
  const contentGaps: string[] = [];
  for (const path of Object.keys(GUIDES)) {
    const en = GUIDES[path];
    const zh = GUIDES_ZH[path];
    if (Boolean(en.about) !== Boolean(zh.about)) {
      contentGaps.push(`${path}: about 只有一侧有`);
    }
    if ((en.faqs?.length ?? 0) !== (zh.faqs?.length ?? 0)) {
      contentGaps.push(`${path}: faqs 条数不一致（en ${en.faqs?.length ?? 0} / zh ${zh.faqs?.length ?? 0}）`);
    }
  }
  if (contentGaps.length > 0) {
    throw new Error(`[seo/tool-page] about/faqs 语言数据不成对: ${contentGaps.join('; ')}`);
  }

  // —— 簇数据校验（src/seo/clusters.ts）——
  // 簇是手工维护的数据，写错 path 不会报错、只会静默少一条内链，
  // 所以必须在构建期把它变成硬失败。
  const clusterProblems: string[] = [];
  for (const { id, members } of TOOL_CLUSTERS) {
    const dup = new Set<string>();
    for (const member of members) {
      if (!BY_PATH.has(member)) {
        clusterProblems.push(`簇 ${id} 的成员 ${member} 不是真实工具路径`);
      }
      if (dup.has(member)) {
        clusterProblems.push(`簇 ${id} 的成员 ${member} 重复`);
      }
      dup.add(member);
    }
  }
  if (clusterProblems.length > 0) {
    throw new Error(`[seo/tool-page] 簇数据有问题: ${clusterProblems.join('; ')}`);
  }

  // 内链自检：related 不能为空、不能自指 —— 这正是「簇写错 / 分类为空」时
  // 最容易静默退化成空区块的地方，而空区块在界面上看不出任何异常。
  const linkProblems: string[] = [];
  for (const entry of TOOL_SEO_PAGES) {
    if (entry.related.length === 0) {
      linkProblems.push(`${entry.path}: related 为空`);
    }
    if (entry.related.some(item => item.path === entry.path)) {
      linkProblems.push(`${entry.path}: related 含自身`);
    }
    if (entry.workflow.length > 0 && entry.workflow.filter(item => item.current).length !== 1) {
      linkProblems.push(`${entry.path}: workflow 里当前项不是恰好一个`);
    }
  }
  if (linkProblems.length > 0) {
    throw new Error(`[seo/tool-page] 内链数据有问题: ${linkProblems.join('; ')}`);
  }

  return {
    total: TOOL_SEO_PAGES.length,
    withGuide: TOOL_SEO_PAGES.length - withoutGuide.length,
    withoutGuide,
    guideKeys: enKeys.size,
    guideLocales: ['en', 'zh'] as const,
    withAbout: TOOL_SEO_PAGES.filter(entry => entry.guide?.about).length,
    withFaqs: TOOL_SEO_PAGES.filter(entry => entry.guide?.faqs?.length).length,
    // 簇覆盖：x/101。数字掉下来 = 有工具被移出簇或簇数据丢了，肉眼可见。
    withCluster: TOOL_SEO_PAGES.filter(entry => entry.cluster).length,
    clusterIds: CLUSTER_IDS,
  };
}
