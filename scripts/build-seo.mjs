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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * 预渲染只渲染页面组件本身（不含 base.layout 的导航栏/侧边栏/页脚），
 * 因此初始 HTML 里没有站内导航 —— 爬虫只能靠 sitemap 发现其它页面。
 * 这里补一段静态页脚导航；客户端 mount 后会被真实页脚接管，链接集合一致。
 *
 * href 统一带尾斜杠，与 canonical / sitemap 保持一致（原因见 src/seo/site.ts）。
 */
const STATIC_FOOTER = `
<footer class="dd-seo-footer" style="max-width:800px;margin:48px auto 0;padding:24px 16px;border-top:1px solid rgba(128,128,128,.25);font-size:14px;line-height:2">
  <nav>
    <a href="/">首页</a> ·
    <a href="/about/">关于</a> ·
    <a href="/privacy/">隐私政策</a> ·
    <a href="/terms/">服务条款</a> ·
    <a href="/contact/">联系我们</a>
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

try {
  // —— 全部从 TypeScript 侧取，保证与页面/路由使用同一份数据 ——
  const { canonicalUrl, SITE_ORIGIN } = await vite.ssrLoadModule('/src/seo/site.ts');
  const { STATIC_ROUTES } = await vite.ssrLoadModule('/src/seo/routes.ts');
  const { TOOL_SEO_PAGES, auditToolSeoData } = await vite.ssrLoadModule('/src/seo/tool-page.ts');
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
    const out = replaceOnce(
      replaceOnce(
        template,
        '<div id="app"></div>',
        `<div id="app">${html}${STATIC_FOOTER}</div>`,
      ),
      pageSeoBlock,
      `<!-- page-seo:start -->\n${headTags}\n      <!-- page-seo:end -->`,
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
