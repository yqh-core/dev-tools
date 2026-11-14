#!/usr/bin/env node
/**
 * sync-readme.mjs —— README 工具清单与计数的单一数据源同步（参考站研究范式 2）。
 * ---------------------------------------------------------------------------
 * 病灶：README 的工具数曾硬编码 101，而站内首页/词条用 tools.length 现算，
 * 工具增长后 README 与站点漂移（101 vs 118）。商业站（OnlineToolHubs）的做法是
 * 所有计数与列表同一次渲染产出，新增工具自动出现在全部位置。
 *
 * 根治：README 的清单与计数都从 src/tools/index.ts（唯一事实源）派生，
 * 删掉手抄数字。--check 模式在构建期核对漂移，漂移即判失败（防再次烂尾）。
 *
 * 用法
 *   node scripts/sync-readme.mjs          # 重新生成 README 清单与计数
 *   node scripts/sync-readme.mjs --check  # 只校验是否漂移，不改文件（CI 用）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const README = path.join(REPO, 'README.md');
const CHECK = process.argv.includes('--check');
const SITE = 'https://digdevbox.com';

const vite = await createServer({
  root: REPO,
  logLevel: 'warn',
  server: { middlewareMode: true, hmr: false },
});

let toolsByCategory;
try {
  ({ toolsByCategory } = await vite.ssrLoadModule('/src/tools/index.ts'));
} finally {
  await vite.close();
}

const categories = toolsByCategory.filter(c => c.components.length > 0);
const total = categories.reduce((n, c) => n + c.components.length, 0);

// —— 生成工具清单（按分类，name + url + description，与站内同源）——
const lines = [];
for (const cat of categories) {
  lines.push(`### ${cat.name}`, '');
  for (const tool of cat.components) {
    const desc = String(tool.description ?? '').replace(/\s+/g, ' ').trim();
    lines.push(`- [${tool.name}](${SITE}${tool.path}) - ${desc}`);
  }
  lines.push('');
}
const listBlock = lines.join('\n').trimEnd();

// —— 组装新 README ——
const original = readFileSync(README, 'utf8');
let next = original.replace(
  /<!-- generated-tools-list:start -->[\s\S]*?<!-- generated-tools-list:end -->/,
  `<!-- generated-tools-list:start -->\n${listBlock}\n<!-- generated-tools-list:end -->`,
);
// 计数同源：替换三处手抄数字（措辞固定，数字派生）。
next = next
  .replace(/collection of \d+ free online tools/, `collection of ${total} free online tools`)
  .replace(/\*\*\d+ utilities across \d+ categories\*\*/, `**${total} utilities across ${categories.length} categories**`)
  .replace(/## All tools \(\d+\)/, `## All tools (${total})`);

if (CHECK) {
  if (next !== original) {
    console.error(`[sync-readme] DRIFT: README is out of sync with the tool registry (${total} tools, ${categories.length} categories). Run: node scripts/sync-readme.mjs`);
    process.exit(1);
  }
  console.log(`[sync-readme] OK: README in sync (${total} tools, ${categories.length} categories).`);
  process.exit(0);
}

if (next === original) {
  console.log(`[sync-readme] already in sync (${total} tools, ${categories.length} categories).`);
} else {
  writeFileSync(README, next);
  console.log(`[sync-readme] updated README: ${total} tools across ${categories.length} categories.`);
}