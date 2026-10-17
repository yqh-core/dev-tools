/**
 * 指南文章互链扫描 —— 纯函数，零依赖。
 *
 * 单独成文件（而不是塞进 guide-articles.ts）只有一个理由：
 * guide-articles.ts 会拉起 TOOL_SEO_PAGES → 101 个工具的 defineTool → naive-ui / i18n，
 * 单元测试为了测一个正则就得整套环境起来。放这里，node 环境下直接可测。
 *
 * ## 为什么这条判据必须在构建期跑
 * 指向 `/guides/<x>` 的链接如果对应的文章没生成，用户与爬虫拿到的是**软 404**
 * （HTTP 200 + 「没找到」）。软 404 比 404 更糟：爬虫把这条链接当有效页面反复抓，
 * 还可能把「未找到」当正文收录。构建期手里同时有全量文章清单和全量 HTML，
 * 这一刻判定成本最低、证据最完整；过了这一刻就只能靠线上巡检。
 *
 * ## checked 是自证位，不是日志
 * 匹配不到任何链接时 `dangling` 也是空的 —— 「扫到 0 条」和「一条都不悬空」如果
 * 输出一样，这条判据就是摆设。所以调用方必须要求 `checked > 0`。
 */

/**
 * 文章路由前缀与拼法。**放在这个零依赖模块里**而不是 guide-articles.ts，是因为
 * 运行时的 `tool.layout.vue`（每一个工具页都过它）也要拼这个链接：
 * guide-articles.ts 会拉起 TOOL_SEO_PAGES → `@/tools`（整个工具注册表）+ guides.en/zh，
 * 从那导入等于把构建期数据塞进共享 chunk。前缀只有一处定义，两侧（预渲染骨架 /
 * hydration 后的真实面板）调的是同一个函数，不存在各写一份字面量的可能。
 */
export const GUIDE_PREFIX = '/guides';

/** 工具 `/uuid-generator` → 文章 `/guides/uuid-generator`（不带尾斜杠，站内标识用）。 */
export function guideArticlePath(toolPath: string): string {
  return `${GUIDE_PREFIX}${toolPath}`;
}

/** 写进 `<a href>` 的形式：带尾斜杠，与 canonical / sitemap 的规范形式一致。 */
export function guideArticleHref(toolPath: string): string {
  return `${guideArticlePath(toolPath)}/`;
}

/** 文章路径 → 工具路径（反向解析，可达性图要用）。 */
export function toolPathOfArticle(articlePath: string): string {
  return articlePath.slice(GUIDE_PREFIX.length) || '/';
}

/**
 * 实测形状（2026-10-17，116 篇 `dist/guides/<slug>/index.html`）：
 * 668 条 `href="/guides/<slug>"`，**全部不带尾斜杠**。
 * 正则仍容忍带斜杠的写法，免得将来改成 `<router-link>` 生成绝对形式时静默漏扫。
 * 只匹配站内相对链接：canonical 那种 `href="https://digdevbox.com/guides/x/"`
 * 不在这里判（它由预渲染层的 canonical 断言单独管）。
 */
const GUIDE_HREF_RE = /href="(\/guides\/[a-z0-9-]+)\/?"/g;

export interface GuideLinkScan {
  /** 悬空链接，形如 `/guides/a -> /guides/b`。 */
  dangling: string[]
  /** 实际扫过的 `/guides/...` 链接条数。为 0 说明判据没吃到数据，调用方必须判红。 */
  checked: number
  /** 每篇扫到多少条，供构建日志核对（总数 == checked）。 */
  perPage: Record<string, number>
}

/**
 * 从一段 HTML 里取出所有指向文章的**站内相对**链接（已去尾斜杠、已剔除自链）。
 *
 * 剔除自链是防御性的，不是当前实测形态：2026-10-17 量过 116 篇，
 * `href="/guides/<自己>"` 这种自链**一条都没有**（0/116），canonical 是绝对 URL、
 * 会被 GUIDE_HREF_RE 直接排除。留着这层过滤的理由是判据性质：孤岛判据数的是「入链」，
 * 而自链会让节点从自己身上拿到一条入链，一旦将来 markup 改成 RouterLink 生成自指
 * 相对链接，孤岛数会**静默**变成 0 —— 那比现在报错危险得多。
 */
export function collectGuideLinksFromHtml(html: string, selfPath: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(GUIDE_HREF_RE)) {
    if (m[1] !== selfPath) {
      out.push(m[1]);
    }
  }
  return out;
}

/** 页面 → 它链到的文章集合（可达性图的边表）。 */
export function buildGuideEdgeMap(
  pages: readonly { path: string }[],
  htmlOf: (path: string) => string,
): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const page of pages) {
    edges.set(page.path, collectGuideLinksFromHtml(htmlOf(page.path) ?? '', page.path));
  }
  return edges;
}

export function scanGuideCrossLinks(
  pages: readonly { path: string }[],
  htmlOf: (path: string) => string,
): GuideLinkScan {
  const built = new Set(pages.map(p => p.path.replace(/\/+$/, '')));
  const dangling: string[] = [];
  const perPage: Record<string, number> = {};
  let checked = 0;
  for (const page of pages) {
    const html = htmlOf(page.path) ?? '';
    let n = 0;
    for (const m of html.matchAll(GUIDE_HREF_RE)) {
      checked += 1;
      n += 1;
      const target = m[1];
      if (!built.has(target)) {
        dangling.push(`${page.path} -> ${target}`);
      }
    }
    perPage[page.path] = n;
  }
  return { dangling, checked, perPage };
}

/**
 * 工具页 → 文章页的入口链接扫描（F1 的机器判据）。
 *
 * 判的是**预渲染骨架**，不是 hydration 之后的 DOM —— 这条边存在的理由就是让不执行 JS
 * 的抓取器能从工具页走到文章页，运行时才出现的链接对爬虫等于不存在。
 * 反方向（文章页 → 工具页）早有断言，缺的一直是这一侧，所以「四向互链」实际只有三向。
 */
export interface ToolEntryLinkScan {
  /** 有文章、但初始 HTML 里没有入口链接的工具页。 */
  missing: string[]
  /** 有入口链接的工具页数（== 有文章的工具数才算对）。 */
  linked: number
  /** 本该有文章的工具页总数（自证位：为 0 说明判据没吃到数据）。 */
  expected: number
  /** 链接指向了没生成的文章（软 404）。 */
  dangling: string[]
}

export function scanToolEntryLinks(
  tools: readonly { path: string }[],
  htmlOf: (path: string) => string,
  articlePaths: Iterable<string>,
): ToolEntryLinkScan {
  const built = new Set(articlePaths);
  const missing: string[] = [];
  const dangling: string[] = [];
  let linked = 0;
  let expected = 0;
  for (const tool of tools) {
    const article = guideArticlePath(tool.path);
    if (!built.has(article)) {
      continue;
    }
    expected += 1;
    const html = htmlOf(tool.path) ?? '';
    // 认 href 的两种写法：带 / 不带尾斜杠都算入口存在（canonical 一致性另有判据管）
    const bare = guideArticlePath(tool.path);
    if (html.includes(`href="${bare}/"`) || html.includes(`href="${bare}"`)) {
      linked += 1;
    }
    else {
      missing.push(tool.path);
    }
    for (const m of html.matchAll(GUIDE_HREF_RE)) {
      if (!built.has(m[1])) {
        dangling.push(`${tool.path} -> ${m[1]}`);
      }
    }
  }
  return { missing, linked, expected, dangling };
}

/**
 * 检查一批 i18n 键是否**两种语言都在**。
 *
 * 为什么单独做判据：骨架恒按 en 预渲染，面板按用户当前语言渲染。
 * 一个键只在 en.yml 里有，英文页一切正常、构建也正常，**中文页直接漏出键名**
 * （`t('seo.guideArticleLink')` 渲染成 `seo.guideArticleLink` 这串字）。
 * 这类缺陷肉眼才看得见，界面上不报错 —— 与 guides en/zh 不成对是同一类。
 *
 * 只做「键存在」这一件事；值是否为空串也一起判（空值同样会让句子塌掉）。
 */
export function missingLocaleKeys(
  keys: readonly string[],
  en: Record<string, unknown>,
  zh: Record<string, unknown>,
): { key: string; missingIn: string }[] {
  const pick = (obj: Record<string, unknown>, dotted: string) => dotted
    .split('.')
    .reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), obj);
  const out: { key: string; missingIn: string }[] = [];
  for (const k of keys) {
    const hasEn = typeof pick(en, k) === 'string' && (pick(en, k) as string).trim() !== '';
    const hasZh = typeof pick(zh, k) === 'string' && (pick(zh, k) as string).trim() !== '';
    if (!hasEn || !hasZh) {
      out.push({ key: k, missingIn: !hasEn && !hasZh ? 'en+zh' : hasEn ? 'zh' : 'en' });
    }
  }
  return out;
}

/**
 * 有向图可达性（BFS）。节点集合由调用方给全 —— **不能只喂收录进 sitemap 的那部分**，
 * 否则「未收录 = 不存在」会被静默写进结论，孤岛数量永远比真实情况好看。
 *
 * ⚠ 种子**不受** `nodes` 限制，遍历也不受；只有返回值会被裁到 `nodes` 上。
 * 这个区分不是吹毛求疵：本项目第一版把种子也按 `nodes` 过滤了，而种子恰恰是
 * 「工具页 + 静态页 + 已收录文章」——工具页不在文章节点集里，于是全部种子被丢掉，
 * 可达数直接塌成 1，判据以「115 篇孤岛」的形式炸出来。要是它安静地过了，
 * 我们就拿着一张根本没在图上跑过的数字当验收。
 *
 * 边表里指向未知目标的链接一律忽略（悬空链接由 `scanGuideCrossLinks` /
 * `scanToolEntryLinks` 负责判红，这里只管可达，两个判据不互相掩盖）。
 */
export function reachableFrom(
  seeds: Iterable<string>,
  edges: Map<string, string[]>,
  nodes: Iterable<string>,
): Set<string> {
  const wanted = new Set(nodes);
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const s of seeds) {
    if (!seen.has(s)) {
      seen.add(s);
      queue.push(s);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    for (const next of edges.get(queue[i]) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const reached = new Set<string>();
  for (const n of wanted) {
    if (seen.has(n)) {
      reached.add(n);
    }
  }
  return reached;
}
