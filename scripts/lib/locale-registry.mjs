/**
 * 语言注册表门禁（G1）的纯逻辑 —— 零 I/O，可在 Node / vitest 里直接测。
 *
 * ## 为什么需要这一层
 *
 * `src/i18n/languages.ts` 说「新增语言的唯一动作 = 往 ENABLED_LOCALES 加一项 + 放对应
 * yml」，但此前**没有任何机器检查证明这句话成立**：
 *   - 注册了却没有 yml → 切换器有选项（会被 availableLocales 交集过滤掉，看似"安全"），
 *     但 `detectLocale` 仍可能把 locale 设成它 → 全页回落 en 且无任何报错；
 *   - 有 yml 却没注册 → 死文件，没人消费；
 *   - yml 是**空文件** → 被 `existsSync` 当成"存在"（`scripts/build-locales-files.mjs`
 *     会批量创建空 yml），是最危险的假成功路径（P1 报告 K6）；
 *   - DEFAULT/FALLBACK 不在 ENABLED 里 → 全站兜底语言拿不到词条。
 *
 * 这一层把上述四种情况变成**可判红的字符串**，CLI（`scripts/check-locale-registry.mjs`）
 * 只负责读文件与打印。
 */

/**
 * 从 `src/i18n/languages.ts` 源码里解析注册表。
 *
 * 为什么解析源码而不是 import：`build-seo.mjs` 是纯 node 脚本（不经 vite transform），
 * 无法直接 import .ts。解析只读**一个文件**，且 `defaultLocale/fallbackLocale`
 * 必须落在 `enabled` 内（由 audit 校验），比在脚本里再写一份 `'en'` 字面量更抗漂移。
 */
export function parseRegistry(source) {
  const block = source.match(/export const ENABLED_LOCALES\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) {
    throw new Error('[locale-registry] 解析失败：找不到 `ENABLED_LOCALES = [...] as const` 块');
  }
  const enabled = [...block[1].matchAll(/\bcode:\s*'([^']+)'/g)].map(m => m[1]);
  const def = source.match(/export const DEFAULT_LOCALE\s*:[^=]*=\s*'([^']+)'/);
  const fb = source.match(/export const FALLBACK_LOCALE\s*:[^=]*=\s*'([^']+)'/);
  if (!enabled.length) throw new Error('[locale-registry] 解析失败：ENABLED_LOCALES 为空');
  if (!def) throw new Error('[locale-registry] 解析失败：找不到 DEFAULT_LOCALE');
  if (!fb) throw new Error('[locale-registry] 解析失败：找不到 FALLBACK_LOCALE');
  return { enabled, defaultLocale: def[1], fallbackLocale: fb[1] };
}

/** 取对象的所有**一级** key（用于"顶层区块缺失"判据）。 */
export function topLevelKeys(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
}

/** 统计叶子字符串条数（报告用，不参与判定）。 */
export function countLeafStrings(obj) {
  let n = 0;
  const walk = (v) => {
    if (typeof v === 'string') { n += 1; return; }
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(obj);
  return n;
}

/**
 * 执行 G1 判据。
 *
 * @param {object} input
 * @param {string[]} input.enabled           注册表里的语言码
 * @param {string}   input.defaultLocale     默认语言（预渲染语言）
 * @param {string}   input.fallbackLocale    vue-i18n 回落语言
 * @param {Record<string, {raw: string, data: unknown, parseError?: string|null}>} input.locales
 *        key = 文件名去掉 .yml；必须把磁盘上**所有** locales/*.yml 都传进来（含未注册的），
 *        否则"孤儿文件"判据失效。
 * @returns {{failures: string[], warnings: string[], stats: {code: string, keys: number}[]}}
 */
export function auditRegistry({ enabled, defaultLocale, fallbackLocale, locales }) {
  const failures = [];
  const warnings = [];
  const stats = [];

  if (!enabled.includes(defaultLocale)) {
    failures.push(`DEFAULT_LOCALE='${defaultLocale}' 不在 ENABLED_LOCALES（${enabled.join(', ')}）里 —— 兜底语言没有词条`);
  }
  if (!enabled.includes(fallbackLocale)) {
    failures.push(`FALLBACK_LOCALE='${fallbackLocale}' 不在 ENABLED_LOCALES（${enabled.join(', ')}）里`);
  }

  const onDisk = Object.keys(locales || {});

  for (const code of enabled) {
    const entry = locales?.[code];
    if (!entry) {
      failures.push(`已启用语言 '${code}' 缺少 locales/${code}.yml（注册了但没有词条文件）`);
      continue;
    }
    // K6：空文件不算"存在"。这是本门禁最重要的一条 —— 批量生成的空 yml 会让
    // existsSync / 目录存在性检查全部误判为"语言已就绪"。
    if (!entry.raw || !entry.raw.trim()) {
      failures.push(`locales/${code}.yml 是空文件（空白也算空）—— 空文件不构成"语言已配置"，必须删除或填内容`);
      continue;
    }
    if (entry.parseError) {
      failures.push(`locales/${code}.yml 解析失败：${entry.parseError}`);
      continue;
    }
    if (!entry.data || typeof entry.data !== 'object' || Array.isArray(entry.data)) {
      failures.push(`locales/${code}.yml 顶层不是对象（yaml 结构错误）`);
      continue;
    }
    const keys = topLevelKeys(entry.data);
    if (!keys.length) {
      failures.push(`locales/${code}.yml 无任何一级区块（解析出来是空对象）`);
      continue;
    }
    stats.push({ code, keys: countLeafStrings(entry.data) });
  }

  // 孤儿：磁盘上有、注册表里没有 → 死文件（同时意味着有人"只放了文件没注册"）
  for (const code of onDisk) {
    if (!enabled.includes(code)) {
      failures.push(`locales/${code}.yml 存在但 '${code}' 未在 ENABLED_LOCALES 注册（孤儿词条文件，没人消费）`);
    }
  }

  // 顶层区块对齐：非默认语言缺 section 说明翻译没跟上结构（深层缺键由 G2 管）
  const base = locales?.[defaultLocale]?.data;
  if (base && typeof base === 'object') {
    const baseKeys = new Set(topLevelKeys(base));
    for (const code of enabled) {
      if (code === defaultLocale) continue;
      const d = locales?.[code]?.data;
      if (!d || typeof d !== 'object') continue;
      const missing = [...baseKeys].filter(k => !topLevelKeys(d).includes(k));
      if (missing.length) {
        failures.push(`locales/${code}.yml 缺少一级区块：${missing.join(', ')}（结构未对齐 ${defaultLocale}）`);
      }
    }
  }

  // 未注册但非空的 yml 已在上面判 failure；这里只提示可能的"占位"目录
  const emptyOrphans = onDisk.filter(code => !enabled.includes(code) && !String(locales[code].raw || '').trim());
  if (emptyOrphans.length) {
    warnings.push(`存在 ${emptyOrphans.length} 个空 yml 且未注册：${emptyOrphans.join(', ')}（建议删除，避免下次误判）`);
  }

  return { failures, warnings, stats };
}

/**
 * K4 构建期门禁：已启用语言必须有对应的 guides 数据文件且被注册进 GUIDE_IMPORTERS。
 *
 * @param {object} input
 * @param {string[]} input.enabled       ENABLED_LOCALES 里的语言码列表
 * @param {string[]} input.guideFiles    src/tools/ 目录下实际存在的 `guides.<code>.ts` 对应的 code 集合
 *                                       （由 CLI 扫描磁盘后传入）
 * @param {string[]} [input.importerCodes] 从 guides.ts 源码解析出的 GUIDE_IMPORTERS key 列表
 *                                        （可选；若不提供则仅检查文件存在性）
 * @returns {{failures: string[], ok: boolean}}
 */
export function auditGuideLocaleCoverage({ enabled, guideFiles, importerCodes }) {
  const failures = [];

  for (const code of enabled) {
    // 1. 文件必须存在
    if (!guideFiles.includes(code)) {
      failures.push(
        `[K4] 已启用语言 '${code}' 缺少 src/tools/guides.${code}.ts —— `
        + `loadGuides 会在运行时 throw，构建期必须拦截`,
      );
    }
    // 2. 如果提供了 importerCodes，检查 GUIDE_IMPORTERS 有对应行
    if (importerCodes && !importerCodes.includes(code)) {
      failures.push(
        `[K4] '${code}' 有数据文件但 guides.ts 的 GUIDE_IMPORTERS 里没有对应 import 行`
        + ` —— Vite 不会为它拆 chunk，loadGuides 运行时会 throw`,
      );
    }
  }

  // 3. 孤儿：有 guides 文件但语言未注册 → 死代码（警告，不阻断）
  // （暂不报 failure，因为开发者可能先建文件再注册；G1 已管 yml 侧孤儿）

  return { failures, ok: failures.length === 0 };
}

/**
 * 从 `src/tools/guides.ts` 源码解析 GUIDE_IMPORTERS 对象的 key 列表。
 * 用于构建门禁判断"代码里有没有补对应行"。
 */
export function parseImporterCodes(source) {
  const block = source.match(/const GUIDE_IMPORTERS\s*[:=][^{]*\{([\s\S]*?)\n\}/);
  if (!block) return [];
  return [...block[1].matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1]);
}
