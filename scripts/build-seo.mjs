/**
 * 构建期预渲染 + sitemap 生成。
 *
 * 用法：`npm run build`（vite build 之后自动执行），或单独跑
 *   node scripts/build-seo.mjs
 *   node scripts/build-seo.mjs --dry-run   # 只渲染不落盘，用于排查
 *
 * 做法：起一个 middlewareMode 的 Vite dev server，用 ssrLoadModule 在 Node 里
 * 加载 src/entry-server.ts 渲染每条路由，再把结果注入 dist/index.html 模板，
 * 输出 dist/<route>/index.html。复用同一份 vite.config.ts，因此 ?raw / ?component
 * / unplugin 等全部生效，且不需要额外产出 SSR bundle。
 *
 * 预渲染范围（106 个页面）：
 *   - 静态页 5 个  ← src/seo/routes.ts   的 STATIC_ROUTES
 *   - 工具页 101 个 ← src/seo/tool-page.ts 的 TOOL_SEO_PAGES
 * 两处都是**单一事实来源**，本脚本不自己推导清单 —— 页面与 sitemap 用同一个数组，
 * 从根上避免「页面生成了但 sitemap 没有」或反之。
 *
 * 为什么同时生成 sitemap：sitemap 此前是手写的 public/sitemap.xml，与真实路由
 * 各存一份，已经悄悄漏掉了 3 个新建的法务页。改为构建期从同一份路由数据生成，
 * 从根上避免两边不一致。因此 public/sitemap.xml 已删除，不要再手工维护。
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parse } from 'yaml';
import { parseRegistry } from './lib/locale-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * 预渲染只渲染页面组件本身（不含 base.layout 的导航栏/侧边栏/页脚），
 * 因此初始 HTML 里没有站内导航 —— 爬虫只能靠 sitemap 发现其它页面。
 * 这里补一段静态页脚导航；客户端 mount 后会被真实页脚接管，链接集合一致。
 *
 * href 统一带尾斜杠，与 canonical / sitemap 保持一致（原因见 src/seo/site.ts）。
 *
 * ⚠ 文案必须取**默认 locale（en）**的词条，不能硬编码中文。
 *   2026-09-20 实测踩坑：这里原先写死「首页 / 关于 / 隐私政策 / 服务条款 / 联系我们」，
 *   而默认 locale 已是 en —— 结果是「爬虫与不执行 JS 的访问者看到中文页脚，
 *   执行 JS 的用户看到英文页脚」，同一页面两套语言。
 *   这与「只改 SSG 骨架不改客户端」是同一类缺陷（见 V2 方案 §5.6 / E1-L10N），
 *   只是方向相反。改为从 locales/en.yml 读，词条改了这里自动跟着变，不会漂移。
 */
/**
 * 语言注册表是唯一事实源：默认语言、已启用语言集合都从 src/i18n/languages.ts 读，
 * 不在脚本里写死 'en' / 只读 en+zh 两份（P1 报告 K1/K3）。
 */
const REGISTRY = parseRegistry(await readFile(join(root, 'src/i18n/languages.ts'), 'utf8'));
const DEFAULT_LOCALE = REGISTRY.defaultLocale;
const messages = parse(await readFile(join(root, `locales/${DEFAULT_LOCALE}.yml`), 'utf8'));
const label = (dotted) => {
  const v = dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), messages);
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`[build-seo] locales/${DEFAULT_LOCALE}.yml 缺少词条 ${dotted}（静态页脚要用）`);
  }
  return v;
};

/**
 * 另一份语言的词条存在性校验（只读，不参与渲染）。
 *
 * 预渲染只走默认语言，但**词条缺失**必须在构建期拦下：簇名是真页面上会渲染的文案，
 * 少一种语言时该语言的 workflow 区块标题会直接显示 key（`clusters.json`），
 * 界面上不报错、肉眼才看得见 —— 与 guides en/zh 不成对是同一类缺陷。
 */
/**
 * 每个已启用语言的词条表（注册表驱动）。
 *
 * 原实现只读 locales/zh.yml 并写一个 hasZh()，导致"第三种语言"永远不被检查
 * （P1 报告 K3）。现在按 ENABLED_LOCALES 逐个读，新增语言自动纳入所有判据。
 */
const MESSAGES_BY_LOCALE = Object.fromEntries(
  await Promise.all(REGISTRY.enabled.map(async (code) => [
    code,
    parse(await readFile(join(root, `locales/${code}.yml`), 'utf8')),
  ])),
);
const hasKey = (loc, dotted) => {
  const v = dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), MESSAGES_BY_LOCALE[loc]);
  return typeof v === 'string' && v.trim().length > 0;
};
// 与客户端真实页脚的链接集合一致：首页 / 关于 + 3 个法务页。
const FOOTER_LINKS = [
  { href: '/', text: label('home.home') },
  { href: '/about/', text: label('home.nav.aboutLabel') },
  { href: '/privacy/', text: label('legal.privacy') },
  { href: '/terms/', text: label('legal.terms') },
  { href: '/contact/', text: label('legal.contact') },
];

const STATIC_FOOTER = `
<footer class="dd-seo-footer" style="max-width:800px;margin:48px auto 0;padding:24px 16px;border-top:1px solid rgba(128,128,128,.25);font-size:14px;line-height:2">
  <nav>
${FOOTER_LINKS.map(l => `    <a href="${l.href}">${l.text}</a>`).join(' ·\n')}
  </nav>
</footer>`;

/** index.html 里由本脚本整体替换的区块（标题 / description / canonical / og / twitter）。 */
const PAGE_SEO_RE = /[ \t]*<!-- page-seo:start[\s\S]*?<!-- page-seo:end -->/;

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
});

/** 替换模板片段。headTags/正文里可能含 `$`，必须用函数式替换，否则会被当反向引用解释。 */
function replaceOnce(haystack, needle, value) {
  if (!haystack.includes(needle)) {
    throw new Error(`[build-seo] 模板里找不到待替换片段: ${needle.slice(0, 60)}`);
  }

  return haystack.replace(needle, () => value);
}

function buildSitemap(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(({ loc, changefreq }) => `  <url><loc>${loc}</loc><changefreq>${changefreq}</changefreq></url>`),
    '</urlset>',
    '',
  ];

  return lines.join('\n');
}

/**
 * 从 HTML 里取出可读文本，用于「正文到底进没进 HTML」的断言。
 *
 * 必须先反转义：Vue 的文本插值会把 `&` `<` `>` `"` `'` 转成实体，
 * 直接拿原文 includes(工具名) 会在名字含这些字符时误报失败。
 */
function textOf(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/[\s\u00a0\u200b]+/g, ' ')
    .trim();
}

/** 去掉所有空白后再比对，避免「名字里的空格 vs 换行」造成假阴性。 */
function squash(text) {
  return text.replace(/[\s\u00a0\u200b]/g, '');
}

/**
 * 剥掉渲染结果里的 HTML 注释。
 *
 * 为什么必须做：预渲染走的是 Vite dev server（`ssrLoadModule`），此时 Vue 的模板
 * 编译器处于非 production 模式，会**保留**模板里的 HTML 注释并把它们输出到结果里。
 * 客户端构建（production）默认丢弃注释，所以只有预渲染产物会带出来 ——
 * 也就是**恰好被抓取器读到的那份 HTML**。
 *
 * 实测：工具页骨架带出 9 条开发注释，首页带出 1012 条（首页那条是既有的，
 * 本轮核验时才量出来）。这些注释对页面毫无价值，只是把内部说明泄进线上源码。
 *
 * 注意：本项目不使用 IE 条件注释（`<!--[if IE]>`），因此整体剥离是安全的；
 * 若将来需要保留某类注释，必须改成本函数里的白名单，而不是放开这条。
 * 另外，`index.html` 模板里的 `<!-- page-seo:start/end -->` 标记不在渲染结果内，
 * 不会受影响。
 */
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * 工具页的 SoftwareApplication 结构化数据 —— 帮助搜索引擎理解
 * 「这是一个免费、无需安装、跑在浏览器里的工具页」。
 *
 * 放在构建期注入（而不是 useHead 客户端声明）有两个原因：
 *   1. 客户端接管后真实工具页组件不含 SEO head，注入的 script 会被移除；
 *      构建期写进初始 HTML 对抓取器最稳（本脚本的自检也会盯着它）。
 *   2. 数据直接取 TOOL_SEO_ENTRIES，与页面正文同一来源，不会出现两套事实。
 */
function buildSoftwareApplicationLd(entry, canonical) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: entry.name,
    url: canonical,
    description: entry.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
}

/**
 * 工具页的 BreadcrumbList 结构化数据。
 *
 * 只放「首页 → 当前工具」两级，不编造分类层级：本站**没有**分类落地页
 * （面包屑里的分类是纯文本，点不了），给它编一个 URL 会让结构化数据与站点
 * 实际结构不符 —— 那正是结构化数据最容易踩的坑。
 *
 * 与页面上的面包屑（ToolSeoPage / tool.layout）指向同一个事实：
 * 首页可达、当前页自指。
 */
function buildBreadcrumbLd(entry, canonical, homeUrl) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: homeUrl },
      { '@type': 'ListItem', position: 2, name: entry.name, item: canonical },
    ],
  });
}

/**
 * 工具页的 FAQPage 结构化数据。
 *
 * 只给配置了 guide.faqs 的工具页注入，且问题与答案取自 guides 数据本身 ——
 * 与页面正文（真实工具页 guide 面板 + 预渲染骨架）逐字同源。Google 要求
 * FAQ 内容必须对用户可见（折叠面板即满足），这里的问题在页面上确实由用户
 * 展开后可读，因此不算「结构化数据与页面内容不符」。
 */
/**
 * 全站 FAQ 页的 FAQPage —— 问答取自 src/seo/site-faqs.ts，
 * 与页面上渲染的是同一份数组；`{{count}}` 走同一个 fillSiteFaq，
 * 所以结构化数据里不会出现与页面不同的工具数。
 */

/**
 * 文章页的「信息增量」度量 —— sitemap 收录判据（实测驱动，不是字段存在性检查）。
 *
 * 做法：把文章与它对应的工具页都取可见文本，按句切分、归一化（去空白、比字符集），
 * 统计**没在工具页出现过的句子占比**。
 * 10-17 对 116 篇实测：min 0.20 / max 0.467，**没有任何一篇 >0.5**；
 * 也就是说按当前结构，每篇文章都有 >=53% 的句子与工具页逐字重复 ——
 * 「独立 URL」不等于「独立价值」。这条事实写在这里，是为了下一批别再拿
 * 「页面生成了」当收录理由；要真正独立，得把工具页正文收敛成操作面。
 */
const GUIDE_MIN_NOVEL_RATIO = 0.3;

function sentencesOf(html) {
  const text = textOf(html);
  return text
    .split(/(?<=[.!?。！？;；])\s+/)
    .map(s => s.replace(/[^0-9A-Za-z一-鿿]+/g, '').toLowerCase())
    .filter(s => s.length >= 12);
}

function novelRatioOf(articleHtml, toolHtml) {
  const article = sentencesOf(articleHtml);
  if (article.length === 0) {
    return 0;
  }
  const onTool = new Set(sentencesOf(toolHtml));
  const novel = article.filter(s => !onTool.has(s));
  return novel.length / article.length;
}

function buildSiteFaqPageLd({ faqs, fill, count }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: fill(a, count) },
    })),
  });
}

/**
 * 文章页的 Article 结构化数据。
 *
 * K2（2026-10-22）：`inLanguage` 原为字面量 `'en'`，与注册表脱钩 —— 若默认语言
 * 改成别的，生成的 JSON-LD 会继续谎报英文。改为 `DEFAULT_LOCALE`（由
 * `scripts/lib/locale-registry.mjs` 解析 `src/i18n/languages.ts` 得出），
 * 与预渲染语言单一事实源一致。
 */
function buildGuideArticleLd(page, canonical, origin) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.entry.h1,
    description: page.entry.description,
    inLanguage: DEFAULT_LOCALE,
    about: { '@type': 'SoftwareApplication', name: page.entry.name, url: origin + page.toolPath + '/' },
    url: canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  });
}

/** 文章页面包屑：首页 → 工具 → 指南。三级，工具页是它的父节点。 */
function buildGuideBreadcrumbLd(page, canonical, origin) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: page.entry.name, item: origin + page.toolPath + '/' },
      { '@type': 'ListItem', position: 3, name: page.entry.h1, item: canonical },
    ],
  });
}

function buildFaqPageLd(entry) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entry.guide.faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

try {
  // —— 全部从 TypeScript 侧取，保证与页面/路由使用同一份数据 ——
  const { canonicalUrl, SITE_ORIGIN } = await vite.ssrLoadModule('/src/seo/site.ts');
  const { STATIC_ROUTES } = await vite.ssrLoadModule('/src/seo/routes.ts');
  const { TOOL_SEO_PAGES, auditToolSeoData } = await vite.ssrLoadModule('/src/seo/tool-page.ts');
  // Keyword Map 的已落地 title 与 locales/en.yml 逐字比对：drift 即构建失败。
  // 判据全部在 src/seo/keyword-map.ts（不在本脚本里），⛔ 本脚本不改任何现有判据。
  const { auditKeywordMap } = await vite.ssrLoadModule('/src/seo/keyword-map.ts');
  const { SITE_FAQ_PATH, getSiteFaqs, fillSiteFaq } = await vite.ssrLoadModule('/src/seo/site-faqs.ts');
  const { GUIDE_ARTICLE_PAGES, auditGuideArticles } = await vite.ssrLoadModule('/src/seo/guide-articles.ts');
  const { scanGuideCrossLinks, scanToolEntryLinks, buildGuideEdgeMap, reachableFrom, guideArticlePath, missingLocaleKeys } = await vite.ssrLoadModule('/src/seo/guide-links.ts');
  const mod = await vite.ssrLoadModule('/src/entry-server.ts');

  // —— 数据体检：不通过就让构建失败，而不是少渲染几个页面还说成功 ——
  const audit = auditToolSeoData();
  console.log(
    `[tools] 可索引工具页 ${audit.total}：含使用说明 ${audit.withGuide}，`
    + `缺说明 ${audit.withoutGuide.length}`,
  );
  if (audit.withoutGuide.length > 0) {
    console.log(`[tools] 待补说明（正文仍有 H1/简介/描述，不虚构、不凑字数）: ${audit.withoutGuide.join(' ')}`);
  }
  console.log(`[tools] 知识内容覆盖：about ${audit.withAbout}/${audit.total}，faqs ${audit.withFaqs}/${audit.total}`);

  // 簇名必须在**每个已启用语言**里都有：预渲染只走默认语言，缺时该语言页面的
  // workflow 标题会直接显示成 `clusters.json`（不报错、只有肉眼可见），构建期拦死。
  for (const id of audit.clusterIds) {
    label(`clusters.${id}`);
    for (const code of REGISTRY.enabled) {
      if (code === DEFAULT_LOCALE) continue;
      if (!hasKey(code, `clusters.${id}`)) {
        throw new Error(`[build-seo] locales/${code}.yml 缺少词条 clusters.${id}（${DEFAULT_LOCALE} 有、${code} 没有）`);
      }
    }
  }
  console.log(
    `[tools] 任务簇覆盖：${audit.withCluster}/${audit.total} 个工具页有工作流区块`
    + `（簇 ${audit.clusterIds.length} 个：${audit.clusterIds.join(', ')}）`,
  );

  // Keyword Map 体检：锁定 title 漂移 + 路径/取值域/文章 slug。不通过直接抛错。
  const toolTitles = Object.fromEntries(
    Object.entries(messages.tools ?? {}).map(([key, value]) => [key, value?.title]),
  );
  const kwAudit = auditKeywordMap(toolTitles);
  console.log(
    `[keyword-map] ${kwAudit.total} 行已入库：title 锁定 ${kwAudit.lockedTitles} 条，`
    + `待落地 ${kwAudit.pendingTitles.length} 条，配文章 ${kwAudit.withArticle} 条，`
    + `搜索量 ${kwAudit.searchVolume}（口径：全部 N/A，无 Keyword Planner 权限，禁止当流量预测）`,
  );
  console.log(`[keyword-map] 优先级分布 ${kwAudit.byPriority.join(' ')}｜搜索量 ${kwAudit.searchVolume}`);

  const staticPaths = new Set(STATIC_ROUTES.map(({ path }) => path));
  const collide = TOOL_SEO_PAGES.filter(({ path }) => staticPaths.has(path));
  if (collide.length > 0) {
    throw new Error(`[build-seo] 工具路径与静态路由冲突: ${collide.map(e => e.path).join(', ')}`);
  }

  const template = await readFile(join(root, 'dist/index.html'), 'utf8');

  // 幂等保护：本脚本会把预渲染结果写回 dist/index.html。若 dist/index.html 已经被
  // 预渲染过（#app 不再是空壳），再跑一次就会拿「已渲染的页面」当模板，
  // 结果是把首页内容灌进 /privacy 等页面 —— 实测踩过，必须直接报错而不是静默产出。
  if (!template.includes('<div id="app"></div>')) {
    throw new Error(
      '[build-seo] dist/index.html 已含预渲染内容，不能重复使用。请先重新执行 npm run build（vite 会重建 dist），再跑本脚本。',
    );
  }
  if (!PAGE_SEO_RE.test(template)) {
    throw new Error(
      '[build-seo] index.html 里找不到 <!-- page-seo:start --> 区块。'
      + '页面级 head 标签必须写在区块内，否则预渲染时不会被逐页替换。',
    );
  }
  const pageSeoBlock = template.match(PAGE_SEO_RE)[0];

  // —— 待渲染清单：静态页 + 工具页，来自两个单一事实来源 ——
  const jobs = [
    ...STATIC_ROUTES.map(({ path, changefreq }) => ({ path, changefreq, kind: 'static' })),
    ...TOOL_SEO_PAGES.map(({ path }) => ({ path, changefreq: 'monthly', kind: 'tool' })),
    ...GUIDE_ARTICLE_PAGES.map(({ path }) => ({ path, changefreq: 'monthly', kind: 'guide' })),
  ];

  const results = [];
  for (const job of jobs) {
    const r = job.kind === 'tool'
      ? await mod.renderTool(job.path)
      : job.kind === 'guide'
        ? await mod.renderGuideArticle(job.path)
        : await mod.render(job.path);
    const { html = '', headTags = '' } = r ?? {};
    if (!html) {
      throw new Error(`[build-seo] ${job.path} 渲染结果为空`);
    }
    results.push({ ...job, html, headTags });
  }

  // —— 文章页信息增量实测：拿同一份渲染结果里的工具页与文章页比句子 ——
  const rendered = new Map(results.map(item => [item.path, item.html]));
  const guideNovel = {};
  for (const page of GUIDE_ARTICLE_PAGES) {
    guideNovel[page.path] = novelRatioOf(rendered.get(page.path) ?? '', rendered.get(page.toolPath) ?? '');
  }
  const ratios = Object.values(guideNovel);
  const novelPass = GUIDE_ARTICLE_PAGES.filter(p => p.indexable && guideNovel[p.path] >= GUIDE_MIN_NOVEL_RATIO);
  console.log(
    `[guides] 信息增量实测：min ${(Math.min(...ratios) * 100).toFixed(1)}%`
    + ` / 中位 ${(ratios.slice().sort((a, b) => a - b)[ratios.length >> 1] * 100).toFixed(1)}%`
    + ` / max ${(Math.max(...ratios) * 100).toFixed(1)}%`
    + `；过门槛(>=${GUIDE_MIN_NOVEL_RATIO * 100}%)且形状合格的 ${novelPass.length}/${GUIDE_ARTICLE_PAGES.length} 篇进 sitemap`,
  );
  const notIndexed = GUIDE_ARTICLE_PAGES.filter(p => !novelPass.includes(p));
  // 每篇被排除都要说清是**哪一条**没过：只看总比例会把「形状不合格但增量很高」
  // 和「形状合格但和工具页几乎逐字重复」混成一堆，人工复核就没法判。
  const excludedDetail = notIndexed.map((p) => {
    const ratio = guideNovel[p.path];
    const shapePass = p.indexable;
    const novelPasses = ratio >= GUIDE_MIN_NOVEL_RATIO;
    return {
      route: p.path,
      path: canonicalUrl(p.path),
      novelRatio: ratio,
      shapePass,
      reason: !shapePass && !novelPasses ? 'shape+novelty' : shapePass ? 'novelty' : 'shape',
    };
  });
  const excludedByShape = excludedDetail.filter(e => !e.shapePass).length;
  console.log(`[guides] 暂不收录 ${notIndexed.length} 篇（仍可访问、canonical 自指）`
    + `；其中形状条件未过 ${excludedByShape} 篇`);
  if (excludedDetail.length > 0) {
    console.log(
      `[guides] 暂不收录清单(带实测值与原因): `
      + excludedDetail.map(e => `${e.route.replace('/guides/', '')}=${(e.novelRatio * 100).toFixed(0)}%/${e.reason}`).join(' '),
    );
  }

  // —— 文章互链完整性（软 404 判据）——
  // 指向 /guides/<x> 的链接必须对应一篇真的生成了的文章。这一刻手里有全量清单和全量 HTML，
  // 是成本最低的判定时机；放过去就得靠线上巡检，而软 404 恰恰是爬虫会反复抓的那类。
  //
  // 证伪开关：`GUIDE_FAKE_DANGLING=1 npm run build` 往第一篇文章里塞一条指向不存在
  // 文章的链接，这条判据**必须**让构建失败。没有这一步，「今天没报」和「判据是摆设」
  // 在日志里长得一模一样（纯函数那侧已有 5 条单测含对照组，这里证的是调用点真的接上了）。
  if (process.env.GUIDE_FAKE_DANGLING === '1') {
    const victim = GUIDE_ARTICLE_PAGES[0].path;
    rendered.set(victim, `${rendered.get(victim)}<a href="/guides/zz-seeded-dangling">seed</a>`);
    console.log(`[guides] 证伪模式：已向 ${victim} 注入一条悬空互链，构建应当失败`);
  }
  const linkScan = scanGuideCrossLinks(
    GUIDE_ARTICLE_PAGES,
    pagePath => rendered.get(pagePath) ?? '',
  );
  const linkCheckedSum = Object.values(linkScan.perPage).reduce((a, b) => a + b, 0);
  if (linkCheckedSum !== linkScan.checked) {
    throw new Error(`[build-seo] 互链自洽核对失败：逐页合计 ${linkCheckedSum} ≠ 总数 ${linkScan.checked}`);
  }
  if (linkScan.checked === 0) {
    // 「扫到 0 条」不是干净，是判据没吃到数据 —— 宁可红，不许绿。
    throw new Error('[build-seo] 文章互链扫描一条链接都没匹配到，判据失效（href 形状变了？先量 dist/guides/*/index.html）');
  }
  if (linkScan.dangling.length > 0) {
    throw new Error(
      `[build-seo] ${linkScan.dangling.length}/${linkScan.checked} 条文章互链指向不存在的文章页（软 404）：`
      + `${linkScan.dangling.slice(0, 8).join(', ')}`,
    );
  }
  console.log(`[guides] 文章互链 ${linkScan.checked} 条全部命中已生成的文章页`);

  const sitemapEntries = [
    ...STATIC_ROUTES.map(({ path, changefreq }) => ({ loc: canonicalUrl(path), changefreq })),
    ...TOOL_SEO_PAGES.map(({ path }) => ({ loc: canonicalUrl(path), changefreq: 'monthly' })),
    // 收录 = 形状下限（guide-articles 的 GUIDE_INDEX_RULE）**且**实测信息增量过门槛。
    // 页面本身一律仍可访问、canonical 自指；这里只决定要不要交给搜索引擎发现。
    // 直接复用上面打印过的 novelPass —— 判据只有一处，打印的数字与实际进 sitemap 的条目
    // 不可能各说各话（写两遍同样的 filter，改一处就会悄悄不一致）。
    ...novelPass.map(({ path }) => ({ loc: canonicalUrl(path), changefreq: 'monthly' })),
  ];

  // —— F1：工具页 → 文章页的入口链接（爬虫发现路径上缺的那条边）——
  // 判的是**预渲染骨架**，不是 hydration 之后的 DOM：这条边存在的唯一理由就是让不执行 JS
  // 的抓取器能从工具页走到文章页。运行时才出现的链接对爬虫等于不存在。
  //
  // 证伪开关：`GUIDE_FAKE_UNLINKED=1 npm run build` 把第一个工具页 HTML 里的入口链接剥掉，
  // 这条判据必须让构建失败（纯函数那侧有带对照组的单测，这里证的是调用点真的接上）。
  const articlePaths = GUIDE_ARTICLE_PAGES.map(p => p.path);
  if (process.env.GUIDE_FAKE_UNLINKED === '1') {
    const victim = TOOL_SEO_PAGES.find(t => articlePaths.includes(guideArticlePath(t.path)));
    const html = rendered.get(victim.path) ?? '';
    const stripped = html.replace(/<a[^>]*href="\/guides\/[a-z0-9-]+\/?"[^>]*>[\s\S]*?<\/a>/, '<!-- seeded: entry link removed -->');
    if (stripped === html) {
      throw new Error(`[build-seo] 证伪模式失败：${victim.path} 的 HTML 里找不到入口链接可剥（判据本身可能空转）`);
    }
    rendered.set(victim.path, stripped);
    console.log(`[guides] 证伪模式：已从 ${victim.path} 剥掉指南入口链接，构建应当失败`);
  }
  const entryScan = scanToolEntryLinks(TOOL_SEO_PAGES, path => rendered.get(path) ?? '', articlePaths);
  if (entryScan.expected === 0) {
    throw new Error('[build-seo] 入口链接判据没吃到任何数据（expected=0）—— 文章页清单或工具页清单读空了，不许当通过');
  }
  if (entryScan.dangling.length > 0) {
    throw new Error(`[build-seo] 工具页里的指南链接指向未生成的文章：${entryScan.dangling.slice(0, 8).join(', ')}`);
  }
  if (entryScan.missing.length > 0) {
    throw new Error(
      `[build-seo] ${entryScan.missing.length}/${entryScan.expected} 个工具页的初始 HTML 没有指向自己指南文章的入口链接：`
      + `${entryScan.missing.slice(0, 8).join(', ')}（预渲染骨架与真实面板必须同时有这条链接）`,
    );
  }
  if (entryScan.linked !== entryScan.expected) {
    throw new Error(`[build-seo] 入口链接自洽核对失败：linked=${entryScan.linked} ≠ expected=${entryScan.expected}`);
  }
  console.log(`[guides] 工具页入口链接 ${entryScan.linked}/${entryScan.expected} 全部就位`);

  // —— 两侧同源的机器判据（预渲染骨架 ↔ hydration 后的真实面板）——
  // 这条边写在两个文件里：src/seo/ToolSeoPage.vue（给爬虫）与 src/layouts/tool.layout.vue（给用户）。
  // 任何一侧被改成写死字面量、或各拼各的 href，构建期就该炸 —— 靠人眼盯两个 .vue 迟早会漏，
  // 而「骨架有、面板没有」这种漂移正好违反本项目红线（给抓取器看的每句都得真实可见）。
  const [skeletonSrc, panelSrc] = await Promise.all([
    readFile(join(root, 'src/seo/ToolSeoPage.vue'), 'utf8'),
    readFile(join(root, 'src/layouts/tool.layout.vue'), 'utf8'),
  ]);
  for (const [who, src] of [['src/seo/ToolSeoPage.vue（骨架）', skeletonSrc], ['src/layouts/tool.layout.vue（面板）', panelSrc]]) {
    if (!src.includes('seo.guideArticleLink')) {
      throw new Error(`[build-seo] ${who} 没有引用 i18n 键 seo.guideArticleLink —— 两侧不再同源，文案会各漂各的`);
    }
    if (!src.includes('guideArticleHref(')) {
      throw new Error(`[build-seo] ${who} 没有用 guideArticleHref() 拼链接 —— href 一旦各写一份，两侧就可能指到不同 URL`);
    }
  }
  // 行为侧再核一次：骨架里渲染出来的确实是这条词条解析后的文字（不是键名漏翻、不是空串）
  const entryLabel = label('seo.guideArticleLink');
  if (!entryLabel || entryLabel.includes('guideArticleLink')) {
    throw new Error(`[build-seo] seo.guideArticleLink 没解析出文案，拿到的是「${entryLabel}」`);
  }
  // 归一化比较而不是拼正则：词条里将来可能有 - ( ) 这类元字符，拼进 RegExp 就是自找的运行期炸点
  const squeeze = s => s.replace(/>\s+/g, '>').replace(/\s+</g, '<');
  const labelMissing = TOOL_SEO_PAGES
    .filter(t => articlePaths.includes(guideArticlePath(t.path)))
    .filter(t => !squeeze(rendered.get(t.path) ?? '').includes(`>${entryLabel}<`))
    .map(t => t.path);
  if (labelMissing.length > 0) {
    throw new Error(
      `[build-seo] ${labelMissing.length} 个工具页骨架里的入口链接文案不是 seo.guideArticleLink 的原文：`
      + `${labelMissing.slice(0, 6).join(', ')}（期望文案「${entryLabel}」）`,
    );
  }
  console.log(`[guides] 骨架与面板同源：两侧都引用 seo.guideArticleLink + guideArticleHref，${entryScan.expected} 页文案逐字一致`);
  // 中文侧也必须有这条词条：骨架恒按 en 预渲染，zh 缺键时英文页一切正常、
  // 中文页把键名 `seo.guideArticleLink` 直接渲染到 116 个工具页上。
  const localeGaps = missingLocaleKeys(['seo.guideArticleLink', 'seo.guideSummary', 'seo.faqTitle'], MESSAGES_BY_LOCALE);
  if (localeGaps.length > 0) {
    throw new Error(`[build-seo] 指南入口相关词条两种语言不齐全：${localeGaps.map(g => `${g.key} 缺 ${g.missingIn}`).join(', ')}`);
  }
  console.log('[guides] 词条成对：入口文案在 en / zh 两侧都在（缺一种就会在另一种语言的页面上漏出键名）');

  // —— 示例填充的两条防漂移判据（applyExample 的「逐字核对」靠它们才成立）——
  // ① 期望值清单必须与 guides.en.ts 同步：引擎在浏览器外拿不到 TS，只能用派生物，
  //    派生物过期 = 「拿旧文案去核对新页面」，那种红/绿都不可信。
  const exampleFixtureFile = join(root, 'scripts/smoke-fixtures/example-values.json');
  const exampleExpect = existsSync(exampleFixtureFile)
    ? JSON.parse(await readFile(exampleFixtureFile, 'utf8')).values
    : null;
  if (!exampleExpect) {
    throw new Error('[build-seo] 缺 scripts/smoke-fixtures/example-values.json —— 跑 node scripts/gen-example-values.mjs 生成');
  }
  const withExample = TOOL_SEO_PAGES.filter(e => e.guide?.example?.text);
  const stale = [];
  for (const e of withExample) {
    if (exampleExpect[e.path] !== e.guide.example.text) {
      stale.push(e.path);
    }
  }
  const extraKeys = Object.keys(exampleExpect).filter(k => !withExample.some(e => e.path === k));
  if (stale.length > 0 || extraKeys.length > 0) {
    throw new Error(
      `[build-seo] 示例期望值清单与 guides.en.ts 不一致：待更新 ${stale.length} 条(${stale.slice(0, 5).join(', ')})`
      + `、多余 ${extraKeys.length} 条(${extraKeys.slice(0, 5).join(', ')}) —— 重新生成 example-values.json`,
    );
  }
  // ② 引擎复刻的「主输入控件」取法必须与应用 findPrimaryInput 的兜底选择器一致。
  //    两边不一致 = 验的框不是填的框，会出现「填对了却判红」或反过来「填错框也没抓到」。
  const layoutSrc = await readFile(join(root, 'src/layouts/tool.layout.vue'), 'utf8');
  const engineSrc = await readFile(join(root, 'scripts/smoke-tools.mjs'), 'utf8');
  const PRIMARY_SELECTOR = 'input[type="text"], input[type="search"], input[type="number"], input:not([type])';
  for (const [who, src] of [['tool.layout.vue（应用真正填的框）', layoutSrc], ['smoke-tools.mjs（冒烟验的框）', engineSrc]]) {
    if (!src.includes(PRIMARY_SELECTOR)) {
      throw new Error(
        `[build-seo] ${who} 里没有 findPrimaryInput 的那串选择器（${PRIMARY_SELECTOR}）—— `
        + '两边一旦漂移，冒烟验的控件就不是应用填的控件',
      );
    }
  }
  console.log(
    `[examples] 示例期望值与 guides.en.ts 同步（${withExample.length} 条），`
    + '且应用与冒烟对「主输入控件」的取法一致',
  );

  // —— F2：可达性按**全部 116 篇**算，不是只算进了 sitemap 的那 81 篇 ——
  // 只喂收录清单会让「未收录 = 不存在」被静默写进结论，孤岛数量永远比真实情况好看。
  // 种子 = 爬虫真正能拿到的起点（sitemap 全部条目）；节点 = 全部文章页。
  const allPages = results.map(item => ({ path: item.path }));
  const siteEdges = buildGuideEdgeMap(allPages, path => rendered.get(path) ?? '');
  const seedPaths = sitemapEntries.map(e => {
    const raw = e.loc.replace(/^https?:\/\/[^/]+/, '');
    return raw.replace(/\/$/, '') || '/';
  });
  const reachable = reachableFrom(seedPaths, siteEdges, articlePaths);
  const orphans = articlePaths.filter(p => !reachable.has(p));
  if (orphans.length > 0) {
    throw new Error(`[build-seo] ${orphans.length} 篇指南文章从任何发现起点都到不了（孤岛）：${orphans.slice(0, 8).join(', ')}`);
  }
  // 反事实：把工具→文章这条边拿掉，孤岛会是多少 —— 用来说明 F1 这条边的实际作用
  const articleOnlyEdges = buildGuideEdgeMap(GUIDE_ARTICLE_PAGES, path => rendered.get(path) ?? '');
  const reachableNoToolEdge = reachableFrom(seedPaths, articleOnlyEdges, articlePaths);
  const orphansNoToolEdge = articlePaths.filter(p => !reachableNoToolEdge.has(p));
  console.log(
    `[guides] 可达性：${reachable.size}/${articlePaths.length} 篇可发现，孤岛 0；`
    + `反事实（去掉工具页入口这条边）孤岛 ${orphansNoToolEdge.length} 篇`,
  );

  // —— sitemap 自检 ——
  const seen = new Set();
  for (const { loc } of sitemapEntries) {
    if (!loc.endsWith('/')) {
      throw new Error(`[build-seo] sitemap 条目未以 / 结尾（与 canonical 形式不一致）: ${loc}`);
    }
    if (seen.has(loc)) {
      throw new Error(`[build-seo] sitemap 出现重复条目: ${loc}`);
    }
    seen.add(loc);
  }
  if (TOOL_SEO_PAGES.length === 0) {
    throw new Error('[build-seo] 未取到任何工具页，src/seo/tool-page.ts 的解析可能已失效');
  }

  await vite.close();

  if (!DRY_RUN) {
    // public/sitemap.xml 已删除，构建期唯一产物就是 dist/sitemap.xml
    await rm(join(root, 'dist/sitemap.xml'), { force: true });
    await writeFile(join(root, 'dist/sitemap.xml'), buildSitemap(sitemapEntries), 'utf8');
  }

  const guideAudit = auditGuideArticles();
  console.log(
    `[guides] 文章页 ${guideAudit.total}/${guideAudit.toolTotal} 个工具（只给有使用说明的工具出文章），`
    + `含 FAQ ${guideAudit.withFaqs} 篇，平均 ${guideAudit.avgSections} 节/篇`,
  );
  // 收录是策略不是必然：打印进/不进 sitemap 的数量与被排除清单，逼人工复核看得见。
  // 这里必须用 novelPass（形状 + 实测增量两条一起过）而不是 guideAudit.indexable（只有形状），
  // 否则这行日志会和它自己刚写出去的 sitemap 各说各话。
  console.log(
    `[guides] sitemap 收录 ${novelPass.length} 篇、暂不收录 ${notIndexed.length} 篇`
    + `（规则 ${guideAudit.rule}，实测门槛 ${GUIDE_MIN_NOVEL_RATIO * 100}%；不收录的页面仍然可访问）`,
  );
  // 清单只打印一次（带实测值与原因，见上面 excludedDetail）；两处各列一份
  // 迟早会一份新一份旧，读的人不知道信哪个。
  console.log(
    `[sitemap] 静态 ${STATIC_ROUTES.length} + 工具 ${TOOL_SEO_PAGES.length}`
    + ` + 指南 ${novelPass.length}/${GUIDE_ARTICLE_PAGES.length}（生成的文章页里过收录门槛的才进）`
    + ` = ${sitemapEntries.length} 条（重定向源不收录，未收录 /legacy/*）`,
  );

  // 把这次收录决策落成机器可读的产物：静态检查（verify 脚本）因此不必自己重算正则，
  // 只要比对 sitemap 与这份清单；实测值也留在里面，改门槛时能看见当初是按什么定的。
  //
  // 刻意写在 dist **外面**：dist 整个会被部署，`/guides/_index-policy.json` 会变成
  // 任何人都能取到的公开文件（把我们自己的重复度实测值发给竞争对手和爬虫）。
  if (!DRY_RUN) {
    const policy = {
      generatedAt: new Date().toISOString(),
      rule: guideAudit.rule,
      minNovelRatio: GUIDE_MIN_NOVEL_RATIO,
      measured: {
        min: Math.min(...ratios),
        median: ratios.slice().sort((a, b) => a - b)[ratios.length >> 1],
        max: Math.max(...ratios),
      },
      generated: GUIDE_ARTICLE_PAGES.length,
      indexed: novelPass.map(p => canonicalUrl(p.path)),
      excluded: excludedDetail,
      excludedTally: excludedDetail.reduce((acc, e) => {
        acc[e.reason] = (acc[e.reason] || 0) + 1;
        return acc;
      }, {}),
      crossLinkScan: { checked: linkScan.checked, dangling: linkScan.dangling },
      entryLinks: {
        expected: entryScan.expected,
        linked: entryScan.linked,
        missing: entryScan.missing,
        dangling: entryScan.dangling,
      },
      reachability: {
        nodes: articlePaths.length,
        seeds: seedPaths.length,
        reachable: reachable.size,
        orphans,
        orphansWithoutToolEdges: orphansNoToolEdge.length,
      },
    };
    const policyFile = join(root, '.build/guides-index-policy.json');
    await mkdir(dirname(policyFile), { recursive: true });
    await writeFile(policyFile, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
  }

  let thinPages = 0;
  for (const { path, kind, html: rawHtml, headTags } of results) {
    const canonical = canonicalUrl(path);
    // 先剥注释再注入：dev 模式下 Vue 会把模板注释输出到渲染结果里（见 stripComments）
    const html = stripComments(rawHtml);
    // 工具页在 page-seo 区块尾部追加 SoftwareApplication / BreadcrumbList JSON-LD（见函数注释）
    // 注意 faqs 挂在 entry.guide.faqs（ToolGuide 的字段），不是 entry.faqs
    const entry = kind === 'tool' ? TOOL_SEO_PAGES.find(item => item.path === path) : undefined;
    let pageTags = kind === 'tool'
      ? `${headTags}`
        + `\n      <script type="application/ld+json">${buildSoftwareApplicationLd(entry, canonical)}</script>`
        + `\n      <script type="application/ld+json">${buildBreadcrumbLd(entry, canonical, SITE_ORIGIN + '/')}</script>`
      : headTags;
    const guidePage = kind === 'guide' ? GUIDE_ARTICLE_PAGES.find(item => item.path === path) : undefined;
    if (guidePage) {
      pageTags += `\n      <script type="application/ld+json">${buildGuideArticleLd(guidePage, canonical, SITE_ORIGIN)}</script>`;
      pageTags += `\n      <script type="application/ld+json">${buildGuideBreadcrumbLd(guidePage, canonical, SITE_ORIGIN)}</script>`;
      if (guidePage.sections.some(s => s.kind === 'faqs')) {
        pageTags += `\n      <script type="application/ld+json">${buildFaqPageLd(guidePage.entry)}</script>`;
      }
    }
    if (kind === 'static' && path === SITE_FAQ_PATH) {
      pageTags += `\n      <script type="application/ld+json">${buildSiteFaqPageLd({ faqs: getSiteFaqs(DEFAULT_LOCALE), fill: fillSiteFaq, count: TOOL_SEO_PAGES.length })}</script>`;
    }
    if (entry?.guide?.faqs?.length) {
      pageTags += `\n      <script type="application/ld+json">${buildFaqPageLd(entry)}</script>`;
    }
    const out = replaceOnce(
      replaceOnce(
        template,
        '<div id="app"></div>',
        `<div id="app">${html}${STATIC_FOOTER}</div>`,
      ),
      pageSeoBlock,
      `<!-- page-seo:start -->\n${pageTags}\n      <!-- page-seo:end -->`,
    );

    const file = path === '/' ? join(root, 'dist/index.html') : join(root, 'dist', path, 'index.html');

    // 逐页自检：title 只能有一条、canonical 必须自指、description 必须存在。
    // 这些正是「改了页面却忘了更新 head」最容易静默出错的地方。
    const titleCount = (out.match(/<title[\s>]/gi) ?? []).length;
    const canonicalCount = (out.match(/rel=["']canonical["']/gi) ?? []).length;
    const hasDescription = /<meta[^>]+name=["']description["']/i.test(out);
    const hasAdsense = out.includes('ca-pub-7944759654100814');

    const problems = [];
    if (titleCount !== 1) { problems.push(`title=${titleCount}`); }
    if (canonicalCount !== 1) { problems.push(`canonical=${canonicalCount}`); }
    if (!hasDescription) { problems.push('description 缺失'); }
    if (!hasAdsense) { problems.push('AdSense 丢失'); }
    if (!out.includes(`rel="canonical" href="${canonical}"`) && !out.includes(`rel='canonical' href='${canonical}'`)) {
      problems.push(`canonical 未自指(${canonical})`);
    }
    // 注释必须在注入前剥净：漏掉不影响功能，但会把开发注释泄进线上源码
    if (html.includes('<!--')) {
      problems.push('正文里残留 HTML 注释');
    }

    // 工具页额外断言「正文真的进到 HTML 里了」：H1 与工具名必须在 #app 内出现。
    // 少了这条，一旦 #app 替换失效（模板变更等），构建仍然全绿但产出全是空壳。
    const bodyRaw = textOf(html);
    const bodyText = bodyRaw.length;
    if (kind === 'guide') {
      const gp = GUIDE_ARTICLE_PAGES.find(item => item.path === path);
      if (!out.includes('<h1')) { problems.push('文章页缺 H1'); }
      // 反向断言：FAQPage 只能出现在真的有 faqs 小节的页面上 —— 缺这条就会「超发」，
      // 而超发的结构化数据与正文不一致，是搜索结果里最容易被判低质的形态。
      const hasFaqBlock = gp?.sections.some(s => s.kind === 'faqs');
      if (hasFaqBlock && !out.includes('"@type":"FAQPage"')) { problems.push('文章页 FAQPage JSON-LD 缺失'); }
      if (!hasFaqBlock && out.includes('"@type":"FAQPage"')) { problems.push('文章页 FAQPage JSON-LD 超发'); }
      if (!gp || bodyText < 600) { problems.push(`文章页正文过短(${bodyText})`); }
      // H1 比对必须走「可见文本」而不是原始 HTML：`/guides/jwt-parser` 的 h1 是
      // `JWT Decoder & Parser`，插值进 HTML 后 `&` 变成 `&amp;`，
      // 拿 raw HTML 做子串比对会把正常页面判成缺陷（本批次实测踩过一次）。
      if (gp?.entry.h1 && !squash(bodyRaw).includes(squash(gp.entry.h1))) { problems.push('文章页 H1 与数据不一致'); }
      // 与工具页同一条同源判据：FAQ 结构化数据里的问题必须真的在正文里。
      if (gp?.entry.guide?.faqs?.length) {
        const squashedGuideBody = squash(bodyRaw);
        for (const { q } of gp.entry.guide.faqs) {
          if (!squashedGuideBody.includes(squash(q))) {
            problems.push(`文章页 FAQ 问题不在正文中: ${q}`);
            break;
          }
        }
      }
    }
    if (kind === 'tool') {
      const entry = TOOL_SEO_PAGES.find(item => item.path === path);
      if (!/<h1[\s>]/i.test(html)) { problems.push('缺少 H1'); }
      if (!squash(bodyRaw).includes(squash(entry.name))) {
        problems.push(`正文里找不到工具名(${entry.name})`);
      }
      if (bodyText < 60) { problems.push(`正文过短 text=${bodyText}`); }
      // SoftwareApplication JSON-LD 必须真的进了初始 HTML（防 replaceOnce 静默失效）
      if (!out.includes('"@type":"SoftwareApplication"')) { problems.push('JSON-LD 缺失'); }
      // 面包屑结构化数据同上：注入链路任何一环断了，这里都会红。
      if (!out.includes('"@type":"BreadcrumbList"')) { problems.push('BreadcrumbList JSON-LD 缺失'); }
      // 工作流区块：配了簇就必须真的把链条渲染进正文（防「数据有了、模板没输出」）
      if (entry.cluster) {
        const clusterLabel = label(`clusters.${entry.cluster}`);
        if (!squash(bodyRaw).includes(squash(clusterLabel))) {
          problems.push(`workflow 簇名不在正文中(${clusterLabel})`);
        }
        if (html.split('dd-tool-workflow').length - 1 !== 1) {
          problems.push('workflow 区块数量异常');
        }
        for (const node of entry.workflow) {
          if (!squash(bodyRaw).includes(squash(node.name))) {
            problems.push(`workflow 节点不在正文中(${node.name})`);
          }
        }
      }
      // 配了 FAQ 的页面必须带 FAQPage JSON-LD；反之没配的页面不允许出现。
      // 判据字段同样是 entry.guide.faqs —— 这两处曾一致地写错成 entry.faqs，
      // 结果「缺注入」和「防缺注入的检查」一起静默跳过；现在构建日志会打印
      // withFaqs 覆盖数，0 而数据源里有 FAQ 时肉眼立刻能看出来。
      if (entry.guide?.faqs?.length && !out.includes('"@type":"FAQPage"')) { problems.push('FAQPage JSON-LD 缺失'); }
      if (!entry.guide?.faqs?.length && out.includes('"@type":"FAQPage"')) { problems.push('FAQPage JSON-LD 超发'); }
      // FAQ 问答与页面正文必须同源：结构化数据里的问题要能在骨架正文中找到
      if (entry.guide?.faqs?.length) {
        const squashedBody = squash(bodyRaw);
        for (const { q } of entry.guide.faqs) {
          if (!squashedBody.includes(squash(q))) {
            problems.push(`FAQ 问题不在正文中: ${q}`);
            break;
          }
        }
      }
    }

    if (problems.length > 0) {
      throw new Error(`[build-seo] ${path} 自检未通过: ${problems.join(', ')}`);
    }

    if (!DRY_RUN) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, out, 'utf8');
    }

    if (bodyText < 200) { thinPages += 1; }

    console.log(
      `[build-seo] ${path.padEnd(42)} html=${String(html.length).padStart(6)}B`
      + `  text=${String(bodyText).padStart(5)}  canonical=${canonical}`,
    );
  }

  console.log(
    `[build-seo] 完成：${results.length} 个页面（静态 ${STATIC_ROUTES.length} + 工具 ${TOOL_SEO_PAGES.length} + 指南 ${GUIDE_ARTICLE_PAGES.length}）`
    + ` + sitemap（${sitemapEntries.length} 条）。站点源 ${SITE_ORIGIN}`,
  );
  console.log(`[build-seo] 其中正文 < 200 字符的页面：${thinPages} 个（工具页正文不含折叠的使用说明）`);
} catch (err) {
  await vite.close().catch(() => {});
  console.error('[build-seo] FAILED:', err);
  process.exit(1);
}
