/**
 * API Studio CLI · 双入口 bundle（main + 沙箱 worker）→ dist-cli/。
 *
 * 复用仓库已有 vite（零新依赖；任务书 §5：浏览器/CLI 共用同一份 Runtime/Runner 源码——
 * bundle 直接内联 src/tools/api-cli 与它导入的 api-debugger 引擎模块）。
 * ssr 构建自动外置 node 内建；iarna-toml-esm（CJS 壳装 ESM，Node 原生命名导入会翻车）
 * 经 noExternal 内联。产物侧判据：外置 npm 导入必须为零（干净环境安装运行的硬保证），
 * 不做「源码层面已处理」的假声明。
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url)); // scripts/ 的上一级 = 仓库根（下方 join 校正）
const repoRoot = dirname(root);
const entries = [
  { input: 'src/tools/api-cli/main.ts', out: 'api-studio-cli.mjs', emptyOutDir: true },
  { input: 'src/tools/api-cli/worker-entry.ts', out: 'api-studio-cli-worker.mjs', emptyOutDir: false },
];

for (const e of entries) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false, // CLI bundle 不复制站点 public/（404.html/_headers 污染产物）
    // configFile:false 不加载仓库 vite.config 的 alias——CLI 显式补 @ → src（引擎链 json-workspace 使用）
    resolve: { alias: { '@': join(repoRoot, 'src') } },
    // vite 4.4 口径：build.ssr 开启 SSR 构建 + rollupOptions.input 指定入口（d.ts 明言）；
    // 顶层 ssr.noExternal 让 npm 依赖内联（iarna-toml-esm=CJS壳装ESM，Node 原生加载必炸；
    // json5 同内联——干净环境零外置 npm 依赖的硬保证）。
    ssr: { noExternal: ['iarna-toml-esm', 'json5'] },
    build: {
      ssr: true,
      outDir: join(repoRoot, 'dist-cli'),
      emptyOutDir: e.emptyOutDir,
      minify: false,
      target: 'node22', // Node 运行口径（TLA/worker_threads 语法合法）
      rollupOptions: {
        input: join(repoRoot, e.input),
        output: { entryFileNames: e.out },
      },
    },
  });
}

// shebang 保证（rollup 对入口 shebang 的保留不作承诺）——构建后置补全
const mainPath = 'dist-cli/api-studio-cli.mjs';
const main = readFileSync(mainPath, 'utf8');
if (!main.startsWith('#!')) {
  writeFileSync(mainPath, '#!/usr/bin/env node\n' + main, 'utf8');
}

// —— 产物侧判据（fail-closed）——
if (!existsSync(mainPath) || !existsSync('dist-cli/api-studio-cli-worker.mjs')) {
  throw new Error('[build-cli] missing bundle output (main and/or worker)');
}
if (!main.includes('api-studio-cli-worker.mjs')) {
  throw new Error('[build-cli] main bundle does not reference the worker bundle');
}
const worker = readFileSync('dist-cli/api-studio-cli-worker.mjs', 'utf8');
if (!worker.includes('installSandboxGuards')) {
  throw new Error('[build-cli] worker bundle missing sandbox guards — script-worker logic not inlined?');
}
// 外置 npm 导入审计：两个产物中除 node: 与 Node 内置模块（无前缀形态合法）外不得有裸导入。
// 正则限定 import/export/require 语境——模板字符串里的 from '...' 是假阳性，须排除。
const BUILTIN = new Set(builtinModules);
const bareRe = /(?:\bimport\s+[\s\S]{0,300}?\bfrom|\bexport\s+[\s\S]{0,300}?\bfrom)\s*\(?\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
for (const f of [mainPath, 'dist-cli/api-studio-cli-worker.mjs']) {
  const text = readFileSync(f, 'utf8');
  const bad = [...text.matchAll(bareRe)].map(m => m[1] ?? m[2]).filter(id => id && !id.startsWith('node:') && !BUILTIN.has(id));
  if (bad.length) {
    throw new Error(`[build-cli] external npm import(s) left in ${f}: ${[...new Set(bad)].join(', ')} — clean-env run would break`);
  }
}
console.log('[build-cli] dist-cli/api-studio-cli.mjs + api-studio-cli-worker.mjs OK (zero external npm imports)');
