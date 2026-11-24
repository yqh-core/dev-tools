/**
 * 站点级 SEO 常量与 URL 规范化 —— 全站唯一来源。
 *
 * ## 尾斜杠约定（改动前务必读完）
 *
 * Cloudflare Pages 对「磁盘上存在同名目录」的路径会强制 308 跳到带斜杠形式，
 * 且该 308 **优先于** `_redirects` 里的 SPA fallback —— 实测：
 *
 *   /legacy            → 308 → /legacy/
 *   /legacy/aesencrypt → 308 → /legacy/aesencrypt/
 *
 * 目前 `/about` 两种写法都返回 200，是因为它**还是 SPA 路由、磁盘上没有对应目录**。
 * 一旦该路由被构建期预渲染（`scripts/build-seo.mjs` 产出 `dist/about/index.html`），
 * 磁盘上就出现了真实目录，`/about`（不带斜杠）当天就会变成 308 跳转。
 *
 * 因此 canonical / sitemap / 站内链接**一律使用带尾斜杠形式**，
 * 避免预渲染铺开之后大批 URL 变成「sitemap 里是 A、实际服务的是 B」的跳转条目。
 */
export const SITE_ORIGIN = 'https://www.digdevbox.com';

/** 站点主机名，用于需要在正文里提到域名的场景。 */
export const SITE_HOST = 'www.digdevbox.com';

export const SITE_NAME = 'DigDevBox';

/** 社交卡片回退图（用于未知路由与开发服务器）。正式页面使用各自生成的 PNG。 */
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg?v=3`;

/** 每个预渲染路由拥有独立的 1200×630 PNG 社交卡片。 */
export const SOCIAL_IMAGE_VERSION = '1';

export function socialImageSlug(path: string): string {
  const normalized = !path || path === '/' ? '/' : (path.startsWith('/') ? path : '/' + path);
  if (normalized === '/') {
    return 'home';
  }
  const withoutLeadingSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const withoutTrailingSlash = withoutLeadingSlash.endsWith('/')
    ? withoutLeadingSlash.slice(0, -1)
    : withoutLeadingSlash;
  return withoutTrailingSlash.split('/').join('--').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

export function socialImagePath(path: string): string {
  return '/og/' + socialImageSlug(path) + '.png';
}

export function socialImageUrl(path: string): string {
  return `${SITE_ORIGIN}${socialImagePath(path)}?v=${SOCIAL_IMAGE_VERSION}`;
}

/**
 * 把任意路由路径规范化成唯一形式：以 `/` 开头；非根路径以 `/` 结尾。
 *
 * normalizePath('/')          → '/'
 * normalizePath('/about')     → '/about/'
 * normalizePath('/about/')    → '/about/'
 * normalizePath('about')      → '/about/'
 */
export function normalizePath(path: string): string {
  if (!path || path === '/') {
    return '/';
  }

  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;

  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

/** 规范化后的绝对 URL。canonical / og:url / sitemap `<loc>` 共用同一个函数。 */
export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${normalizePath(path)}`;
}
