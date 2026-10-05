/**
 * 给 legacy 中「新版已有对应工具」的页面加 noindex,follow。
 *
 * 判据：页面 body 里带 dd-toolnotice 横幅（静态化迁移时注入的
 * 「该工具对应的新版功能已上线」提示）。带横幅 = 新版已有对应 + 经典版脚本
 * 未迁移（功能已坏）→ 对搜索引擎 noindex，但 follow 保留页内 122+ 内链的
 * 权重传导。不带横幅的 134 页是独立工具（title/description 唯一），保持索引。
 *
 * 两阶段方案第一步：观察 4 周 GSC 数据后，再决定这些页面是定向 301 到
 * 对应新版工具页还是维持 noindex。第二步之前不要 301、不要删除。
 *
 * 幂等：已有 name="robots" 的文件跳过。用法：node scripts/legacy-noindex.mjs
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const legacyDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'legacy');
const MARK = '<meta name="robots" content="noindex,follow" />';

const entries = await readdir(legacyDir, { withFileTypes: true });
let patched = 0;
let skipped = 0;
let noBanner = 0;

for (const e of entries) {
  if (!e.isDirectory()) continue;
  const file = join(legacyDir, e.name, 'index.html');
  let html;
  try {
    html = await readFile(file, 'utf8');
  } catch {
    continue; // 无 index.html 的目录不管
  }

  const hasBanner = html.includes('dd-toolnotice');
  if (!hasBanner) {
    noBanner++;
    continue;
  }
  if (html.includes('name="robots"')) {
    skipped++;
    continue;
  }
  if (!html.includes('</title>')) {
    console.error(`[skip] ${e.name}: 找不到 </title>`);
    continue;
  }
  const next = html.replace('</title>', '</title>' + MARK);
  if (next === html) {
    skipped++;
    continue;
  }
  await writeFile(file, next, 'utf8');
  patched++;
}

console.log(`noindex,follow 注入: ${patched} 页`);
console.log(`已有 robots 跳过   : ${skipped} 页`);
console.log(`独立工具页（不动） : ${noBanner} 页`);
if (patched > 0) {
  console.log('—— 两阶段方案第一步完成；第二步（定向 301）等 4 周 GSC 数据后再做 ——');
}
