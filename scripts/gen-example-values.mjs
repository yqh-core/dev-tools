#!/usr/bin/env node
/**
 * gen-example-values.mjs —— 生成 `scripts/smoke-fixtures/example-values.json`
 * ---------------------------------------------------------------------------
 * 为什么要这个产物：
 *   冒烟里 27 条用例点「示例」按钮（`applyExample`）。如果只验「控件的值变了」，
 *   那是**弱判据**：填错控件、填进半个值、被规范化改写过，全都算通过。
 *   真判据是「主输入控件的值逐字等于 guides 里那条 example.text」——
 *   而引擎跑在浏览器之外，拿不到 guides.en.ts（TS + `@/` 别名，不能直接 import）。
 *
 * 所以：用 vite 的 ssrLoadModule 把 guides.en.ts 读出来，落一份**只有 path → text** 的清单。
 * 事实源仍然只有一个（guides.en.ts）；这份 JSON 是它的派生物，
 * 并由 `scripts/build-seo.mjs` 在构建期核对是否过期（漂移就判构建失败）。
 *
 * 用法
 *   node scripts/gen-example-values.mjs            # 生成/更新
 *   node scripts/gen-example-values.mjs --check     # 只校验是否过期，不改文件（CI 用）
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const OUT = path.join(REPO, 'scripts/smoke-fixtures/example-values.json');
const CHECK = process.argv.includes('--check');

const vite = await createServer({
  root: REPO,
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: false },
});

let GUIDES;
try {
  ({ GUIDES } = await vite.ssrLoadModule('/src/tools/guides.en.ts'));
} finally {
  await vite.close();
}

const map = {};
for (const [p, guide] of Object.entries(GUIDES)) {
  if (guide?.example?.text) {
    map[p] = guide.example.text;
  }
}
const next = `${JSON.stringify({ generatedFrom: 'src/tools/guides.en.ts', count: Object.keys(map).length, values: map }, null, 2)}\n`;

if (CHECK) {
  if (!existsSync(OUT)) {
    console.error('[example-values] 缺产物：先跑 node scripts/gen-example-values.mjs');
    process.exit(1);
  }
  const cur = readFileSync(OUT, 'utf8');
  if (cur !== next) {
    console.error('[example-values] ✗ 产物与 guides.en.ts 不一致（示例文案改了但没重新生成，或反之）');
    const old = JSON.parse(cur).values;
    const keys = new Set([...Object.keys(old), ...Object.keys(map)]);
    const diff = [...keys].filter(k => JSON.stringify(old[k]) !== JSON.stringify(map[k]));
    for (const k of diff.slice(0, 8)) {
      console.error(`  ${k}: 产物=${JSON.stringify(old[k]?.slice(0, 30))} 现值=${JSON.stringify(map[k]?.slice(0, 30))}`);
    }
    console.error(`  共 ${diff.length} 项不一致`);
    process.exit(1);
  }
  console.log(`[example-values] 与 guides.en.ts 一致（${Object.keys(map).length} 条）`);
  process.exit(0);
}

writeFileSync(OUT, next, 'utf8');
console.log(`[example-values] 写入 ${OUT}（${Object.keys(map).length} 条）`);
