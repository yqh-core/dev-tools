/**
 * 静态路由的 description 数据层。
 *
 * ## 为什么只有 description，没有 title
 *
 * title 已各有来源且可用：4 个法务页取 `legal.*`（9 种语言齐全），
 * 首页 / 关于页为硬编码中文。本模块**不重复定义 title**，避免出现两个事实来源。
 *
 * description 则是此前完全缺失的：5 个页面都没有声明，构建期预渲染后
 * 全部原样沿用 `index.html` 模板里的**首页通用描述**，即 `/privacy/` 的
 * description 与首页逐字相同 —— 与页面主题不匹配，属于 SEO 数据层缺口。
 *
 * ## 为什么只有 zh / en
 *
 * 与法务页正文一致：`Privacy.vue` 等页面在非 zh 语言下一律取英文 Markdown
 * （`locale === 'zh' ? zh : en`）。description 沿用同一口径，其它 7 种语言
 * 回落英文，不引入机器翻译产物。
 */
import { SITE_HOST } from './site';
import { TOOL_SEO_PAGES } from './tool-page';

/** 工具数从注册表实时取值：新增/下架工具后 description 自动跟随，不再硬编码。 */
const TOOL_COUNT = TOOL_SEO_PAGES.length;

export interface PageMeta {
  description: string
}

const ZH: Record<string, PageMeta> = {
  '/': {
    description:
      `DigDevBox（${SITE_HOST}）收录 ${TOOL_COUNT} 个面向开发与运维的在线工具，`
      + '涵盖加密、转换、Web、开发、网络、文本、数学、度量、数据等分类；'
      + '绝大多数工具在浏览器本地运行，输入内容不会上传。',
  },
  '/about': {
    description:
      '关于DigDevBox：项目定位、收录范围、技术栈与许可说明。'
      + '前端采用 Vue 3 + Naive UI、Vite 构建，部署在 Cloudflare Pages；'
      + '基于开源项目 it-tools（GPL-3.0）二次开发。',
  },
  '/privacy': {
    description:
      'DigDevBox隐私政策：本站实际部署了哪些服务、各类工具如何处理您输入的数据、'
      + '本地存储与广告（Google AdSense）的使用方式，以及您可以做出的选择。',
  },
  '/terms': {
    description:
      'DigDevBox服务条款：使用本站的规则、工具输出的免责声明、知识产权归属、'
      + '广告说明、可用性承诺范围与条款变更方式。',
  },
  '/contact': {
    description:
      '联系DigDevBox：工具使用问题与缺陷反馈、新工具建议、隐私与数据相关咨询、'
      + '广告与商务合作。页内附反馈时需要提供的信息清单。',
  },
};

const EN: Record<string, PageMeta> = {
  '/': {
    description:
      `DigDevBox collects ${TOOL_COUNT} online tools for developers and IT engineers, covering crypto, `
      + 'converters, web, development, network, text, math, measurement and data. '
      + 'Most tools run entirely in your browser and never upload your input.',
  },
  '/about': {
    description:
      'About DigDevBox: what the site is, which tools it collects, the tech stack and its licence. '
      + 'Built with Vue 3 + Naive UI and Vite, deployed on Cloudflare Pages, '
      + 'based on the open-source it-tools project (GPL-3.0).',
  },
  '/privacy': {
    description:
      'DigDevBox privacy policy: which services are actually deployed, how each kind of tool handles '
      + 'your input, local storage and advertising (Google AdSense), and the choices available to you.',
  },
  '/terms': {
    description:
      'DigDevBox terms of service: the rules for using the site, disclaimers about tool output, '
      + 'intellectual property, advertising, availability, and how these terms may change.',
  },
  '/contact': {
    description:
      'Contact DigDevBox: tool bugs and feedback, new tool suggestions, privacy and data questions, '
      + 'and advertising or business enquiries, plus what to include in your message.',
  },
};

const BY_LOCALE: Record<'zh' | 'en', Record<string, PageMeta>> = { zh: ZH, en: EN };

/**
 * 取某条静态路由的 description。
 *
 * - 未知路径 → 回落首页描述（宁可给通用值，也不要空 description）
 * - 非 zh 语言 → 回落英文（与法务页正文口径一致）
 */
export function getPageMeta(path: string, locale = 'zh'): PageMeta {
  const table = locale === 'zh' ? ZH : EN;

  return table[path] ?? (locale === 'zh' ? ZH['/'] : EN['/'])!;
}
