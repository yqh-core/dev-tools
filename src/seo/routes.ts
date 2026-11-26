/**
 * 构建期预渲染的静态路由清单 —— 单一事实来源。
 *
 * 被三处消费，因此必须集中定义，不要让它们各自维护一份：
 *   1. `src/entry-server.ts`  —— 按路径选择要渲染的页面组件（漏登记会编译报错）
 *   2. `scripts/build-seo.mjs` —— 逐路由渲染并注入 HTML
 *   3. 同脚本生成 `sitemap.xml` 时的静态页部分
 *
 * 路径一律**不带尾斜杠**（`'/privacy'`）。输出成 URL 时统一走
 * `canonicalUrl()` / `normalizePath()`（见 `src/seo/site.ts`），
 * 页面自身不需要关心尾斜杠形式。
 */
export const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly' },
  { path: '/about', changefreq: 'monthly' },
  { path: '/privacy', changefreq: 'monthly' },
  { path: '/terms', changefreq: 'monthly' },
  { path: '/contact', changefreq: 'monthly' },
  { path: '/tools', changefreq: 'weekly' },
  { path: '/faq', changefreq: 'monthly' },
] as const;

/** 静态路由的路径联合类型（`'/' | '/about' | … | '/faq'`，由下面那份清单派生）。 */
export type StaticRoutePath = (typeof STATIC_ROUTES)[number]['path'];

/** sitemap `<changefreq>` 的取值类型。 */
export type ChangeFreq = (typeof STATIC_ROUTES)[number]['changefreq'];

/**
 * 仅客户端渲染的应用路由 —— 产出一个**空壳** index.html，正文由客户端路由渲染。
 *
 * 为什么需要这张清单：本站是 SSG，**每个路由都必须有静态产物**。
 * `public/_redirects` 里唯一的兜底是 `/legacy/*`，没有 catch-all SPA 兜底，
 * 所以「不预渲染」在 Cloudflare Pages 上等于 404 —— 实测 `/api-studio` 返回 404。
 *
 * 为什么是空壳而不是预渲染真页面：这些是浏览器端应用（Web Worker / localStorage /
 * 独立全屏 layout），在 Node 里预渲染会崩；而且预渲染出的内容会被
 * `main.ts` 的 `createApp().mount('#app')` 整体替换，先闪一下错误内容反而更差。
 *
 * 与 STATIC_ROUTES 的区别：不进 sitemap、不生成工具页骨架、不进内链扫描
 * —— 它们是 app 界面，不是可索引的落地页。
 */
export const APP_ROUTES = [
  {
    path: '/api-studio',
    title: 'API Studio — Online API Testing Workspace | DigDevBox',
    description: 'Test and debug APIs straight in your browser: collections, environments, history, response inspection, tests and a collection runner. Import or export Postman, cURL and OpenAPI. No signup.',
  },
] as const;

/** 应用路由的路径联合类型。 */
export type AppRoutePath = (typeof APP_ROUTES)[number]['path'];
