/**
 * Keyword Map 独立校验入口。
 *
 * 为什么不只靠 `npm run build`
 * ------------------------------------------------------------------
 * `build-seo.mjs` 会跑同一份判据，但它是四步串联 build 的最后一步，且要花几十秒。
 * 「改完 title 想立刻知道有没有漂移」这件事需要一条秒级、不碰 dist 的命令 ——
 * 形态对齐既有的 `scripts/legacy-noindex.mjs`（独立脚本 + 幂等 + 打印统计）。
 *
 * 用法：
 *   node scripts/audit-keyword-map.mjs           # 校验并打印统计
 *   node scripts/audit-keyword-map.mjs --check   # 同上（显式声明「不改任何文件」）
 *
 * ⛔ 本脚本**只读**：不写 locales/、不写 src/、不碰 dist/。判据全部来自
 *   `src/seo/keyword-map.ts` 的 `auditKeywordMap()`，与构建期**同一份代码**，
 *   所以「这里绿」等价于「build 不会因 keyword map 炸」。
 * ⛔ 口径：搜索量全部 N/A（无 Keyword Planner 权限），本脚本打印 N/A 而不是 0。
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
});

try {
  const messages = parse(await readFile(join(root, 'locales/en.yml'), 'utf8'));
  const toolTitles = Object.fromEntries(
    Object.entries(messages.tools ?? {}).map(([key, value]) => [key, value?.title]),
  );

  const { auditKeywordMap, CLUSTER_KEYWORD_ENTRIES, KNOWN_NOTE_SLUGS } = await vite.ssrLoadModule(
    '/src/seo/keyword-map.ts',
  );
  const audit = auditKeywordMap(toolTitles);

  console.log(`[keyword-map] 校验通过：${audit.total} 行（11 个关键词簇）`);
  console.log(`[keyword-map] title 锁定 ${audit.lockedTitles} 条 —— 这些 title 与 locales/en.yml 不一致会让 build 失败`);
  console.log(`[keyword-map] 待落地 title ${audit.pendingTitles.length} 条：${audit.pendingTitles.join(' ')}`);
  console.log(`[keyword-map] 优先级 ${audit.byPriority.join(' ')}`);
  console.log(`[keyword-map] 搜索意图分布 ${audit.byIntent.map(({ intent, count }) => `${intent}=${count}`).join(' ')}`);
  console.log(`[keyword-map] 关联 forge-notes 文章 ${audit.withArticle} 条，白名单 slug ${KNOWN_NOTE_SLUGS.length} 个`);
  console.log(`[keyword-map] 搜索量：${audit.searchVolume}（无 Keyword Planner / Ads 权限，本表不含任何流量数字）`);

  // 反向可见性：哪些 slug 被哪些工具引用了 —— 「新文章只加在一个工具上」时
  // 在这里一眼能看出来（首页 Blog 是反向聚合，单点引用不会漏，但值得看见）。
  const byArticle = new Map();
  for (const entry of CLUSTER_KEYWORD_ENTRIES) {
    if (!entry.article) {
      continue;
    }
    byArticle.set(entry.article, [...(byArticle.get(entry.article) ?? []), entry.path]);
  }
  for (const [slug, paths] of byArticle) {
    console.log(`[keyword-map]   ${slug} ← ${paths.join(' ')}`);
  }

  await vite.close();
}
catch (err) {
  await vite.close().catch(() => {});
  console.error('[keyword-map] FAILED:', err.message ?? err);
  process.exit(1);
}
