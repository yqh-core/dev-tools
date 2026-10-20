/**
 * 语言单一事实源（single source of truth）。
 *
 * ## 为什么单独建这个文件
 * 加一种语言原本要同时改 4 处、且互相不认识：
 *   ① `locales/<x>.yml` 词条文件；
 *   ② `locale-selector.vue` 里写死的 `{ zh:'中文', en:'English' }`；
 *   ③ 各处 `locale === 'zh' ? … : …` 的二元回落；
 *   ④ head 里的 `og:locale` / `hreflang`（目前根本没有）。
 * 每加一种语言都要把这些找一遍 = 「从头再来」。这里把**语言元数据**收敛成一份，
 * 切换器、检测、head 标签全部从这里派生。新增语言的唯一动作 = 往 `ENABLED_LOCALES`
 * 加一项 + 放对应 yml，其余自动生效。
 *
 * ## 检测用浏览器语言，不用 IP 定位
 * 用户诉求是「日语国家进来看到日语/英语切换」。成熟的实现是读 `navigator.languages`
 * （浏览器/系统设置的首选语言，日本用户通常就是 ja 打头），它免费、零延迟、无隐私成本。
 * IP→国家是**另一回事**（用于区分 pt-BR / pt-PT 这类同语言不同地区），需要 CF 的
 * `request.cf.countries` 或接口，且那是「地区变体」而非「语言」。这里 `detectLocale`
 * 收的是**有序偏好列表**，将来要叠加地理信号只需往列表前面 unshift，不改契约。
 */

/** 已启用、有对应词条文件、可切换的语言。 */
export type LocaleCode = 'en' | 'zh';

export interface LocaleDef {
  /** 内部短码，也是 `locales/<code>.yml` 的文件名与 vue-i18n 的 locale key。 */
  code: LocaleCode
  /** BCP 47 形式，写进 `<html lang>` 与 `Intl.*`。 */
  bcp47: string
  /** Open Graph 的 `og:locale`（Facebook/VK 用的是 `语言_国家` 形式）。 */
  ogLocale: string
  /** `<link rel=alternate hreflang>` 的值。 */
  hreflang: string
  /** 语言在切换器里用**它自己的文字**显示（English / 中文），符合国际惯例。 */
  nativeName: string
  /** 英文名，供工具/日志/无障碍标注。 */
  englishName: string
}

export const ENABLED_LOCALES = [
  { code: 'en', bcp47: 'en', ogLocale: 'en_US', hreflang: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'zh', bcp47: 'zh-CN', ogLocale: 'zh_CN', hreflang: 'zh', nativeName: '中文', englishName: 'Chinese' },
] as const satisfies readonly LocaleDef[];

/**
 * 二期候选语言。**刻意不并入 ENABLED**：
 * 没有词条文件就进切换器 = 点进去一片空白（把 key 直接渲染给用户）。
 * 接入某一种时：建 `locales/<code>.yml` → 把该 code 的 `LocaleDef` 加入 ENABLED_LOCALES →
 * 从本清单移除。检测、切换器、og/hreflang 全部自动跟上，无需再改别处。
 */
export const PLANNED_LOCALES = ['es', 'ja', 'de', 'fr'] as const;

/** 站点的兜底/默认语言（预渲染也恒用它，见 scripts/build-seo.mjs）。 */
export const DEFAULT_LOCALE: LocaleCode = 'en';
/** 找不到译文时 vue-i18n 回落到的语言。 */
export const FALLBACK_LOCALE: LocaleCode = 'en';

/**
 * 本站是否已给每种语言配了**独立可索引 URL**（如 `/zh/...`）。
 * 目前 = false：多语言靠客户端运行时切换，同一 URL 只有一份可被抓取的内容（en）。
 * hreflang 的前提是「不同语言有不同 URL」；在 false 时发 `hreflang="zh"` → 与 en 同 URL
 * 会误导 Google（它抓到的 zh 版本其实就是那份 en HTML）。所以 false 时只发自引用 +
 * `x-default`。将来引入分语言 URL 时把这里置 true，`buildAlternateLinks` 会自动补全互链。
 */
export const URL_LOCALIZED = false;

const BY_CODE: Map<string, LocaleDef> = new Map(ENABLED_LOCALES.map(l => [l.code, l]));

export const isLocaleCode = (v: unknown): v is LocaleCode => typeof v === 'string' && BY_CODE.has(v);

/** 取某语言定义；未知码回落默认（永不返回 undefined，调用方不必到处判空）。 */
export function localeDef(code: string): LocaleDef {
  return BY_CODE.get(code) ?? BY_CODE.get(DEFAULT_LOCALE)!;
}

/**
 * 把一个任意语言标签归一到已启用短码。Accept-Language / navigator / 用户手填都走这里。
 * 例：`zh-TW` `zh_Hant` → `zh`；`en-GB` → `en`；`ja`（未启用）→ 默认 `en`。
 */
export function normalizeLocale(raw: string | undefined | null): LocaleCode {
  const sub = (raw ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return isLocaleCode(sub) ? sub : DEFAULT_LOCALE;
}

/**
 * 按浏览器首选语言列表选初始语言。返回第一个「本站已启用」的偏好；全不匹配 → 默认。
 * `['ja-JP','ja','en']` → `en`（暂无 ja，落到通用语英语）；`['zh-CN']` → `zh`。
 * 传空（SSR / 老浏览器）安全返回默认，不抛错。
 */
export function detectLocale(preferredLanguages: readonly string[] | undefined): LocaleCode {
  for (const raw of preferredLanguages ?? []) {
    const sub = (raw ?? '').trim().toLowerCase().split(/[-_]/)[0];
    if (isLocaleCode(sub)) {
      return sub;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * 生成页面 head 里的 `<link rel=alternate hreflang>` 集合（纯数据，无 DOM，SSR 安全）。
 * - 单 URL（URL_LOCALIZED=false）：只发**已启用主语言自引用** + `x-default`，都指向 canonical。
 *   诚实表达「这份 HTML 就是这个语言」，不虚头发没有独立 URL 的语言。
 * - 分语言 URL（=true）：为每种已启用语言发一条（hrefOf 给出各自 URL）+ `x-default`。
 * 二期接 `/zh/` 时只翻 `URL_LOCALIZED` 并给 hrefOf，互链随之完整。
 */
export function buildAlternateLinks(
  canonical: string,
  hrefOf: (code: LocaleCode) => string = () => canonical,
  localized: boolean = URL_LOCALIZED,
): { rel: 'alternate'; hreflang: string; href: string }[] {
  if (!localized) {
    return [
      { rel: 'alternate', hreflang: localeDef(DEFAULT_LOCALE).hreflang, href: canonical },
      { rel: 'alternate', hreflang: 'x-default', href: canonical },
    ];
  }
  const links: { rel: 'alternate'; hreflang: string; href: string }[] = ENABLED_LOCALES.map(l => ({ rel: 'alternate' as const, hreflang: l.hreflang, href: hrefOf(l.code) }));
  links.push({ rel: 'alternate', hreflang: 'x-default', href: hrefOf(DEFAULT_LOCALE) });
  return links;
}

/** `og:locale` = 已启用主语言（= 抓取可见的那份）；`og:locale:alternate` = 其余已启用语言。 */
export function ogLocaleTags(): { property: string; content: string }[] {
  const primary = localeDef(DEFAULT_LOCALE).ogLocale;
  const alts = ENABLED_LOCALES.filter(l => l.code !== DEFAULT_LOCALE).map(l => l.ogLocale);
  return [
    { property: 'og:locale', content: primary },
    ...alts.map(c => ({ property: 'og:locale:alternate', content: c })),
  ];
}
