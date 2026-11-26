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
import { readFileSync, writeFileSync, existsSync, mkdtempSync, copyFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url)); // scripts/ 的上一级 = 仓库根（下方 join 校正）
const repoRoot = dirname(root);
const entries = [
  { input: 'src/tools/api-cli/main.ts', out: 'api-studio-cli.mjs', emptyOutDir: true },
  // G2：沙箱=隔离子进程（api-studio-cli-child.mjs）；worker_threads 入口（worker-entry.ts）已退役删除。
  { input: 'src/tools/api-cli/sandbox-child-entry.ts', out: 'api-studio-cli-child.mjs', emptyOutDir: false },
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
if (!existsSync(mainPath) || !existsSync('dist-cli/api-studio-cli-child.mjs')) {
  throw new Error('[build-cli] missing bundle output (main and/or sandbox child)');
}
if (!main.includes('api-studio-cli-child.mjs')) {
  throw new Error('[build-cli] main bundle does not reference the sandbox child bundle');
}
const worker = readFileSync('dist-cli/api-studio-cli-child.mjs', 'utf8');
if (!worker.includes('installSandboxGuards')) {
  throw new Error('[build-cli] sandbox child bundle missing sandbox guards — script-worker logic not inlined?');
}
// 外置 npm 导入审计（fail-closed）：静态 import/export...from、require()、
// **副作用裸导入** `import "pkg";`（终审 P1-07 实测命中形态——旧审计正则漏掉它，
// 交付产物在干净目录 ERR_MODULE_NOT_FOUND yaml，此处必须全覆盖）、动态 import("pkg")。
const BUILTIN = new Set(builtinModules);
const bareRe = /(?:\bimport\s+[\s\S]{0,300}?\bfrom|\bexport\s+[\s\S]{0,300}?\bfrom)\s*\(?\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*\(?\s*['"]([^'"]+)['"]\s*\)?\s*;|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
for (const f of [mainPath, 'dist-cli/api-studio-cli-child.mjs']) {
  const text = readFileSync(f, 'utf8');
  const bad = [...text.matchAll(bareRe)].map(m => m[1] ?? m[2] ?? m[3] ?? m[4]).filter(id => id && !id.startsWith('node:') && !BUILTIN.has(id) && !id.startsWith('.'));
  if (bad.length) {
    throw new Error(`[build-cli] external npm import(s) left in ${f}: ${[...new Set(bad)].join(', ')} — clean-env run would break`);
  }
}
// —— 干净目录实弹验收（终审 P1-07 口径 + G2 子进程沙箱协议 round-trip）——
// 复制到无 node_modules 的临时目录，真实 spawn node 解析执行；任何外置残留在此暴露。
const MINIMAL_SNAPSHOT = {
  request: { method: 'GET', url: 'about:blank', headers: [], body: '' },
  response: null, globals: {}, collection: {}, environment: {}, iterationData: {}, local: {},
  info: { event: 'test', iteration: 1, counter: 1, requestName: 'build-smoke' },
};
const cleanDir = mkdtempSync(join(tmpdir(), 'api-studio-cli-clean-'));
for (const f of ['api-studio-cli.mjs', 'api-studio-cli-child.mjs']) {
  copyFileSync(join(repoRoot, 'dist-cli', f), join(cleanDir, f));
}
const smoke = spawnSync(process.execPath, ['api-studio-cli.mjs', '--version'], { cwd: cleanDir, encoding: 'utf8' });
if (smoke.status !== 0) {
  throw new Error(`[build-cli] clean-directory smoke failed (exit=${smoke.status}): ${smoke.stderr.slice(0, 400)}`);
}
// G2 安全边界产物实弹：子进程沙箱协议 round-trip（run→done）——加载退出码不冒充协议可用
const childSmoke = spawn(process.execPath, [join(cleanDir, 'api-studio-cli-child.mjs')], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], cwd: cleanDir });
const childOk = await new Promise(resolve => {
  const timer = setTimeout(() => { try { childSmoke.kill('SIGKILL') } catch {} resolve(false) }, 8000);
  childSmoke.on('message', d => { if (d?.type === 'done') { clearTimeout(timer); try { childSmoke.kill() } catch {} resolve(true) } });
  childSmoke.on('exit', () => { clearTimeout(timer); resolve(false) });
  childSmoke.send({ type: 'run', nonce: 1, code: 'pm.test("child-smoke", () => pm.expect(1).to.equal(1));', snapshot: MINIMAL_SNAPSHOT }); // ChildProcess IPC API = send（非 Worker postMessage）
});
if (!childOk) {
  throw new Error('[build-cli] sandbox child bundle protocol smoke failed (run→done round-trip)');
}
console.log(`[build-cli] dist-cli/api-studio-cli.mjs + api-studio-cli-child.mjs OK (zero external npm imports; clean-dir smoke: "${smoke.stdout.trim()}"; child protocol round-trip OK)`);
