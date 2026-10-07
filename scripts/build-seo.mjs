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
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parse } from 'yaml';

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
const DEFAULT_LOCALE = 'en';
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
const messagesZh = parse(await readFile(join(root, 'locales/zh.yml'), 'utf8'));
const hasZh = (dotted) => {
  const v = dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), messagesZh);
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

  // 簇名必须两种语言都有：预渲染只走 en，缺 zh 时中文页面的 workflow 标题会直接
  // 显示成 `clusters.json`（不报错、只有肉眼可见），所以在构建期拦死。
  for (const id of audit.clusterIds) {
    label(`clusters.${id}`);
    if (!hasZh(`clusters.${id}`)) {
      throw new Error(`[build-seo] locales/zh.yml 缺少词条 clusters.${id}（en 有、zh 没有）`);
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
  ];

  const results = [];
  for (const job of jobs) {
    const r = job.kind === 'tool' ? await mod.renderTool(job.path) : await mod.render(job.path);
    const { html = '', headTags = '' } = r ?? {};
    if (!html) {
      throw new Error(`[build-seo] ${job.path} 渲染结果为空`);
    }
    results.push({ ...job, html, headTags });
  }

  const sitemapEntries = [
    ...STATIC_ROUTES.map(({ path, changefreq }) => ({ loc: canonicalUrl(path), changefreq })),
    ...TOOL_SEO_PAGES.map(({ path }) => ({ loc: canonicalUrl(path), changefreq: 'monthly' })),
  ];

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

  console.log(
    `[sitemap] 静态 ${STATIC_ROUTES.length} + 工具 ${TOOL_SEO_PAGES.length} = ${sitemapEntries.length} 条`
    + '（重定向源不收录，未收录 /legacy/*）',
  );

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
    `[build-seo] 完成：${results.length} 个页面（静态 ${STATIC_ROUTES.length} + 工具 ${TOOL_SEO_PAGES.length}）`
    + ` + sitemap（${sitemapEntries.length} 条）。站点源 ${SITE_ORIGIN}`,
  );
  console.log(`[build-seo] 其中正文 < 200 字符的页面：${thinPages} 个（工具页正文不含折叠的使用说明）`);
} catch (err) {
  await vite.close().catch(() => {});
  console.error('[build-seo] FAILED:', err);
  process.exit(1);
}
