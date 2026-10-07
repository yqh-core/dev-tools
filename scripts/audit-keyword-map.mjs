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
 *   node scripts/audit-keyword-map.mjs --frontmatter
 *     # 额外对着真实 forge-notes 仓库校验 title/description 逐字一致（G-03 裁定④红线）
 *     # 用 --frontmatter=<dir> 指定仓库路径，默认 D:\work\forge-notes
 *
 * ⛔ 本脚本**只读**：不写 locales/、不写 src/、不碰 dist/。判据全部来自
 *   `src/seo/keyword-map.ts` 的 `auditKeywordMap()`，与构建期**同一份代码**，
 *   所以「这里绿」等价于「build 不会因 keyword map 炸」。
 * ⛔ 口径：搜索量全部 N/A（无 Keyword Planner 权限），本脚本打印 N/A 而不是 0。
 */
import process from 'node:process';
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

  // —— relatedNotes ↔ forge-notes frontmatter 逐字比对（G-03 裁定④红线）——
  // 这条判据必须读得到真实文章仓库才跑得起来，所以用 --frontmatter 显式触发：
  // 默认的 build 环境（CI / 别的机器）没有 forge-notes，硬跑会变成永远失败的断言。
  // ⛔ 找不到仓库时**不静默通过**：报 UNKNOWN 并以退出码 2 结束。
  //
  // ⛔ 这条判据是「Home.page.vue 的红线」的唯一机器化身。首页 BLOG_POSTS 现在从
  //   guides 的 relatedNotes 反向聚合，不再手写 —— 逐字一致性因此从「靠注释提醒」
  //   变成「可门禁」：改了 title 但没同步改 guides（或反之）这里就红。
  const frontmatterArg = process.argv.find(arg => arg.startsWith('--frontmatter'));
  if (frontmatterArg) {
    const notesDir = resolve(
      root,
      '..',
      'forge-notes',
      frontmatterArg.includes('=') ? frontmatterArg.split('=')[1] : '',
    );
    const postsDir = join(notesDir, 'docs', 'posts');
    try {
      await readFile(join(postsDir, 'index.md'), 'utf8');
    }
    catch {
      console.error(
        `[notes] UNKNOWN：读不到 forge-notes 文章目录 ${postsDir}，无法校验 title/description `
        + '是否与 frontmatter 逐字一致。请用 --frontmatter=<dir> 指向真实仓库。',
      );
      process.exit(2);
    }

    const vite2 = await createServer({
      root,
      server: { middlewareMode: true },
      appType: 'custom',
      logLevel: 'warn',
    });
    let GUIDES;
    try {
      ({ GUIDES } = await vite2.ssrLoadModule('/src/tools/guides.en.ts'));
    }
    finally {
      await vite2.close();
    }

    const problems = [];
    let checked = 0;
    for (const [path, guide] of Object.entries(GUIDES)) {
      for (const note of guide.relatedNotes ?? []) {
        const raw = await readFile(join(postsDir, `${note.slug}.md`), 'utf8').catch(() => null);
        if (raw === null) {
          problems.push(`${path}: 文章 ${note.slug}.md 在 ${postsDir} 不存在`);
          continue;
        }
        const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fm) {
          problems.push(`${path}: ${note.slug}.md 没有 frontmatter`);
          continue;
        }
        const meta = parse(fm[1]);
        if ((meta.lang ?? 'zh') !== 'en') {
          problems.push(`${path}: ${note.slug} 的 lang 是 ${meta.lang ?? '（未标注）'}，⛔ 英文主站只收 lang: en`);
        }
        if (meta.title !== note.title) {
          problems.push(
            `${path}: ${note.slug} title 不一致 —— frontmatter ${JSON.stringify(meta.title)}`
            + ` vs guides ${JSON.stringify(note.title)}`,
          );
        }
        if (meta.description !== note.description) {
          problems.push(`${path}: ${note.slug} description 与 frontmatter 不是逐字相同`);
        }
        checked += 1;
      }
    }
    if (problems.length > 0) {
      console.error(`[notes] FAILED（${problems.length} 项）:\n  - ${problems.join('\n  - ')}`);
      process.exit(1);
    }
    console.log(
      `[notes] frontmatter 逐字一致：${checked} 条引用`
      + '（title / description / lang: en 全部核对通过；首页 BLOG_POSTS 与工具页 related guides 同源）',
    );
  }
}
catch (err) {
  await vite.close().catch(() => {});
  console.error('[keyword-map] FAILED:', err.message ?? err);
  process.exit(1);
}
