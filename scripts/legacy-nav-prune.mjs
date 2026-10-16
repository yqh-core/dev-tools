/**
 * 经典版导航裁剪：把已退休页的导航链接从 public/legacy/ 各页摘掉。
 *
 * 为什么需要它（而不是一次性 sed）
 *   legacy 导航不是构建期生成的 —— legacy-canonical.mjs / legacy-noindex.mjs 都是一次性维护工具，
 *   package.json 与 CI 都不调用，所以 163 个页面各自存了一份导航副本，真合集页又是另一套 markup。
 *   只能机械改文件；那就必须让它幂等、可 dry-run、且带能证伪的断言，
 *   否则就是一堆没人能复核的 164 文件 diff。
 *
 * 三条来自实际教训的硬规矩
 *   1) 断言必须独立于删除逻辑。C2d 那次自检写成 `n == len(targets)`，两边都由同一个坏正则算出来，
 *      属于循环自证 —— 结果只删掉 7 块、线上残留 14 块，自检还是「通过」。
 *      所以这里 --apply 之后会用另一套实现（逐页扫 `<a href="/legacy/slug/"` 的裸计数）复核。
 *   2) 两种模板都要覆盖：`<li><span></span><a …>` 与 `<li data-s="…"><a …>`，
 *      且真合集页里多个 <li> 挤在同一行，所以不能要求 `</li>` 后接换行。
 *   3) 合集页上写的工具数不许再抄死数字：按实际剩余条数生成并断言相等。
 *      （原先 title 写 162、按钮写 163，本身就已经自相矛盾。）
 *
 * 用法：node scripts/legacy-nav-prune.mjs            # 预演，不写盘
 *       node scripts/legacy-nav-prune.mjs --apply   # 真正写盘
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEG = join(root, 'public', 'legacy');
const APPLY = process.argv.includes('--apply');

const spec = JSON.parse(readFileSync(join(root, 'scripts', 'legacy-retired.json'), 'utf8'));
const retired = new Set(
  Object.entries(spec).filter(([k]) => k !== '_comment').flatMap(([, v]) => v),
);
// 不写死总数（写死 93 之后每加一批都要改脚本，只会逼人随手把数字改对——那是假门禁）。
// 改成两条真有防护力的不变量：组间不得重叠、每个 slug 必须在磁盘上真有这一页。
const groups = Object.entries(spec).filter(([k]) => k !== '_comment');
const seenG = new Map();
for (const [g, list] of groups) {
  for (const s of list) {
    if (seenG.has(s)) { throw new Error(`${s} 同时出现在 ${seenG.get(s)} 与 ${g}`); }
    seenG.set(s, g);
    if (!existsSync(join(LEG, s, 'index.html'))) { throw new Error(`退休清单里的 ${s} 在磁盘上没有对应页`); }
  }
}
if (retired.size === 0) { throw new Error('退休清单为空，拒绝执行（空清单会让后面的断言全部空转）'); }
console.log(`退休清单：${groups.length} 组、共 ${retired.size} 个 slug`);

// ⚠ 不能用「<li> 块级匹配」。实测 legacy 导航 HTML 本身是坏的：存在未闭合的
//    `<li class="dropdown">`，而分类下拉的 toggle 自身就是 `<a href="/legacy/" …>`。
//    块级正则（允许跨过任何非 </li> 内容）会从那个游离 <li> 一路吞到下拉头、<ul> 开标签
//    和它里面第一条链接 —— 等于把整个分类标题删掉。断言 3 就是这么拦下第一次跑的。
//    所以只匹配「内容恰好是这一条链接」的 <li>（可带一个空的 <span></span> 前缀），
//    匹配不到就宁可留着链接，也不猜结构。
const LI = s => new RegExp(
  String.raw`[ \t]*<li[^>]*>(?:<span[^>]*></span>)?<a\b[^>]*href="/legacy/${s}/"[^>]*>[^<]*</a></li>[ \t]*\n?`, 'g');
const ANCHOR = s => new RegExp(String.raw`<a\b[^>]*href="/legacy/${s}/"`, 'g');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'static') walk(p); }
    else if (name.endsWith('.html')) files.push(p);
  }
})(LEG);
files.sort();

const plans = files.map((p) => {
  const src = readFileSync(p, 'utf8');
  const before = {};
  for (const s of retired) { before[s] = (src.match(ANCHOR(s)) || []).length; }
  let out = src;
  let removed = 0;
  for (const s of retired) { out = out.replace(LI(s), () => { removed += 1; return ''; }); }
  const after = {};
  for (const s of retired) { after[s] = (out.match(ANCHOR(s)) || []).length; }
  const beforeAll = (src.match(/<a\b[^>]*href="\/legacy\//g) || []).length;
  const afterAll = (out.match(/<a\b[^>]*href="\/legacy\//g) || []).length;
  // 断言 1：删掉的条数必须等于锚点计数的下降量（两套独立测量互校）
  const decByAnchor = Object.values(before).reduce((a, b) => a + b, 0)
    - Object.values(after).reduce((a, b) => a + b, 0);
  if (decByAnchor !== removed) { throw new Error(`[${relative(root, p)}] 两套测量不一致：删 ${removed}，锚点降 ${decByAnchor}`); }
  if (beforeAll - afterAll !== removed) { throw new Error(`[${relative(root, p)}] 总锚点降 ${beforeAll - afterAll} ≠ 删 ${removed}`); }
  // 断言 2：非退休链接一条不能少
  const nrBefore = beforeAll - Object.values(before).reduce((a, b) => a + b, 0);
  const nrAfter = afterAll - Object.values(after).reduce((a, b) => a + b, 0);
  if (nrBefore !== nrAfter) { throw new Error(`[${relative(root, p)}] 误伤非退休链接 ${nrBefore} → ${nrAfter}`); }
  // 断言 3：<li> 与 </li> 计数差必须保持为 0（原 HTML 有未闭合 <li>，所以按「差值不变」而非「等于 0」判）
  const bal = t => (t.match(/<li\b/g) || []).length - (t.match(/<\/li>/g) || []).length;
  if (bal(src) !== bal(out)) { throw new Error(`[${relative(root, p)}] 删后 <li>/</li> 差值从 ${bal(src)} 变成 ${bal(out)}，结构被破坏`); }
  // 断言 4：不得把某个分类摘空
  const groups = [...out.matchAll(/<h3><span>([^<]+)<\/span><\/h3>([\s\S]*?)(?=<h3>|<\/ul>|\n\s*<div)/g)];
  for (const [, name, body] of groups) {
    if (/<li\b/.test(body) && !/<a\b[^>]*href="\/legacy\//.test(body)) {
      throw new Error(`[${relative(root, p)}] 分类「${name}」被摘成空壳`);
    }
  }
  // 断言 5：LF 干净
  if (out.includes('\r')) { throw new Error(`[${relative(root, p)}] 结果含 CR`); }
  const residual = Object.entries(after).filter(([, n]) => n > 0).map(([s, n]) => `${s}=${n}`);
  return { p, removed, src, out, residual };
});

const residualAll = plans.flatMap(x => x.residual.map(s => `${relative(root, x.p)}:${s}`));
if (residualAll.length) {
  console.log(`⚠ 有 ${residualAll.length} 处退休链接没被「整条 <li>」形态匹配到（HTML 结构不规则），选择保留不猜结构：`);
  for (const r of residualAll.slice(0, 12)) { console.log('   ', r); }
  if (residualAll.length > 12) { console.log(`    …另 ${residualAll.length - 12} 处`); }
}

// 合集页可见计数：按实际剩余条数生成，不再抄死数字
const hub = plans.find(x => relative(root, x.p).replaceAll('\\', '/') === 'public/legacy/index.html');
if (hub) {
  const alive = new Set([...hub.out.matchAll(/<a\b[^>]*href="\/legacy\/([a-z0-9]+)\//g)].map(m => m[1]));
  const n = alive.size;
  const declared = [...hub.out.matchAll(/(\d{2,3})\s*个(?:经典)?工具/g)].map(m => +m[1]);
  const before2 = hub.src.match(/<a\b[^>]*href="\/legacy\//g)?.length ?? 0;
  process.stdout.write(`  合集页：剩余可点条目 ${n} 个（原链接 ${before2} 条），改前文里写死的数字 ${[...new Set(declared)]}\n`);
  hub.out = hub.out
    .replace(/经典版（\d+ 个工具）/g, `经典版（${n} 个工具）`)
    .replace(/共 \d+ 个工具/g, `共 ${n} 个工具`)
    .replace(/搜索这 \d+ 个经典工具/g, `搜索这 ${n} 个经典工具`);
  const after3 = [...hub.out.matchAll(/(\d{2,3}) 个(?:经典)?工具/g)].map(m => +m[1]);
  if (after3.length && !after3.every(v => v === n)) {
    throw new Error(`合集页仍残留 ${[...new Set(after3.filter(v => v !== n))]}`);
  }
  hub.countN = n;
}

const total = plans.reduce((a, x) => a + x.removed, 0);
const touched = plans.filter(x => x.removed > 0).length;
console.log(`${APPLY ? '已应用' : '预演'}：${files.length} 个文件、${touched} 个有改动、共摘 ${total} 条链接`);
console.log('  每文件条数分布:', Object.entries(
  plans.reduce((a, x) => { a[x.removed] = (a[x.removed] ?? 0) + 1; return a; }, {}),
).map(([k, v]) => `${k}×${v}`).join(' '));

if (!APPLY) {
  console.log('\n预演完成，未写盘。确认总数无误后加 --apply。');
} else {
  for (const x of plans) { if (x.removed > 0 || x.p === hub?.p) writeFileSync(x.p, x.out, 'utf8'); }
  console.log(`\n已写盘。合集页工具数已按实际剩余生成：${hub?.countN}`);
}
