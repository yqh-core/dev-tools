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
 *     （101/101 均为真实差异化中文文案，非模板拼接）
 *   - 使用说明 ← `src/tools/guides.ts` 的 `GUIDES[path]`（101/101 条人工编写）
 *   - 分类 ← `toolsByCategory` 的聚合结果
 *
 * 缺失即缺失：取不到 guide 的工具**不会**被补上「输入内容→点击按钮→查看结果」
 * 这类机械文案（那是低价值内容政策里的「自动生成内容」形态）。覆盖率由
 * `build-seo.mjs` 打印出来，缺口按待办处理而不是靠凑字数掩盖。
 */
import { GUIDES } from '@/tools/guides';
import type { ToolGuide } from '@/tools/guides';
import { toolsWithCategory } from '@/tools';

export interface ToolSeoEntry {
  /** 工具路由，不带尾斜杠，如 `/uuid-generator`。 */
  path: string
  /** 工具名（zh）。 */
  name: string
  /** `tools.<key>.description` 的真实文案（zh）。 */
  description: string
  /** 所属分类名（来自 toolsByCategory）。 */
  category: string
  /** 人工编写的使用说明；无则为 null，此时骨架不输出使用说明段落。 */
  guide: ToolGuide | null
  /** 同分类的其它工具，用于页内互链（提升重要页面的内部可发现性）。 */
  related: { path: string, name: string }[]
}

/** 同分类互链的条数上限：只做「相邻工具发现」，不做全站链接堆砌。 */
const MAX_RELATED = 8;

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
  // 同分类索引：related 需要「同分类、排除自身」。
  const byCategory = new Map<string, { path: string, name: string }[]>();
  for (const tool of toolsWithCategory) {
    const list = byCategory.get(tool.category) ?? [];
    list.push({ path: tool.path, name: tool.name });
    byCategory.set(tool.category, list);
  }

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

    entries.push({
      path,
      name: String(tool.name ?? '').trim(),
      description,
      category: tool.category,
      guide: GUIDES[path] ?? null,
      related: (byCategory.get(tool.category) ?? [])
        .filter(item => item.path !== path)
        .slice(0, MAX_RELATED),
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
  // guides.ts 的 key 必须都是真实工具路径，否则说明它已经和路由脱节
  // （改过工具 path 却忘了改说明 → 该工具的使用说明会静默失效）。
  const staleGuideKeys = Object.keys(GUIDES).filter(key => !BY_PATH.has(key));
  if (staleGuideKeys.length > 0) {
    throw new Error(
      `[seo/tool-page] src/tools/guides.ts 存在与任何工具路径都不匹配的 key: ${staleGuideKeys.join(', ')}`,
    );
  }

  // 反向：工具不含 guide 是允许的（新工具还没写说明），但要报数、不掩盖。
  const withoutGuide = TOOL_SEO_PAGES.filter(entry => !entry.guide).map(entry => entry.path);

  return {
    total: TOOL_SEO_PAGES.length,
    withGuide: TOOL_SEO_PAGES.length - withoutGuide.length,
    withoutGuide,
  };
}
