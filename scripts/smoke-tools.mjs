#!/usr/bin/env node
/**
 * smoke-tools.mjs — 全站工具页 Smoke Test（零依赖 CDP）
 * ---------------------------------------------------------------------------
 * 为什么要有这个脚本
 *   101 个工具页在预渲染上线后，没有人系统地量过「每一页在真实浏览器里到底
 *   能不能用」。单元测试只覆盖纯函数、e2e 只覆盖 26 个工具，剩下的靠人工点。
 *   这里把整站当成一个可回归的对象：一条命令，逐页量五层。
 *
 * 五层检查（与方案 §8 STEP 5 动作 A1 的口径一致）
 *   ① HTTP 状态      —— 请求必须带尾斜杠（CF Pages 目录型路由对无斜杠强制 308）
 *   ② 初始 HTML      —— h1 / title / canonical 自指 / AdSense 标记 / 正文非空
 *   ③ JS chunk       —— 同源脚本不得 4xx/5xx，不得 loadingFailed
 *   ④ 组件 mount     —— .tool-layout 出现、.tool-content 有内容、h1 等于 locales/<locale>.yml 声明的标题
 *   ⑤ 客户端已接管   —— 预渲染骨架 article.dd-tool-seo 必须已被 SPA 替换
 *                        （这一项就是「客户端渲染是否回退」的判据）
 *
 * console error 的判定口径（**不设「控制台 0 error」门槛**）
 *   区分「影响使用」与「第三方/扩展/广告噪声」，两类分开记录：
 *     阻断 blocking = 同源 error + 未捕获异常 + 同源脚本加载失败
 *     噪声 noise    = 第三方 host、favicon、SW 注册、net::ERR_ABORTED
 *   每条噪声都带 host/pattern 记录，便于复核白名单是否在掩盖真问题。
 *
 * 用例可用的 expect 字段
 *   text / regex / not        期望出现的文本、正则、禁止出现的文本
 *   js                        页内断言（返回 false 或字符串=失败，字符串会原样进报告）
 *   canvasNonBlank            canvas 里真的画了东西（非全透明像素）
 *   imageData                 `{ sel, minBytes }`：存在 src 为 data:/blob: 的 <img>，
 *                             且已解码出非零尺寸、字节数达标（二维码这类图片产物用它）
 *   consoleNoise              `[{ re, why }]`：用例**自己声明**的豁免噪声，必须写 why，
 *                             用于「故意注入故障」的场景（如 A3 注入 500 时浏览器必然记一条同源错误）
 *
 * 零依赖
 *   本机没有 chrome-remote-interface / puppeteer / playwright，且不允许下载浏览器。
 *   所以走 Chrome `--headless=new --remote-debugging-port=0` + Node 22 原生 WebSocket
 *   直连 CDP。端口传 0 并读 DevToolsActivePort，避免固定端口被上一轮残留实例顶替。
 *
 * 用法
 *   node scripts/smoke-tools.mjs --base https://digdevbox.com
 *   node scripts/smoke-tools.mjs --serve-dist dist --base http://127.0.0.1:4192
 *   node scripts/smoke-tools.mjs --shard 1/4 --out .smoke-out
 *   node scripts/smoke-tools.mjs --only /base-converter,/hash-text
 *
 * 参数
 *   --base <url>        被测站点，默认 https://digdevbox.com
 *   --canonical-origin <url>  页面里 canonical 的期望源。**本地跑必须显式传生产域名**，
 *                             否则 canonicalSelf 会拿 127.0.0.1 去比对 → 全量假失败
 *   --locale <code>     期望标题语种，默认 en（本站默认英文）；读 locales/<code>.yml
 *   --serve-dist <dir>  起内置静态服务（含目录 index.html 与 SPA fallback），供本地跑
 *   --port <n>          本地静态服务端口，默认 4192（多分片各自 +n）
 *   --shard i/n         只跑第 i 片（1-based），默认 1/1
 *   --only <a,b>        只跑指定 path 或目录名，逗号分隔
 *   --out <dir>         输出目录（JSON + 失败截图），默认 <repo>/.smoke-out
 *   --budget <ms>       单页预算，默认 20000
 *   --shot-all          所有页都截图（默认只截失败页）
 *   --keep-profile      保留临时 Chrome profile（排查用）
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

// 用例文件可切换（--cases=./smoke-cases-a3.mjs）：
// A3 的 API 失败态注入与 A1 的主用例**共用 path**（同页面两种注入态），
// 放同一个文件里会让「101 条用例 ↔ 101 个页面」的双向校验失去意义，所以分开跑。
const CASES_FILE = (process.argv.find(a => a.startsWith('--cases=')) || '').slice(8) || './smoke-cases.mjs';
const { SMOKE_CASES } = await import(new URL(CASES_FILE, import.meta.url).href);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ─────────────────────────────── CLI ───────────────────────────────
const argv = process.argv.slice(2);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = f => argv.includes(f);

// --base 允许写成 host:port 简写：不补协议时 new URL() 会抛 Invalid URL，
// 报出来的堆栈与真实原因（协议没写）毫无关系，排查成本高。
// loopback 缺协议按 http，其余按 https。
let BASE = argOf('--base', 'https://digdevbox.com');
if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(BASE)) {
  const loop = /^(127\.|localhost\b|\[::1\])/i.test(BASE);
  console.log(`[base] --base "${BASE}" 未写协议 → 按 ${loop ? 'http' : 'https'}:// 处理`);
  BASE = `${loop ? 'http' : 'https'}://${BASE}`;
}
BASE = BASE.replace(/\/+$/, '');
// canonical 在预渲染时写死为生产域名，本地用 127.0.0.1 跑时必须分开算，否则全是假失败
const CANON_ORIGIN = argOf('--canonical-origin', BASE).replace(/\/+$/, '');
const SERVE_DIST = argOf('--serve-dist', '');
const LOCAL = !!SERVE_DIST;
let PORT = Number(argOf('--port', '4192'));
const OUT = path.resolve(argOf('--out', path.join(REPO, '.smoke-out')));
const BUDGET = Number(argOf('--budget', '20000'));
const ONLY = (argOf('--only', '') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const [SHARD_I, SHARD_N] = (argOf('--shard', '1/1') || '1/1').split('/').map(Number);
const SHOT_ALL = has('--shot-all');
const KEEP_PROFILE = has('--keep-profile');
// 不带尾斜杠访问（线上会被 CF 308 到带斜杠形式，本地静态服务不会）。
// 用来做「尾斜杠会不会改变路由状态」这类对照实验。
const NO_SLASH = has('--no-slash');
const pageUrl = p => BASE + p + (NO_SLASH ? '' : '/');
// 预渲染层（初始 HTML）只在「已做 SSG 的产物 / 线上」上才有意义。对着 vite dev server 跑时
// dev 不做预渲染，该层必然全灭 —— 只能显式跳过，并且报告里必须留下「本轮未验预渲染层」的痕迹，
// 免得把 dev 跑出的全绿误当成完整验收。
const SKIP_HTML_LAYER = has('--skip-html-layer');
let runtimeOnly = false;
const canonUrl = p => CANON_ORIGIN + p + '/';

/**
 * 期望标题的语种（默认 en）—— 判据必须跟着产品走。
 *
 * 2026-09-20 踩坑（T-37）：本站默认语言从 zh 切成 en 之后，
 * 「初始 HTML 的 H1 == zh.yml 里的中文标题」这条断言对 98 个工具页**必然全红**。
 * 它表面上在报产品缺陷，实际是判据自己过期了 ——
 * 与 T-31（soft404 长度阈值失效）同属「测试规则随系统演进失效但报告仍然可信」这一类。
 *
 * 现在按 --locale 读 locales/<locale>.yml 的 tools.<name>.title；
 * **解析不到就报错，不静默跳过** —— 静默跳过等于这条验收项不存在（比全红更危险）。
 */
const LOCALE = argOf('--locale', 'en');
const LOCALE_TITLES = loadLocaleToolTitles(LOCALE);

/** 只为读 `tools: → 两个空格 <name>: → 四个空格 title:` 这一层，零依赖，够用且不易误匹配 */
function loadLocaleToolTitles(locale) {
  const f = path.join(REPO, 'locales', `${LOCALE}.yml`);
  if (!fs.existsSync(f)) {
    console.error(`[locale] 找不到词条文件 ${f} —— 拒绝在「没有判据」的状态下跑 H1 断言`);
    process.exit(2);
  }
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const titles = {};
  let inTools = false;
  let cur = null;
  for (const raw of lines) {
    if (/^tools:\s*$/.test(raw)) { inTools = true; cur = null; continue; }
    if (/^[A-Za-z_]/.test(raw)) { inTools = false; continue; } // 顶层键，离开 tools 区
    if (!inTools) continue;
    let m = /^ {2}([A-Za-z0-9_.-]+):\s*$/.exec(raw);
    if (m) { cur = m[1]; continue; }
    m = /^ {4}title:\s*(.+?)\s*$/.exec(raw);
    if (m && cur) {
      titles[cur] = m[1].replace(/^['"]|['"]$/g, '');
    }
  }
  if (Object.keys(titles).length < 50) {
    console.error(`[locale] 从 ${LOCALE}.yml 只解析出 ${Object.keys(titles).length} 个工具标题 —— 解析器或词条结构变了，拒绝继续`);
    process.exit(2);
  }
  console.log(`[locale] 期望标题语种 = ${LOCALE}（${Object.keys(titles).length} 条词条）`);
  return titles;
}

fs.mkdirSync(OUT, { recursive: true });

// 站点根 URL（用于判定同源 / 拼 canonical）
const BASE_URL = new URL(BASE);

/**
 * --base 与 --port 各写各的，是本工具最贵的一个坑：内置静态服务绑在 PORT，
 * 而浏览器访问的是 BASE —— 两者不一致时每一页都变成「无法访问此网站」，
 * 报告里表现为「初始 HTML 非 200 / 组件未挂载 / 缺少 .tool-content」，
 * 看着像 101 个页面全坏了。实测踩过：16 条全失败，查了几分钟才发现是端口。
 * 既然 BASE 是明确给定的目标，就以它为准把服务端口对齐过去，并打一行日志。
 */
if (LOCAL && BASE_URL.port && Number(BASE_URL.port) !== PORT) {
  console.log(`[serve] --base 的端口 ${BASE_URL.port} 与 --port ${PORT} 不一致 → 服务端口改为 ${BASE_URL.port}`);
  PORT = Number(BASE_URL.port);
}

// ─────────────────────── 用例静态检查（跑浏览器之前，1ms） ───────────────────────
/**
 * 「断言空转」：expect 里的 token 如果本来就是这个用例自己填进去的输入值，
 * 那么这条断言在任何情况下都成立 —— 查询没触发、接口 500、组件崩了，照样绿。
 *
 * 实测踩过（线上首跑）：/whois-lookup 的 expect.text = ['example.com']，而 steps 里
 * fill 的就是 'example.com'；输入框里永远躺着这串字符。它报了 OK，但真实 WHOIS
 * 查询从未执行（该组件必须点按钮才查，用例里没有 click）。同批还有两条同源问题。
 *
 * 假通过比假失败贵得多：假失败会被人查，假通过会被直接写进验收报告。
 * 因此这里在开跑前就把这类 token 列出来，并要求用「独立于输入」的期望值替换。
 * 只想看这份清单：--lint-only
 *
 * 判据只认一个方向：**期望 token 是输入的子串**（输入框里就躺着它 → 断言恒真）。
 * 反向（token 是输入的超集，如期望 `admin:$apr1$` 而输入只有 `admin`）不算空转 ——
 * 它额外要求了 `$apr1$` 出现，那是只有真正算过才有的东西。
 * 分级：`vacuous` 该用例还有别的可信断言；`blind` 整条用例的断言全空转 → 无论
 * 功能好坏都会绿，等于没测，必须补一条能证伪的断言。
 */
function lintCases(cases) {
  const out = [];
  for (const c of cases) {
    if (!c || !c.path) continue;
    const payloads = [];
    for (const s of c.steps || []) {
      if (s.fill && typeof s.fill.text === 'string') payloads.push(s.fill.text);
      if (s.fillLabel && typeof s.fillLabel.text === 'string') payloads.push(s.fillLabel.text);
    }
    // 太短的输入不参与判定，否则正常断言会被大量误报
    const usable = payloads.filter(p => p.length >= 4);
    if (!usable.length) continue;

    const vacuous = [];
    const sound = [];
    for (const tok of c.expect?.text || []) {
      if (typeof tok !== 'string' || tok.length < 3) continue;
      (usable.some(p => p.includes(tok)) ? vacuous : sound).push(`text "${tok}"`);
    }
    for (const tok of c.expect?.regex || []) {
      let re;
      try { re = new RegExp(tok); } catch { continue; }
      (usable.some(p => re.test(p)) ? vacuous : sound).push(`regex /${tok}/`);
    }
    if (!vacuous.length) continue;

    // 能证伪的断言：非空转的 text/regex，或输出区断言（out/outRegex）、页内脚本、画布、图片解码
    const hasReal = sound.length
      || (c.expect?.out || []).length
      || (c.expect?.outRegex || []).length
      || !!c.expect?.js
      || c.expect?.canvasNonBlank
      || c.expect?.imageData;
    out.push({ path: c.path, level: hasReal ? 'vacuous' : 'blind', vacuous, sound });
  }
  return out;
}

const LINT = lintCases(SMOKE_CASES);
const BLIND = LINT.filter(x => x.level === 'blind');
if (BLIND.length) {
  console.log(`[lint] ✗ ${BLIND.length} 条用例处于「断言盲区」：全部断言都能被自身输入满足，功能好坏都会绿`);
  for (const b of BLIND) console.log(`  ✗ ${b.path}：${b.vacuous.join('、')} —— 把这些 token 移到 expect.out / outRegex（取工具区文本+控件值，且已剔除与输入完全相同的值），或补一条能证伪的断言`);
}
if (LINT.length > BLIND.length) {
  console.log(`[lint] ! ${LINT.length - BLIND.length} 条用例含空转断言（另有可信断言兜底，可后续收紧）：`);
  for (const v of LINT.filter(x => x.level === 'vacuous')) {
    console.log(`  ! ${v.path}：空转 ${v.vacuous.join('、')} ｜ 兜底 ${v.sound.join('、')}`);
  }
}
if (!LINT.length) console.log('[lint] 用例静态检查通过：未发现「断言可被自身输入满足」的空转断言');
if (has('--lint-only')) process.exit(BLIND.length ? 1 : 0);

// ─────────────────────────────── 噪声白名单 ───────────────────────────────
// 第三方 host：广告 / 统计 / 字体。这些域报错与被测功能无关。
const NOISE_HOSTS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'google-analytics.com',
  'googletagservices.com',
  'gstatic.com',
  'googleapis.com',
  'plausible.io',
  'cloudflareinsights.com',
  'sentry.io',
];
// 同源但可豁免的 pattern。每一条都要写清理由，否则等于把真问题也在沉默里吞掉。
const NOISE_SAME_ORIGIN = [
  { re: /\/favicon[^/]*\.(ico|png|svg)(\?|$)/, why: '图标缺失与工具功能无关（含 favicon-32x32.png / favicon-16x16.png 等变体）' },
  { re: /\/apple-touch-icon|site\.webmanifest|manifest\.json/, why: 'PWA 图标与清单缺失，不影响工具功能' },
  { re: /\/sw\.js|workbox-|service.?worker/i, why: '无头环境首轮注册 Service Worker 的固有噪声' },
  { re: /net::ERR_ABORTED/, why: '导航切换时被主动中断的请求，非缺陷' },
  { re: /net::ERR_NETWORK_CHANGED|net::ERR_INTERNET_DISCONNECTED/, why: '执行环境网络抖动' },
  { re: /net::ERR_CACHE_MISS/, why: '无缓存首次加载的固有噪声' },
  {
    re: /report-only Content Security Policy|frame-ancestors 'self'/,
    why: 'CSP 处于 report-only 模式（只记录、不阻断）：AdSense iframe 嵌 google.com 触发的日志，非功能缺陷',
  },
];
// 命中即归噪声、且**必须**在报告里单列出来的第三方 URL 判定
const isThirdParty = url => NOISE_HOSTS.some(h => url.includes(h)) || /^https?:\/\//.test(url) && !url.startsWith(BASE);

// ─────────────────────────────── 静态服务（本地模式） ───────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
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
    const inRoot = file === root || file.startsWith(root + path.sep);
    if (!inRoot) {
      res.writeHead(403).end('forbidden');
      return;
    }
    // 目录 → 目录下的 index.html（这是 CF Pages 目录型路由的等价物）
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) {
        file = idx;
      } else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        // 目录存在但没有 index.html —— 如实 404，不要假装成功，
        // 否则「目录型路由被删」这类回归会被 fallback 悄悄掩盖
        res.writeHead(404, { 'content-type': 'text/plain' }).end('no index.html');
        return;
      } else {
        file = path.join(root, 'index.html'); // SPA fallback，与 public/_redirects 的最后一条等价
      }
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  servers.push(server);
  console.log(`[serve] ${root} → http://127.0.0.1:${PORT}`);
}

// ─────────────────────────────── 起点自检 ───────────────────────────────
// 服务没起来时，Chrome 会停在错误页，所有用例一起「明明没挂载却查不出原因」，
// 而且会白白跑满看门狗。这里先探一次，不可达就立刻退出并给出可操作的原因。
if (!LOCAL) {
  let reachable = false;
  try {
    const r = await fetch(BASE + '/', { method: 'HEAD' });
    reachable = r.status > 0;
  } catch {}
  if (!reachable) {
    console.error(
      `[fatal] ${BASE} 不可达。\n` +
        `  如果是 vite dev server：它默认只绑 localhost（在 Windows 上常解析到 ::1），\n` +
        `  用 127.0.0.1 访问不通 —— 启动时加 --host 127.0.0.1。`,
    );
    for (const s of servers) {
      try {
        s.close();
      } catch {}
    }
    process.exit(2);
  }
  console.log(`[check] ${BASE} 可达`);
}

// ─────────────────────────────── Chrome ───────────────────────────────
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(2);
}

const profile = path.join(OUT, `profile-${SHARD_I}-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });

const proxyArgs = LOCAL
  ? ['--no-proxy-server', '--proxy-bypass-list=<-loopback>']
  : process.env.SMOKE_PROXY
    ? ['--proxy-server=' + process.env.SMOKE_PROXY]
    : [];

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--window-size=1440,1000',
    '--force-device-scale-factor=1',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    // 让 camera-recorder 这类工具在无头环境也能拿到（假）设备，避免把
    // 「无头没有摄像头」误判成「工具坏了」
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    ...proxyArgs,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let finished = false;
function teardown(code) {
  if (finished) return;
  finished = true;
  for (const s of servers) {
    try {
      s.close();
    } catch {}
  }
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      chrome.kill('SIGKILL');
    }
  } catch {}
  if (!KEEP_PROFILE) {
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    } catch {}
  }
  process.exit(code);
}

// 整片看门狗：宁可整体失败，也不要挂死在这里
const WATCHDOG = Number(argOf('--watchdog', '1800000'));
setTimeout(() => {
  console.error(`[watchdog] 分片 ${SHARD_I} 超时 ${WATCHDOG}ms，强制收尾`);
  teardown(3);
}, WATCHDOG);
process.on('SIGINT', () => teardown(130));
process.on('uncaughtException', e => {
  console.error(e);
  teardown(1);
});

// ─────────────────────────────── 连 CDP ───────────────────────────────
const portFile = path.join(profile, 'DevToolsActivePort');
let wsUrl = null;
for (let i = 0; i < 120 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 150));
  if (!fs.existsSync(portFile)) continue;
  const [p] = fs.readFileSync(portFile, 'utf8').split('\n');
  try {
    const list = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) {
  console.error('拿不到 CDP endpoint');
  teardown(2);
}

const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let msgId = 0;
const pending = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

const send = (method, params) =>
  new Promise((resolve, reject) => {
    const id = ++msgId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('CDP timeout: ' + method));
    }, 30000);
    pending.set(id, {
      resolve: v => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: e => {
        clearTimeout(timer);
        reject(e);
      },
    });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });

// 每个用例开始前重置的采集桶
let logEntries = [];
let exceptions = [];
let scriptResponses = [];
let loadFailures = [];
// requestId → URL。loadingFailed 事件只给 requestId，不给 URL，
// 不建这张表就没法判断失败的到底是自家 chunk 还是第三方广告（首版就吃了这个亏）
const reqUrl = new Map();

// API 失败态注入（A3）：'fail500' | 'ok200' | null
let interceptApi = null;
const API_STUB_OK = JSON.stringify({
  // 结构对齐真实接口，保证「对照组」走的是成功分支
  domain: 'example.com',
  status: 200,
  headers: { 'content-type': 'text/html' },
  createdAt: new Date().toISOString(),
});

/**
 * 对照组（ok200 / ok200empty）的响应体必须**逐个接口对齐真实契约**，否则前端会走到别的分支，
 * 对照组就失去意义。三个契约（读自 functions/api/*.js 与线上真实响应）：
 *   /api/whois      → { domain, raw, source }（raw 是带中文标签的 RDAP 文本）
 *   /api/webstatus  → { url, status, headers }
 *   /api/today      → { date, events: [{ date, title }], note? }
 *                     note 只在 events 为空时出现（Response.json 会丢掉 undefined 键）
 *
 * ok200empty：只对 /api/today 有意义 —— 伪造「当日无收录」+ note，
 * 用来**确定性**验证空态有没有把接口给的「为什么」渲染出来（不依赖当天日期）。
 */
function stubBodyFor(url, empty = false) {
  if (url.includes('/api/whois')) {
    return JSON.stringify({
      domain: 'example.com',
      raw: '域名          : EXAMPLE.COM\n注册商        : RESERVED-Internet Assigned Numbers Authority\n到期时间      : 2027-08-13 04:00 UTC',
      source: 'https://rdap.verisign.com/com/v1/domain/example.com',
    });
  }
  if (url.includes('/api/webstatus')) {
    return JSON.stringify({
      url: 'https://example.com/',
      status: 200,
      headers: { 'content-type': 'text/html; charset=UTF-8', 'server': 'stub' },
    });
  }
  if (url.includes('/api/today')) {
    if (empty) {
      return JSON.stringify({
        date: '09-19',
        events: [],
        note: '今日暂无收录事件，数据集持续完善中',
      });
    }
    return JSON.stringify({ events: [{ date: '1991-08-06', title: 'stub event for smoke test' }] });
  }
  return API_STUB_OK;
}

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  switch (msg.method) {
    case 'Log.entryAdded':
      if (msg.params.entry.level === 'error') logEntries.push(msg.params.entry);
      break;
    case 'Runtime.exceptionThrown':
      exceptions.push(msg.params.exceptionDetails);
      break;
    case 'Network.requestWillBeSent':
      reqUrl.set(msg.params.requestId, msg.params.request.url);
      break;
    case 'Network.responseReceived': {
      const r = msg.params.response;
      scriptResponses.push({ url: r.url, status: r.status, type: msg.params.type });
      break;
    }
    case 'Network.loadingFailed':
      loadFailures.push({
        url: reqUrl.get(msg.params.requestId) || '',
        type: msg.params.type,
        error: msg.params.errorText,
        canceled: !!msg.params.canceled,
      });
      break;
    case 'Page.javascriptDialogOpening':
      // 原生对话框会冻结渲染进程 —— 一律接管并接受，否则整片卡死
      send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      break;
    case 'Fetch.requestPaused': {
      const { requestId, request } = msg.params;
      if (interceptApi === 'fail500') {
        send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 500,
          responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
          body: Buffer.from('{"error":"injected failure by smoke test"}').toString('base64'),
        }).catch(() => {});
      } else if (interceptApi === 'ok200' || interceptApi === 'ok200empty') {
        send('Fetch.fulfillRequest', {
          requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'content-type', value: 'application/json; charset=utf-8' }],
          body: Buffer.from(stubBodyFor(request.url || '', interceptApi === 'ok200empty')).toString('base64'),
        }).catch(() => {});
      } else {
        send('Fetch.continueRequest', { requestId }).catch(() => {});
      }
      break;
    }
  }
});

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

const evaluate = async (expression, awaitPromise = true) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
  if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.text || ''));
  return r.result.value;
};

// ─────────────────────────────── console 分类 ───────────────────────────────
/**
 * 用例自己声明的噪声规则（`expect.consoleNoise: [{ re, why }]`）。
 *
 * 为什么需要它：A3 用 Fetch 域**故意**注入 500 来验失败态 UI，浏览器必然把那次响应
 * 记成一条同源 console error（`Failed to load resource: ... 500`）。这条错误是**测试自己造的**，
 * 不是页面缺陷；但它长得跟「接口真挂了」一模一样，靠内置白名单无法区分。
 *
 * 与内置白名单同一条规矩：**必须写 why**，没写理由的条目一律不生效并记一条 warning ——
 * 否则这个出口会变成「把不认识的报错都吞掉」的静默开关。
 */
let CASE_NOISE = [];
const CASE_NOISE_SKIPPED = [];
function setCaseNoise(list, caseName) {
  CASE_NOISE_SKIPPED.length = 0;
  CASE_NOISE = (Array.isArray(list) ? list : []).flatMap(n => {
    if (!n || !n.why) { CASE_NOISE_SKIPPED.push({ case: caseName }); return []; }
    return [{ re: n.re instanceof RegExp ? n.re : new RegExp(String(n.re)), why: n.why }];
  });
}
const caseNoiseHit = (url, text) => CASE_NOISE.find(n => n.re.test(url) || n.re.test(text));

function classifyConsole() {
  const blocking = [];
  const noise = [];

  for (const e of logEntries) {
    const url = e.url || '';
    const text = e.text || '';
    const rec = { text: text.slice(0, 300), url: url.split('?')[0] };

    if (isThirdParty(url) || NOISE_HOSTS.some(h => text.includes(h))) {
      noise.push({ ...rec, why: 'third-party' });
      continue;
    }
    const byCase = caseNoiseHit(url, text);
    if (byCase) {
      noise.push({ ...rec, why: '用例声明：' + byCase.why });
      continue;
    }
    const hit = NOISE_SAME_ORIGIN.find(n => n.re.test(url) || n.re.test(text));
    if (hit) {
      noise.push({ ...rec, why: hit.why });
      continue;
    }
    blocking.push(rec);
  }

  for (const x of exceptions) {
    blocking.push({
      text: ('未捕获异常: ' + (x.text || '')).slice(0, 300),
      url: (x.url || '').split('?')[0],
      detail: (x.exception?.description || '').split('\n')[0].slice(0, 200),
    });
  }

  // 同源 JS chunk / CSS 加载失败 = 该页功能或版式必然不可用。
  // 注意：favicon / manifest 这类同源非代码资源也要先过噪声白名单，否则一个图标 404 能把整页判成阻断。
  for (const r of scriptResponses) {
    if (!(r.status >= 400) || !r.url.startsWith(BASE)) continue;
    const hit = NOISE_SAME_ORIGIN.find(n => n.re.test(r.url));
    if (hit) {
      noise.push({ text: `同源资源 HTTP ${r.status}`, url: r.url.split('?')[0], why: hit.why });
      continue;
    }
    const isCode = r.type === 'Script' || r.type === 'Stylesheet' || /\.(m?js|css)(\?|$)/.test(r.url);
    if (!isCode) {
      noise.push({ text: `同源非代码资源 HTTP ${r.status}`, url: r.url.split('?')[0], why: '既非 JS 也非 CSS，不影响工具功能' });
      continue;
    }
    blocking.push({ text: `同源${r.type === 'Stylesheet' ? '样式' : '脚本'} HTTP ${r.status}`, url: r.url.split('?')[0] });
  }
  for (const f of loadFailures) {
    if (f.canceled) continue;
    if (/ERR_ABORTED/.test(f.error)) continue;
    // 第三方资源超时（广告/统计）与工具功能无关，归噪声并记下 host，便于复核
    if (isThirdParty(f.url)) {
      noise.push({ text: `第三方资源失败: ${f.error}`, url: f.url.split('?')[0], why: 'third-party' });
      continue;
    }
    const hit = NOISE_SAME_ORIGIN.find(n => n.re.test(f.url) || n.re.test(f.error));
    if (hit) {
      noise.push({ text: `资源失败(${hit.why}): ${f.error}`, url: f.url.split('?')[0], why: hit.why });
      continue;
    }
    const byCase = caseNoiseHit(f.url, f.error);
    if (byCase) {
      noise.push({ text: `资源失败: ${f.error}`, url: f.url.split('?')[0], why: '用例声明：' + byCase.why });
      continue;
    }
    blocking.push({ text: `资源加载失败: ${f.error}`, url: f.url.split('?')[0] });
  }

  return { blocking, noise };
}

// ─────────────────────────────── 页面交互原语 ───────────────────────────────
const ROOT = '.tool-content';
/**
 * 所有「文本类」输入控件。
 *
 * 用**排除法**而不是类型白名单：白名单曾漏掉 `input[type="password"]`，
 * 后果不只是「找不到」——按 label 定位时会向上爬到公共容器，取到该容器里第一个匹配项，
 * 于是 basic-auth-generator 的 `byLabel('Password')` 实际写进了 Username 框，
 * 表现为「两步都成功但结果错」。白名单每漏一种类型就换一个地方复现，排除法不会。
 */
const TEXT_INPUT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"])' +
  ':not([type="button"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="hidden"])';
const EDITABLE = `textarea, ${TEXT_INPUT}`;

/**
 * 注入到每个页面的小工具对象。
 *
 * 为什么需要它：有些用例必须做「页内往返」（加密→解密、编码→解码、改密钥输出应变），
 * 这类断言没法用「期望某段固定文本」表达，只能让用例在页面里自己算。
 * 与其把这 101 个工具的特殊操作都塞进引擎的步骤 DSL，不如给用例一个脚本出口，
 * 引擎保持稳定。复杂逻辑留在 smoke-cases.mjs 里，一眼能看出每个工具被怎么验的。
 */
const HELPERS = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const SEL = ${JSON.stringify(EDITABLE)};
  const root = () => document.querySelector('.tool-content') || document;
  const controls = () => [...root().querySelectorAll(SEL)].filter(e => vis(e) && !e.disabled);
  const editables = () => controls().filter(e => !e.readOnly);
  const setVal = (el, text) => {
    if (!el) return null;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (setter) setter.call(el, text); else el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return el.value;
  };
  const leafText = e => (e.children.length === 0 ? (e.textContent || '').trim() : '');
  const byLabel = label => {
    const nodes = [...root().querySelectorAll('*')].filter(vis);
    const anchor = nodes.find(e => leafText(e) === label) || nodes.find(e => leafText(e).startsWith(label));
    if (!anchor) return null;
    let node = anchor;
    for (let i = 0; i < 6 && node; i++) {
      const el = [...node.querySelectorAll(SEL)].filter(e => vis(e) && !e.disabled)[0];
      if (el) return el;
      node = node.parentElement;
    }
    return null;
  };
  const clickText = t => {
    const bs = [...document.querySelectorAll('button, [role="button"]')].filter(vis);
    const b = bs.find(x => x.innerText.trim() === t) || bs.find(x => x.innerText.includes(t));
    if (b) { b.click(); return true; }
    return false;
  };
  window.__smoke = { vis, root, controls, editables, setVal, byLabel, clickText, all: () => document.body.innerText };
  return true;
})()`;

const installHelpers = () => evaluate(HELPERS).catch(() => false);

/**
 * 写入受控输入框。
 * 直接改 el.value 不会触发 Vue 的响应式更新 —— 必须走原型链上的原生 setter
 * 再派发 input/change 事件，两件都不能省。
 */
async function fillEditable({ sel, i = 0, text }) {
  const s = sel || EDITABLE;
  const ok = await evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(ROOT)}) || document;
    const els = [...root.querySelectorAll(${JSON.stringify(s)})].filter(e => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.disabled && !e.readOnly;
    });
    const el = els[${i}];
    if (!el) return { ok: false, total: els.length };
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (setter) setter.call(el, ${JSON.stringify(text)}); else el.value = ${JSON.stringify(text)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
    return { ok: true, total: els.length };
  })()`);
  return ok?.ok ? '' : `没找到第 ${i} 个可编辑控件（选择器 ${s}，命中 ${ok?.total ?? 0} 个）`;
}

/** 按标签文案定位输入框。多输入框工具（如 encryption 的加密/解密两个面板）靠序号很脆，
 *  靠 label 文案更稳 —— 这些 label 是界面上真实可见的英文，不是我在用例里造的词。 */
async function fillByLabel({ label, text }) {
  const ok = await evaluate(`(() => {
    if (!window.__smoke) return false;
    const el = window.__smoke.byLabel(${JSON.stringify(label)});
    if (!el) return false;
    window.__smoke.setVal(el, ${JSON.stringify(text)});
    return true;
  })()`);
  return ok ? '' : `按标签找不到输入框：${JSON.stringify(label)}`;
}

/** 用例级脚本出口：表达式返回字符串即视为步骤失败，返回 undefined/null 表示通过。
 *  用页面里的 window.__smoke 做受控写值，或把中间结果挂在 window 上供 expect.js 复核。 */
async function runJsStep(expression) {
  const r = await evaluate(
    `(() => { try { const v = (${expression}); return v == null ? null : String(v); } catch (e) { return 'JS 异常: ' + e.message; } })()`,
  );
  return r ? r : '';
}

/** 点「示例」按钮。
 *  注意 guides.ts 是动态 import 的，组件挂载那一刻 guide 还是 null，
 *  `.guide-example-btn` 根本不在 DOM 里 —— 直接点必然失败（首版就踩了这个）。
 *  这里轮询等它出现；指南区默认折叠也无妨，v-show 的元素照样能被程序化点击。 */
async function applyExampleStep() {
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    found = await evaluate(`!!document.querySelector('.guide-example-btn')`).catch(() => false);
    if (!found) await sleep(150);
  }
  if (!found) return '示例按钮未出现（guide 未加载，或该工具没有 example）';
  const ok = await evaluate(
    `(function(){var b=document.querySelector('.guide-example-btn');if(!b)return false;b.click();return true;})()`,
  );
  return ok ? '' : '示例按钮点击失败';
}

async function clickButton({ text, exact, sel }) {  const res = await evaluate(`(() => {
    if (${JSON.stringify(sel || '')}) {
      const el = document.querySelector(${JSON.stringify(sel || '')});
      if (!el) return { ok: false, why: 'selector miss' };
      el.click();
      return { ok: true, label: (el.innerText || '').trim().slice(0, 40) };
    }
    const want = ${JSON.stringify(text)};
    const vis = b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const match = (b) => ${exact ? 'b.innerText.trim() === want' : 'b.innerText.trim() === want || b.innerText.includes(want)'};
    // 关键：先在工具区内找，找不到才退回全文档。
    // 否则「生成」「校验」这类短词会先命中侧栏工具名（"Token 生成器" / "htpasswd 生成与校验"），
    // 把点击变成一次导航 —— 用例会以「按钮未找到」的形式失败，真因却是点错了地方。
    const scopes = [document.querySelector('.tool-content'), document].filter(Boolean);
    for (const scope of scopes) {
      const btns = [...scope.querySelectorAll('button, [role="button"], a')].filter(vis);
      const b = btns.find(match);
      if (b) {
        b.click();
        return { ok: true, label: b.innerText.trim().slice(0, 40), scope: scope === document ? 'document' : 'tool-content' };
      }
    }
    const btns = [...document.querySelectorAll('button, [role="button"], a')].filter(vis);
    return { ok: false, why: 'no button', sample: btns.map(x => x.innerText.trim()).filter(Boolean).slice(0, 14) };
  })()`);
  if (res?.ok) return '';
  return `按钮未找到：${JSON.stringify(text || sel)}${res?.sample ? '（可见按钮样例 ' + JSON.stringify(res.sample) + '）' : ''}`;
}

/** 点开 naive-ui 之类的下拉，再点中指定文案的选项（选项通常被 teleport 到 body） */
// 真实键盘事件（CDP Input.dispatchKeyEvent）——不是 JS 伪造 Event，
// 因此 keyCode/code/location 这些「浏览器原生才有的字段」是真实值。
// 用于验证监听 document keydown 的工具（如 /keycode-info）。
const KEYMAP = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Tab: { key: 'Tab', code: 'Tab', vk: 9, text: '\t' },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  Space: { key: ' ', code: 'Space', vk: 32, text: ' ' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  F1: { key: 'F1', code: 'F1', vk: 112 },
};

async function pressKey(spec) {
  let K;
  if (typeof spec === 'string') K = KEYMAP[spec];
  else if (spec && /^Key[A-Z]$/.test(spec.code || '')) {
    K = { key: spec.code.slice(3).toLowerCase(), code: spec.code, vk: spec.code.charCodeAt(3), text: spec.code.slice(3).toLowerCase() };
  } else K = spec;
  if (!K || K.vk == null) return `未定义的按键：${JSON.stringify(spec)}`;
  const base = { key: K.key, code: K.code, windowsVirtualKeyCode: K.vk, nativeVirtualKeyCode: K.vk };
  try {
    // 页面必须处于焦点态，否则 keydown 不会派发到 document
    await evaluate('window.focus(); document.body.focus && document.body.focus();').catch(() => {});
    await send('Input.dispatchKeyEvent', { type: K.text ? 'keyDown' : 'rawKeyDown', ...base, ...(K.text ? { text: K.text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  } catch (e) {
    return `按键派发失败：${e.message}`;
  }
  return '';
}

/** 选择下拉项。sel 可以是「逗号分隔的候选选择器」——不同工具的下拉实现不同
 *  （本站自研 c-select 用 .c-select-input；naive-ui 用 .n-select），
 *  与其在每个用例里记清楚，不如按顺序试。 */
async function pickOption({ sel, text }) {
  const opened = await evaluate(`(() => {
    var sels = ${JSON.stringify(sel)}.split(',');
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i].trim());
      if (el) { el.click(); return sels[i].trim(); }
    }
    return false;
  })()`);
  if (!opened) return `下拉未找到：${sel}`;
  await sleep(320);
  const picked = await evaluate(`(() => {
    const opts = [...document.querySelectorAll('.c-select-dropdown-option, .n-base-select-option, [role="option"]')].filter(o => {
      const r = o.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const o = opts.find(x => x.innerText.trim() === ${JSON.stringify(text)}) ||
              opts.find(x => x.innerText.includes(${JSON.stringify(text)}));
    if (!o) return { ok: false, sample: opts.map(x => x.innerText.trim()).filter(Boolean).slice(0, 16) };
    o.click();
    return { ok: true, label: o.innerText.trim().slice(0, 40) };
  })()`);
  if (picked?.ok) return '';
  return `选项未找到：${JSON.stringify(text)}${picked?.sample ? '（样例 ' + JSON.stringify(picked.sample) + '）' : ''}`;
}

async function uploadFile({ sel, i = 0, file }) {
  const abs = path.resolve(REPO, file);
  if (!fs.existsSync(abs)) return `待上传文件不存在：${abs}`;
  const { root } = await send('DOM.getDocument', { depth: -1 });
  const q = await send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: sel || 'input[type="file"]',
  });
  const nodeId = q.nodeIds[i];
  if (!nodeId) return `文件输入未找到：${sel || 'input[type="file"]'}`;
  await send('DOM.setFileInputFiles', { files: [abs], nodeId });
  await sleep(600);
  return '';
}

/** 收集页面可见文本 + 所有输入框/下拉的值（只看 innerText 会漏掉工具的输出框） */
async function collectText() {
  return (
    (await evaluate(`(() => {
      const parts = [document.body.innerText];
      for (const el of document.querySelectorAll('input, textarea')) {
        if (['checkbox','radio','password','file','submit','button'].includes(el.type)) continue;
        if (el.value) parts.push(el.value);
      }
      for (const el of document.querySelectorAll('select')) {
        if (el.value) parts.push(el.value);
      }
      // 把输出也暴露给用例里的自定义 js 断言用
      window.__smokeText = parts.join(String.fromCharCode(10));
      window.__smokeValues = [...document.querySelectorAll('input, textarea')].map(e => e.value).filter(Boolean);
      return window.__smokeText;
    })()`)) || ''
  );
}

// ─────────────────────────────── 初始 HTML 层 ───────────────────────────────
const stripTags = html =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function checkHtml(c) {
  if (SKIP_HTML_LAYER) {
    return { skipped: true, checks: {}, bad: [], reason: '显式跳过（--skip-html-layer）' };
  }
  const url = BASE + c.path + '/';
  const checks = {};
  let status = -1;
  let ctype = '';
  let html = '';
  try {
    const r = await fetch(url, { redirect: 'manual' });
    status = r.status;
    ctype = r.headers.get('content-type') || '';
    html = status === 200 ? await r.text() : '';
  } catch (e) {
    checks.fetchError = String(e.message || e);
  }

  checks.status200 = status === 200;
  checks.htmlType = /text\/html/.test(ctype);
  checks.hasH1 = /<h1[\s>]/i.test(html);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
  checks.titleNonEmpty = !!title;
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) || [])[1] || '';
  checks.canonicalSelf = canonical === CANON_ORIGIN + c.path + '/';
  checks.adsense = html.includes('ca-pub-7944759654100814');
  const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const bodyText = stripTags(html);
  checks.bodyLen = bodyText.length;
  checks.bodyLongEnough = bodyText.length >= 60;
  checks.h1 = h1;
  checks.title = title;
  checks.canonical = canonical;

  const bad = Object.entries(checks)
    .filter(([k, v]) => typeof v === 'boolean' && !v)
    .map(([k]) => k);
  return { status, ctype, checks, bad, htmlTitle: title, htmlH1: h1 };
}

// ─────────────────────────────── 单个工具页 ───────────────────────────────
async function runCase(c) {
  const t0 = Date.now();
  const shotName = `${c.name || c.path.replace(/\//g, '_')}.png`;
  const rec = {
    path: c.path,
    name: c.name || c.path,
    category: c.category || '',
    label: c.label || '',
    tier: c.tier || 'io',
    strategy: c.strategy || '',
    onlineOnly: !!c.onlineOnly,
    skipped: false,
    skipReason: '',
    html: null,
    runtime: {},
    steps: [],
    assert: {},
    console: { blocking: [], noise: [] },
    verdict: 'pass',
    failures: [],
    shot: '',
    elapsedMs: 0,
  };

  const fail = (m, kind = 'blocking') => {
    rec.failures.push({ msg: m, kind });
    if (kind === 'blocking') rec.verdict = 'fail';
    else if (rec.verdict === 'pass') rec.verdict = 'warn';
  };

  // 本地模式没有 Pages Functions，依赖 /api/* 的页面必然拿不到数据
  if (c.onlineOnly && LOCAL) {
    rec.skipped = true;
    rec.skipReason = '依赖 Pages Functions（/api/*），本地静态服务没有';
    rec.verdict = 'skip';
    return rec;
  }
  if (c.tier === 'skip-env') {
    rec.skipped = true;
    rec.skipReason = c.skipReason || '环境不可得';
    rec.verdict = 'skip';
    return rec;
  }

  // ① ② HTTP + 初始 HTML
  rec.html = await checkHtml(c);
  if (rec.html.skipped) {
    // 明确留痕：这一轮没验预渲染层，不能当作「全绿」
    runtimeOnly = true;
  } else {
  if (!rec.html.checks.status200) {
    fail(`初始 HTML 非 200：实际 ${rec.html.status}${rec.html.status === 308 ? '（尾斜杠规范回归？）' : ''}`);
  }
  for (const k of rec.html.bad) {
    if (k !== 'status200') fail(`初始 HTML 检查未过：${k}`);
  }
  // 标题与 locales/<locale>.yml 声明的标题一致性（能抓到「工具定义漏接 translate()」这类缺陷）
  // 期望值以 --locale 为准，不再写死 zh.yml（见文件上方 LOCALE 的说明）
  //
  // 键名用 **path 段**推导，不用用例里的 name：
  //   /base-converter → tools.base-converter.title（而 c.name 是 'integer-base-converter'）
  //   两者对多数工具相同、对少数不同，用 name 会漏判（实测 2 例）。
  const titleKey = c.path.replace(/^\/+|\/+$/g, '');
  const expectedTitle = LOCALE_TITLES[titleKey] ?? LOCALE_TITLES[c.name];
  if (!expectedTitle) {
    fail(`locales/${LOCALE}.yml 里找不到 tools.${titleKey}.title —— 判据缺失，不计入通过`);
  } else if (rec.html.htmlH1 && rec.html.htmlH1 !== expectedTitle) {
    fail(`初始 HTML 的 H1 与 ${LOCALE}.yml 不一致：页面「${rec.html.htmlH1}」≠ 词条「${expectedTitle}」`);
  }
  }

  // ③④⑤ 运行时层
  interceptApi = c.interceptApi || null;
  setCaseNoise(c.expect && c.expect.consoleNoise, c.name || c.path);
  if (CASE_NOISE_SKIPPED.length) {
    rec.warnings = [...(rec.warnings || []), 'expect.consoleNoise 有条目没写 why，已忽略（写理由才能豁免）'];
  }
  // A3：只有确实要注入 API 响应时才开 Fetch 域，且把 pattern 限定在 /api/ 下 ——
  // 不设 pattern 会把每个请求（含全部静态资源）都 pause 掉，既拖慢又容易漏 continue 而挂死页面。
  await send('Fetch.disable').catch(() => {});
  if (interceptApi) {
    await send('Fetch.enable', {
      patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }],
    }).catch(() => {});
  }
  logEntries = [];
  exceptions = [];
  scriptResponses = [];
  loadFailures = [];
  reqUrl.clear();

  try {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(120);
    await send('Page.navigate', { url: BASE + c.path + '/' });

    // 轮询等待挂载 —— 固定 sleep 会把「chunk 还没加载完」误判成「功能坏了」。
    // 默认 10s；重依赖工具（如 text-diff 的 Monaco）在 dev 下要慢得多，可用 case.mountTimeout 放宽。
    let mounted = false;
    // mountTimeout 是**显式覆盖**，不再被 0.6×BUDGET 压回去 ——
    // 否则写了 mountTimeout: 45000 也会被 default 的 BUDGET 悄悄截成 12s，等于没写。
    const mountMs = c.mountTimeout || Math.min(10000, BUDGET * 0.6);
    const mountDeadline = Date.now() + mountMs;
    while (Date.now() < mountDeadline) {
      mounted = await evaluate(`!!document.querySelector('.tool-layout')`).catch(() => false);
      if (mounted) break;
      await sleep(150);
    }
    rec.runtime.mounted = mounted;
    if (!mounted) fail(`组件未挂载：.tool-layout 在 ${Math.round(mountMs / 1000)}s 内没出现`);
    else await installHelpers();

    rec.runtime.hasToolContent = await evaluate(`!!document.querySelector('.tool-content')`).catch(() => false);
    if (!rec.runtime.hasToolContent) fail('缺少 .tool-content（工具组件插槽容器）');

    rec.runtime.h1 = (await evaluate(`(document.querySelector('h1')||{}).innerText || ''`).catch(() => '')) || '';
    rec.runtime.expectH1 = rec.html.htmlH1 || c.zhTitle || '';
    rec.runtime.h1MatchesPrerender =
      !!rec.runtime.h1 && !!rec.runtime.expectH1 && rec.runtime.h1.trim() === rec.runtime.expectH1.trim();
    if (!rec.runtime.h1MatchesPrerender) {
      fail(`运行时 H1「${rec.runtime.h1}」≠ 预渲染 H1「${rec.runtime.expectH1}」`);
    }

    // ⑤ 客户端是否真的接管了（预渲染骨架必须被替换掉）
    rec.runtime.skeletonGone = !(await evaluate(`!!document.querySelector('.dd-tool-seo')`).catch(() => true));
    if (!rec.runtime.skeletonGone) fail('预渲染骨架 .dd-tool-seo 仍在 DOM —— 客户端渲染疑似未接管');

    rec.runtime.navPresent = await evaluate(
      `!!document.querySelector('.menu-layout, nav, aside')`,
    ).catch(() => false);

    // JS chunk 是否加载
    const ownScripts = scriptResponses.filter(r => r.url.startsWith(BASE) && /\.(m?js)(\?|$)/.test(r.url));
    rec.runtime.scriptCount = ownScripts.length;
    rec.runtime.scriptBad = ownScripts.filter(r => r.status >= 400);
    if (ownScripts.length === 0 && !LOCAL) fail('没有观察到任何同源 JS 加载');
  } catch (e) {
    fail('运行时检查异常：' + (e.message || e));
  }

  // 交互步骤
  if (!rec.skipped && rec.runtime.mounted) {
    // 单页预算按用例放宽：重依赖工具（Monaco 等）光挂载就要几十秒
    const budget = Math.max(BUDGET, (c.mountTimeout || 0) + 10000);
    for (const step of c.steps || []) {
      if (Date.now() - t0 > budget) {
        rec.steps.push({ step: JSON.stringify(step), err: '超出单页预算' });
        fail('超出单页预算，后续步骤未执行', 'warn');
        break;
      }
      let err = '';
      try {
        if (step.applyExample) err = await applyExampleStep();
        else if (step.clickSel) err = await clickButton({ sel: step.clickSel });
        else if (step.click !== undefined) err = await clickButton({ text: step.click, exact: false });
        else if (step.clickExact !== undefined) err = await clickButton({ text: step.clickExact, exact: true });
        else if (step.fill) err = await fillEditable(step.fill);
        else if (step.fillLabel) err = await fillByLabel(step.fillLabel);
        else if (step.pick) err = await pickOption(step.pick);
        else if (step.key) err = await pressKey(step.key);
        else if (step.upload) err = await uploadFile(step.upload);
        else if (step.js) err = await runJsStep(step.js);
        else if (step.wait) await sleep(step.wait);
        else if (step.waitText) {
          const until = Date.now() + (step.waitText.ms || 4000);
          // scope：等待范围。默认整页，但**工具页的文案常常在「工具描述/使用说明」里
          // 也出现一份**，而描述在 .tool-content 之外 —— 于是「等结果出现」会立刻
          // 被描述文字满足，几秒后就断言，结果还在飞。实测踩过：/whois-lookup 等
          // '注册信息'，描述里就有这四个字，请求却还在 pending（按钮停在"查询中…"）。
          // 等结果文案时一律显式限定 scope: '.tool-content'。
          const q = step.waitText.scope
            ? `(document.querySelector('${step.waitText.scope}') || {}).innerText || ''`
            : 'document.body.innerText';
          let hit = false;
          while (Date.now() < until && !hit) {
            const txt = await evaluate(q).catch(() => '');
            hit = (txt || '').includes(step.waitText.text);
            if (!hit) await sleep(200);
          }
          if (!hit) err = `等待文案超时：${step.waitText.text}`;
        } else if (step.waitSel) {
          // 等某个选择器出现（比等文案更硬：元素存在与否不会被别处的同名字符串骗过）
          const until = Date.now() + (step.waitSel.ms || 6000);
          let hit = false;
          while (Date.now() < until && !hit) {
            hit = await evaluate(`!!document.querySelector(${JSON.stringify(step.waitSel.sel)})`).catch(() => false);
            if (!hit) await sleep(200);
          }
          if (!hit) err = `等待元素超时：${step.waitSel.sel}`;
        } else {
          err = '未知步骤：' + JSON.stringify(step);
        }
      } catch (e) {
        err = '步骤异常：' + (e.message || e);
      }
      rec.steps.push({ step: JSON.stringify(step), err });
      if (err) break;
      await sleep(180);
    }
  }

  await sleep(350);

  // 断言
  const text = await collectText().catch(() => '');
  rec.assert.textLen = text.length;
  const exp = c.expect || {};
  const missing = (exp.text || []).filter(s => !text.includes(s));
  const forbidden = (exp.not || []).filter(s => text.includes(s));
  const regexMiss = (exp.regex || []).filter(s => !new RegExp(s, 'm').test(text));

  /**
   * 输出区断言通道（out / outRegex / outNot）—— 这是本次新增的、也是必须有的。
   *
   * 为什么需要：text 断言的取值面是「body.innerText + 全部控件值」，对「输出恰好是
   * 输入的回显」这类工具（URL 解析、UA 解析、格式化…），期望值本来就在输入框里躺着 ——
   * 功能好坏都会绿。实测有 7 条用例落在这种盲区里（`--lint-only` 会列出来）。
   *
   * 取值面 = 工具区（.tool-content）自身的 innerText + 该区域内的控件值，
   * **但剔除与本用例 fill 载荷完全相同的那个值**（那就是输入本身）。
   * 两条实测依据：
   *   · 结果渲染成文本的（json-prettify 的美化结果）→ innerText 有；
   *   · 结果渲染进只读 input 的（url-parser 的 protocol/host/path）→ innerText 没有，
   *     得靠控件值 —— 所以只取 innerText 会漏，只取控件值又会被输入污染。
   * 因此必须取「文本 + 剔除输入后的控件值」。
   */
  const fillPayloads = [];
  for (const s of c.steps || []) {
    if (s.fill && typeof s.fill.text === 'string') fillPayloads.push(s.fill.text);
    if (s.fillLabel && typeof s.fillLabel.text === 'string') fillPayloads.push(s.fillLabel.text);
  }
  const outScope = (await evaluate(`(function(){
    var r = document.querySelector('.tool-content');
    if (!r) return { text: '', values: [] };
    var vals = [].slice.call(r.querySelectorAll('input, textarea'))
      .filter(function(e){ return ['checkbox','radio','password','file','submit','button'].indexOf(e.type) < 0; })
      .map(function(e){ return e.value; }).filter(Boolean);
    return { text: r.innerText || '', values: vals };
  })()`).catch(() => null)) || { text: '', values: [] };
  const outValues = outScope.values.filter(v => !fillPayloads.includes(v));
  const outAll = outScope.text + '\n' + outValues.join('\n');
  const outMissing = (exp.out || []).filter(s => !outAll.includes(s));
  const outRegexMiss = (exp.outRegex || []).filter(s => !new RegExp(s, 'm').test(outAll));
  const outForbidden = (exp.outNot || []).filter(s => outAll.includes(s));
  let custom = null;
  if (exp.js) {
    try {
      // 这里**不能**用 !! 强制转布尔：那样「返回一串原因字符串」会被转成 true 而静默通过，
      // 而 `return null` 会被转成 false 当失败 —— 两种写法都不直观（实测踩过：
      // /today-in-history 的 js 返回 null 表示「空态也算合法」，被 !! 变成 false 后误报失败）。
      // 约定与步骤里的 js 一致：返回 false 或**非空字符串**（作为失败原因）即失败。
      custom = await evaluate(`(() => { try { return (${exp.js}); } catch (e) { return 'ERR:' + e.message; } })()`);
    } catch (e) {
      custom = 'ERR:' + (e.message || e);
    }
  }
  let canvas = null;
  if (exp.canvasNonBlank) {
    canvas = await evaluate(`(() => {
      const cs = [...document.querySelectorAll('canvas')].filter(c => c.width > 0 && c.height > 0);
      if (!cs.length) return { count: 0 };
      return { count: cs.length, nonBlank: cs.some(c => {
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
          return false;
        } catch (e) { return false; }
      }) };
    })()`).catch(() => null);
  }

  /**
   * 图片产物断言（二维码一类）。
   *
   * 为什么不能沿用 canvasNonBlank：本项目的二维码工具走 `QRCode.toDataURL()`，
   * 渲染成 `<img src="data:image/png;base64,...">` —— 页面上**不存在 canvas 元素**，
   * canvas 断言会报 `{"count":0}`，看起来像「工具没出图」，其实是判据选错了产物类型。
   *
   * 判据 = 目标里存在一个 src 为 `data:` / `blob:` 的 `<img>`，且：
   *   ① naturalWidth/Height > 0 —— 浏览器真的解码出了位图（只挂上属性但加载失败不算）
   *   ② 解码后字节数 ≥ minBytes（默认 200）—— 排除 1×1 占位图、空 data URL
   * 出图是异步的（toDataURL 要等一次动态 import + 编码），所以轮询等待而不是拍一次快照。
   */
  let image = null;
  if (exp.imageData) {
    const o = typeof exp.imageData === 'object' && exp.imageData ? exp.imageData : {};
    const sel = o.sel || '.tool-content img';
    const minBytes = o.minBytes ?? 200;
    const probe = `(function(){
      var imgs = [].slice.call(document.querySelectorAll(${JSON.stringify(sel)}));
      return imgs.map(function(im){
        var s = im.getAttribute('src') || '';
        var kind = s.slice(0, 5) === 'data:' ? 'data' : (s.slice(0, 5) === 'blob:' ? 'blob' : 'other');
        var i = s.indexOf('base64,');
        return {
          kind: kind,
          bytes: i >= 0 ? Math.floor((s.length - i - 7) * 3 / 4) : 0,
          w: im.naturalWidth || 0,
          h: im.naturalHeight || 0,
        };
      });
    })()`;
    const good = list =>
      Array.isArray(list)
      && list.some(x => (x.kind === 'data' || x.kind === 'blob') && x.bytes >= minBytes && x.w > 0 && x.h > 0);
    const deadline = Date.now() + 3000;
    do {
      image = await evaluate(probe).catch(() => null);
      if (good(image)) break;
      await sleep(300);
    } while (Date.now() < deadline);
    image = { sel, minBytes, samples: Array.isArray(image) ? image : [], ok: good(image) };
  }

  rec.assert.missing = missing;
  rec.assert.forbidden = forbidden;
  rec.assert.regexMiss = regexMiss;
  rec.assert.outMissing = outMissing;
  rec.assert.outRegexMiss = outRegexMiss;
  rec.assert.outForbidden = outForbidden;
  rec.assert.outText = outAll.replace(/\n{2,}/g, '\n').slice(0, 800);
  rec.assert.custom = custom;
  rec.assert.canvas = canvas;
  rec.assert.image = image;
  // 留证：失败的断言必须能自证，否则报告里只有「缺失」没有「实际是什么」，无法判断是缺陷还是用例写错。
  // toolText 只取工具区（含 input/textarea 的值），避免 800 字全被侧栏导航吃掉。
  rec.assert.observedText = text.slice(0, 800);
  rec.assert.toolText = await evaluate(`(function(){
    var r = document.querySelector('.tool-content');
    if (!r) return '';
    var parts = [r.innerText || ''];
    [].slice.call(r.querySelectorAll('input, textarea')).forEach(function(e){ if (e.value) parts.push(e.value); });
    return parts.join('\\n').replace(/\\n{2,}/g, '\\n').slice(0, 1500);
  })()`).catch(() => '');
  rec.assert.controlValues = await evaluate('(window.__smokeValues || []).map(function(v){return v.length>120?v.slice(0,120):v})').catch(() => []);

  const stepErrs = rec.steps.filter(s => s.err);
  if (stepErrs.length) fail('交互步骤失败：' + stepErrs[0].err);
  if (missing.length) fail('期望文本缺失：' + JSON.stringify(missing));
  if (forbidden.length) fail('命中禁止文本：' + JSON.stringify(forbidden));
  if (regexMiss.length) fail('期望正则未命中：' + JSON.stringify(regexMiss));
  if (outMissing.length) fail('输出区缺少文本：' + JSON.stringify(outMissing));
  if (outRegexMiss.length) fail('输出区正则未命中：' + JSON.stringify(outRegexMiss));
  if (outForbidden.length) fail('输出区命中禁止文本：' + JSON.stringify(outForbidden));
  // 注意整块都要在 exp.js 存在时才判 —— custom 的初值就是 null，
  // 不判 exp.js 会把「这条用例压根没写 js 断言」当成「js 返回了 null」而误报失败
  // （本地 A3 一跑就抓到了这个回归）。
  if (exp.js) {
    if (custom === false || custom === null || custom === undefined) fail('自定义断言未通过');
    else if (typeof custom === 'string' && custom && !custom.startsWith('ERR:')) fail('自定义断言未通过：' + custom);
    if (typeof custom === 'string' && custom.startsWith('ERR:')) fail('自定义断言异常：' + custom);
  }
  if (exp.canvasNonBlank && (!canvas || !canvas.count || !canvas.nonBlank)) {
    fail('canvas 未渲染出内容：' + JSON.stringify(canvas));
  }
  if (exp.imageData && !(image && image.ok)) {
    fail('图片产物未渲染出可解码位图：' + JSON.stringify(image));
  }

  // console
  const { blocking, noise } = classifyConsole();
  rec.console = { blocking, noise };
  if (blocking.length) fail('影响使用的 console 错误 ' + blocking.length + ' 条');
  if (noise.length) rec.noiseCount = noise.length;

  if (c.expectMountOnly) rec.tier = 'mount';

  // 截图：默认只留失败页，避免产出无意义的 101 张图
  if (SHOT_ALL || rec.verdict === 'fail') {
    try {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, shotName), Buffer.from(shot.data, 'base64'));
      rec.shot = shotName;
    } catch {}
  }

  // 关掉响应注入，避免污染下一条用例
  await send('Fetch.disable').catch(() => {});

  rec.elapsedMs = Date.now() - t0;
  return rec;
}

// ─────────────────────────────── 诊断模式 ───────────────────────────────
// 写用例时需要看清「这个页面到底渲染出了什么」：指南区有没有出来、有哪些按钮、
// 哪些可写控件、同源 chunk 是否都 200。靠猜会写出大量假失败用例，所以留这个出口。
if (has('--probe')) {
  const pool = SMOKE_CASES.filter(c => c && c.path);
  const targets = ONLY.length
    ? pool.filter(c => ONLY.some(o => c.path === o || c.name === o))
    : pool.filter((_, i) => i % SHARD_N === SHARD_I - 1);
  for (const c of targets) {
    logEntries = [];
    exceptions = [];
    scriptResponses = [];
    loadFailures = [];
    reqUrl.clear();
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(150);
    await send('Page.navigate', { url: pageUrl(c.path) });
    let mounted = false;
    for (let k = 0; k < 80 && !mounted; k++) {
      mounted = await evaluate(`!!document.querySelector('.tool-layout')`).catch(() => false);
      if (!mounted) await sleep(150);
    }
    await installHelpers();
    await sleep(600);
    const info = await evaluate(`(function(){
      var q = function(s){ return document.querySelector(s); };
      var vis = window.__smoke ? window.__smoke.vis : function(){ return true; };
      var gb = q('.guide-example-btn');
      return {
        mounted: !!q('.tool-layout'),
        skeletonGone: !q('.dd-tool-seo'),
        h1: (q('h1') || {}).innerText || '',
        pathname: location.pathname,
        routerPath: (function () {
          try {
            var app = q('#app').__vue_app__;
            var r = app && app.config.globalProperties.$route;
            return r ? r.path : null;
          } catch (e) { return 'ERR:' + e.message; }
        })(),
        headerLen: (function () { var h = q('.tool-header'); return h ? h.innerText.trim().length : -1; })(),
        headerText: (function () { var h = q('.tool-header'); return h ? h.innerText.trim().replace(/\s+/g, ' ').slice(0, 180) : null; })(),
        descText: (function () { var d = q('.description'); return d ? d.innerText.trim().slice(0, 60) : null; })(),
        relatedSection: !!q('.related'),
        relatedCount: document.querySelectorAll('.related a').length,
        breadcrumb: (function () { var b = q('.breadcrumb'); return b ? b.innerText.trim().replace(/\s+/g, ' ') : null; })(),
        guideCount: document.querySelectorAll('.guide').length,
        guideBlock: !!q('.guide'),
        guideToggle: q('.guide-toggle') ? q('.guide-toggle').innerText.trim() : null,
        guideBody: !!q('.guide-body'),
        guideExampleWrap: !!q('.guide-example'),
        exampleBtn: gb ? gb.innerText.trim() : null,
        guideSeenKey: (function(){ try { return localStorage.getItem('digdevbox:guide-seen'); } catch(e) { return 'ERR'; } })(),
        buttons: [].slice.call(document.querySelectorAll('.tool-content button')).filter(vis).map(function(b){ return b.innerText.trim().slice(0,24); }),
        controls: (window.__smoke ? window.__smoke.controls() : []).map(function(e,i){ return { i: i, tag: e.tagName, type: e.type, ro: e.readOnly, ph: (e.placeholder||'').slice(0,42), len: (e.value||'').length }; }),
        // 下拉类控件的真实 class 名 —— c-select 包的是 naive-ui 哪个组件、根 class 叫什么，
        // 不能靠猜（.n-select 这个选择器就猜错过一次）。
        // 注意：本段位于模板字符串内，注释里不能出现反引号，否则会截断字符串。
        selectLike: [].slice.call(document.querySelectorAll('.tool-content *')).map(function(e){
          var c = (e.className && e.className.toString) ? e.className.toString() : '';
          if (!c || !/select/i.test(c)) return null;
          var hit = c.split(/\\s+/).filter(function(x){ return /select/i.test(x); });
          return hit.length ? (e.tagName + '.' + hit.join('.')) : null;
        }).filter(Boolean).filter(function(v, i, a){ return a.indexOf(v) === i; }).slice(0, 12),
      };
    })()`).catch(e => ({ probeError: String(e.message || e) }));
    console.log(`\n===== PROBE ${c.path} =====`);
    console.log(JSON.stringify(info, null, 1));
    console.log('own-js:', JSON.stringify(scriptResponses.filter(r => r.url.startsWith(BASE)).map(r => r.status + ' ' + r.url.split('/').pop()).slice(0, 24)));
    console.log('failed:', JSON.stringify(loadFailures.map(f => f.error + ' ' + f.url.split('/').slice(0, 3).join('/'))));
    const { blocking, noise } = classifyConsole();
    console.log('blocking:', JSON.stringify(blocking).slice(0, 500));
    console.log('noise:', JSON.stringify(noise).slice(0, 500));
  }
  teardown(0);
}

// ─────────────────────────────── 跑起来 ───────────────────────────────
const all = SMOKE_CASES.filter(c => c && c.path);
const filtered = ONLY.length
  ? all.filter(c => ONLY.some(o => c.path === o || c.name === o || c.path === '/' + o))
  : all;
const mine = filtered.filter((_, i) => i % SHARD_N === SHARD_I - 1);

console.log(
  `[smoke] 共 ${all.length} 条用例；本片 ${SHARD_I}/${SHARD_N} 跑 ${mine.length} 条；base=${BASE}${LOCAL ? '（本地）' : ''}`,
);

const results = [];
let n = 0;
for (const c of mine) {
  n++;
  const rec = await runCase(c).catch(e => ({
    path: c.path,
    name: c.name || c.path,
    verdict: 'fail',
    failures: [{ msg: '用例执行器抛错：' + (e.message || e), kind: 'blocking' }],
    console: { blocking: [], noise: [] },
  }));
  results.push(rec);
  const mark = { pass: 'OK  ', fail: 'FAIL', skip: 'SKIP', warn: 'WARN' }[rec.verdict] || '????';
  console.log(
    `${mark} [${n}/${mine.length}] ${rec.path.padEnd(46)} ${rec.elapsedMs || 0}ms` +
      (rec.skipped ? ` — ${rec.skipReason}` : '') +
      (rec.failures?.length ? '\n       ✗ ' + rec.failures.map(f => f.msg).join('\n       ✗ ') : ''),
  );
}

const summary = {
  shard: `${SHARD_I}/${SHARD_N}`,
  base: BASE,
  local: LOCAL,
  startedAt: new Date().toISOString(),
  total: results.length,
  pass: results.filter(r => r.verdict === 'pass').length,
  fail: results.filter(r => r.verdict === 'fail').length,
  warn: results.filter(r => r.verdict === 'warn').length,
  skip: results.filter(r => r.verdict === 'skip').length,
  htmlLayerSkipped: runtimeOnly,
  results,
};
fs.writeFileSync(path.join(OUT, `shard-${SHARD_I}.json`), JSON.stringify(summary, null, 1), 'utf-8');

console.log(
  `\n[smoke] 分片 ${SHARD_I}/${SHARD_N} 汇总：pass=${summary.pass} fail=${summary.fail} warn=${summary.warn} skip=${summary.skip}`,
);

/**
 * 覆盖面自证 —— 为什么要单独印这一块：
 *
 * `pass=98 fail=0 skip=3` 与 `pass=101 fail=0 skip=0` 都会让脚本 `exit 0`。
 * 只看退出码时，「3 条被环境性跳过」与「101 条全过」在终端里长得几乎一样，
 * 极易把**覆盖面缩水**读成「全站通过」。
 *
 * 所以这里把四个数分开印，并加两条硬判据：
 *   ① 计划数必须被「执行 + 跳过」完全消耗（用例不得凭空消失）
 *   ② 线上模式（非本地 static serve）不允许出现 SKIP ——
 *      本地那 3 条 SKIP 的正当理由是「依赖 Pages Functions `/api/*`」，
 *      线上这些接口可用，再出现 SKIP 就说明有别的环境原因在吞用例，必须查。
 */
const executed = summary.total - summary.skip;
console.log(
  `[smoke] 覆盖面：计划 ${all.length} 条 / 本片上界 ${mine.length} · ` +
    `执行 ${executed} · 跳过 ${summary.skip} · 失败 ${summary.fail} · 警告 ${summary.warn}`,
);

// ① 用例消耗完整性：本片实际跑的条数 = 执行 + 跳过（两者都不该为负或凭空多出）
if (executed + summary.skip !== summary.total) {
  console.log(
    `[smoke] ✗ 覆盖不完整：执行 ${executed} + 跳过 ${summary.skip} ≠ 本片总条数 ${summary.total}`,
  );
  summary.coverageShrunk = true;
}

/**
 * ②③ 两条覆盖面判据只在**全量跑**时生效。
 * `--only` 是单工具诊断模式，它的本分就是「只跑几条」；
 * 用全量口径去要求它，只会产出假 FAIL，把诊断跑本身变成噪声源。
 */
if (ONLY.length === 0) {
  // ② 单分片跑时，本片应等于全集（分片模式下每片只是一部分，不做此断言）
  if (SHARD_N === 1 && summary.total !== all.length) {
    console.log(
      `[smoke] ✗ 覆盖不完整：单分片跑了 ${summary.total} 条，但用例集共 ${all.length} 条`,
    );
    summary.coverageShrunk = true;
  }

  // ③ 线上模式不允许环境性跳过
  if (!LOCAL && summary.skip > 0) {
    console.log(
      `[smoke] ✗ 线上模式出现 ${summary.skip} 条 SKIP —— 线上不应有环境性跳过，需逐条核对理由。`,
    );
    summary.coverageShrunk = true;
  }
} else {
  console.log(`[smoke] ℹ 诊断模式（--only ${ONLY.length} 项）：不做全量覆盖面断言。`);
}

if (runtimeOnly) {
  console.log('[smoke] ⚠ 本轮跳过了「初始 HTML / 预渲染」层（--skip-html-layer）——只验证了运行时层，**不可当作完整验收**。');
  console.log('[smoke]   完整验收请对 dist 产物或线上跑（不加该开关）。');
}
console.log(`[smoke] 明细 → ${path.join(OUT, `shard-${SHARD_I}.json`)}`);

teardown(summary.fail || summary.coverageShrunk ? 1 : 0);
