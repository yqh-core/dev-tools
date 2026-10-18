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
 * 两个只读的证伪 / 绑定探针（不设环境变量时完全空转，不改变任何行为）
 *   SMOKE_FAKE_EXAMPLE=1  把示例的期望值改错一位 → applyExample 那一步必须判红
 *   SMOKE_FILL_NOISE=1    示例填入并核对通过后，再把主输入改成一个无关值 →
 *                         用例自己的断言**必须**变红；还绿就说明那些断言不依赖被填入的数据
 *                         （10-18 首次使用抓出 6 条，逐条定性见当条 commit 与台账：
 *                          其中 4 条是断言弱点，2 条是设计使然，不是一锅端的"缺陷"）
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
 *   --serve-dist <dir>  起内置静态服务（目录 index.html + 与 CF Pages 同构的 404：
 *                       缺文件回 404.html 并带状态 404，不再假装 200 首页壳）
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
import * as RULES from './smoke-console-rules.mjs';
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

/**
 * 引擎认识的 expect 键 —— 白名单，不是文档。
 *
 * 为什么要机器化：`expect.htmlNotLd` 少写一个字母（`htmlNotLdd`）时，取值的代码
 * 读到 undefined，那条断言**永远不会执行**，而用例照样报绿。这比写错期望值更坏 ——
 * 后者会红，前者永远不红。新增通道时必须同时加进这里。
 */
const KNOWN_EXPECT_KEYS = [
  'text', 'not', 'regex',
  'out', 'outRegex', 'outNot',
  'js', 'htmlLd', 'htmlNotLd',
  'canvasNonBlank', 'imageData',
  'consoleNoise',
];
const UNKNOWN_EXPECT = SMOKE_CASES
  .filter(c => c && c.expect)
  .map(c => ({
    path: c.path,
    keys: Object.keys(c.expect).filter(k => !KNOWN_EXPECT_KEYS.includes(k)),
  }))
  .filter(x => x.keys.length);
if (UNKNOWN_EXPECT.length) {
  console.log(`[lint] ✗ ${UNKNOWN_EXPECT.length} 条用例写了引擎不认识的 expect 键 —— 那条断言不会执行（拼错通道名 = 永久假绿）：`);
  for (const u of UNKNOWN_EXPECT) console.log(`  ✗ ${u.path}：${u.keys.join(', ')}`);
}
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
if (has('--lint-only')) process.exit(BLIND.length || UNKNOWN_EXPECT.length ? 1 : 0);

// 名单与归类规则本体在 `scripts/smoke-console-rules.mjs`（纯函数、可合成输入测试）。
// 这里只做引擎独有的两件小事：注入 BASE、保留原来的调用形状。
// ⛔ 不要在引擎里再抄一份名单/规则 —— 出现过「测的和跑的不一样」之后就知道代价。
const NOISE_HOSTS = RULES.NOISE_HOSTS;
const NOISE_SAME_ORIGIN = RULES.NOISE_SAME_ORIGIN;
// 命中即归噪声、且**必须**在报告里单列出来的第三方 URL 判定
const isThirdParty = url => RULES.isThirdPartyUrl(url, BASE);

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
        // 文件和目录索引都不存在。
        //
        // 这里过去一律回落到 SPA 壳并写 200，理由写着「与 public/_redirects 的最后一条等价」——
        // 但那是**不成立**的：2026-10-17 实测线上 https://digdevbox.com/guides/<未知>/
        // 与 /definitely-not-a-page 都是 **HTTP 404 + 404.html（1982 字节，H1「Page not found」）**，
        // 不是 200 首页壳。本地假装 200 会同时造出两个后果：
        //   ① 用例路径写错（少一个字母、slug 改名后没同步）不会被发现 —— 它拿到的是首页，
        //      只要那条用例没断言 H1，就可能一路判绿；
        //   ② 「未知 slug 必须硬 404」这条失败场景判据在本地永远没法验，只能标 onlineOnly 长期吃灰。
        // 所以按线上行为来：有 404.html 就照 CF Pages 那样回 404 + 该文件；没有才退回壳。
        const notFound = path.join(root, '404.html');
        if (fs.existsSync(notFound)) {
          res.writeHead(404, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          });
          fs.createReadStream(notFound).pipe(res);
          return;
        }
        file = path.join(root, 'index.html');
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

const checks0 = h => (h && h.checks && h.checks.fetchAttempts) || 3;

// ─────────────────────────────── 起点自检 ───────────────────────────────
// 服务没起来时，Chrome 会停在错误页，所有用例一起「明明没挂载却查不出原因」，
// 而且会白白跑满看门狗。这里先探一次，不可达就立刻退出并给出可操作的原因。
if (!LOCAL) {
  /**
   * 探测本身也会失败 —— 2026-10-17 实测：线上 3 条用例刚跑完 25 分钟后，同一 BASE
   * 被这一步判「不可达」直接 exit 2，而 curl 与裸 node https.get 都稳定 200。
   * 一次 HEAD 抛出异常就定罪，等于把「测量层抖动」写成「站点故障」，
   * 而且原来连异常内容都吞了（catch {}），报告里只剩一句结论，无法复核。
   * 现在：最多 3 次、每次带 15s 超时、逐次打印真实错误，全失败才退出。
   */
  let reachable = false;
  let lastErr = '';
  for (let attempt = 1; attempt <= 3 && !reachable; attempt++) {
    try {
      const r = await fetch(BASE + '/', { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      reachable = r.status > 0;
      if (!reachable) {
        lastErr = `响应 status=${r.status}`;
      }
    }
    catch (e) {
      lastErr = `${e.name || 'Error'}: ${e.message || e}`;
    }
    if (!reachable) {
      console.log(`[check] 第 ${attempt}/3 次探测 ${BASE} 未成功 —— ${lastErr}`);
      if (attempt < 3) {
        // 不用 sleep()：它在下面第 ~500 行才声明，顶层 await 阶段访问会踩 TDZ
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  if (!reachable) {
    console.error(
      `[fatal] ${BASE} 三次探测都不可达（最后一次原因：${lastErr}）。\n` +
        `  如果是 vite dev server：它默认只绑 localhost（在 Windows 上常解析到 ::1），\n` +
        `  用 127.0.0.1 访问不通 —— 启动时加 --host 127.0.0.1。\n` +
        `  如果 curl 能通而这里不通，那是**测量层**问题（代理/TLS/IPv6），不是站点缺陷 —— 别据此定罪。`,
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
// requestId -> 归因所需的完整上下文（类型 / frame / loader / 发起方 / 时间）。
// 只有 URL 时，遇到「有 loadingFailed 却没有对应 requestWillBeSent」的事件就彻底无从回溯：
// 实测 /safelink-decoder 一条 Document + ERR_CONNECTION_TIMED_OUT 落进 unattributed，
// 事后分不清是第三方 iframe 还是自家导航请求，归因链当场断掉。
const reqMeta = new Map();

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
      reqMeta.set(msg.params.requestId, {
        url: msg.params.request.url,
        reqType: msg.params.type,
        frameId: msg.params.frameId,
        loaderId: msg.params.loaderId,
        initiator: (msg.params.initiator && msg.params.initiator.type) || 'unknown',
        initiatorUrl: (msg.params.initiator && (msg.params.initiator.url
          || (msg.params.initiator.stack && msg.params.initiator.stack.callFrames
            && msg.params.initiator.stack.callFrames[0]
            && msg.params.initiator.stack.callFrames[0].url))) || '',
        wallTime: msg.params.wallTime,
        ts: msg.params.timestamp,
      });
      break;
    case 'Network.responseReceived': {
      const r = msg.params.response;
      scriptResponses.push({ url: r.url, status: r.status, type: msg.params.type });
      break;
    }
    case 'Network.loadingFailed':
      // 归因信息一次性固化（纯函数 RULES.recordLoadFailure，带合成负向测试）：
      // 查不到 requestWillBeSent 时也要留下 requestId/type/error/时间，
      // 并用 attributed 字段让「查到」与「没查到」可机器区分，而不是事后靠猜。
      loadFailures.push(RULES.recordLoadFailure(msg.params, reqMeta.get(msg.params.requestId)));
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
  const unattributed = [];

  /**
   * 归属与分级一律走 `smoke-console-rules.mjs`，引擎里不留第二份实现。
   *
   * 为什么：`Network.loadingFailed` 只给 requestId，URL 靠 `requestWillBeSent` 建的表反查。
   * 上一轮页面残留的失败事件会落进这一轮的窗口里，而那张表过去**每条用例开头就清空**，
   * 于是这些事件带着空 URL 进来 —— 空 URL 既可能是「自家 chunk 没了」（必须阻断），
   * 也可能是「本机代理掐了第三方」（属环境）。两者混在一条判据里，怎么判都是错的：
   * 一律阻断 → 代理抖动把 116 个健康页写成红；一律豁免 → 真丢的脚本从此隐身。
   * 拆成纯函数之后，「缺失 URL / 已有归属 / 未知归属」三种情况第一次有了可重跑的负向测试
   * （scripts/smoke-console-rules.test.mjs），不再只能靠真跑一整轮去猜。
   */
  const ruleCtx = { base: BASE, logEntries, caseNoiseHit };
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
    // 没有 URL 可归属的连接超时：无法指认是第一方资源（第一方 chunk 失败一定带我们自己的 URL），
    // 实测本机代理链路掐第三方时就是这个形态 —— 同一次运行里带 URL 的那条已被正确判成 third-party。
    // 只豁免「空 URL」这一种，带 URL 的超时会照常 blocking，不把真丢的脚本藏起来。
    if (!url && /net::ERR_CONNECTION_TIMED_OUT|net::ERR_CONNECTION_RESET/.test(text)) {
      noise.push({ ...rec, why: '空 URL 的连接超时：不可归属到第一方资源，本机代理链路抖动形态（同 run 内带 URL 的同类记录已判 third-party）' });
      continue;
    }
    blocking.push(rec);
  }

  for (const x of exceptions) {
    // 未捕获异常按**抛它的脚本来自哪里**分流，和另外两条路径同一套归属规则：
    //   · 同源脚本报错 = 页面自己的代码坏了 → 阻断
    //   · 第三方脚本报错 = 广告/统计脚本在被掐断的网络里 reject → 噪声，但带 URL 留档
    // 实测：/ipv4-range-expander 的功能输出完全正确，红的原因是
    // `Uncaught (in promise) undefined`，url = pagead2.googlesyndication.com/…/show_ads_impl.js。
    // 不分开就会让 AdSense 的网络抖动冒充「页面坏了」；一分开，同源异常一条都不放过。
    const exUrl = x.url || ((x.exception || {}).url) || '';
    const rec = {
      text: ('未捕获异常: ' + (x.text || '')).slice(0, 300),
      url: exUrl.split('?')[0],
      detail: (x.exception?.description || '').split('\n')[0].slice(0, 200),
    };
    const verdict = RULES.classifyException(x, ruleCtx);
    if (verdict.kind === 'noise') {
      noise.push({ ...rec, why: verdict.why });
      continue;
    }
    blocking.push(rec);
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
    // 归属与分级全部走 smoke-console-rules.mjs（那里有合成输入的负向测试）。
    // 三条不可让步的语义：同源失败永远阻断；归不到 URL 的单列 unattributed（可见，不隐身）；
    // 站外的绝对 URL 按第三方处理并留下 URL —— 名单只用于文案归类，不是放行开关。
    const verdict = RULES.classifyLoadFailure(f, ruleCtx);
    const shown = (verdict.url || '').split('?')[0];
    if (verdict.kind === 'skip') continue;
    if (verdict.kind === 'unattributed') {
      // 采集层存下来的归因字段必须一路带到产物 JSON，否则「归因链已补全」只是句空话：
      // 之前这里只 push {text,type,error}，requestId/frameId/发起方/时间全丢在引擎内部。
      unattributed.push(RULES.describeUnattributed(f));
      continue;
    }
    if (verdict.kind === 'noise') {
      noise.push({ text: `资源失败(${verdict.why}): ${f.error}`, url: shown, why: verdict.why });
      continue;
    }
    blocking.push({ text: `${shown.startsWith(BASE) ? '同源资源' : '资源'}加载失败: ${f.error}`, url: shown });
  }

  return { blocking, noise, unattributed };
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

/**
 * 装页内钩子，并**验证它真的在当前文档里活着**。
 *
 * 原来是一句 `evaluate(HELPERS).catch(() => false)`，装没装上不看：导航刚提交、
 * 文档还在换的当口装到旧上下文里，后面每个 `js` / `fillLabel` 步骤都会以
 * 「window.__smoke 是 undefined」的形式报红，看上去像页面坏了 —— 实测全量跑里的
 * /encryption 就是这样红的，而它单跑必然绿（跨用例假红）。
 * 现在装完回读一次确认，最多重试到 3s；装不上就直接判红并说清是取证设施没起来，
 * 而不是让后面的判据拿着 undefined 猜。
 */
async function installHelpers() {
  for (let i = 0; i < 20; i++) {
    const ok = await evaluate(`${HELPERS}`).catch(() => false)
      && await evaluate('!!(window.__smoke && typeof window.__smoke.byLabel === "function")').catch(() => false);
    if (ok) return true;
    await sleep(150);
  }
  return false;
}

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
  // ⚠ 外层必须是 async 并 await：同步 IIFE 里 async 用例返回的是 Promise，
  //    String(Promise) 得到 "[object Promise]" —— 判据根本没跑完，却被当成失败原因
  //    （实测：新加的下载内容断言用 async IIFE，就以 [object Promise] 假红）。
  //    await 对同步表达式无副作用，两条路径同时成立。
  const r = await evaluate(
    `(async () => { try { const v = await (${expression}); return v == null ? null : String(v); } catch (e) { return 'JS 异常: ' + e.message; } })()`,
  );
  return r ? r : '';
}

/** 点「示例」按钮。
 *  注意 guides.ts 是动态 import 的，组件挂载那一刻 guide 还是 null，
 *  `.guide-example-btn` 根本不在 DOM 里 —— 直接点必然失败（首版就踩了这个）。
 *  这里轮询等它出现；指南区默认折叠也无妨，v-show 的元素照样能被程序化点击。 */
// 选择器演进：按钮原在折叠面板内（.guide-example-btn），后随 P1 首屏重排移到
// 动作条 .actions，类名变成 .action-btn.action-example（见 tool.layout.vue:408-415）。
// 只查旧类名会让 26 个页面以「示例按钮未出现」的形式假红 —— 保留旧类名做兼容兜底。
const EXAMPLE_SEL = '.action-example, .guide-example-btn';

/**
 * 示例文本的唯一事实源是 `src/tools/guides.en.ts`；引擎在浏览器外拿不到 TS，
 * 所以由 `scripts/gen-example-values.mjs` 派生这份 JSON，并由 build-seo 在构建期
 * 核对是否过期（示例文案改了但没重新生成 = 构建失败）。
 * 引擎因此可以要求「点完示例后主输入的值逐字等于 example.text」，
 * 而不是退而求其次地只看「值变了」。
 */
const EXAMPLE_VALUES = (() => {
  try {
    const f = path.join(REPO, 'scripts/smoke-fixtures/example-values.json');
    return JSON.parse(fs.readFileSync(f, 'utf8')).values || {};
  } catch {
    return {};
  }
})();

/**
 * 点「示例」按钮，并验**值真的落到该落的那个控件上**。
 *
 * 为什么不能只看「点了、值变了」：
 *   · 旧实现只验「按钮在不在、点没点成功」→「按钮存在但填充没进输入框」会被记成步骤通过。
 *     实测 /hash-text 在同一份 dist 上两轮结果不同，失败那轮读到的是**空串的摘要**
 *     （d41d8cd9… / da39a3ee… / e3b0c442…）而步骤回执 err 是空的。
 *   · 「值变了」同样是弱判据：填错框、只填进一半、被规范化改写，全都算通过。
 * 所以判据取到最硬的一档：**主输入控件的值逐字等于 guides 里那条 example.text**。
 *
 * 主输入控件的取法**逐字复刻** src/layouts/tool.layout.vue 的 findPrimaryInput
 * （优先「非只读非禁用」的 textarea，没有再退到 text/search/number/无 type 的 input）——
 * 我们验的控件必须就是应用要填的那个控件，否则「填对了但验错框」会造出假红，
 * 反过来「填错框但没验到」就是假绿。这条复刻的一致性由 build-seo 的源码检查守着。
 *
 * 偶发不落地允许重点（最多 3 次）：这是给 UI 竞态的重试，不是放宽结论；
 * 三次之后值仍不等于期望就判红，并把控件身份与前后值一起打出来。
 */
const PRIMARY_PICKER = `(() => {
  const root = document.querySelector('.tool-content');
  if (!root) return null;
  const tas = Array.from(root.querySelectorAll('textarea'));
  const editableTA = tas.find(ta => !ta.readOnly && !ta.disabled);
  if (editableTA) return editableTA;
  return root.querySelector('input[type="text"], input[type="search"], input[type="number"], input:not([type])');
})`;
const READ_PRIMARY = `(() => {
  const el = (${PRIMARY_PICKER})();
  if (!el) return null;
  return {
    tag: el.tagName.toLowerCase(),
    type: el.type || '',
    label: (el.getAttribute('aria-label') || el.placeholder || el.id || '').slice(0, 40),
    value: String(el.value == null ? el.textContent || '' : el.value),
  };
})()`;

async function applyExampleStep(casePath) {
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    found = await evaluate(`!!document.querySelector(${JSON.stringify(EXAMPLE_SEL)})`).catch(() => false);
    if (!found) await sleep(150);
  }
  if (!found) return '示例按钮未出现（guide 未加载，或该工具没有 example）';

  const expected = EXAMPLE_VALUES[casePath];
  // 证伪开关：`SMOKE_FAKE_EXAMPLE=1` 故意把期望值改错一位。
  // 这条判据必须炸 —— 不然「逐字核对」只是写在注释里的一句话。
  const expectation = process.env.SMOKE_FAKE_EXAMPLE === '1' && typeof expected === 'string'
    ? `${expected}\u0000-seeded-wrong`
    : expected;
  if (typeof expectation !== 'string' || !expectation.length) {
    return `无法核对示例：scripts/smoke-fixtures/example-values.json 里没有 ${casePath} 的 example.text —— `
      + '没有期望值就不许把「点了按钮」当成「填对了」（跑 node scripts/gen-example-values.mjs 生成）';
  }

  /**
   * 先清空，再点。
   *
   * 两个理由：
   *   ① 去掉「空转通过」：有的工具默认值就等于自己的示例文本，不清空的话「点完等于示例值」
   *      在点之前就已经成立 —— 这条断言什么也没证明，却会长绿。
   *   ② 「点击前的值」必须是真·点击前。上一版我把 before 的采样放在了点击之后的轮询里，
   *      于是失败信息里的「点击前」其实是点击后，诊断会指错方向。
   * 与 scripts/verify-example-e2e.mjs 同一个做法（原生 setter + input 事件），两条路径口径一致。
   */
  const CLEAR_PRIMARY = `(() => {
    const el = (${PRIMARY_PICKER})();
    if (!el) return false;
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, ''); else el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`;
  if (!(await evaluate(CLEAR_PRIMARY).catch(() => false))) {
    return '清空主输入控件失败（控件还没渲染出来？没有控件就没有「填入」这回事）';
  }
  await sleep(150);
  const before = await evaluate(READ_PRIMARY).catch(() => null);
  if (before && before.value === expectation) {
    return `清空后主输入仍等于示例值（${JSON.stringify(expectation.slice(0, 40))}）——`
      + '这条断言在点击之前就已经成立，不能作为证据';
  }

  let last = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await evaluate(
      `(function(){var b=document.querySelector(${JSON.stringify(EXAMPLE_SEL)});if(!b)return false;b.click();return true;})()`,
    );
    if (!ok) return '示例按钮点击失败';
    const until = Date.now() + 2500;
    for (;;) {
      last = await evaluate(READ_PRIMARY).catch(() => null);
      if (last && last.value === expectation) {
        /**
         * 绑定探针：`SMOKE_FILL_NOISE=1` 在填充成功之后，把主输入改成一个**与示例无关**的值。
         * 之后用例自己的断言必须变红 —— 还绿就说明那些断言不依赖被填入的数据。
         * 这一步不改变正常路径的任何行为（不设环境变量就是空转）。
         * ⚠ 噪声串不能随手挑：第一版用 'ZZZ-noise-not-the-example'，
         *   里面含 s/o 两个字母 → NATO 编码自带 Sierra/Oscar，等于探针自己把期望值喂了出来；
         *   换成不含 s/o/i 的 'QWERTY-42-probe' 才有判别力（实测见台账）。
         *
         * 10-18 两跑的结论（第二跑换了噪声串，见下面 ⚠ 那条）：22 红 / 5 绿。
         * 逐条定性（不是"5 条都是缺陷"）：
         *   · /bcrypt               format 级断言（只认 $2[abxy]$dd$ 前缀），设计上就不绑数据；
         *   · /text-statistics      differential（js 里比 统计值 == 输入长度），换值后依旧成立是**正确行为**；
         *   · /color-converter      text:['255','102','ff6600'] —— 预渲染 HTML 里本来就有 ff6600，
         *                           另两个数是换输入后不重算的旧结果（同下条机制）；
         *   · /numeronym-generator  text:['i18n'] —— 'i18n' 直接在预渲染 HTML 里，工具不动也算过；
         *   · /roman-numeral-converter
         *                           **换输入后旧结果仍留在页面上且没有任何错误提示**：
         *                           实测 999→CMXCIX，再把输入换成 ZZZ-noise，
         *                           .tool-content 仍显示 "Arabic to roman CMXCIX … Roman to arabic 42"，
         *                           hasErrorWord=false。也就是说这类 knownVector 断言测的是
         *                           「曾经算对过」，不是「现在这份输入算对了」。
         *   /text-to-nato-alphabet 第一跑"仍绿"是**探针自己的错**（旧噪声串含 s/o，编码出来就是
         *     Sierra/Oscar，等于把期望值喂给了用例）；换成 QWERTY-42-probe 后它正确变红。
         * 结论：真要收紧的是 3 条（color-converter / numeronym-generator / roman-numeral-converter），
         * 2 条设计使然（bcrypt 只认格式、text-statistics 是差分式，换值后等式照样成立）。
         * 顺带一个产品侧问题留给裁定：无效输入静默保留上一次结果，用户看到的是一个不属于自己的答案。
         */
        if (process.env.SMOKE_FILL_NOISE === '1') {
          await evaluate(`(() => {
            const el = (${PRIMARY_PICKER})();
            if (!el) return false;
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
            if (setter) setter.call(el, 'QWERTY-42-probe'); else el.value = 'QWERTY-42-probe';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          })()`).catch(() => false);
          await sleep(600);
        }
        return '';
      }
      if (Date.now() >= until) break;
      await sleep(120);
    }
  }
  const got = last ? `${last.tag}[${last.type}] label=${JSON.stringify(last.label)} value=${JSON.stringify(last.value.slice(0, 60))}` : 'null（没找到主输入控件）';
  const pre = before ? JSON.stringify(before.value.slice(0, 40)) : 'n/a';
  return `点了 3 次示例，主输入仍未等于 example.text —— 期望 ${JSON.stringify(expectation.slice(0, 60))}，实得 ${got}（清空后 ${pre}）`
    + ' —— 填充没落到该落的控件上，后面的断言读到的会是空值/旧值，不许当成通过';
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

/** 真实指针拖拽（CDP Input.dispatchMouseEvent）。
 *
 * 为什么不能用 dispatchEvent(new PointerEvent(...)) 代替：合成事件确实能触发挂在目标上的
 * handler，但「按下后临时在 window 上挂 move/up」这类交互依赖浏览器输入管线的时序，
 * 实测合成拖拽不改变组件状态（/image-crop 首跑就是这样：handler 收到了，框却没动）。
 * 走 Input 域 = 和真实鼠标同一条路径，pointerdown/move/up 与 clientX/clientY 都是浏览器给的。
 *
 * spec: { sel, host?, to: [fx, fy], from?, steps?, ms? }
 *   fx/fy = 0~1 的**比例**，相对 host（默认=sel）的 rect。用比例而不是像素，
 *   这样窗口尺寸、显示缩放都改不动用例语义。
 *   起点默认落在 sel 元素中心（例如裁剪框的角点手柄），可用 from 覆盖成 host 的比例坐标。
 */
async function dragPointer(spec) {
  const sel = spec.sel;
  const hostSel = spec.host || spec.sel;
  const to = spec.to;
  if (!Array.isArray(to) || to.length !== 2) {
    return `drag 需要 to: [fx, fy]，实际=${JSON.stringify(to)}`;
  }
  // 1) 先滚进视野。**单独一次 evaluate + 等待**：Input 域坐标是视口相对的，
  //    而滚动可能是动画提交的（实测：同一次 evaluate 里 scrollIntoView 后立刻量 rect，
  //    随后派发事件时页面又移了 ~6px，640px 显示 200px 图 → 断言收到 102×102 而不是 100×100）。
  await evaluate(`(() => {
    var el = document.querySelector(${JSON.stringify(sel)});
    if (el) { el.scrollIntoView({ block: 'center', inline: 'center' }); }
    return 1;
  })()`);
  await sleep(150);
  const geom = await evaluate(`(() => {
    var el = document.querySelector(${JSON.stringify(sel)});
    var host = document.querySelector(${JSON.stringify(hostSel)});
    if (!el || !host) return null;
    var e = el.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (!e.width || !e.height || !h.width || !h.height) return null;
    return { ex: e.left + e.width / 2, ey: e.top + e.height / 2, h: { l: h.left, t: h.top, w: h.width, h: h.height } };
  })()`);
  if (!geom) {
    return `拖拽目标不存在或没有尺寸：sel=${sel} host=${hostSel}`;
  }
  const from = Array.isArray(spec.from)
    ? [geom.h.l + spec.from[0] * geom.h.w, geom.h.t + spec.from[1] * geom.h.h]
    : [geom.ex, geom.ey];
  const target = [geom.h.l + to[0] * geom.h.w, geom.h.t + to[1] * geom.h.h];
  const steps = spec.steps || 5;
  const ms = spec.ms ?? 20;
  // 2) 按下前先确认起点真的命中在被拖元素上。没有这一步，坐标算错会退化成
  //    「事件派发成功但什么都没发生」的静默假通过。
  const hit = await evaluate(`(() => {
    var el = document.elementFromPoint(${JSON.stringify(from[0])}, ${JSON.stringify(from[1])});
    var want = document.querySelector(${JSON.stringify(sel)});
    if (!el || !want) return 'null';
    return (el === want || want.contains(el) || el.contains(want)) ? 'ok' : String(el.className || el.tagName);
  })()`);
  if (hit !== 'ok') {
    return `拖拽起点没有命中目标（测量层问题，不是产品缺陷）：起点 ${Math.round(from[0])},${Math.round(from[1])} 命中 ${hit}`;
  }
  const at = (x, y, extra) => send('Input.dispatchMouseEvent', {
    x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, button: 'left', clickCount: 1, ...extra,
  });
  try {
    await at(from[0], from[1], { type: 'mouseMoved', buttons: 0 });
    await sleep(ms);
    await at(from[0], from[1], { type: 'mousePressed', buttons: 1 });
    await sleep(ms);
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await at(from[0] + (target[0] - from[0]) * k, from[1] + (target[1] - from[1]) * k, { type: 'mouseMoved', buttons: 1 });
      await sleep(ms);
    }
    await at(target[0], target[1], { type: 'mouseReleased', buttons: 0 });
  } catch (e) {
    return `拖拽派发失败：${e.message}`;
  }
  await sleep(ms);
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
  // file 允许字符串或数组。多文件控件（如 pdf-merge 需要一次给 2 个 PDF）必须一次给全：
  // 组件的 @files-upload 是替换语义（files.value = list），分两次上传只会留下最后一个。
  const absList = (Array.isArray(file) ? file : [file]).map((f) => path.resolve(REPO, f));
  for (const abs of absList) {
    if (!fs.existsSync(abs)) return `待上传文件不存在：${abs}`;
  }
  const probeSel = JSON.stringify(sel || 'input[type="file"]');
  // 有界重试，而不是「setFileInputFiles 之后睡 600ms 然后祈祷」：
  // 实测同一份用例六次里有一次 waitSel 超时 —— 组件挂载初期会重建 <input>，
  // 上一轮 DOM.querySelectorAll 拿到的 nodeId 就悬空了，文件静默没落地。
  for (let attempt = 1; attempt <= 4; attempt++) {
    let nodeId;
    try {
      // 整段 DOM 调用都要包起来：线上页面导航/重渲之间 root.nodeId 会失效，
      // 只包 setFileInputFiles 的话 -32000 "Could not find node with given id"
      // 会当成步骤异常冒出来（打生产实测到过）。
      const { root } = await send('DOM.getDocument', { depth: -1 });
      const q = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: sel || 'input[type="file"]' });
      nodeId = q.nodeIds[i];
      if (!nodeId) {
        await sleep(350 * attempt);
        continue;
      }
      await send('DOM.setFileInputFiles', { files: absList, nodeId });
    } catch (e) {
      await sleep(350 * attempt);
      continue;
    }
    const until = Date.now() + 4000;
    while (Date.now() < until) {
      const n = await evaluate(`(() => {
        var el = document.querySelectorAll(${probeSel})[${i}];
        return el && el.files ? el.files.length : -1;
      })()`).catch(() => -1);
      if (n === absList.length) {
        await sleep(600);
        return '';
      }
      await sleep(200);
    }
    await sleep(350 * attempt);
  }
  return `上传后 input.files 始终不是 ${absList.length} 个（测量层：文件没落到控件上，不是站点缺陷）`;
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
    // 实体解码：预渲染 HTML 里是 `JWT Decoder &amp; Parser`，而 locales 词条与
    // 运行时 DOM 文本都是字面 `&`。不解码会让**所有名字带 & 的工具**在 H1 一致性
    // 检查上恒假红（实测 /jwt-parser、/json-prettify）。
    // 顺序：&amp; 必须最后解，否则 `&amp;lt;` 会被二次解码成 `<`。
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
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
  // 有界重试：单次 fetch 一旦抖动，下面 7 条检查会级联假红（实测 3 页因此被写成坏页，
  // 而 curl 复验全 200，其中 /fullwidth-converter 单页 8.0s 逼近超时）。
  // 重试只治测量层噪声；三次仍拿不到就照实 FAIL —— 那可能是真故障，不能粉饰。
  // 默认期望 200；用例可用 expectStatus 显式改口（唯一正当用法是 404 页本身 ——
  // 「未知 slug 必须硬 404」这条判据的通过条件就是**不是** 200）。
  const wantStatus = c.expectStatus || 200;
  const ATTEMPTS = 3;
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const r = await fetch(url, { redirect: 'manual' });
      status = r.status;
      ctype = r.headers.get('content-type') || '';
      html = (status === 200 || status === wantStatus) ? await r.text() : '';
      if (status === wantStatus) break;
    } catch (e) {
      checks.fetchError = `${e.message || e}（第 ${i + 1}/${ATTEMPTS} 次）`;
      status = -1;
    }
    if (i < ATTEMPTS - 1) await sleep(400 * (i + 1));
  }
  if (status !== wantStatus) checks.fetchAttempts = ATTEMPTS;

  checks.statusExpected = status === wantStatus;
  checks.htmlType = /text\/html/.test(ctype);
  checks.hasH1 = /<h1[\s>]/i.test(html);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
  checks.titleNonEmpty = !!title;
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i) || [])[1] || '';
  const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const bodyText = stripTags(html);
  checks.bodyLen = bodyText.length;
  checks.bodyLongEnough = bodyText.length >= 60;
  if (wantStatus === 200) {
    // 「正常内容页」完整性判据：只对 200 生效。
    checks.canonicalSelf = canonical === CANON_ORIGIN + c.path + '/';
    checks.adsense = html.includes('ca-pub-7944759654100814');
  } else {
    // 非 200 期望（404 一类）：这两条**不适用**，记成字符串而不是布尔 ——
    // 写 true 是把判据缺失伪装成绿灯，写 false 是必红，两者都不许。
    checks.canonicalSelf = `n/a（期望 ${wantStatus}，非内容页）`;
    checks.adsense = `n/a（期望 ${wantStatus}，非内容页）`;
  }
  checks.h1 = h1;
  checks.title = title;
  checks.canonical = canonical;

  // 初始 HTML 层的 JSON-LD 类型清单：结构化数据是**给爬虫看的**，只能在预渲染产物上判。
  // 实测教训：把 `"@type":"Article"` 写进 expect.regex（比的是运行时 body.innerText）
  // 永远不会命中；写进运行时 js 步骤也不可靠 —— hydration 后 head 会被 unhead 重组，
  // 同一批页面里 FAQPage 还在、Article 已经不在（这个不对称另开一条待查）。
  const htmlJsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        const parsed = JSON.parse(m[1]);
        return parsed && parsed['@type'] ? String(parsed['@type']) : null;
      }
      catch {
        return 'UNPARSEABLE';
      }
    })
    .filter(Boolean);

  const bad = Object.entries(checks)
    .filter(([k, v]) => typeof v === 'boolean' && !v)
    .map(([k]) => k);
  // fetchFailed = 重试后仍拿不到响应：这是**测量层**事实，不能当站点缺陷报红
  return {
    status,
    ctype,
    checks,
    bad,
    htmlTitle: title,
    htmlH1: h1,
    htmlJsonLd,
    fetchFailed: status === -1,
  };
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
    pageKind: c.pageKind || 'tool',
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
  if (rec.html.fetchFailed) {
    // 测量层失败：curl 复验同一 URL 是 200（实测 /text-statistics 连抓 8 次全 200），
    // 说明是脚本自身连接抖动。记 warn 不记 fail —— 红只代表站点真有问题。
    runtimeOnly = true;
    fail(`测量层：初始 HTML ${checks0(rec.html)} 次重试仍无响应（非站点缺陷，请重跑或 curl 复验）`, 'nonblocking');
  } else if (rec.html.skipped) {
    // 明确留痕：这一轮没验预渲染层，不能当作「全绿」
    runtimeOnly = true;
  } else {
  if (!rec.html.checks.statusExpected) {
    fail(`初始 HTML 状态码非期望（要 ${c.expectStatus || 200}）：实际 ${rec.html.status}${rec.html.status === 308 ? '（尾斜杠规范回归？）' : ''}`);
  }
  for (const k of rec.html.bad) {
    if (k !== 'statusExpected') fail(`初始 HTML 检查未过：${k}`);
  }
  // 标题与 locales/<locale>.yml 声明的标题一致性（能抓到「工具定义漏接 translate()」这类缺陷）
  // 期望值以 --locale 为准，不再写死 zh.yml（见文件上方 LOCALE 的说明）
  //
  // 键名用 **path 段**推导，不用用例里的 name：
  //   /base-converter → tools.base-converter.title（而 c.name 是 'integer-base-converter'）
  //   两者对多数工具相同、对少数不同，用 name 会漏判（实测 2 例）。
  // 静态内容页（pageKind: 'static'）没有 tools.<key>.title 这种词条依据，
  // 期望 H1 由用例自己用 expectedH1 显式给出；不给就是判据缺失，按红算而不是跳过。
  if (c.pageKind === 'static') {
    if (!c.expectedH1) {
      fail('静态页用例必须自带 expectedH1 —— 没有期望值就不许判这一层通过');
    } else if (rec.html.htmlH1 !== c.expectedH1) {
      fail(`初始 HTML 的 H1「${rec.html.htmlH1}」≠ 用例声明的「${c.expectedH1}」`);
    }
  }
  const titleKey = c.path.replace(/^\/+|\/+$/g, '');
  const expectedTitle = LOCALE_TITLES[titleKey] ?? LOCALE_TITLES[c.name];
  if (c.pageKind !== 'static' && !expectedTitle) {
    fail(`locales/${LOCALE}.yml 里找不到 tools.${titleKey}.title —— 判据缺失，不计入通过`);
  } else if (c.pageKind !== 'static' && rec.html.htmlH1 && rec.html.htmlH1 !== expectedTitle) {
    // H1 承载主标题，SEO title 是「主标题 — 词缀」——P0-P2 刻意给 title 加了
    // online/free 等词缀，H1 未同步是设计如此。整串比对会把 8 个好页写成红。
    // 仍保留判据效力：未翻译/中文残留/漏接 translate() 一律照红。
    const mainSegment = expectedTitle.split(/\s+—\s+/)[0].trim();
    if (rec.html.htmlH1 !== mainSegment) {
      fail(`初始 HTML 的 H1 与 ${LOCALE}.yml 主标题段不一致：页面「${rec.html.htmlH1}」≠「${mainSegment}」（词条「${expectedTitle}」）`);
    }
  }
  }

  /**
   * 反向通道（expect.htmlNotLd）：「这一页**不该**产出某种结构化数据」。
   *
   * 为什么必须有：正向 htmlLd 只抓「少发了」，永远抓不到「超发了」——
   * 而空壳页 / 未找到页挂着 Article 正是 sitemap 准入最想拦的那类低质形态。
   *
   * 放在初始 HTML 层（不是运行时层）有两个原因：
   *   ① 结构化数据的读者是爬虫，判据落点就该是预渲染产物；
   *   ② standalone 用例（自包含错误页，无 SPA 运行时）根本不进运行时层，
   *      放在那边就成了一条永远不会执行的空转断言。
   * 防空转：haveLd 为空既可能是「真没有」（判通过），也可能是「这轮没拿到 HTML」
   * （判未取证，不许算绿）—— 两种成因必须分开。
   */
  const wantNoLd = (c.expect && c.expect.htmlNotLd) || [];
  if (wantNoLd.length) {
    if (rec.html.fetchFailed || rec.html.skipped) {
      rec.warnings = [...(rec.warnings || []), 'htmlNotLd 反向判据本轮未取证（初始 HTML 没拿到），不计入通过'];
    } else {
      const have = rec.html.htmlJsonLd || [];
      const hit = wantNoLd.filter(t => have.includes(t));
      if (hit.length) fail(`初始 HTML 出现了不该有的 JSON-LD 类型：${JSON.stringify(hit)}（实到 ${JSON.stringify(have)}）`);
      rec.assert = rec.assert || {};
      rec.assert.htmlNotLd = { want: wantNoLd, have };
    }
  }

  // standalone：自包含静态页（404 一类），产物里没有 #app、没有 JS，
  // 运行时三层（挂载 / 正文 / 客户端接管）对它**不适用**。
  // 这里显式记「未验证」而不是默默跳过 —— 静默跳过会让一条只判了 HTTP 层的用例
  // 在报表里长得和全层通过的用例一模一样。
  if (c.standalone) {
    // standalone 用例不进运行时层，所以任何**只在运行时取值**的断言写了也不会执行。
    // 与其让它静静躺着当摆设，这里直接判红：要么改用例（把判据挪到初始 HTML 层），
    // 要么改页面性质（它其实不是自包含页）。
    const inertKeys = ['text', 'not', 'regex', 'out', 'outRegex', 'outNot', 'js', 'canvasNonBlank', 'imageData']
      .filter(k => Array.isArray(c.expect?.[k]) ? c.expect[k].length > 0 : Boolean(c.expect?.[k]));
    if (inertKeys.length) {
      fail(`standalone 用例写了运行时层断言却不会执行：${inertKeys.join(', ')}（改写到 htmlNotLd / expectedH1，或去掉 standalone）`);
    }
    rec.runtime = { applicable: false, reason: 'standalone：自包含静态页，无 SPA 运行时' };
    rec.warnings = [...(rec.warnings || []), '运行时层不适用（standalone）：本条只验 HTTP 状态 + 初始 HTML'];
    rec.elapsedMs = Date.now() - t0;
    return rec;
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
  reqMeta.clear();

  let mountMs = 0;
  try {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(120);
    await send('Page.navigate', { url: BASE + c.path + '/' });

    // 轮询等待挂载 —— 固定 sleep 会把「chunk 还没加载完」误判成「功能坏了」。
    // 默认 45s；线上（digdevbox.com 走 CF 边缘、冷启动慢）实测得单次挂载偶发 16s / 21s，
    // 把默认从 10s → 20s → 45s 逐级放宽（与 waitText 对齐），避免「量网速不是量工具」的假红。
    // 注意：默认**独立于 BUDGET**（不再被 Math.min(…,BUDGET) 压回 20s）；
    // 本地 --serve-dist 读磁盘挂载是瞬时的，循环会立刻 break，不增加本地耗时。
    // 重依赖工具（如 text-diff 的 Monaco）在 dev 下要慢得多，可用 case.mountTimeout 再放宽。
    let mounted = false;
    const isStatic = c.pageKind === 'static';
    // mountTimeout 是**显式覆盖**，不再被 0.6×BUDGET 压回去 ——
    // 否则写了 mountTimeout: 45000 也会被 default 的 BUDGET 悄悄截成 12s，等于没写。
    mountMs = c.mountTimeout || 45000;
    const mountDeadline = Date.now() + mountMs;
    while (Date.now() < mountDeadline) {
      // 静态页没有工具布局容器；改判「#app 内确实渲染出了带文字的 h1」——
      // 这条能抓到「预渲染壳 + SPA 报错白屏」，不是永远为真的空转断言。
      mounted = isStatic
        ? await evaluate(`(() => {
             const a = document.querySelector('#app');
             const h = a && a.querySelector('h1');
             return !!(h && (h.innerText || '').trim().length > 1);
           })()`).catch(() => false)
        : await evaluate(`!!document.querySelector('.tool-layout')`).catch(() => false);
      if (mounted) break;
      await sleep(150);
    }
    rec.runtime.mounted = mounted;
    if (!mounted) fail(isStatic
      ? `静态页未渲染出正文：#app 内没有在 ${Math.round(mountMs / 1000)}s 内出现带文字的 h1`
      : `组件未挂载：.tool-layout 在 ${Math.round(mountMs / 1000)}s 内没出现`);
    else if (!(await installHelpers())) {
      // 取证设施没起来 = 这一条用例的所有 js / fillLabel 判据都没跑，不能记成通过
      fail('页内辅助钩子装不上（window.__smoke 不在当前文档），后续判据无法取证');
    }

    rec.runtime.hasToolContent = await evaluate(`!!document.querySelector('.tool-content')`).catch(() => false);
    if (isStatic) {
      // 静态页没有 .tool-content，这条判据换成「正文真的有内容」：
      // #app 下可见文本长度过阈值，能抓到「页面存在但正文空」这类薄壳。
      const bodyLen = await evaluate(`(() => {
         const a = document.querySelector('#app');
         return a ? (a.innerText || '').replace(/\\s+/g, ' ').trim().length : 0;
       })()`).catch(() => 0);
      rec.runtime.staticBodyLen = bodyLen;
      if (!(bodyLen >= (c.minBodyChars || 400))) {
        fail(`静态页正文过短：${bodyLen} 字符（阈值 ${c.minBodyChars || 400}）`);
      }
    } else if (!rec.runtime.hasToolContent) {
      fail('缺少 .tool-content（工具组件插槽容器）');
    }

    // 有界等待再读 H1，而不是读到什么算什么：hydration 中途 `h1` 的 innerText 会短暂为空，
    // 单次读数会把「还没渲染完」写成「运行时 H1 ≠ 预渲染 H1」的假红（实测 /faq 一次跑这样红，
    // 同一条用例全量跑又绿 —— 读数依赖时机 = 判据不稳定）。
    // 等不到非空 H1 仍然照红：这里放宽的是**时机**，不是**结论**。
    {
      const h1Deadline = Date.now() + 6000;
      let h1Now = '';
      for (;;) {
        h1Now = (await evaluate(`(document.querySelector('h1')||{}).innerText || ''`).catch(() => '')) || '';
        if (h1Now.trim() || Date.now() >= h1Deadline) break;
        await sleep(150);
      }
      rec.runtime.h1 = h1Now;
      rec.runtime.h1WaitedMs = Math.min(6000, Date.now() - (h1Deadline - 6000));
    }
    // 不再回退到 c.zhTitle：预渲染层抓取失败时，用中文标题当英文 H1 的期望值
    // 会把「脚本没抓到」伪装成「站点 H1 是中文」——实测 3 页这样产生假红。
    rec.runtime.expectH1 = rec.html.htmlH1 || '';
    rec.runtime.h1MatchesPrerender =
      !!rec.runtime.h1 && !!rec.runtime.expectH1 && rec.runtime.h1.trim() === rec.runtime.expectH1.trim();
    if (!rec.runtime.expectH1) {
      // 预渲染层这轮没量到（见 fetchFailed），拿空串比对运行时 H1 只会造出假红
      fail('预渲染 H1 本轮未量到，跳过「运行时 vs 预渲染」比对', 'nonblocking');
    } else if (!rec.runtime.h1MatchesPrerender) {
      fail(`运行时 H1「${rec.runtime.h1}」≠ 预渲染 H1「${rec.runtime.expectH1}」`);
    }

    // ⑤ 客户端是否真的接管了（预渲染骨架必须被替换掉）
    if (isStatic) {
      // 静态页的接管证据用 `.menu-layout`：它是 base.layout 的 MenuLayout 容器，
      // **只可能由客户端渲染出来** —— 实测预渲染产物里出现 0 次（dist/faq、dist/base-converter 都是 0）。
      //
      // 两条踩过的路，都记在这里免得有人再走：
      //   ① `#app.__vue_app__` —— Vue 只在 dev 构建上挂这个字段，生产产物里永远取不到，
      //      等于一条不可能通过的判据（--probe 模式跑 dev 时才看得到，最容易骗人）。
      //   ② 用 `#app 内有 h1` 当挂载完成 —— 预渲染 HTML 本身就有 h1，会立刻为真，
      //      于是后续步骤在 hydration 中途读 DOM，抓出「找不到目录链接」这类假红。
      // 所以这里既等它出现（有界轮询），也把它当成接管结论。
      const shellDeadline = Date.now() + Math.max(6000, mountMs);
      let shell = false;
      while (Date.now() < shellDeadline) {
        shell = await evaluate(`!!document.querySelector('.menu-layout')`).catch(() => false);
        if (shell) { break; }
        await sleep(150);
      }
      rec.runtime.skeletonGone = shell;
      if (!shell) fail('静态页客户端未接管：等 .menu-layout（base.layout 容器）超时');
    } else {
      rec.runtime.skeletonGone = !(await evaluate(`!!document.querySelector('.dd-tool-seo')`).catch(() => true));
      if (!rec.runtime.skeletonGone) fail('预渲染骨架 .dd-tool-seo 仍在 DOM —— 客户端渲染疑似未接管');
    }

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
    const budget = Math.max(BUDGET, mountMs + 10000);
    for (const step of c.steps || []) {
      if (Date.now() - t0 > budget) {
        rec.steps.push({ step: JSON.stringify(step), err: '超出单页预算' });
        fail('超出单页预算，后续步骤未执行', 'warn');
        break;
      }
      let err = '';
      try {
        if (step.applyExample) err = await applyExampleStep(c.path);
        else if (step.clickSel) err = await clickButton({ sel: step.clickSel });
        else if (step.click !== undefined) err = await clickButton({ text: step.click, exact: false });
        else if (step.clickExact !== undefined) err = await clickButton({ text: step.clickExact, exact: true });
        else if (step.fill) err = await fillEditable(step.fill);
        else if (step.fillLabel) err = await fillByLabel(step.fillLabel);
        else if (step.pick) err = await pickOption(step.pick);
        else if (step.key) err = await pressKey(step.key);
        else if (step.drag) err = await dragPointer(step.drag);
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

  /**
   * 通用判据：页面上不得出现**未解析的 i18n 键**（形如 tools.image-to-pdf.pickFiles）。
   * 组件引用了 locales 里不存在的键时，vue-i18n 不抛错、只把键名原样渲染出来 ——
   * 功能断言全绿、控制台只有一条 warn，用户却看到一行裸键。实测这样漏过一整批
   * （/image-to-pdf 的上传框标题，靠截图才发现），所以固化成每页都跑的判据。
   *
   * 位置很关键：必须放在**交互步骤之后**、用断言阶段已经收集好的全文本来量。
   * 早先放在挂载检测那一档时，工具正文还没渲染（实测 innerText 只有 238 字符），
   * 判据对已知坏页面报绿 —— 假绿比假红贵。
   */
  const BARE_KEY_RE = /\b(?:tools|seo|clusters|common|nav|pages)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/g;
  const bareKeys = Array.from(new Set(text.match(BARE_KEY_RE) || [])).slice(0, 6);
  rec.assert.bareI18nKeys = bareKeys;
  if (bareKeys.length) {
    fail(`页面出现未解析的 i18n 键（组件引用了 locales 里没有的键）：${bareKeys.join(' | ')}`);
  }
  const exp = c.expect || {};
  const missing = (exp.text || []).filter(s => !text.includes(s));
  const forbidden = (exp.not || []).filter(s => text.includes(s));
  const regexMiss = (exp.regex || []).filter(s => !new RegExp(s, 'm').test(text));

  /**
   * 初始 HTML 层的 JSON-LD 断言通道（expect.htmlLd）。
   *
   * 结构化数据是给爬虫读的，判据就该落在**预渲染产物**上：
   *   · expect.regex 比的是运行时 body.innerText —— <head> 里的东西永远不在里面；
   *   · 运行时 querySelectorAll 也不可靠 —— hydration 后 head 由 unhead 重组，
   *     实测同一批页面里 FAQPage 还在、Article 已经不在。
   * 所以这一档必须是「初始 HTML 里有没有这个 @type」，而不是「浏览器里还有没有」。
   */
  const wantLd = exp.htmlLd || [];
  const haveLd = (rec.html && rec.html.htmlJsonLd) || [];
  const ldMissing = wantLd.filter(t => !haveLd.includes(t));
  const ldExtra = haveLd.filter(t => !wantLd.includes(t) && t !== 'UNPARSEABLE');
  if (ldMissing.length) { fail(`初始 HTML 的 JSON-LD 缺少：${JSON.stringify(ldMissing)}（实到 ${JSON.stringify(haveLd)}）`); }
  if (wantLd.length && ldExtra.length) {
    rec.warnings = [...(rec.warnings || []), `JSON-LD 出现用例未声明的类型：${JSON.stringify(ldExtra)}`];
  }

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
      // 约定（与 37 条现存 expect.js 用例一致）：**成功必须返回真值**（推荐直接 `return true`）。
      // false / null / undefined / 非空字符串 一律算失败 —— 判据没给出「通过」的证据就是没通过，
      // 不许用「什么都没返回」蒙过这一层。
      // 这里刻意不用 `!!` 归一：那样「返回一串失败原因」会被转成 true 而静默通过。
      // （旧注释说「return null 表示空态也算合法」，那是 `!!` 时代的写法；
      //  现在这么写会被判失败 —— 实测有一条新用例就是这么假红了。）
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
  const { blocking, noise, unattributed } = classifyConsole();
  rec.console = { blocking, noise };
  // 未归属的网络失败单列出来：它既不算站点缺陷，也不算「已确认是第三方」，
  // 只在汇总里报数。归因规则变松时这个数会涨，看得见才不会把隐身当成修好了。
  if (unattributed.length) rec.unattributed = unattributed;
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
    reqMeta.clear();
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
  staticCount: results.filter(r => r.pageKind === 'static').length,
  // 未归属的网络失败单列计数：这类事件既不算站点缺陷，也不许悄悄消失。
  // 归因规则一旦放松，这个数会先涨起来 —— 有这一行才看得见。
  unattributedCount: results.reduce((n, r) => n + ((r.unattributed || []).length), 0),
  unattributedCases: results.filter(r => (r.unattributed || []).length).map(r => r.path),
  results,
};
fs.writeFileSync(path.join(OUT, `shard-${SHARD_I}.json`), JSON.stringify(summary, null, 1), 'utf-8');

console.log(
  `\n[smoke] 分片 ${SHARD_I}/${SHARD_N} 汇总：pass=${summary.pass} fail=${summary.fail} warn=${summary.warn} skip=${summary.skip}`
  // 静态内容页要单独报数：这一档刚加，跑没跑到、跑了几条必须看得见，
  // 否则「114 全绿」里其实一条静态页都没含，就是假覆盖面。
  + `（其中静态内容页 ${summary.staticCount} 条，用例集共 ${all.length} 条）`,
);
// 未归属网络失败单独印一行：它不判红，但也不许悄悄消失。
// 归因规则放松时这个数会先涨，所以它是「有没有把真故障藏起来」的可见指标。
if (summary.unattributedCount) {
  console.log(
    `[smoke] ℹ 未归属网络失败 ${summary.unattributedCount} 条（${summary.unattributedCases.length} 页：`
    + `${summary.unattributedCases.slice(0, 6).join(', ')}）—— 既不阻断也不并噪声，逐条见 shard JSON 的 unattributed 字段`,
  );
} else {
  console.log('[smoke] ℹ 未归属网络失败 0 条（本轮所有资源失败都能归到同源或第三方）');
}

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
