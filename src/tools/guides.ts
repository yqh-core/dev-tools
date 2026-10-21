/**
 * 使用说明（guides）的入口 —— 注册表驱动、按语言分发。
 *
 * ## K4 改造要点（2026-10-22）
 * 此前 `GUIDE_LOCALES` 硬编码 `['en','zh']`、`normalizeGuideLocale` 用 `startsWith('zh')`
 * 二元判断、`loadGuides` 用 `switch` 加 `default` 静默回落英文——三处都是新增语言时必须
 * "手工找一遍"的隐性耦合，且缺失语言会**静默吞掉**（界面切成日文，说明仍是英文）。
 *
 * 现在全部改为从 `src/i18n/languages.ts` 注册表派生：
 *   - `GUIDE_LOCALES` = `ENABLED_LOCALES.map(l => l.code)`
 *   - 归一化统一用 `normalizeLocale`（来自注册表，语义一致）
 *   - `loadGuides` 查 **静态 importer 映射**（保留 Vite code-split 能力）：
 *     注册了但没有对应 guides 文件 → **throw**（不是静默回落）
 *   - 构建期另有门禁（`scripts/lib/locale-registry.mjs` 的 `auditGuideLocaleCoverage`）
 *     在 build 链拦截：注册了但 `guides.<code>.ts` 不存在 → 构建失败
 *
 * 因此新增语言的完整动作是：
 *   1. 建 `locales/<code>.yml` + 注册表 `ENABLED_LOCALES` 加一项（G1 管配平）
 *   2. 建 `src/tools/guides.<code>.ts` 导出 `GUIDES`（K4 门禁管缺失）
 *   3. 在下方 `GUIDE_IMPORTERS` 补一行（静态可枚举，Vite 拆 chunk）
 *   少了任何一步，构建红而非静默降级。
 *
 * 消费方
 * ------------------------------------------------------------------
 *   - 构建期：`src/seo/tool-page.ts` 直接 import `guides.en.ts`（默认语言），
 *     把英文说明写进每个工具页的静态 HTML。
 *   - 运行期：`tool.layout.vue` / `GuideArticle.vue` 调 `loadGuides(locale)` 取当前语言。
 */

import { ENABLED_LOCALES, DEFAULT_LOCALE, normalizeLocale } from '@/i18n/languages'
import type { ToolGuide } from './guides.types'

export type { ToolGuide }

/** 已启用语言（派生自注册表，不再硬编码）。 */
export const GUIDE_LOCALES: readonly string[] = ENABLED_LOCALES.map(l => l.code)

/**
 * 静态 importer 映射。
 * ⛔ 每个 `GUIDE_LOCALES` 里的 code 都必须在这里有一行，且指向的文件必须存在。
 * 构建门禁（`auditGuideLocaleCoverage`）验证这一条；缺失 = 构建红。
 *
 * 写成字面量 import 而非模板拼接：Vite 只在静态可枚举时才拆 chunk。
 */
const GUIDE_IMPORTERS: Record<string, () => Promise<Record<string, ToolGuide>>> = {
  en: () => import('./guides.en').then(m => m.GUIDES),
  zh: () => import('./guides.zh').then(m => m.GUIDES),
}

/**
 * 运行时快速自检（供 dev-mode 或测试使用，构建门禁在 Node 端另有覆盖）。
 * 返回缺失 guides 文件的已启用语言列表；空数组 = 全部就绪。
 */
export function assertGuideCoverage(): string[] {
  return GUIDE_LOCALES.filter(code => !GUIDE_IMPORTERS[code])
}

/**
 * 按语言加载使用说明。
 * 归一化统一走注册表的 `normalizeLocale`（例：zh-TW → zh、ja(未启用) → en）。
 * 若注册表启用了一种语言但此处没有对应 importer → throw（不静默回落）。
 */
export async function loadGuides(locale: string): Promise<Record<string, ToolGuide>> {
  const resolved = normalizeLocale(locale)
  const importer = GUIDE_IMPORTERS[resolved]
  if (!importer) {
    throw new Error(
      `[guides] 语言 '${resolved}' 已在注册表 ENABLED_LOCALES 中启用，`
      + `但缺少 src/tools/guides.${resolved}.ts 或 GUIDE_IMPORTERS 没有对应行。`
      + ` 构建门禁 (auditGuideLocaleCoverage) 应在 CI 拦截此情况。`,
    )
  }
  return importer()
}
