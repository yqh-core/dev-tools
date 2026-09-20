/**
 * 使用说明（guides）的入口 —— 按语言分发。
 *
 * 语言策略
 * ------------------------------------------------------------------
 * DigDevBox 的默认语言是 English（`src/plugins/i18n.plugin.ts` 里 `locale: 'en'`），
 * 但界面同时支持中文。说明正文因此拆成两份数据：
 *   - `guides.en.ts` 英文（默认）
 *   - `guides.zh.ts` 中文（切到中文时按需加载）
 *
 * 为什么两份都要有
 * ------------------------------------------------------------------
 * 原先只有一份硬编码中文数据：默认英文工具页的 title / description / H1 是英文，
 * 下面那段使用说明却是中文（实测正文中文占比 25%~41%），属于明显的语言断层。
 * 但反过来把唯一一份改成英文，中文界面又会看到英文说明 —— 所以是**按语言分开**，
 * 而不是把中文改成英文。两份数据的 key 集合由构建期体检强制保持一致。
 *
 * 消费方
 * ------------------------------------------------------------------
 *   - 构建期：`src/seo/tool-page.ts` 直接 import `guides.en.ts`，把默认语言
 *     （英文）说明写进每个工具页的静态 HTML —— 爬虫拿到的必须是默认语言。
 *   - 运行期：`src/layouts/tool.layout.vue` 调 `loadGuides(locale)` 动态取当前语言，
 *     两份数据各自成为懒加载 chunk，不占首屏主包。
 */

export type { ToolGuide } from './guides.types';

/** 支持的语言。新增语言时在这里补一项，并在 `loadGuides` 里补分支。 */
export const GUIDE_LOCALES = ['en', 'zh'] as const;

export type GuideLocale = (typeof GUIDE_LOCALES)[number];

/** 把任意 locale 串（`zh`、`zh-CN`、`zh-Hans`…）归一到我们支持的语言上。 */
export function normalizeGuideLocale(locale: string): GuideLocale {
  return locale.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

/**
 * 按语言加载使用说明。
 *
 * 用 `switch` + 字面量 `import()` 而不是模板串拼路径：
 * Vite 只有在静态可枚举时才会把每个语言拆成独立 chunk。
 */
export async function loadGuides(locale: string): Promise<Record<string, import('./guides.types').ToolGuide>> {
  switch (normalizeGuideLocale(locale)) {
    case 'zh': {
      const { GUIDES } = await import('./guides.zh');
      return GUIDES;
    }
    default: {
      const { GUIDES } = await import('./guides.en');
      return GUIDES;
    }
  }
}
