/**
 * 工具指南文章页（B1，参照 nexacove.cc / DevBox Tools 的 /guides/<key>.html）。
 *
 * ## 为什么要单独成页
 * 现在每份 guide 内容（intro / steps / notes / example / about / faqs）只活在工具页的
 * 折叠面板里：URL 是工具页本身，标题是工具名，爬虫读到的是「工具 + 一小段说明」。
 * 长尾搜索（"how to validate json online"、"what does a htpasswd line look like"）
 * 想要的是**文章形态**的页面：有目录、有解释、有例子、有 FAQ，而不是一上来就要你操作。
 * 独立 URL 才能承接这类查询，也才能把内链从「工具 ↔ 工具」扩成「工具 ↔ 指南 ↔ FAQ」。
 *
 * ## 不复制内容
 * 这一层**不新写任何正文**：文章由 `TOOL_SEO_PAGES[].guide` 现场组装，
 * 与工具页折叠面板同源同字。工具页说明改了，文章自动跟着改，不存在第二份事实。
 *
 * ## 与工具页的关系（口径写在这里，免得被当成重复内容缺陷）
 * 两者确实共享 about/faqs 文字。区别是：工具页 = 操作面（标题短、核心词、直接给工具），
 * 文章页 = 解释面（标题带 guide、有目录、有面包屑、回链到工具与同簇工具）。
 * 是否要把工具页正文进一步收敛成「只留 intro」以彻底消除重叠，属产品裁定，
 * 会牵动 114 页的预渲染判据，不在本批次内做。
 */
import { GUIDE_PREFIX, guideArticlePath } from './guide-links';
import type { ToolSeoEntry } from './tool-page';
import { TOOL_SEO_PAGES } from './tool-page';
import type { ToolGuide } from '@/tools/guides.types';

// 前缀与 href 拼法来自零依赖模块 ./guide-links（运行时的 tool.layout.vue 也要拼同一个
// 链接，不能为了一个常量把 TOOL_SEO_PAGES → 整个工具注册表拖进共享 chunk）。
// 这里再导出，既有引用方（GuideArticle.vue / entry-server）不必改导入路径。
export { GUIDE_PREFIX, guideArticlePath };
/**
 * 指南页进 sitemap 的**形状**条件（不是充分条件，见下）。
 *
 * 页面一律保持可访问与自指 canonical —— 这里只决定**要不要出现在 sitemap 里**。
 * 依据不是「字段存不存在」：所有文章的 about/faqs 字段都是齐的，字段存在性筛不掉任何东西。
 * 真正的门槛是两条**同时**成立：
 *   ① 形状：步骤 ≥2，且（有可照抄的示例 或 至少 1 条限制/坑说明）—— 就是下面这个常量；
 *   ② 实测信息增量：该篇相对其工具页的「新句占比」过 `scripts/build-seo.mjs`
 *      里的 `GUIDE_MIN_NOVEL_RATIO`（同一次渲染里量出来，不是抄的）。
 * 只做 ① 会把「换个标题重排一遍工具页文案」的页面推给爬虫单独发现，
 * 那是 pSEO 被判薄的典型形态。两条条件都只有**一处**：调阈值在这里和 build-seo，不用翻别的文件。
 */
export const GUIDE_INDEX_RULE = 'steps>=2 && (example || notes>=1) && novelRatio>=threshold';

function isIndexableGuide(guide: ToolGuide) {
  const steps = guide.steps?.length ?? 0;
  const notes = guide.notes?.length ?? 0;
  const hasExample = Boolean(guide.example?.text);
  return steps >= 2 && (hasExample || notes >= 1);
}

export interface GuideSection {
  id: string
  /** i18n 键后缀（`guideArticle.sections.<key>`）。 */
  key: string
  kind: 'prose' | 'list' | 'steps' | 'faqs' | 'example'
  text?: string
  /** example 一节：可直接照抄的输入原文（与工具页那个按钮填进去的是同一串字）。 */
  code?: string
  items?: string[]
  faqs?: { q: string; a: string }[]
}

export interface GuideArticlePage {
  /** 文章路由，不带尾斜杠。 */
  path: string
  /** 对应的工具路由，用来回链。 */
  toolPath: string
  slug: string
  entry: ToolSeoEntry
  sections: GuideSection[]
  /** 是否进 sitemap（见 GUIDE_INDEX_RULE）。为 false 的页面仍然可访问、仍然自指 canonical。 */
  indexable: boolean
}

/** 从 guide 现场组装文章分节；没有任何可写内容的工具不出文章页。 */
export function buildGuideSections(guide: ToolGuide): GuideSection[] {
  const sections: GuideSection[] = [];

  // about 讲「这个东西是什么」，intro 讲「这个工具能帮你干什么」。
  // 两个都有时合成一节，避免目录里出现两个都叫「是什么」的空洞小节。
  const what = [guide.about, guide.intro].filter(Boolean).join('\n\n');
  if (what) {
    sections.push({ id: 'what-it-is', key: 'what', kind: 'prose', text: what });
  }

  if (guide.steps?.length) {
    sections.push({ id: 'how-to-use', key: 'steps', kind: 'steps', items: guide.steps });
  }

  // 一键示例：把 guides 里那份 example 如实展示成「可以照抄的输入」，
  // 与工具页那个按钮填进去的是同一串字。
  if (guide.example?.text) {
    sections.push({
      id: 'worked-example',
      key: 'example',
      kind: 'example',
      text: guide.example.label,
      code: guide.example.text,
    });
  }

  if (guide.notes?.length) {
    sections.push({ id: 'gotchas', key: 'notes', kind: 'list', items: guide.notes });
  }

  if (guide.faqs?.length) {
    sections.push({ id: 'faq', key: 'faqs', kind: 'faqs', faqs: guide.faqs });
  }

  return sections;
}

/**
 * 全部文章页。只收录**有 guide 的工具** —— 没有说明的工具不生成空壳页面，
 * 那正是低价值 pSEO 的典型形态（宁缺勿滥）。
 */
export const GUIDE_ARTICLE_PAGES: GuideArticlePage[] = TOOL_SEO_PAGES
  .filter(entry => entry.guide !== null)
  .map((entry) => {
    const slug = entry.path.replace(/^\//, '');
    return {
      path: guideArticlePath(entry.path),
      toolPath: entry.path,
      slug,
      entry,
      sections: buildGuideSections(entry.guide as ToolGuide),
      indexable: isIndexableGuide(entry.guide as ToolGuide),
    };
  });

export function getGuideArticle(path: string): GuideArticlePage | undefined {
  return GUIDE_ARTICLE_PAGES.find(page => page.path === path);
}

/**
 * 构建期体检：文章页的数量与内容完整性。
 * 返回统计给 build-seo 打印，异常直接抛 —— 静默少渲染 100 个页面是最难发现的事故形态。
 */
export function auditGuideArticles() {
  const withGuide = TOOL_SEO_PAGES.filter(e => e.guide !== null);
  if (GUIDE_ARTICLE_PAGES.length !== withGuide.length) {
    throw new Error(
      `[guide-articles] 文章页数 ${GUIDE_ARTICLE_PAGES.length} ≠ 有 guide 的工具数 ${withGuide.length}`,
    );
  }

  const empty = GUIDE_ARTICLE_PAGES.filter(p => p.sections.length === 0).map(p => p.path);
  if (empty.length > 0) {
    throw new Error(`[guide-articles] 这些文章一节内容都没有：${empty.join(', ')}`);
  }

  const slugs = new Set(GUIDE_ARTICLE_PAGES.map(p => p.slug));
  if (slugs.size !== GUIDE_ARTICLE_PAGES.length) {
    throw new Error('[guide-articles] slug 出现重复，会产生互相覆盖的静态文件');
  }

  const excluded = GUIDE_ARTICLE_PAGES.filter(p => !p.indexable).map(p => p.path);
  return {
    total: GUIDE_ARTICLE_PAGES.length,
    indexable: GUIDE_ARTICLE_PAGES.length - excluded.length,
    excluded,
    rule: GUIDE_INDEX_RULE,
    toolTotal: TOOL_SEO_PAGES.length,
    withFaqs: GUIDE_ARTICLE_PAGES.filter(p => p.sections.some(s => s.kind === 'faqs')).length,
    avgSections: Number(
      (GUIDE_ARTICLE_PAGES.reduce((sum, p) => sum + p.sections.length, 0)
      / Math.max(1, GUIDE_ARTICLE_PAGES.length)).toFixed(2),
    ),
  };
}
