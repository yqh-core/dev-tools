/**
 * G1 语言注册表门禁 + K4 指南覆盖门禁：CLI 壳（I/O 全在这里，判据在 lib/locale-registry.mjs）。
 *
 * 用法：`npm run i18n:check`
 * 退出码：0 = 全 PASS；1 = 存在 FAIL（构建链里会因此中断）。
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { auditFaqLocaleCoverage, auditGuideLocaleCoverage, auditRegistry, parseFaqLocaleCodes, parseImporterCodes, parseRegistry } from './lib/locale-registry.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const registry = parseRegistry(await readFile(join(root, 'src/i18n/languages.ts'), 'utf8'));

const localeDir = join(root, 'locales');
const names = (await readdir(localeDir)).filter(f => f.endsWith('.yml')).sort();
const locales = {};
for (const file of names) {
  const code = file.replace(/\.yml$/, '');
  const raw = await readFile(join(localeDir, file), 'utf8');
  let data = null;
  let parseError = null;
  try { data = parse(raw); } catch (e) { parseError = String(e.message || e).split('\n')[0]; }
  locales[code] = { raw, data, parseError };
}

const { failures, warnings, stats } = auditRegistry({
  enabled: registry.enabled,
  defaultLocale: registry.defaultLocale,
  fallbackLocale: registry.fallbackLocale,
  locales,
});

console.log(`[i18n] 注册表：enabled=${registry.enabled.join(', ')} default=${registry.defaultLocale} fallback=${registry.fallbackLocale}`);
for (const s of stats) {
  console.log(`[i18n]   ${s.code}: ${s.keys} 条叶子词条`);
}
for (const w of warnings) console.log(`[i18n] WARN ${w}`);

// ── K4：指南覆盖门禁 ──
// 扫描 src/tools/ 下实际存在的 guides.<code>.ts 文件
const toolsDir = join(root, 'src/tools');
const toolFiles = await readdir(toolsDir);
const guideFiles = toolFiles
  .filter(f => /^guides\.(.+)\.ts$/.test(f))
  .map(f => f.match(/^guides\.(.+)\.ts$/)[1]);

// 从 guides.ts 源码解析 GUIDE_IMPORTERS 的 key
const guidesSource = await readFile(join(toolsDir, 'guides.ts'), 'utf8');
const importerCodes = parseImporterCodes(guidesSource);

const guideResult = auditGuideLocaleCoverage({
  enabled: registry.enabled,
  guideFiles,
  importerCodes,
});

if (guideResult.ok) {
  console.log(`[i18n] K4 PASS 指南覆盖：${registry.enabled.length} 种已启用语言均有 guides 文件且注册进 GUIDE_IMPORTERS`);
} else {
  failures.push(...guideResult.failures);
}

// ── P0 收口：站点级 FAQ 覆盖门禁（site-faqs.ts 的 FAQS_BY_LOCALE）──
const faqSource = await readFile(join(root, 'src/seo/site-faqs.ts'), 'utf8');
const faqCodes = parseFaqLocaleCodes(faqSource);
const faqResult = auditFaqLocaleCoverage({ enabled: registry.enabled, faqCodes });
if (faqResult.ok) {
  console.log(`[i18n] FAQ PASS 站点级 FAQ 覆盖：${registry.enabled.join(', ')} 均有 FAQS_BY_LOCALE 条目`);
} else {
  failures.push(...faqResult.failures);
}

// ── 汇总 ──
if (failures.length) {
  console.error(`[i18n] FAIL ${failures.length} 项：`);
  for (const f of failures) console.error(`[i18n]   - ${f}`);
  process.exit(1);
}
console.log('[i18n] PASS 注册表与词条文件一致 + 指南覆盖完整（K4）+ 站点级 FAQ 覆盖完整');
