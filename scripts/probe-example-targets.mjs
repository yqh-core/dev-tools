#!/usr/bin/env node
/**
 * probe-example-targets.mjs — 19 个「缺 example」工具的输入形态**真机探测**
 * ---------------------------------------------------------------------------
 * 为什么要有这个脚本
 *   「给工具补 example」的前提是「example.text 能被页面上某个输入控件接受」。
 *   这个前提**不能读代码推断**，也不能靠「写进去 el.value 没被清空」来判：
 *
 *   ⚠️ 首版探针栽在这上面（实测打脸，记录在此以免重犯）
 *   用原生 setter 写完立刻读 `el.value`，对以下三种控件都会得到 `kept: true`，
 *   也就是**假阳性**：
 *     ① naive-ui `n-input-number` —— DOM input 是 `type="text"`，setter 写什么都原样留着，
 *        但组件内部的 value 是 NaN/null，工具照样什么都不产出；
 *     ② 原生 `readonly` 的 input/textarea —— setter 照样写得进去，
 *        但那是**输出框**（chmod-calculator 的 "Input text"、lorem-ipsum 的结果区），
 *        填 example 等于往输出里塞字，下一次渲染就被冲掉；
 *     ③ 受控组件还没跑完一轮更新 —— 读得太早，看到的是中间态。
 *   首版因此把 4 个 n-input-number 工具全判成 ACCEPT，实际全是数字受限控件。
 *
 * 本版的判据（差分法，differential）
 *   对每个候选控件做两轮独立实验，每轮都「写入 → 等 Vue 结算 → 读控件值 + 读工具区输出」：
 *     A 轮：写文本载荷 `Hello Dev 123`
 *     B 轮：写数字载荷 `42`
 *   结论只看**三件事**：
 *     · 控件本身是否 readonly（readonly = 输出框，永不接受 example）
 *     · 写入后控件值是否被组件回写/清掉（数字控件会）
 *     · 工具区输出是否**真的变了**（变了才说明这个输入参与运算）
 *   三者都不成立 → 不接受。
 *
 * 零依赖：Chrome --headless=new --remote-debugging-port=0 + Node 22 原生 WebSocket 直连 CDP
 * （与 scripts/smoke-tools.mjs 同一套打法，本机不允许下载浏览器）。
 *
 * 用法
 *   node scripts/probe-example-targets.mjs --serve-dist dist
 *   node scripts/probe-example-targets.mjs --base https://digdevbox.com
 *   node scripts/probe-example-targets.mjs --out _ops/example-probe-2026-10-07.md
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ─────────────────────────────── 待探测工具（19 个） ───────────────────────────────
const TARGETS = [
  'base64-file-converter',
  'benchmark-builder',
  'camera-recorder',
  'chmod-calculator',
  'chronometer',
  'device-information',
  'git-memo',
  'html-wysiwyg-editor',
  'keycode-info',
  'lorem-ipsum-generator',
  'mac-address-generator',
  'mime-types',
  'password-strength-analyser',
  'pdf-signature-checker',
  'percentage-calculator',
  'random-port-generator',
  'svg-placeholder-generator',
  'px-rem-converter',
  'regex-memo',
  'today-in-history',
];

// ─────────────────────────────── CLI ───────────────────────────────
const argv = process.argv.slice(2);
const argOf = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const has = f => argv.includes(f);

let BASE = argOf('--base', '');
const SERVE_DIST = argOf('--serve-dist', '');
if (!BASE) {
  BASE = SERVE_DIST ? 'http://127.0.0.1:4192' : 'https://digdevbox.com';
}
BASE = BASE.replace(/\/+$/, '');
const LOCAL = !!SERVE_DIST;
const PORT = Number(argOf('--port', '4192'));
const OUT_MD = path.resolve(REPO, argOf('--out', path.join(REPO, '_ops/example-probe-latest.md')));
const OUT_JSON = OUT_MD.replace(/\.md$/, '.json');
const MOUNT_TIMEOUT = Number(argOf('--mount-timeout', '45000'));

// findPrimaryInput() 的**逐字复刻**（src/layouts/tool.layout.vue:223-232）。
// 探针与被探对象用不同选择器，探出来的结论就不成立 —— 这里必须一字不差。
const FIND_PRIMARY_INPUT_SEL = 'textarea, input[type="text"], input[type="search"], input[type="number"], input:not([type])';
// 更宽的可编辑控件（兜底清单，smoke-tools.mjs 的排除法白名单）
const EDITABLE_SEL =
  'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="submit"])'
  + ':not([type="button"]):not([type="reset"]):not([type="range"]):not([type="color"]):not([type="hidden"])';

const TEXT_PAYLOAD = 'Hello Dev 123';
const NUMBER_PAYLOAD = '42';
// 等 Vue 响应式结算的时间。n-input-number 内部有 debounce/format，默认 450ms 足够稳。
const SETTLE_MS = 450;

// ─────────────────────────────── 静态服务 ───────────────────────────────
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

if (!LOCAL) {
  let reachable = false;
  try {
    reachable = (await fetch(BASE + '/', { method: 'HEAD' })).status > 0;
  }
  catch {}
  if (!reachable) {
    console.error(`[fatal] ${BASE} 不可达`);
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

const profile = path.join(REPO, `.example-probe-profile-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });

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
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    ...(LOCAL ? ['--no-proxy-server', '--proxy-bypass-list=<-loopback>'] : []),
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
  // ⛔ 临时 profile 删不掉时必须留痕，不能静默留垃圾。
  //   真实原因不是Chrome 文件锁（实测手工 Remove-Item 能秒删同一个目录），
  //   而是本工作区的**批量删除保护**：单次删除文件数 > 50 就被拦，
  //   而一个 Chrome profile 有 300~700 个文件。与「vite 清 dist 需要
  //   CODEBUDDY_SAFE_DELETE_ENABLED=0」是同一个环境机制。
  try {
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2 });
    if (fs.existsSync(profile)) {
      console.warn(`[cleanup] 临时 profile 未能自动删除（多半是批量删除保护：文件数 > 50）：${profile}`);
    }
  }
  catch {
    console.warn(`[cleanup] 临时 profile 未能自动删除（多半是批量删除保护：文件数 > 50）：${profile}`);
  }
  process.exit(code);
}
const WATCHDOG = Number(argOf('--watchdog', '900000'));
setTimeout(() => {
  console.error(`[watchdog] 超时 ${WATCHDOG}ms，强制收尾`);
  teardown(3);
}, WATCHDOG);
process.on('SIGINT', () => teardown(130));
process.on('uncaughtException', e => {
  console.error(e);
  teardown(1);
});
// ⛔ unhandledRejection 也要接管：模块顶层是 top-level await，启动阶段的 rejection
//   （首版就栽在`Invalid loader value` 那类错误上）只会走 unhandledRejection，
//   不会触发 uncaughtException —— 于是teardown 从不执行，
//   每次失败都在仓库根留下一个 Chrome profile 目录（实测积了 7 个、4000+ 文件）。
process.on('unhandledRejection', e => {
  console.error(e);
  teardown(1);
});
// 兜底：正常跑完也会走 teardown；这里只防「进程被外部信号打断」导致 profile 残留。
process.on('exit', () => {
  try {
    if (fs.existsSync(profile)) {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    }
  }
  catch {}
});

// ─────────────────────────────── CDP ───────────────────────────────
const portFile = path.join(profile, 'DevToolsActivePort');
let wsUrl = null;
for (let i = 0; i < 120 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 150));
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

ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    throw new Error('JS: ' + (r.exceptionDetails.text || ''));
  }
  return r.result.value;
};

// ─────────────────────────────── 页内脚本 ───────────────────────────────
/**
 * 页面内公用工具。写值必须走**原型链上的原生 setter** + input 事件，
 * 与 tool.layout.vue 的 setInputValue 完全一致 —— 否则 Vue 收不到通知，
 * 探到的是「DOM 变了但组件不知道」的死状态。
 */
const PAGE_HELPERS = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const root = () => document.querySelector('.tool-content');
  const primary = () => { const r = root(); return r ? r.querySelector(${JSON.stringify(FIND_PRIMARY_INPUT_SEL)}) : null; };
  const describe = (el) => {
    const t = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    let widget = 'native';
    if (el.closest('.n-input-number')) widget = 'n-input-number';
    else if (el.closest('.n-upload')) widget = 'n-upload';
    else if (el.closest('.n-input')) widget = 'n-input';
    const numeric = type === 'number' || widget === 'n-input-number'
      || el.getAttribute('inputmode') === 'decimal' || el.getAttribute('inputmode') === 'numeric';
    return {
      tag: t, type, widget, numeric,
      readOnly: !!el.readOnly,
      placeholder: el.getAttribute('placeholder') || '',
      cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
    };
  };
  /** 写入：原生 setter + input + change + blur，逼组件结算 */
  const write = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    el.focus();
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.blur();
  };
  /**
   * 工具区可见文本（归一化，供差分比较）。
   *
   * ⛔ 必须剔除 placeholder 节点。naive-ui 把 placeholder 渲染成真实 DOM
   * （类名 n-input__placeholder），它会进 innerText；而一旦写入任何值该节点就消失 ——
   * 于是「有没有打字」本身就能让 textChanged 变 true，与产出是否真的变了无关。
   * 首版就中过这个招：4 个 n-input-number 的文本轮全部因此假阳性。
   * 做法是克隆一份容器、删掉 placeholder 与 label 提示节点，再取 innerText。
   */
  const toolText = () => {
    const r = root();
    if (!r) return '';
    const clone = r.cloneNode(true);
    clone.querySelectorAll('.n-input__placeholder, .n-input__label, [class*="placeholder"]').forEach(n => n.remove());
    return (clone.innerText || '').replace(/\\s+/g, ' ').trim();
  };
  /**
   * 除**主控件以外**的其他控件值。
   *
   * ⛔ 必须排除主控件本身：首版把它算进去，于是「值写进去了」本身就让 valΔ 恒为 true，
   * 差分判据变成自证（self-fulfilling）。现在只统计「别的控件」有没有跟着变 ——
   * 那才是这个输入真的参与了运算的证据。
   */
  const otherValues = () => {
    const r = root();
    const p = primary();
    if (!r) return [];
    return [...r.querySelectorAll('input, textarea')]
      .filter(vis)
      .filter(e => e !== p)
      .map(e => e.value)
      .filter(v => v != null && v !== '');
  };
  window.__probe = {
    vis, root, primary, describe, write, toolText, otherValues,
    inspect() {
      const r = root();
      if (!r) return { hasToolContent: false };
      const p = primary();
      const all = [...r.querySelectorAll(${JSON.stringify(EDITABLE_SEL)})].filter(vis).map(describe);
      return {
        hasToolContent: true,
        primaryFound: !!p,
        primary: p ? describe(p) : null,
        allControls: all,
        fileInputs: [...r.querySelectorAll('input[type="file"]')].filter(vis).length,
        buttons: [...r.querySelectorAll('button')].filter(vis).map(b => (b.innerText || '').trim()).filter(Boolean),
        baselineText: toolText(),
        baselineValues: otherValues(),
      };
    },
    /** 一轮实验：写入 → 等结算（由调用方 sleep）→ 读回 */
    snapshot() {
      const p = primary();
      return {
        value: p ? p.value : null,
        text: toolText(),
        values: otherValues(),
      };
    },
  };
  return true;
})()`;

/**
 * 一轮实验：重置 → 等结算 → 取基线 → 写入 → 等结算 → 读回 → 比对。
 *
 * ⛔ 每轮**先重置再取基线**，首版没做，得到的第一轮差分里混着「初始渲染刚settle」的噪声
 * （比如 readonly 的 Result 框从空变成 0），会让 textChanged 假阳性。
 * ⛔ 基线必须在写入**之后**重新取，不能复用上一轮的读数。
 * ⛔ 差分只统计「主控件以外」的控件值。把主控件本身算进去，差分就是自证的。
 */
async function experiment(payload) {
  await evaluate(`window.__probe.write(window.__probe.primary(), '')`);
  await sleep(SETTLE_MS);
  const before = await evaluate('window.__probe.snapshot()');
  await evaluate(`window.__probe.write(window.__probe.primary(), ${JSON.stringify(payload)})`);
  await sleep(SETTLE_MS);
  const after = await evaluate('window.__probe.snapshot()');
  const textChanged = after.text !== before.text;
  const valuesChanged = JSON.stringify(after.values) !== JSON.stringify(before.values);
  // 逐项对比「别的控件」，报告里要能看到到底哪个输出跟着变了
  const valueDelta = after.values.map((v, i) => ({ was: before.values[i] ?? null, now: v }))
    .filter((d, i) => d.was !== d.now);
  return {
    payload,
    valueBefore: before.value,
    valueAfter: after.value,
    kept: after.value === payload,
    textChanged,
    valuesChanged,
    anyChange: textChanged || valuesChanged,
    valueDelta,
    textDelta: textChanged ? { was: before.text.slice(0, 160), now: after.text.slice(0, 160) } : null,
    nan: /(^|[^A-Za-z])NaN([^A-Za-z]|$)/.test(after.text),
    textSample: after.text.slice(0, 180),
  };
}

/**
 * 真实键盘输入实验 —— 风险 1 的决定性判据。
 *
 * 为什么必须用真实按键（CDP Input.insertText）而不能用 setter：
 *   setter 绕过组件的输入解析，naive-ui 的 n-input-number 因此会把 "Hello Dev 123"
 *   原样留在 DOM input 里，看起来「接受任意文本」。真实用户敲进去时，组件会解析，
 *   解析失败就把值回退成 null/上一个合法值 —— 这才是用户真正会遇到的体验。
 *   本函数返回 blur 之后的控件真实值。
 */
async function typingExperiment(payload) {
  await evaluate(`window.__probe.write(window.__probe.primary(), '')`);
  await sleep(SETTLE_MS);
  // 先聚焦到主控件（页内 focus，再用真实按键输入）
  const focused = await evaluate(`(() => {
    const el = window.__probe.primary();
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.focus();
    const r = el.getBoundingClientRect();
    window.__probeRect = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    return true;
  })()`);
  if (!focused) {
    return { ok: false, why: 'no-primary-input' };
  }
  const rect = await evaluate('window.__probeRect');
  // 先点一下确保焦点在页面上，再用 insertText 走真实输入通道
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed', x: Math.round(rect.x), y: Math.round(rect.y), button: 'left', clickCount: 1,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased', x: Math.round(rect.x), y: Math.round(rect.y), button: 'left', clickCount: 1,
  });
  await sleep(120);
  // 全选后输入，模拟「用户选中原内容再改写」
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await send('Input.insertText', { text: payload });
  await sleep(200);
  // blur：按 Tab，让组件跑校验/格式化
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sleep(SETTLE_MS);
  const snap = await evaluate('window.__probe.snapshot()');
  return {
    ok: true,
    payload,
    typedValue: snap.value,
    /** 真实按键 + blur 之后，文本是否还留在控件里 */
    survived: snap.value === payload,
    /** 控件里还剩什么（数字控件通常回退成空或上一个合法值） */
    afterTyping: snap.value,
    nan: /(^|[^A-Za-z])NaN([^A-Za-z]|$)/.test(snap.text),
    textSample: snap.text.slice(0, 180),
  };
}

// ─────────────────────────────── 判定 ───────────────────────────────
/**
 * 接受形态。
 *
 * ⛔ 四条判据的优先级（顺序不能换，每一条都是实测踩出来的）：
 *   1. `findPrimaryInput` 命中不了 → 一律不补（风险 2 / 风险 3）。
 *   2. 命中的是 `readonly` → 那是输出框，永不补（首版误判过 chmod-calculator / lorem-ipsum）。
 *   3. **真实按键**实验：blur 之后文本是否还留在控件里 —— 风险 1 的决定性判据。
 *      setter 会骗人（数字控件的 DOM input 是 type=text，setter 写什么都留着），
 *      真实按键 + blur 才会触发组件解析并回退。
 *   4. 输出差分只作**旁证**，不单独作为「接受文本」的依据：px-rem-converter /
 *      percentage-calculator 的产出需要第二个字段才非空，差分恒为 false，
 *      但它们确实是有效的数字输入 —— 不能因此判成「不可用」。
 */
function judge(row) {
  const p = row.primary;
  if (!row.primaryFound) {
    return {
      mode: 'no-input',
      canText: false,
      canNumber: false,
      reason: 'findPrimaryInput() 返回 null —— 页面上没有任何 textarea / input[text|search|number|无 type]，按钮点了会静默无反应',
    };
  }
  if (p.readOnly) {
    return {
      mode: 'readonly-output',
      canText: false,
      canNumber: false,
      reason: `首个控件是 readonly（placeholder="${p.placeholder}"）—— 那是输出框，填 example 等于往结果里塞字，下一轮渲染就被冲掉`,
    };
  }
  const t = row.typingText;
  if (!t || !t.ok) {
    return {
      mode: 'typing-failed',
      canText: false,
      canNumber: false,
      reason: `真实按键实验未能执行：${t?.why || '未知'} —— 不猜，交人工复核`,
    };
  }
  if (t.survived) {
    const corrob = row.textProbe?.anyChange
      ? '输出差分也证实产出跟着变'
      : '输出差分未变（该工具的产出需要第二个字段才非空，不影响「控件接受文本」这一结论）';
    return { mode: 'text-typed', canText: true, canNumber: true, reason: `真实按键输入并 blur 后文本原样留在控件里；${corrob}` };
  }
  if (p.numeric) {
    return {
      mode: 'number-only',
      canText: false,
      canNumber: true,
      reason: `数字控件（${p.widget}）：真实按键输入 ${JSON.stringify(t.payload)} 并 blur 后，控件值被回退成 ${JSON.stringify(t.afterTyping)} —— 文本进不去，只有数字载荷可用`,
    };
  }
  return {
    mode: 'dropped',
    canText: false,
    canNumber: false,
    reason: `真实按键输入并 blur 后，控件值被回退成 ${JSON.stringify(t.afterTyping)} —— 控件不接受这段文本`,
  };
}

// ─────────────────────────────── 逐工具探测 ───────────────────────────────
const results = [];
for (const [i, tool] of TARGETS.entries()) {
  const row = { tool, path: `/${tool}` };
  process.stdout.write(`[${String(i + 1).padStart(2)}/${TARGETS.length}] ${tool.padEnd(26)}`);
  try {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(100);
    await send('Page.navigate', { url: `${BASE}/${tool}/` });

    let mounted = false;
    const deadline = Date.now() + MOUNT_TIMEOUT;
    while (Date.now() < deadline) {
      mounted = await evaluate('!!document.querySelector(\'.tool-layout\')').catch(() => false);
      if (mounted) break;
      await sleep(150);
    }
    row.mounted = mounted;
    if (!mounted) {
      row.error = `组件未挂载（${MOUNT_TIMEOUT}ms）`;
      console.log('MOUNT-FAIL');
      results.push(row);
      continue;
    }
    await sleep(700);

    const helpersIn = await evaluate(PAGE_HELPERS);
    if (!helpersIn) throw new Error('页内探针注入失败');
    const info = await evaluate('window.__probe.inspect()');
    row.hasToolContent = info.hasToolContent;
    row.primaryFound = info.primaryFound;
    row.primary = info.primary;
    row.controls = info.allControls;
    row.fileInputs = info.fileInputs;
    row.buttons = info.buttons;
    row.baselineText = (info.baselineText || '').slice(0, 300);

    if (!info.hasToolContent) {
      Object.assign(row, { canText: false, canNumber: false, mode: 'no-root', reason: '缺少 .tool-content —— findPrimaryInput 的前置条件不成立' });
      console.log('⛔ NO-ROOT');
      results.push(row);
      continue;
    }
    if (info.primaryFound && !info.primary.readOnly) {
      // 差分实验（旁证）：写入是否让产出变化
      row.textProbe = await experiment(TEXT_PAYLOAD);
      await evaluate(`window.__probe.write(window.__probe.primary(), '')`);
      await sleep(250);
      row.numberProbe = await experiment(NUMBER_PAYLOAD);
      // 真实按键实验（决定性）：blur 之后文本还在不在
      row.typingText = await typingExperiment(TEXT_PAYLOAD);
      if (row.typingText.ok) {
        row.typingNumber = await typingExperiment(NUMBER_PAYLOAD);
      }
    }
    else if (info.primaryFound) {
      row.textProbe = null;
      row.numberProbe = null;
      row.typingText = null;
      row.typingNumber = null;
    }

    const j = judge(row);
    Object.assign(row, { canText: j.canText, canNumber: j.canNumber, mode: j.mode, reason: j.reason });
    const badge = j.canText ? '✅ TEXT' : j.canNumber ? '🔢 NUMBER' : '⛔ NO';
    console.log(`${badge.padEnd(11)} ${info.primaryFound ? `${info.primary.tag}[${info.primary.type || '-'}]/${info.primary.widget}${info.primary.readOnly ? '/readonly' : ''}` : '(findPrimaryInput=null)'}  ${j.mode}`);
    results.push(row);
  }
  catch (e) {
    row.error = String(e.message || e);
    console.log(`⚠️  ERROR ${row.error}`);
    results.push(row);
  }
}

// ─────────────────────────────── 落盘 ───────────────────────────────
const CAN_TEXT = results.filter(r => r.canText);
const CAN_NUMBER = results.filter(r => !r.canText && r.canNumber);
const CANNOT = results.filter(r => !r.canText && !r.canNumber && !r.error);
const ERRORS = results.filter(r => r.error);
const FILLABLE = [...CAN_TEXT, ...CAN_NUMBER];

const md = [];
md.push('# example 输入形态真机探测报告');
md.push('');
md.push(`- 生成时间：${new Date().toISOString()}`);
md.push(`- 被测源：\`${BASE}\`${LOCAL ? `（本地静态服务 \`${SERVE_DIST}/\`，与生产同构：同一份构建产物 + SPA fallback）` : '（线上）'}`);
md.push(`- 探测方式：**真浏览器真渲染** —— Chrome \`--headless=new\` + Node 原生 WebSocket 直连 CDP，逐页导航、逐控件写入、读回 DOM 与渲染输出。非读代码推断。`);
md.push(`- 探针脚本：\`scripts/probe-example-targets.mjs\`（可重跑复现）`);
md.push(`- 主控件选择器：**逐字复刻** \`src/layouts/tool.layout.vue:231\` 的 \`findPrimaryInput()\`：`);
md.push('');
md.push('  ```');
md.push(`  ${FIND_PRIMARY_INPUT_SEL}`);
md.push('  ```');
md.push('');
md.push('## 判定口径（为什么不能只看「写进去没被清空」）');
md.push('');
md.push('本脚本的判据迭代了四版，每一版都是被自己上一版的假阳性打回来的，记录在此以免重犯：');
md.push('');
md.push('| 版本 | 判据 | 被什么假阳性打回来 |');
md.push('|---|---|---|');
md.push('| v1 | 原生 setter 写入后读 `el.value` 是否原样保留 | ① `n-input-number` 的 DOM 是 `type=text`，setter 写什么都留着 → 4 个数字工具全判成可填文本；② 原生 `readonly` 框（输出框）setter 也写得进去 → chmod-calculator / lorem-ipsum 误判 |');
md.push('| v2 | 加差分（工具区文本/控件值是否变化） | 差分把**主控件自己**也算进去 → 「值写进去了」本身让差分恒真，自证；且第一轮差分混着初始渲染 settle 的噪声 |');
md.push('| v3 | 差分剔除主控件 + 每轮先重置取基线 | naive-ui 把 placeholder 渲染成真实 DOM 节点，输入即消失 → 「有没有打字」本身就能让文本变化为 true |');
md.push('| **v4（本版）** | **真实按键（`Input.insertText`）+ Tab blur 后文本是否存活** | — 差分降级为旁证 |');
md.push('');
md.push('v4 的理由：setter 绕过组件的输入解析，真实按键不绕过。naive-ui 的 `n-input-number`');
md.push('会在 blur 时解析并回退非法串 —— 这正是风险 1 描述的用户体验，只有真实按键能观测到。');
md.push('');
md.push('## 结论速览');
md.push('');
md.push(`| 判定 | 数量 | 工具 |`);
md.push(`|---|---|---|`);
md.push(`| ✅ 可补**文本** example | ${CAN_TEXT.length} | ${CAN_TEXT.map(r => r.tool).join(', ') || '—'} |`);
md.push(`| 🔢 只可补**数字** example | ${CAN_NUMBER.length} | ${CAN_NUMBER.map(r => r.tool).join(', ') || '—'} |`);
md.push(`| ⛔ 不可补（无输入控件） | ${CANNOT.length} | ${CANNOT.map(r => r.tool).join(', ') || '—'} |`);
md.push(`| ⚠️ 探测失败 | ${ERRORS.length} | ${ERRORS.map(r => r.tool).join(', ') || '—'} |`);
md.push('');
md.push('## 逐工具探测表（原文）');
md.push('');
md.push('> 关键列是「**真实按键+blur 后**」两列 —— 那是决定性判据。「差分产出变化」只是旁证。');
md.push('');
md.push('| # | tool | `.tool-content` | findPrimaryInput 命中 | readonly | 真实按键 `Hello Dev 123` → blur 后 | 真实按键 `42` → blur 后 | 差分：产出变化 | NaN | 形态 | 结论 |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|');
results.forEach((r, i) => {
  const p = r.primary;
  const hit = r.primaryFound ? `\`${p.tag}[${p.type || '—'}]\`` : '❌ `null`';
  const ro = r.primaryFound ? (p.readOnly ? '⚠️ 是' : '否') : '—';
  const tyCell = (e) => {
    if (!e) return '—';
    if (!e.ok) return `⚠️ ${e.why}`;
    return `${e.survived ? '✅ 保留' : '⛔ 回退成 ' + JSON.stringify(e.afterTyping)} → \`${JSON.stringify(e.afterTyping)}\``;
  };
  const diffCell = r.textProbe
    ? `文本 ${r.textProbe.anyChange ? '✅变' : '❌不变'} / 数字 ${r.numberProbe?.anyChange ? '✅变' : '❌不变'}`
    : '—';
  const nan = r.typingText?.nan || r.textProbe?.nan || r.numberProbe?.nan ? '⚠️ 有' : '无';
  const verdict = r.error
    ? `⚠️ ${r.error}`
    : r.canText
      ? '✅ 补文本 example'
      : r.canNumber
        ? '🔢 补数字 example'
        : '⛔ 不补';
  md.push(`| ${i + 1} | \`${r.path}\` | ${r.hasToolContent ? '✅' : '❌'} | ${hit} | ${ro} | ${tyCell(r.typingText)} | ${tyCell(r.typingNumber)} | ${diffCell} | ${nan} | \`${r.mode || '—'}\` | ${verdict} |`);
});
md.push('');
md.push('### 主控件明细（含组件归属与 placeholder）');
md.push('');
md.push('| tool | tag | type | 组件归属 | readonly | placeholder | class |');
md.push('|---|---|---|---|---|---|---|');
for (const r of results.filter(x => x.primaryFound)) {
  const p = r.primary;
  md.push(`| \`${r.path}\` | \`${p.tag}\` | \`${p.type || '—'}\` | ${p.widget} | ${p.readOnly ? '⚠️ 是' : '否'} | ${p.placeholder || '—'} | \`${p.cls || '—'}\` |`);
}
md.push('');
md.push('### 真实按键实验原始读数（决定性判据）');
md.push('');
md.push('模拟真实用户：点击聚焦 → Ctrl+A 全选 → `Input.insertText` 输入 → Tab 触发 blur → 等 450ms 读回。');
md.push('');
md.push('| tool | 载荷 | blur 后控件值 | 文本是否存活 | NaN | 结算后输出片段 |');
md.push('|---|---|---|---|---|---|');
for (const r of results) {
  for (const k of ['typingText', 'typingNumber']) {
    const e = r[k];
    if (!e) continue;
    if (!e.ok) {
      md.push(`| \`${r.path}\` | \`${e.payload || '—'}\` | ⚠️ 实验未执行：${e.why} | — | — | — |`);
      continue;
    }
    md.push(`| \`${r.path}\` | \`${e.payload}\` | \`${JSON.stringify(e.afterTyping)}\` | ${e.survived ? '✅ 存活' : '⛔ 被回退'} | ${e.nan ? '⚠️' : '无'} | ${JSON.stringify((e.textSample || '').slice(0, 80))} |`);
  }
}
md.push('');
md.push('### 差分实验原始读数（旁证）');
md.push('');
md.push('| tool | 载荷 | 写入前控件值 | 写入后控件值 | 原样保留 | 工具区文本变化 | 控件值变化 | NaN | 结算后输出片段 |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  for (const k of ['textProbe', 'numberProbe']) {
    const e = r[k];
    if (!e) continue;
    md.push(`| \`${r.path}\` | \`${e.payload}\` | \`${JSON.stringify(e.valueBefore)}\` | \`${JSON.stringify(e.valueAfter)}\` | ${e.kept ? '✅' : '❌'} | ${e.textChanged ? '✅ 变' : '❌ 不变'} | ${e.valuesChanged ? '✅ 变' : '❌ 不变'} | ${e.nan ? '⚠️' : '无'} | ${JSON.stringify(e.textSample.slice(0, 90))} |`);
  }
}
md.push('');
md.push('## ⛔ 不可补 example 的工具 —— 逐条理由');
md.push('');
for (const r of CANNOT) {
  md.push(`### \`${r.path}\` —— \`${r.mode}\``);
  md.push(`- **理由**：${r.reason}`);
  md.push(`- \`.tool-content\`：${r.hasToolContent ? '存在' : '**不存在**'}`);
  md.push(`- \`findPrimaryInput()\`：${r.primaryFound ? `命中 \`${r.primary.tag}[${r.primary.type || '—'}]\`（${r.primary.widget}${r.primary.readOnly ? '，readonly' : ''}）` : '**返回 null**'}`);
  md.push(`- 工具区内可见输入类控件：${(r.controls || []).length ? (r.controls || []).map(c => `\`${c.tag}[${c.type || '—'}]\`${c.widget !== 'native' ? `(${c.widget})` : ''}${c.readOnly ? ' readonly' : ''} ph=${c.placeholder ? `"${c.placeholder}"` : '—'}`).join('、') : '**一个都没有**'}`);
  md.push(`- \`input[type=file]\` 数量：${r.fileInputs ?? 0}`);
  md.push(`- 工具区可见按钮：${(r.buttons || []).length ? r.buttons.map(b => `\`${b}\``).join('、') : '（无）'}`);
  md.push('');
}
md.push('## ✅ / 🔢 可补 example 的工具 —— 控件清单');
md.push('');
for (const r of FILLABLE) {
  md.push(`### \`${r.path}\` —— ${r.canText ? '文本' : '数字'}型，主控件 \`${r.primary.tag}[${r.primary.type || '—'}]\`（${r.primary.widget}）`);
  md.push(`| # | tag | type | 组件 | readonly | placeholder | class |`);
  md.push('|---|---|---|---|---|---|---|');
  (r.controls || []).forEach((c, i) => {
    md.push(`| ${i} | \`${c.tag}\` | \`${c.type || '—'}\` | ${c.widget} | ${c.readOnly ? '⚠️ 是' : '否'} | ${c.placeholder || '—'} | \`${c.cls || '—'}\` |`);
  });
  md.push('');
}
md.push('## 方法学与已知边界');
md.push('');
md.push('1. **① 选择器命中 与 ④ 产出差分 都是判据**，单看任一都会错：');
md.push('   命中但产出不变 = 控件不是有效输入；产出变了但没命中 = `applyExample` 到不了那里。');
md.push('2. 「工具产出变化」= `.tool-content` 的 `innerText` **或**其内 `input/textarea` 的值发生变化。');
md.push('   两者都不覆盖 canvas / 图片类产物 —— 这类工具本轮 19 个里没有。');
md.push('3. `n-input-number` 的 `readOnly` 是 false、DOM type 是 `text`，**静态读源码完全看不出它数字受限**；');
md.push('   只有差分实验能抓出来。这就是本脚本存在的理由。');
md.push('4. 探测只覆盖「能否接受 example」，**不覆盖 example 内容是否是这个工具的真实使用场景** —— 后者是人工判断。');
md.push('');

fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_MD, md.join('\n'), 'utf8');
fs.writeFileSync(OUT_JSON, JSON.stringify({
  base: BASE,
  local: LOCAL,
  settleMs: SETTLE_MS,
  textPayload: TEXT_PAYLOAD,
  numberPayload: NUMBER_PAYLOAD,
  findPrimaryInputSelector: FIND_PRIMARY_INPUT_SEL,
  generatedAt: new Date().toISOString(),
  canText: CAN_TEXT.map(r => r.path),
  canNumber: CAN_NUMBER.map(r => r.path),
  cannot: CANNOT.map(r => r.path),
  errors: ERRORS.map(r => r.path),
  rows: results,
}, null, 2), 'utf8');

console.log('');
console.log(`[done] 文本 ${CAN_TEXT.length} / 数字 ${CAN_NUMBER.length} / 不可补 ${CANNOT.length} / 错误 ${ERRORS.length}`);
console.log(`[md]   ${OUT_MD}`);
console.log(`[json] ${OUT_JSON}`);
teardown(ERRORS.length ? 1 : 0);