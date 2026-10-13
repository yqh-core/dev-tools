/**
 * 给 legacy 静态子站补 canonical + og:url。
 *
 * 为什么要做（2026-10-13 实测）
 *   - 162/164 页**完全没有 canonical**，唯一有的那页（index/）href 是空串，
 *     空 href 会解析成「当前 URL」，于是 www 变体自我归一到 www —— 加重而不是消除重复。
 *   - www.digdevbox.com 返回 200（未 301），Google 已把 www 变体当独立 URL 收录：
 *     GSC 页面榜里 legacy 的 6 次曝光**全部**挂在 www 下。
 *   - 主站页有 canonical 指回裸域可自愈，legacy 没有，所以自愈不了。
 *
 * 三种页，三种目标（判据全部机器可推导，不靠人工清单）
 *   ① 带 dd-toolnotice 横幅的页（= 静态化时已判定「主站已有等价功能」，实测 29 页）
 *      → canonical 指向横幅里那个新工具页。这些页本身已 noindex，
 *        canonical 把重复信号并给新页是收益，不会让它们被索引。
 *   ② legacy 首页 index/ → https://digdevbox.com/legacy/
 *   ③ 其余可索引工具页（实测 133 页）→ 自指 https://digdevbox.com/legacy/<slug>/
 *
 * 幂等：已存在且值正确的 canonical 跳过；存在但值错的替换（修 index/ 那个空 href）。
 * fail-closed：横幅里取不到 href、或 href 指向的路由在主站不存在 → 报错退出，不猜。
 *
 * 用法：node scripts/legacy-canonical.mjs [--dry]
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY = join(ROOT, 'public', 'legacy');
const ORIGIN = 'https://digdevbox.com';
const DRY = process.argv.includes('--dry');

// 主站已注册路由（权威口径：读每个工具的 defineTool.path，不用目录名）
async function registeredRoutes() {
  const dir = join(ROOT, 'src', 'tools');
  const out = new Set();
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = join(dir, e.name, 'index.ts');
    try {
      const s = await readFile(f, 'utf8');
      const m = s.match(/path:\s*'([^']+)'/);
      if (m) out.add(m[1]);
    } catch { /* 无 index.ts 的目录不是工具 */ }
  }
  return out;
}

const routes = await registeredRoutes();
const entries = await readdir(LEGACY, { withFileTypes: true });

let self = 0, toNew = 0, indexPage = 0, skipped = 0, fixed = 0;
const errors = [];

for (const e of entries) {
  if (!e.isDirectory()) continue;
  const file = join(LEGACY, e.name, 'index.html');
  let html;
  try { html = await readFile(file, 'utf8'); } catch { continue; }

  // —— 目标 URL 判定 ——
  let target;
  if (e.name === 'index') {
    target = `${ORIGIN}/legacy/`;
    indexPage++;
  } else if (html.includes('dd-toolnotice')) {
    const m = html.match(/class="dd-tn-a"\s+href="([^"]+)"/) || html.match(/dd-toolnotice[\s\S]{0,600}?href="([^"]+)"/);
    if (!m) { errors.push(`${e.name}: 有横幅但取不到目标 href`); continue; }
    const p = m[1].replace(/^\//, '').replace(/\/$/, '');
    if (!routes.has('/' + p) && !routes.has(p)) {
      errors.push(`${e.name}: 横幅指向 /${p}，但主站无此路由（不猜，跳过）`);
      continue;
    }
    target = `${ORIGIN}/${p}/`;
    toNew++;
  } else {
    target = `${ORIGIN}/legacy/${e.name}/`;
    self++;
  }

  const wantLink = `<link rel="canonical" href="${target}" />`;
  const wantOg = `<meta property="og:url" content="${target}" />`;

  // —— 幂等写入 ——
  let next = html;
  const hadLink = /<link[^>]+rel="canonical"[^>]*>/i.test(next);
  if (hadLink) {
    const cur = next.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i)[1];
    if (cur === target) { skipped++; }
    else {
      next = next.replace(/<link[^>]+rel="canonical"[^>]*>/i, wantLink);
      fixed++;
    }
  }
  if (!hadLink) {
    if (!next.includes('</title>')) { errors.push(`${e.name}: 找不到 </title>，无法插入`); continue; }
    next = next.replace('</title>', `</title>\n${wantLink}`);
  }
  if (!/property="og:url"/i.test(next)) {
    if (!next.includes('</title>')) { errors.push(`${e.name}: 找不到 </title>，无法插 og:url`); continue; }
    next = next.replace(/(<link[^>]+rel="canonical"[^>]*>)/i, `$1\n${wantOg}`);
  }

  if (next !== html) {
    if (!DRY) await writeFile(file, next, 'utf8');
  }
}

console.log(`自指 canonical   : ${self} 页`);
console.log(`并给主站新工具页 : ${toNew} 页（横幅目标路由已逐个核验存在）`);
console.log(`legacy 首页      : ${indexPage} 页`);
console.log(`已正确跳过       : ${skipped} 页`);
console.log(`修正错误值       : ${fixed} 页（如 index/ 的空 href）`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} 页未能处理（fail-closed，未猜测）:`);
  errors.forEach(x => console.error('   ' + x));
  process.exit(1);
}
console.log(DRY ? '\n[dry-run] 未写盘' : '\n已写盘');
