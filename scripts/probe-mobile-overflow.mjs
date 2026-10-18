#!/usr/bin/env node
/**
 * probe-mobile-overflow.mjs — 移动端 390px 宽表可达性定点探针（零依赖 CDP）
 * 目的：把「裸 n-table 的宽内容在窄屏是否被裁且滚不进来」量出来，
 *       给出可复现的 FAIL/PASS，而不是靠肉眼。判据与 0eec57d 修复注释一致：
 *       先看 .tool-content 内容盒与表格固有宽，再逐格尝试「滚任一可滚祖先」能否进视口。
 * 用法：node scripts/probe-mobile-overflow.mjs --serve-dist dist
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const REPO = process.cwd();
const SERVE_DIST = process.argv.includes('--serve-dist') ? process.argv[process.argv.indexOf('--serve-dist') + 1] : 'dist';
const PORT = Number(process.env.PORT || 4200);
const VW = Number(process.env.VW || 390);
const VH = Number(process.env.VH || 844);

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const CHROME = CHROME_CANDIDATES.find(p => fs.existsSync(p));
if (!CHROME) { console.error('no chrome'); process.exit(2); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const root = path.resolve(REPO, SERVE_DIST);
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  let file = path.resolve(root, rel);
  if (!(file === root || file.startsWith(root + path.sep))) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const idx = path.join(file, 'index.html');
    if (fs.existsSync(idx)) { file = idx; }
    else { const nf = path.join(root, '404.html'); if (fs.existsSync(nf)) { res.writeHead(404, { 'content-type': 'text/html' }); fs.createReadStream(nf).pipe(res); return; } file = path.join(root, 'index.html'); }
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const profile = path.join(process.env.TEMP || '/tmp', 'probe-mo-profile-' + Date.now());
fs.mkdirSync(profile, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-proxy-server', 'about:blank'], { stdio: 'ignore' });

function teardown(code) { try { server.close(); } catch {} try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F']); else chrome.kill('SIGKILL'); } catch {} try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(code); }
setTimeout(() => { console.error('watchdog'); teardown(3); }, 180000);

const portFile = path.join(profile, 'DevToolsActivePort');
let wsUrl = null;
for (let i = 0; i < 120 && !wsUrl; i++) { await sleep(150); if (!fs.existsSync(portFile)) continue; const [p] = fs.readFileSync(portFile, 'utf8').split('\n'); try { const list = await (await fetch(`http://127.0.0.1:${p}/json/list`)).json(); wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {} }
if (!wsUrl) { console.error('no cdp'); teardown(2); }
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
const send = (method, params) => new Promise((resolve, reject) => { const mid = ++id; const t = setTimeout(() => { pending.delete(mid); reject(new Error('cdp timeout ' + method)); }, 20000); pending.set(mid, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } }); ws.send(JSON.stringify({ id: mid, method, params: params || {} })); });
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result || {}); pending.delete(m.id); } });
const evaluate = async expr => { const r = await send('Runtime.evaluate', { expression: `(async()=>{try{const v=await (${expr});return v==null?null:String(v);}catch(e){return 'ERR '+e.message;}})()`, returnByValue: true, awaitPromise: true }); return r.result?.value; };
await send('Page.enable'); await send('Runtime.enable');

const setValFn = `(el, text) => { const proto = Object.getPrototypeOf(el); const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set; el.focus(); if (setter) setter.call(el,''); else el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); if (setter) setter.call(el,text); else el.value=text; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.blur(); }`;

// 内置用例：含一个「必须 PASS 的对照组」(ipv4-subnet-calculator，0eec57d 已补滚动壳)
// 和一个「应随修复而 PASS」的 regex-tester。对照组一旦变红，说明探针本身失效而非页面问题。
const DEFAULT_CASES = [
  { name: 'CONTROL/ipv4-subnet-calculator(已修)', path: '/ipv4-subnet-calculator', control: true, fills: [{ i: 0, text: '192.168.1.10/24' }] },
  { name: 'regex-tester(邮箱长值)', path: '/regex-tester', fills: [{ i: 0, text: '[\\w.+-]+@[\\w.-]+\\.\\w+' }, { i: 1, text: 'a.long.user.name.here@sub.corporate-mail-server.example.org and second.person.lastname@another-really-long-domain-name.co.uk' }] },
  { name: 'regex-tester(日期命名组)', path: '/regex-tester', fills: [{ i: 0, text: '(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})' }, { i: 1, text: 'born 1990-04-25 moved 2023-12-01' }] },
];
const cases = process.env.CASES ? JSON.parse(process.env.CASES) : DEFAULT_CASES;
// case: { name, path, fills:[{i,text}], selector }  selector = the wide element to measure (default: widest table in .tool-content)

const results = [];
for (const c of cases) {
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}${c.path}/` });
  await sleep(2500);
  for (const f of (c.fills || [])) {
    await evaluate(`(()=>{const root=document.querySelector('.tool-content')||document;const els=[...root.querySelectorAll('textarea, input:not([type=hidden])')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&!e.disabled&&!e.readOnly;});const el=els[${f.i}];if(!el)return 'no-fill-'+${f.i};(${setValFn})(el,${JSON.stringify(f.text)});return true;})()`);
    await sleep(300);
  }
  await sleep(1200);
  const measure = await evaluate(`(()=>{
    const vw = window.innerWidth;
    const tc = document.querySelector('.tool-content');
    const tables = [...document.querySelectorAll('.tool-content table')];
    if (!tables.length) return JSON.stringify({ ok:true, reason:'no-table', vw });
    // pick widest table by scrollWidth
    let t = tables[0]; for (const x of tables) if (x.scrollWidth > t.scrollWidth) t = x;
    const box = t.getBoundingClientRect();
    const intrinsic = t.scrollWidth;
    const contentBox = tc ? tc.clientWidth : vw;
    // scrollable ancestor of the table
    function scrollableAncestor(el){ let n = el.parentElement; while(n){ const ox=getComputedStyle(n).overflowX; if((ox==='auto'||ox==='scroll') && n.scrollWidth>n.clientWidth+1) return n; if(ox==='scroll'||ox==='auto') return n; n=n.parentElement;} return null; }
    const anc = scrollableAncestor(t);
    // count unreachable cells: cells whose right edge > vw and can't be scrolled into view
    let unreachable = 0, totalCells = 0;
    const cells = [...t.querySelectorAll('td,th')];
    for (const cell of cells){ totalCells++;
      // try scrolling the ancestor (and window) to reveal this cell
      let revealed = false;
      if (anc){ const before = anc.scrollLeft; anc.scrollLeft = cell.getBoundingClientRect().right; if (cell.getBoundingClientRect().right <= vw+1 && cell.getBoundingClientRect().left >= 0){revealed=true;} anc.scrollLeft = 99999; if (cell.getBoundingClientRect().left < vw && cell.getBoundingClientRect().right > 0){revealed=true;} anc.scrollLeft = before; }
      const winBefore = window.scrollX; window.scrollTo(99999, window.scrollY); if (cell.getBoundingClientRect().left < vw && cell.getBoundingClientRect().right > 0){revealed=true;} window.scrollTo(winBefore, window.scrollY);
      const rect0 = cell.getBoundingClientRect();
      const currentlyVisible = rect0.right <= vw+1 && rect0.left >= -1;
      if (!currentlyVisible && !revealed) unreachable++;
    }
    const clipOnly = !anc; // no scrollable ancestor at all -> clipped by overflow-x:hidden chain
    // 结构性判据：表格固有宽超过 .tool-content 内容盒、右边缘越过视口，且没有任何可滚祖先 ——
    // 无论是否有单个"宽单元格"被逮到，右侧内容都已被裁掉且用户无法横滚读到（与 subnet 修复前同类）。
    const overflowClipped = intrinsic > contentBox + 1 && box.right > vw + 1 && !anc;
    return JSON.stringify({ ok: (unreachable === 0 && !overflowClipped), overflowClipped, unreachable, totalCells, intrinsic, contentBox, vw, hasScrollableAncestor: !!anc, clipOnly, tableRight: Math.round(box.right) });
  })()`);
  const r = JSON.parse(measure || '{"ok":false,"reason":"no-measure"}');
  r.name = c.name; r.path = c.path; r.control = !!c.control;
  results.push(r);
  console.log(`[${r.reason === 'no-table' ? 'SKIP' : (r.ok ? 'PASS' : 'FAIL')}] ${c.path.padEnd(32)} ${JSON.stringify(r)}`);
}
const measured = results.filter(x => x.reason !== 'no-table');
const controlFail = measured.find(x => x.control && !x.ok);
if (controlFail) {
  console.error(`\n[HARNESS-BROKEN] 对照组 ${controlFail.path} 未通过（它已含滚动壳，理应 PASS）。`);
  console.error('  → 探针判据失效，本次结果不可采信，先修探针再说页面问题。');
  teardown(2);
}
const fails = measured.filter(x => !x.control && !x.ok);
console.log(`\n=== 移动端 390px 宽表可达性：${fails.length} 页存在被裁/不可达内容（共测 ${measured.length} 张表，含 ${results.filter(x=>x.control).length} 个对照组全部 PASS）===`);
teardown(fails.length ? 1 : 0);
