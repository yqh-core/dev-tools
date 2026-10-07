#!/usr/bin/env node
/**
 * ddb-kwm-probe.mjs — 关键词地图 + 工具↔文章绑定的**视觉自证**探针（零依赖 CDP）
 * ---------------------------------------------------------------------------
 * 为什么门禁全绿还要跑这个
 *   `npm run build` 与 `audit:keyword-map` 证明的是「数据自洽」，
 *   证明不了「浏览器里真的渲染出了 N 条链接」。这两件事会各自静默失效：
 *   数据写对了但模板忘了输出（区块 0 条），或模板输出了但 i18n 词条缺失
 *   （SSR 预渲染下 vue-i18n 对数组型词条会返回 key 本身，产物里出现
 *   `<li>home.why.points</li>` —— 本仓至今没有真正的数组型 i18n 词条，
 *   所以 related guides 一律走 TS 数据而不是 i18n 数组）。
 *
 * 五项实测（全部取真实 DOM 数值，不接受「看起来没问题」）
 *   ① 横向溢出     document.documentElement.scrollWidth > innerWidth
 *   ② 工具页 related guides 区块实际渲染出几条 <a>
 *   ③ 首页 Blog 区块实际渲染出几篇（改前基线 = 3）
 *   ④ SSR 产物裸 key：dist/index.html 里 `>home.*<` / `>clusters.*<` 应 0 命中
 *   ⑤ 首页工具内链数量（上一轮基线 101，本轮不许减少）
 *
 * ⛔ 空转断言（本脚本存在的理由之一）
 *   preview server 不可达 / 拿到的是错误页 / CDP 拿不到 endpoint 时**必须 exit != 0**。
 *   没有这条，一个「所有选择器都数到 0 条」的探针会在错误页上打印
 *   「✅ 全部通过」—— 那比没有探针更危险。
 *
 * 零依赖：本机无 chrome-remote-interface / puppeteer，走 Chrome
 * `--headless=new --remote-debugging-port=0` + Node 原生 WebSocket 直连 CDP。
 *
 * 用法
 *   node scripts/ddb-kwm-probe.mjs --serve-dist dist --out D:/work/_ops/ddb-kwm
 */

import process from 'node:process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const SERVE_DIST = argOf('--serve-dist', null);
const OUT_DIR = argOf('--out', path.join(ROOT, '.kwm-probe-out'));
const PORT = Number(argOf('--port', 4198));
const BASE = SERVE_DIST ? `http://127.0.0.1:${PORT}` : argOf('--base', 'https://digdevbox.com');

/** 上一轮实测基线，用于「不许减少」判据。 */
const BASELINE_HOME_TOOL_LINKS = 101;
const BASELINE_HOME_BLOG_POSTS = 3;

const failures = [];
const results = [];
const fail = msg => failures.push(msg);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ───────────────────────── 静态服务（仅 --serve-dist） ─────────────────────────
let server = null;
if (SERVE_DIST) {
  const distDir = path.resolve(ROOT, SERVE_DIST);
  // ⛔ 先确认 dist 真的存在再起服务。缺 index.html 时若硬起服务，
  //   静态 handler 会把 ENOENT 抛成未捕获异常（退出码虽然非 0，但输出是一坨
  //   堆栈，看不出「是 dist 没构建」这个真实原因）。
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error(
      `❌ ${distDir}/index.html 不存在 —— 先跑 \`npm run build\`（含 build-seo 预渲染）再跑本探针。`
      + '对着空目录量 DOM 只会得到全 0，然后打印「通过」。',
    );
    process.exit(2);
  }
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.xml': 'application/xml',
  };
  server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(distDir, url);
    if (url.endsWith('/')) { file = path.join(file, 'index.html'); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const asIndex = path.join(file, 'index.html');
      file = fs.existsSync(asIndex) ? asIndex : path.join(distDir, 'index.html');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
}

// ⛔ 空转断言 1：preview server 必须真的起来且能返回首页
if (SERVE_DIST) {
  let reachable = false;
  let body = '';
  try {
    const res = await fetch(`${BASE}/`, { redirect: 'follow' });
    body = await res.text();
    reachable = res.ok && body.includes('<div id="app"');
  }
  catch (err) {
    fail(`preview server 不可达：${err.message}`);
  }
  if (!reachable) {
    console.error(`❌ 预渲染服务没返回可用的 dist/index.html（收到 ${body.length}B）。`
      + '在错误页上量 DOM 只会得到全 0，然后打印「通过」—— 那比没有探针更危险。');
    server?.close();
    process.exit(2);
  }
  console.log(`[probe] preview server OK: ${BASE}/ (${body.length}B)`);
}

// ───────────────────────────── 启动 Chrome ─────────────────────────────
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddb-kwm-'));
const { spawn } = await import('node:child_process');
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.CHROME_PATH,
].filter(Boolean);
const chromeBin = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!chromeBin) {
  console.error('❌ 找不到 Chrome 可执行文件，无法做视觉自证。');
  server?.close();
  process.exit(2);
}

const chrome = spawn(chromeBin, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

function cleanup(code) {
  try { chrome.kill(); }
  catch {}
  try { fs.rmSync(profile, { recursive: true, force: true }); }
  catch {}
  try { server?.close(); }
  catch {}
  process.exit(code);
}

const portFile = path.join(profile, 'DevToolsActivePort');
let wsUrl = null;
for (let i = 0; i < 120 && !wsUrl; i++) {
  await sleep(150);
  if (!fs.existsSync(portFile)) { continue; }
  const [p] = fs.readFileSync(portFile, 'utf8').split('\n');
  try {
    const list = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
  }
  catch {}
}

// ⛔ 空转断言 2：拿不到 CDP endpoint 立即失败
if (!wsUrl) {
  console.error('❌ 拿不到 CDP endpoint（Chrome 没起来或 DevToolsActivePort 没生成）。');
  cleanup(2);
}
console.log('[probe] CDP endpoint OK');

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let msgId = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  const slot = pending.get(msg.id);
  if (!slot) { return; }
  pending.delete(msg.id);
  msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result);
});

await send('Page.enable');
await send('Runtime.enable');

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812, dsf: 2, mobile: true },
  { name: 'desktop-1440', width: 1440, height: 900, dsf: 1, mobile: false },
];

/** 导航 + 等待 SPA 接管（骨架被替换后才是真实页面）。 */
async function goto(url) {
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url });
  await sleep(400);
  for (let i = 0; i < 60; i++) {
    const { result } = await send('Runtime.evaluate', {
      expression: 'document.readyState === "complete" && !!document.querySelector("#app > *")',
      returnByValue: true,
    });
    if (result.value) { break; }
    await sleep(250);
  }
  await sleep(900);
}

async function evaluate(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) { throw new Error(exceptionDetails.text); }
  return result.value;
}

const OVERFLOW_JS = 'document.documentElement.scrollWidth > window.innerWidth';
/**
 * related guides 区块选择器。
 *
 * ⛔ 必须同时命中两处，否则探针会给出「假绿」：
 *   `.dd-tool-notes`  —— 预渲染骨架（src/seo/ToolSeoPage.vue），SPA 接管后被替换掉
 *   `.related-notes`  —— 真实工具页（src/layouts/tool.layout.vue），用户真正看到的那份
 * 只查其中一处，就会漏掉「骨架有、真实页没有」这个失效方向 —— 本脚本第一版
 * 就因为只查骨架而在真实页全数 0 条时误判。
 */
const TOOL_NOTES_JS = `(() => {
  const sec = document.querySelector('.related-notes') || document.querySelector('.dd-tool-notes');
  if (!sec) return { found: false, which: null, links: 0, hrefs: [] };
  const links = [...sec.querySelectorAll('a')].map(a => a.getAttribute('href'));
  return {
    found: true,
    which: sec.classList.contains('related-notes') ? 'real-page' : 'ssr-skeleton',
    links: links.length,
    hrefs: links,
  };
})()`;
const HOME_BLOG_JS = `(() => {
  const cards = [...document.querySelectorAll('.home-blog-card')];
  return {
    count: cards.length,
    titles: cards.map(c => (c.querySelector('.home-blog-card-title')?.textContent || '').trim()),
    hrefs: cards.map(c => c.getAttribute('href')),
  };
})()`;

fs.mkdirSync(OUT_DIR, { recursive: true });

/**
 * 真实工具路由清单。
 *
 * ⛔ 从**预渲染产物目录**反推，而不是从 `src/tools/` 的目录名读 ——
 *   目录名 ≠ 路由 path（`json-viewer/` → `/json-prettify`、
 *   `date-time-converter/` → `/date-converter`、`integer-base-converter/` →
 *   `/base-converter`），而 `dist/<route>/index.html` 里的目录名一定是真路由。
 *   这正是本仓最容易踩的坑，探针自己不能踩。
 */
const TOOL_ROUTES = SERVE_DIST
  ? fs.readdirSync(path.resolve(ROOT, SERVE_DIST), { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, SERVE_DIST, d.name, 'index.html')))
    .map(d => `/${d.name}`)
  : [];

const HOME_TOOL_LINKS_JS = `(() => {
  const known = new Set(${JSON.stringify(TOOL_ROUTES)});
  const seen = new Set();
  for (const a of document.querySelectorAll('a[href^="/"]')) {
    const p = a.getAttribute('href').split('#')[0].split('?')[0].replace(/\\/$/, '');
    if (p && p !== '/' && known.has(p)) seen.add(p);
  }
  return { count: seen.size, paths: [...seen].sort() };
})()`;

for (const vp of VIEWPORTS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: vp.dsf,
    mobile: vp.mobile,
  });

  // —— 首页 ——
  await goto(`${BASE}/`);
  const homeTitle = await evaluate('document.title');
  if (!homeTitle || homeTitle.length < 3) {
    fail(`[${vp.name}] 首页 title 为空 —— 探针可能量到了错误页`);
  }
  const overflowHome = await evaluate(OVERFLOW_JS);
  if (overflowHome) { fail(`[${vp.name}] 首页横向溢出（scrollWidth > innerWidth）`); }

  const blog = await evaluate(HOME_BLOG_JS);
  if (!blog.count) {
    fail(`[${vp.name}] 首页 Blog 卡片数 = 0 —— 探针空转（改前基线 ${BASELINE_HOME_BLOG_POSTS}）`);
  }
  if (blog.count < BASELINE_HOME_BLOG_POSTS) {
    fail(`[${vp.name}] 首页 Blog 卡片 ${blog.count} < 基线 ${BASELINE_HOME_BLOG_POSTS}（文章被漏掉了）`);
  }
  // ⛔ 只收英文开发文章：中文标题（AdSense / 跨境电商 / SEO）不得混入英文主站首页
  const CJK = /[一-鿿]/;
  const cjkTitles = blog.titles.filter(t => CJK.test(t));
  if (cjkTitles.length) {
    fail(`[${vp.name}] 首页 Blog 混入中文文章：${cjkTitles.join(' | ')}`);
  }
  for (const href of blog.hrefs) {
    if (!/^https:\/\/notes\.digdevbox\.com\/posts\/[a-z0-9-]+$/.test(href)) {
      fail(`[${vp.name}] 首页 Blog 外链形态异常：${href}`);
    }
  }

  const homeToolLinks = await evaluate(HOME_TOOL_LINKS_JS);
  if (homeToolLinks.count < BASELINE_HOME_TOOL_LINKS) {
    fail(`[${vp.name}] 首页工具内链 ${homeToolLinks.count} < 基线 ${BASELINE_HOME_TOOL_LINKS}（本轮不许减少）`);
  }

  // 首页 Blog 区块截图：同样必须滚到区块再拍（首屏看不到）
  await evaluate(`(() => {
    const el = document.querySelector('.home-blog-list');
    if (el) el.scrollIntoView({ block: 'center' });
  })()`);
  await sleep(400);
  const blogBox = await evaluate(`(() => {
    const el = document.querySelector('.home-blog-list');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  })()`);
  const shotHome = await send('Page.captureScreenshot', {
    format: 'png',
    clip: blogBox
      ? { x: 0, y: Math.max(0, blogBox.top - 90), width: vp.width, height: Math.min(vp.height, blogBox.height + 200), scale: 1 }
      : undefined,
  });
  fs.writeFileSync(path.join(OUT_DIR, `home-blog-${vp.name}.png`), Buffer.from(shotHome.data, 'base64'));

  results.push({
    viewport: vp.name,
    page: '/',
    title: homeTitle,
    horizontalOverflow: overflowHome,
    blogCards: blog.count,
    blogTitles: blog.titles,
    blogHrefs: blog.hrefs,
    homeToolLinks: homeToolLinks.count,
  });

  // —— 工具页：逐个核对 related guides 区块 ——
  const TOOL_PAGES = [
    '/jwt-parser', '/json-prettify', '/json-diff', '/json-minify',
    '/uuid-generator', '/ulid-generator',
    '/regex-tester', '/regex-memo',
    '/chmod-calculator', '/crontab-generator', '/docker-run-to-docker-compose-converter',
  ];
  for (const p of TOOL_PAGES) {
    await goto(`${BASE}${p}/`);
    const t = await evaluate('document.title');
    if (!t || t.length < 3) { fail(`[${vp.name}] ${p} title 为空 —— 探针空转`); }
    const of = await evaluate(OVERFLOW_JS);
    if (of) { fail(`[${vp.name}] ${p} 横向溢出`); }
    const notes = await evaluate(TOOL_NOTES_JS);
    if (!notes.found || notes.links < 1) {
      fail(`[${vp.name}] ${p} related guides 区块未渲染出链接（found=${notes.found} which=${notes.which} links=${notes.links}）`);
    }
    // ⛔ 必须在**真实工具页**上（骨架已被 SPA 替换），否则等于只验证了爬虫看到的那份
    if (notes.which !== 'real-page') {
      fail(`[${vp.name}] ${p} 命中的是 ${notes.which} 而不是真实页区块 —— 探针量错了对象`);
    }
    for (const href of notes.hrefs) {
      if (!/^https:\/\/notes\.digdevbox\.com\/posts\/[a-z0-9-]+$/.test(href)) {
        fail(`[${vp.name}] ${p} related guides 外链形态异常：${href}`);
      }
    }
    if (vp.name === 'desktop-1440') {
      // ⛐ 视口截图只能拍到首屏，而 related guides 区块在 related tools 之下 ——
      //   `captureBeyondViewport` 对本项目的长页面不生效（实测只出首屏那一屏）。
      //   所以显式滚到区块再拍，否则截图证明不了任何东西。
      const box = await evaluate(`(() => {
        const el = document.querySelector('.related-notes');
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height) };
      })()`);
      if (box) {
        await sleep(400);
        const shot = await send('Page.captureScreenshot', {
          format: 'png',
          clip: {
            x: 0,
            y: Math.max(0, box.top - 20),
            width: vp.width,
            height: Math.min(vp.height, box.height + 220),
            scale: 1,
          },
        });
        fs.writeFileSync(path.join(OUT_DIR, `tool${p.replace(/\//g, '-')}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    results.push({
      viewport: vp.name,
      page: p,
      title: t,
      horizontalOverflow: of,
      notesLinks: notes.links,
      notesWhich: notes.which,
      notesHrefs: notes.hrefs,
    });
  }
}

// ───────────────────────── ④ SSR 产物裸 key 检查 ─────────────────────────
let bareKeys = [];
if (SERVE_DIST) {
  const html = fs.readFileSync(path.resolve(ROOT, SERVE_DIST, 'index.html'), 'utf8');
  bareKeys = [...html.matchAll(/>(?:home|clusters|tool|seo|network)\.[a-zA-Z0-9_.]+</g)].map(m => m[0]);
  if (bareKeys.length) {
    fail(`SSR 产物 dist/index.html 出现裸 i18n key ${bareKeys.length} 处：${[...new Set(bareKeys)].slice(0, 5).join(' ')}`);
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({ base: BASE, results, bareKeys, failures }, null, 2));

console.log('\n──── 实测汇总 ────');
for (const r of results) {
  if (r.page === '/') {
    console.log(`[${r.viewport}] /  title="${r.title}"  横向溢出=${r.horizontalOverflow}  Blog 卡片=${r.blogCards}  工具内链=${r.homeToolLinks}`);
    r.blogTitles.forEach((t, i) => console.log(`          · ${t}`));
  }
  else {
    console.log(`[${r.viewport}] ${r.page}  横向溢出=${r.horizontalOverflow}  related guides 链接=${r.notesLinks}（${r.notesWhich}）  ${r.notesHrefs.join(' ')}`);
  }
}
console.log(`\nSSR 裸 key 命中：${bareKeys.length}`);
console.log(`截图目录：${OUT_DIR}`);

if (failures.length) {
  console.error(`\n❌ ${failures.length} 项未通过：`);
  for (const f of failures) { console.error(`  - ${f}`); }
  cleanup(1);
}
console.log('\n✅ 全部通过');
cleanup(0);
