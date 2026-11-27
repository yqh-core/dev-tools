import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('dist-api-studio');
const siteUrlValue = process.env.API_STUDIO_SITE_URL?.trim();
const publicRoutes = [
  '/',
  '/docs/',
  '/docs/first-request/',
  '/docs/collections/',
  '/docs/scripts-and-assertions/',
  '/docs/privacy/',
];
const pageRoutes = [...publicRoutes, '/app/'];

function normalizeSiteUrl(value) {
  if (!value) {
    return null;
  }

  let url;
  try {
    url = new URL(value);
  }
  catch {
    throw new Error('API_STUDIO_SITE_URL must be a valid HTTPS origin.');
  }

  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('API_STUDIO_SITE_URL must be an HTTPS origin without a path, query or credentials.');
  }

  return url.origin;
}

function htmlEscape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function insertOrReplaceMeta(html, attribute, key, content) {
  const escaped = htmlEscape(content);
  const expression = new RegExp(`<meta\\s+${attribute}=["']${key}["']\\s+content=["'][^"']*["']\\s*\\/? >?`, 'i');
  if (expression.test(html)) {
    return html.replace(expression, `<meta ${attribute}="${key}" content="${escaped}" />`);
  }

  return html.replace('</head>', `    <meta ${attribute}="${key}" content="${escaped}" />\\n  </head>`);
}

function routeToFile(route) {
  return resolve(output, route === '/' ? 'index.html' : `${route.replace(/^\\//, '')}index.html`);
}

const siteUrl = normalizeSiteUrl(siteUrlValue);
for (const route of pageRoutes) {
  const file = routeToFile(route);
  let html = await readFile(file, 'utf8');
  const title = html.match(/<title>([\\s\\S]*?)<\\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta\\s+name="description"\\s+content="([^"]+)"/i)?.[1]?.trim();

  if (!title || !description) {
    throw new Error(`Every API Studio route needs a title and meta description: ${route}`);
  }

  html = insertOrReplaceMeta(html, 'property', 'og:type', route.startsWith('/docs/') ? 'article' : 'website');
  html = insertOrReplaceMeta(html, 'property', 'og:site_name', 'API Studio by DigDevBox');
  html = insertOrReplaceMeta(html, 'property', 'og:title', title);
  html = insertOrReplaceMeta(html, 'property', 'og:description', description);
  html = insertOrReplaceMeta(html, 'name', 'twitter:card', 'summary');
  html = insertOrReplaceMeta(html, 'name', 'twitter:title', title);
  html = insertOrReplaceMeta(html, 'name', 'twitter:description', description);

  const canonical = siteUrl && !/noindex/i.test(html.match(/<meta\\s+name="robots"\\s+content="([^"]+)"/i)?.[1] || '')
    ? new URL(route, `${siteUrl}/`).href
    : null;

  html = html.replace(/\\s*<link\\s+rel="canonical"[^>]*>/gi, '');
  if (canonical) {
    html = html.replace('</head>', `    <link rel="canonical" href="${canonical}" />\\n  </head>`);
    html = insertOrReplaceMeta(html, 'property', 'og:url', canonical);
  }

  const structuredData = route === '/'
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'API Studio',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web browser',
        description,
        ...(canonical ? { url: canonical } : {}),
        author: { '@type': 'Organization', name: 'DigDevBox' },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        ...(canonical ? { url: canonical } : {}),
        isPartOf: { '@type': 'WebSite', name: 'API Studio by DigDevBox', ...(siteUrl ? { url: siteUrl } : {}) },
      };

  html = html.replace(/\\s*<script\\s+type="application\\/ld\\+json">[\\s\\S]*?<\\/script>/gi, '');
  html = html.replace('</head>', `    <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>\\n  </head>`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /app/',
  ...(siteUrl ? [`Sitemap: ${new URL('/sitemap.xml', siteUrl).href}`] : []),
  '',
].join('\\n');
await writeFile(resolve(output, 'robots.txt'), robots);

if (siteUrl) {
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...publicRoutes.map(route => `  <url><loc>${new URL(route, `${siteUrl}/`).href}</loc></url>`),
    '</urlset>',
    '',
  ].join('\\n');
  await writeFile(resolve(output, 'sitemap.xml'), sitemap);
}

console.log(`API Studio metadata injected for ${pageRoutes.length} routes${siteUrl ? ' with canonical URLs and sitemap' : ' (canonical/sitemap deferred until the final domain is selected)'}.`);
