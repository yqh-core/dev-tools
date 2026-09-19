/**
 * 构建期预渲染（STEP 1）—— 4 个法务/静态页 + 首页。
 *
 * 用法：npm run build 之后执行 `node scripts/build-seo.mjs`
 *
 * 做法：起一个 middlewareMode 的 Vite dev server，用 ssrLoadModule 在 Node 里
 * 加载 src/entry-server.ts 渲染每条路由，再把结果注入 dist/index.html 模板，
 * 输出 dist/<route>/index.html。复用同一份 vite.config.ts，因此 ?raw / ?component
 * / unplugin 等全部生效，且不需要额外产出 SSR bundle。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SEO_SITE ?? 'https://digdevbox.com';
const ROUTES = ['/', '/about', '/privacy', '/terms', '/contact'];
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * 预渲染只渲染页面组件本身（不含 base.layout 的导航栏/侧边栏/页脚），
 * 因此初始 HTML 里没有站内导航 —— 爬虫只能靠 sitemap 发现其它页面（P0-5 不完整）。
 * 这里补一段静态页脚导航；客户端 mount 后会被真实页脚接管，链接集合一致。
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

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
});

try {
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

  const results = [];
  for (const route of ROUTES) {
    const r = await mod.render(route);
    const { html = '', headTags = '' } = r ?? {};
    console.log(
      `[render] ${route.padEnd(10)} html=${String(html.length).padStart(6)}B headTags=${headTags ? String(headTags.length) + 'B' : 'UNDEFINED'} keys=${Object.keys(r ?? {}).join(',')}`,
    );
    console.log(`         preview: ${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)}`);
    results.push({ route, html, headTags });
  }
  await vite.close();

  for (const { route, html, headTags } of results) {
    const canonical = route === '/' ? `${SITE}/` : `${SITE}${route}/`;
    let out = template
      // 1) 预渲染正文替换空壳
      .replace('<div id="app"></div>', `<div id="app">${html}${STATIC_FOOTER}</div>`)
      // 2) canonical 自指
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonical}" />`);

    // 3) 组件内 useHead 产出的 title / meta。
    //    模板里已有静态 <title> / <meta name="description">，若 headTags 带同类型标签必须先删旧的，
    //    否则页面里会出现两个 <title>，爬虫取的是第一个（即旧的通用标题）。
    if (/<title[\s>]/i.test(headTags)) {
      out = out.replace(/<title[\s\S]*?<\/title>/i, '');
    }
    if (/<meta[^>]+name=["']description["']/i.test(headTags)) {
      out = out.replace(/<meta[^>]+name=["']description["'][^>]*>/gi, '');
      out = out.replace(/<meta[^>]+itemprop=["']description["'][^>]*>/gi, '');
    }
    out = out.replace('</head>', `${headTags}\n</head>`);

    const file = route === '/' ? join(root, 'dist/index.html') : join(root, 'dist', route, 'index.html');
    if (!DRY_RUN) {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, out, 'utf8');
    }
    const hasAdsense = out.includes('ca-pub-7944759654100814');
    console.log(
      `[build-seo] ${route.padEnd(10)} html=${String(html.length).padStart(6)}B  head=${String(headTags.length).padStart(4)}B  canonical=${canonical}  adsense=${hasAdsense ? 'ok' : 'MISSING'}  -> ${file.replace(root, '.')}`,
    );
  }
} catch (err) {
  await vite.close().catch(() => {});
  console.error('[build-seo] FAILED:', err);
  process.exit(1);
}
