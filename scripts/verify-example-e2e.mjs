#!/usr/bin/env node
/**
 * verify-example-e2e.mjs —— 补的 example 在**真实浏览器里点得动吗**
 * ---------------------------------------------------------------------------
 * 为什么需要它
 *   门禁（audit-example-coverage.mjs）只校验**数据**；探针（probe-example-targets.mjs）
 *   只校验**控件能不能接受文本**。两者之间有一段谁也没覆盖的：
 *   「页面加载 → guide 异步加载 → 示例按钮真的出现 → 点它 → 控件真的拿到值」。
 *
 *   这段链路有真实的失败可能：guide 是**客户端异步加载**的（预渲染 HTML 里只有
 *   intro，.guide 区块与示例按钮（.action-example）都不在静态产物里 —— 实测确认），
 *   所以按钮可能在数据到位前不存在；而 applyExample 里 exampleApplied 仍会置 true，
 *   按钮文案变成「已填入」而数据其实没进去 —— 与 n-input-number 那个缺陷同一类假象。
 *
 *   本脚本只做一件事：真浏览器里点一次按钮，读回控件值，必须逐字等于 example.text。
 *
 * 用法
 *   node scripts/verify-example-e2e.mjs --serve-dist dist
 *   node scripts/verify-example-e2e.mjs --base https://digdevbox.com
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const argv = process.argv.slice(2);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = f => argv.includes(f);

const SERVE_DIST = argOf('--serve-dist', '');
const PORT = Number(argOf('--port', '4193'));
// ⛔ BASE 必须由 PORT 推导，不能各自写死一个默认值。
//   首版写成 `argOf('--base','') || (SERVE_DIST ? 'http://127.0.0.1:4193' : ...)`，
//   于是 --port 4194 时服务听 4194、浏览器却去 4193 —— 两个工具全部「组件未挂载」。
//   这正是 scripts/smoke-tools.mjs 注释里点名的「本工具最贵的一个坑」，照抄了坑本身。
const BASE = (argOf('--base', '') || (SERVE_DIST ? `http://127.0.0.1:${PORT}` : 'https://digdevbox.com')).replace(/\/+$/, '');
const SETTLE_MS = 450;
const LOCAL = !!SERVE_DIST;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// findPrimaryInput 的逐字复刻（与 tool.layout.vue 的 findPrimaryInput 一致）。
// ⛔ 必须用「优先可编辑 textarea、跳过只读/禁用」的同一套逻辑，否则格式化类工具
// （xml / json 等）的真实按钮填的是 textarea，而读回却去读首个 n-input-number（缩进大小）→ 假阴性。
const FIND_PRIMARY_INPUT_FN = `(() => {
  const root = document.querySelector('.tool-content');
  if (!root) return null;
  const tas = Array.from(root.querySelectorAll('textarea'));
  const editableTA = tas.find(ta => !ta.readOnly && !ta.disabled);
  if (editableTA) return editableTA;
  return root.querySelector('input[type="text"], input[type="search"], input[type="number"], input:not([type])');
})`;

// ── 期望值来源：真实 guides 数据（不是硬编码字符串） ──
const vite = await createServer({ root: REPO, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let GUIDES;
let GUIDES_ZH;
try {
  GUIDES = (await vite.ssrLoadModule('/src/tools/guides.en.ts')).GUIDES;
  GUIDES_ZH = (await vite.ssrLoadModule('/src/tools/guides.zh.ts')).GUIDES;
}
finally {
  await vite.close();
}
const TARGETS_ALL = Object.keys(GUIDES).filter(p => GUIDES[p].example);
// --only=a,b —— 只跑指定工具。⛔ 全量 83 个工具逐页真机导航很慢（本机实测 >10 分钟），
// 改动局部时用它把范围收窄到受影响的工具，别为了验 2 个工具等一轮全量。
const ONLY = (argOf('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const TARGETS = ONLY.length
  ? TARGETS_ALL.filter(p => ONLY.some(o => p === o || p === `/${o}` || p.endsWith(`/${o}`)))
  : TARGETS_ALL;
if (ONLY.length && TARGETS.length === 0) {
  console.error(`[only] --only ${JSON.stringify(ONLY)} 没匹配到任何带 example 的工具。可选：${TARGETS_ALL.slice(0, 6).join(', ')} …`);
  process.exit(2);
}

// ── 静态服务 ──
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const servers = [];
if (LOCAL) {
  const root = path.resolve(REPO, SERVE_DIST);
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error(`找不到 ${root}/index.html —— 先跑 npm run build`);
    process.exit(2);
  }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    let file = path.resolve(root, rel);
    if (!(file === root || file.startsWith(root + path.sep))) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx) && fs.statSync(file).isDirectory()) {
        file = idx;
      }
      else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'content-type': 'text/plain' }).end('no index.html');
        return;
      }
      else {
        file = path.join(root, 'index.html');
      }
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  servers.push(server);
  console.log(`[serve] ${root} → http://127.0.0.1:${PORT}`);
}

// ── Chrome ──
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(2);
}
const profile = path.join(REPO, `.example-e2e-profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--window-size=1440,1000',
  '--force-device-scale-factor=1', '--remote-debugging-port=0', '--user-data-dir=' + profile,
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  ...(LOCAL ? ['--no-proxy-server', '--proxy-bypass-list=<-loopback>'] : []),
  'about:blank',
], { stdio: 'ignore' });

let finished = false;
/**
 * 删临时 Chrome profile。
 *
 * ⛔ 删不掉的原因**不是** Chrome 文件锁（我一开始猜错了，写在注释里整整三轮）：
 *   实测用 PowerShell 手工 `Remove-Item -Recurse -Force` 能秒删同一个目录，
 *   而脚本里的 fs.rmSync 失败 —— 差别在于本工作区装了**批量删除保护**：
 *   单次删除文件数 > 50 就被拦（profile 里有 300~700 个文件）。
 *   与「vite 清 dist/assets 需要 CODEBUDDY_SAFE_DELETE_ENABLED=0」是同一个环境机制。
 *
 *   ⇒ 所以这里的定位是**清理残留 + 如实告警**，不强求删干净：
 *   删不掉就打印路径让人手动处理，绝不静默留一堆垃圾（首版就是静默留了 7 个）。
 */
function killChromeByProfile() {
  if (process.platform !== 'win32') {
    return;
  }
  try {
    const needle = profile.replace(/'/g, "''");
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `$needle='${needle}';`
        + `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | `
        + `Where-Object { $_.CommandLine -like ('*' + $needle + '*') } | `
        + `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore', timeout: 20000 },
    );
  }
  catch {}
}

async function cleanupProfile(attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    if (!fs.existsSync(profile)) {
      return true;
    }
    killChromeByProfile();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
    }
    catch {}
    if (!fs.existsSync(profile)) {
      return true;
    }
    await sleep(300);
  }
  // ⛔ 不静默：删不掉必须留痕。临时 profile 落在仓库根会污染 git status。
  console.warn(`[cleanup] 临时 profile 未能自动删除（多半是工作区的批量删除保护：文件数 > 50）：`);
  console.warn(`[cleanup]   ${profile}`);
  console.warn('[cleanup]   手动清理：rm -rf "<上面这个路径>"（或先设 CODEBUDDY_SAFE_DELETE_ENABLED=0）');
  return false;
}
async function teardown(code) {
  if (finished) return;
  finished = true;
  for (const s of servers) {
    try {
      s.close();
    }
    catch {}
  }
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    }
    else {
      chrome.kill('SIGKILL');
    }
  }
  catch {}
  await cleanupProfile();
  process.exit(code);
}
setTimeout(() => {
  console.error('[watchdog] 超时强制收尾');
  teardown(3);
}, 1500000);
process.on('uncaughtException', e => {
  console.error(e);
  teardown(1);
});
process.on('unhandledRejection', e => {
  console.error(e);
  teardown(1);
});

// ── CDP ──
const portFile = path.join(profile, 'DevToolsActivePort');
let wsUrl = null;
for (let i = 0; i < 120 && !wsUrl; i++) {
  await sleep(150);
  if (!fs.existsSync(portFile)) continue;
  const [p] = fs.readFileSync(portFile, 'utf8').split('\n');
  try {
    const list = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
  }
  catch {}
}
if (!wsUrl) {
  console.error('拿不到 CDP endpoint');
  teardown(2);
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let msgId = 0;
const pending = new Map();
const send = (method, params) => new Promise((resolve, reject) => {
  const id = ++msgId;
  const t = setTimeout(() => {
    pending.delete(id);
    reject(new Error('CDP timeout: ' + method));
  }, 30000);
  pending.set(id, {
    resolve: v => {
      clearTimeout(t);
      resolve(v);
    },
    reject: e => {
      clearTimeout(t);
      reject(e);
    },
  });
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
});
await send('Page.enable');
await send('Runtime.enable');
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('JS: ' + (r.exceptionDetails.text || ''));
  }
  return r.result.value;
};

// 页内：找按钮、点它、读回控件值
//
// ⛔ 按钮选择器是 `.action-example`（模板里的 class 是 `action-btn action-example`，
//   src/layouts/tool.layout.vue:361），**不是** `.guide-example-btn` ——
//   首版照抄了 scripts/smoke-tools.mjs 里那个选择器，结果两个工具都报「按钮未出现」。
//   那个选择器在本仓库已不存在（详见报告：顺带发现 smoke-tools.mjs 的 applyExampleStep 也用着它）。
const READ = `(() => {
  const root = document.querySelector('.tool-content');
  const btn = document.querySelector('.action-example');
  const el = root ? (${FIND_PRIMARY_INPUT_FN})() : null;
  return {
    hasContent: !!root,
    hasBtn: !!btn,
    btnLabel: btn ? (btn.innerText || '').trim() : null,
    value: el ? el.value : null,
    tag: el ? el.tagName.toLowerCase() + '[' + (el.type || '') + ']' : null,
    readOnly: el ? !!el.readOnly : null,
  };
})()`;

const results = [];
for (const [i, p] of TARGETS.entries()) {
  const expect = GUIDES[p].example.text;
  const row = { path: p, expect, ok: false };
  try {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await send('Page.navigate', { url: `${BASE}${p}/` });
    // 等 .tool-layout 挂载
    let mounted = false;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      mounted = await evaluate('!!document.querySelector(\'.tool-layout\')').catch(() => false);
      if (mounted) break;
      await sleep(150);
    }
    row.mounted = mounted;
    if (!mounted) {
      row.why = '组件未挂载';
      results.push(row);
      continue;
    }
    // guide 是客户端异步加载的：轮询等示例按钮出现（固定 sleep 会误判成「没有 example」）
    let state = null;
    const btnDeadline = Date.now() + 15000;
    while (Date.now() < btnDeadline) {
      state = await evaluate(READ);
      if (state.hasBtn) break;
      await sleep(200);
    }
    row.hasBtn = state?.hasBtn;
    row.btnLabel = state?.btnLabel;
    row.tag = state?.tag;
    row.readOnly = state?.readOnly;
    if (!state?.hasBtn) {
      row.why = '示例按钮未出现（guide 未加载，或该工具没有 example）';
      results.push(row);
      continue;
    }
    // 先清空，再点按钮 —— 真实用户路径
    await evaluate(`(() => {
      const root = document.querySelector('.tool-content');
      const el = (${FIND_PRIMARY_INPUT_FN})();
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      if (setter) setter.call(el, ''); else el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(250);
    await evaluate('document.querySelector(\'.action-example\').click()');
    await sleep(SETTLE_MS);
    const after = await evaluate(READ);
    row.afterValue = after.value;
    row.btnLabelAfter = after.btnLabel;
    // 判据：控件值逐字等于 example.text。
    // ⛔ 不用「值非空」这种弱判据 —— applyExample 会置 exampleApplied=true，
    //   按钮文案变「已填入」而数据没进去，正是 n-input-number 那个缺陷的假象。
    row.ok = after.value === expect;
    if (!row.ok) {
      row.why = `控件值不等于 example.text（期望 ${JSON.stringify(expect)}，实得 ${JSON.stringify(after.value)}）`;
    }
  }
  catch (e) {
    row.why = String(e.message || e);
  }
  results.push(row);
  process.stdout.write(`[${String(i + 1).padStart(3)}/${TARGETS.length}] ${row.ok ? '✓' : '✗'} ${p}\n`);
  if (!row.ok) {
    console.log(`      ${row.why || ''}`);
  }
}

const pass = results.filter(r => r.ok);
const fail = results.filter(r => !r.ok);
console.log('');
console.log(`[e2e] ${pass.length}/${results.length} 个工具的示例按钮在真浏览器里点得动`);
console.log(`[e2e] 判据：点击后 .tool-content 首个输入控件的值逐字等于 guides 里的 example.text`);
console.log(`[e2e] 期望值来源：vite ssrLoadModule 读真实 guides.en.ts（非硬编码）`);

if (has('--md')) {
  const OUT = path.resolve(REPO, argOf('--md', '_ops/example-e2e-latest.md'));
  const md = [
    '# example 按钮真机端到端验收',
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 被测源：\`${BASE}\`${LOCAL ? `（本地 dist 静态服务）` : '（线上）'}`,
    `- 覆盖：全部 ${TARGETS.length} 个配了 example 的工具`,
    '',
    '| tool | 按钮出现 | 控件 | readonly | 点击后控件值 | 与 example.text 一致 |',
    '|---|---|---|---|---|---|',
    ...results.map(r => `| \`${r.path}\` | ${r.hasBtn ? '✅' : '❌'} | ${r.tag || '—'} | ${r.readOnly ? '⚠️ 是' : '否'} | ${JSON.stringify(r.afterValue ?? null)} | ${r.ok ? '✅' : `❌ ${r.why || ''}`} |`),
    '',
    '## 方法学',
    '',
    '1. 判据是**逐字相等**，不是「值非空」。applyExample 会把 exampleApplied 置 true、',
    '   按钮文案变成「已填入」而数据其实没进去 —— 弱判据会把这种假象判成通过。',
    '2. guide 是**客户端异步加载**的（预渲染 HTML 里只有 intro，没有 .guide 区块），',
    '   所以按钮用轮询等出现，不用固定 sleep。',
    '3. 点击前先清空控件，走「用户从空状态点示例按钮」的真实路径。',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md, 'utf8');
  console.log(`[e2e] 报告：${OUT}`);
}
void GUIDES_ZH;
await teardown(fail.length ? 1 : 0);