/**
 * 全站级 FAQ 数据（/faq）—— 与「工具页内嵌 faqs」是两层不同的东西。
 *
 * ## 为什么要单独一层
 * 每个工具页的 `guides.*.faqs` 讲的是「这个工具容易被误解的点」；
 * 本站没有任何一处回答「你们收费吗 / 我粘的口令会不会上传 / 无障碍问题找谁」
 * 这类**站点级**高频问题 —— 参照站 nexacove.cc（DevBox Tools）就是靠这 7 条 FAQ
 * 撑起信任叙事与长尾入口。聚合页同时是内链枢纽：每条答案都指向已有的
 * /privacy、/contact、/tools、/about。
 *
 * ## 口径纪律（比写文案更重要）
 * 下面每一条答案都必须是**可核实的**：
 *   - 有广告这件事写在明面（`index.html` 的 ca-pub 脚本 + `public/ads.txt`），
 *     不允许照抄参照站的「无广告」；
 *   - 「输入不上传」只对纯前端工具成立，三个联网工具（WHOIS / HTTP 状态 / 历史上的今天）
 *     点名例外，且它们打的是本站自己的 Pages Function；
 *   - 离线可用性、日志留存、数据是否转售这些**没实测过的**，一律不作答，
 *     只把问题引到 /privacy。
 *
 * en / zh 必须等长 —— 文件末尾的断言会把这件事变成构建期判据，不靠人记。
 */

import { DEFAULT_LOCALE, ENABLED_LOCALES, normalizeLocale } from '@/i18n/languages';

export interface SiteFaq {
  q: string
  a: string
}

/** 全站 FAQ 页的路径（与 `src/seo/routes.ts` 的静态路由保持一致）。 */
export const SITE_FAQ_PATH = '/faq';

const ZH_FAQS: SiteFaq[] = [
  {
    q: '这些工具收费吗？需要注册吗？',
    a: '不收费用，也不需要注册或登录。页面上有 Google AdSense 广告位，但广告不参与任何计算：同一份输入，点不点广告，结果都一样。',
  },
  {
    q: '我粘贴的文本、上传的文件、输入的密钥会被传到服务器吗？',
    a: '不会。绝大多数工具在您的浏览器里本地完成计算，输入内容不出本机，也不写进任何本站存储。只有三个工具必须向外查询才能给出答案：[WHOIS 查询](/whois-lookup) 问域名注册数据、[HTTP 状态检测](/http-status-checker) 请求您填入的网址、[历史上的今天](/today-in-history) 取一份公开数据集 —— 它们也只向本站自己的服务发请求。更完整的处理说明见[隐私政策](/privacy)。',
  },
  {
    q: '手机上能用吗？',
    a: '能，页面是响应式的。主要工具页在 400px 宽度下做过布局与交互验收（横向溢出、按钮可点、结果可读）。如果您在某个具体页面上遇到排版问题，请按下面的无障碍模板告诉我们。',
  },
  {
    q: '工具给出的结果是错的，怎么办？',
    a: '请到[联系我们](/contact)用「[缺陷]」模板告诉我们：页面链接、您输入了什么、期望结果与实际结果、浏览器版本、复现步骤。工具类缺陷是我们优先级最高的一类反馈。',
  },
  {
    q: '可以建议新增工具吗？会不会提了就没下文？',
    a: '可以，用[联系我们](/contact)里的「[新工具]」模板。我们会看三件事：是否真有使用需求、与已有工具是否重叠、能否在浏览器本地做完且不把页面撑爆。不满足的会淘汰，但淘汰也有记录，不会让点子凭空消失。',
  },
  {
    q: '无障碍方面的问题反馈给谁？',
    a: '同样走[联系我们](/contact)，用「[无障碍]」模板：您用的辅助技术（读屏、纯键盘等）、障碍类型（键盘陷阱、标签不可读、对比度、焦点顺序）、出现位置、期望的正确行为。我们不做「已符合 WCAG」这类没有实测支撑的承诺，但会按反馈逐条修。',
  },
  {
    q: '为什么有些页面在 /legacy/ 下面？',
    a: '那是本站早期版本保留下来的经典工具存档，功能可用但不再随新版一起维护，也不在新版导航里推荐。入口在 [/legacy/](/legacy/)。',
  },
  {
    q: '全部工具在哪里看？',
    a: '[工具目录](/tools) 按类目列出了本站所有工具，共 {count} 个，这个数字直接从工具注册表取值，不手写。',
  },
  {
    q: '谁在做这个站？',
    a: '一个人维护的开源衍生项目（基于 it-tools，GPL-3.0），部署在 Cloudflare Pages。个人维护意味着我们不承诺回复时限与可用等级 —— 这一点在[服务条款](/terms)里也是这么写的，更多背景见[关于本站](/about)。',
  },
];

const EN_FAQS: SiteFaq[] = [
  {
    q: 'Are these tools free? Do I need an account?',
    a: 'Free, and no account or sign-up. Pages carry Google AdSense slots, but ads have no input into any calculation: the same input produces the same output whether you click an ad or not.',
  },
  {
    q: 'Is the text, file or key I paste sent to a server?',
    a: 'No. Most tools compute entirely in your browser — your input never leaves the machine and is never written to any storage we control. Three tools must ask something outside your browser to answer at all: [WHOIS lookup](/whois-lookup) queries domain registration data, [HTTP status checker](/http-status-checker) requests the URL you enter, and [On this day](/today-in-history) reads a public dataset. Those requests go to this site\'s own service, not to third parties. Full details are in the [privacy policy](/privacy).',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes — the layout is responsive, and the main tool pages are checked at a 400px viewport for horizontal overflow, tappable controls and readable results. If a specific page misbehaves on your device, the accessibility template below is the fastest way to tell us.',
  },
  {
    q: 'A tool gave me a wrong result. What now?',
    a: 'Send it through [contact](/contact) with the "[bug]" template: the page link, what you entered, what you expected, what happened, your browser version and the steps to repeat it. Wrong output is the highest-priority class of report here.',
  },
  {
    q: 'Can I ask for a new tool?',
    a: 'Please do — use the "[tool-request]" template on the [contact](/contact) page. Three questions decide it: is there real demand, does an existing tool already cover it, and can it be built to run in the browser without bloating the page. Ideas that fail are still recorded rather than quietly dropped.',
  },
  {
    q: 'Where do I report an accessibility problem?',
    a: 'On the [contact](/contact) page, using the "[a11y]" template: the assistive technology you use (screen reader, keyboard-only), the kind of barrier (keyboard trap, unreadable label, contrast, focus order), where it happens and what should happen instead. We do not claim WCAG conformance we have not measured, but we fix what is reported.',
  },
  {
    q: 'Why are some pages under /legacy/?',
    a: 'That is the archive kept from an earlier Chinese version of the site. The pages still work but are not maintained alongside the current version and are not recommended in the new navigation. Entry point: [/legacy/](/legacy/).',
  },
  {
    q: 'Where is the full list of tools?',
    a: 'The [tools directory](/tools) lists everything grouped by category — {count} tools at the moment. That number is read from the tool registry rather than written by hand, so it cannot go stale.',
  },
  {
    q: 'Who runs this site?',
    a: 'One person, on top of the open-source it-tools project (GPL-3.0), deployed on Cloudflare Pages. Single-maintainer means we promise neither a reply time nor an availability tier — [terms of service](/terms) says so plainly, and [about](/about) has the rest of the background.',
  },
];

if (ZH_FAQS.length !== EN_FAQS.length) {
  throw new Error(
    `[site-faqs] en / zh 条数必须相等（当前 zh=${String(ZH_FAQS.length)} en=${String(EN_FAQS.length)}）`,
  );
}

/**
 * K2（2026-10-22）：语言 → FAQ 数据的映射，改为**注册表驱动**。
 *
 * 此前是 `locale === 'zh' ? ZH_FAQS : EN_FAQS` 的二元分支：新增语言时这一段
 * 既不会报错、也不会提示，只会静默把日语页面显示成英文 FAQ。
 * 现在改成映射表 + 注册表归一化：
 *   - 归一化走 `normalizeLocale`（未启用语言 → 默认语言），与 guides / i18n 同一契约；
 *   - 新增语言只需在映射表加一行 + 提供 `*_FAQS` 数组，**不加就自动回落默认**，
 *     而且条数一致性断言（下方）会自动把新语言纳入校验。
 */
const FAQS_BY_LOCALE: Record<string, SiteFaq[]> = {
  en: EN_FAQS,
  zh: ZH_FAQS,
};

// N 语言条数一致性：所有已提供 FAQ 数组的语言都必须与默认语言等长。
// 新增语言时若漏翻某条，这里直接构建失败，而不是渲染出残缺 FAQ。
const defaultFaqCount = FAQS_BY_LOCALE[DEFAULT_LOCALE].length;
for (const [code, faqs] of Object.entries(FAQS_BY_LOCALE)) {
  if (faqs.length !== defaultFaqCount) {
    throw new Error(
      `[site-faqs] ${code} 的 FAQ 条数 ${faqs.length} ≠ 默认语言 ${DEFAULT_LOCALE} 的 ${defaultFaqCount}`,
    );
  }
}

// 覆盖交叉校验（2026-10-22 P0 收口）：每一种**已启用**语言都必须在 FAQS_BY_LOCALE 里有对应
// FAQ 数组。此前只遍历 FAQS_BY_LOCALE 已有键（en/zh），无法拦截「注册了 ja 但忘加 ja FAQ」——
// 那种情况下 getSiteFaqs 会静默 `?? 默认` 回落成英文 FAQ（用户评审点名的假成功路径）。
// 与 guides 的 K4 门禁同一目标：少了必须构建红，不靠人记。Node 侧另有
// auditFaqLocaleCoverage（check-locale-registry.mjs）在 CLI 里做同样校验，双保险。
for (const { code } of ENABLED_LOCALES) {
  if (!FAQS_BY_LOCALE[code]) {
    throw new Error(
      `[site-faqs] '${code}' 已在 ENABLED_LOCALES 启用，但 FAQS_BY_LOCALE 里没有对应 FAQ 数组 —— `
      + `getSiteFaqs('${code}') 会静默回落成默认语言 FAQ，新增语言必须同时补 FAQ。`,
    );
  }
}

/**
 * 取某语言的站点级 FAQ。
 * 归一化走注册表（`zh-CN` → `zh`、未启用的 `ja` → 默认语言），
 * 映射表里没有该语言时回落默认语言 —— 与 guides 的口径一致，不引入机翻产物。
 */
export function getSiteFaqs(locale: string): SiteFaq[] {
  const code = normalizeLocale(locale);
  return FAQS_BY_LOCALE[code] ?? FAQS_BY_LOCALE[DEFAULT_LOCALE];
}

/**
 * 供构建期 JSON-LD 与页面共用：把 `{count}` 换成真实工具数。
 * 只替换这一个占位符，不做通用模板引擎。
 */
export function fillSiteFaq(text: string, count: number): string {
  return text.replace(/\{count\}/g, String(count));
}
