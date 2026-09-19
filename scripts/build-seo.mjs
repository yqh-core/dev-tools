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

try {
  // —— 全部从 TypeScript 侧取，保证与页面/路由使用同一份数据 ——
  const { canonicalUrl, SITE_ORIGIN } = await vite.ssrLoadModule('/src/seo/site.ts');
  const { STATIC_ROUTES } = await vite.ssrLoadModule('/src/seo/routes.ts');
  const { tools } = await vite.ssrLoadModule('/src/tools/index.ts');
  const mod = await vite.ssrLoadModule('/src/entry-server.ts');

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

  const results = [];
  for (const { path } of STATIC_ROUTES) {
    const r = await mod.render(path);
    const { html = '', headTags = '' } = r ?? {};
    if (!html) {
      throw new Error(`[build-seo] ${path} 渲染结果为空`);
    }
    results.push({ path, html, headTags });
  }

  const staticLocs = STATIC_ROUTES.map(({ path, changefreq }) => ({ loc: canonicalUrl(path), changefreq }));

  // 重定向源不是可索引页面，必须排除（否则 sitemap 会把自己的 301 源当成正规 URL）。
  const redirectSources = new Set(tools.flatMap(tool => tool.redirectFrom ?? []));
  const toolPaths = [...new Set(tools.map(tool => tool.path))].filter(path => !redirectSources.has(path));

  const sitemapEntries = [
    ...staticLocs,
    ...toolPaths.map(path => ({ loc: canonicalUrl(path), changefreq: 'monthly' })),
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
  if (toolPaths.length === 0) {
    throw new Error('[build-seo] 未取到任何工具路由，src/tools/index.ts 的解析可能已失效');
  }

  await vite.close();

  if (!DRY_RUN) {
    // public/sitemap.xml 已删除，构建期唯一产物就是 dist/sitemap.xml
    await rm(join(root, 'dist/sitemap.xml'), { force: true });
    await writeFile(join(root, 'dist/sitemap.xml'), buildSitemap(sitemapEntries), 'utf8');
  }

  console.log(
    `[sitemap] 静态 ${staticLocs.length} + 工具 ${toolPaths.length} = ${sitemapEntries.length} 条`
    + `（已排除 ${redirectSources.size} 个重定向源，未收录 /legacy/*）`,
  );

  for (const { path, html, headTags } of results) {
    const canonical = canonicalUrl(path);
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

    if (problems.length > 0) {
      throw new Error(`[build-seo] ${path} 自检未通过: ${problems.join(', ')}`);
    }

    if (!DRY_RUN) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, out, 'utf8');
    }

    console.log(
      `[build-seo] ${path.padEnd(10)} html=${String(html.length).padStart(6)}B  head=${String(headTags.length).padStart(4)}B`
      + `  canonical=${canonical}  -> ${file.replace(root, '.')}`,
    );
  }

  console.log(`[build-seo] 完成：${results.length} 个页面 + sitemap（${sitemapEntries.length} 条）。站点源 ${SITE_ORIGIN}`);
} catch (err) {
  await vite.close().catch(() => {});
  console.error('[build-seo] FAILED:', err);
  process.exit(1);
}
