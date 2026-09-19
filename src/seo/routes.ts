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
] as const;

/** 静态路由的路径联合类型，`'/about' | '/' | '/contact' | '/privacy' | '/terms'`。 */
export type StaticRoutePath = (typeof STATIC_ROUTES)[number]['path'];

/** sitemap `<changefreq>` 的取值类型。 */
export type ChangeFreq = (typeof STATIC_ROUTES)[number]['changefreq'];
