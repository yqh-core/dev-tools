import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const siteSource = fs.readFileSync(path.resolve('src/seo/site.ts'), 'utf8');
const originMatch = siteSource.match(/export const SITE_ORIGIN = ['"]([^'"]+)['"]/);
if (!originMatch) throw new Error('Unable to read SITE_ORIGIN from src/seo/site.ts');
const origin = new URL(originMatch[1]).origin;
const failures = [];
let checked = 0;

/**
 * The legacy archive is deliberately retained for visitors and redirect targets,
 * but it is Chinese-only historical content outside the English-first US/EU
 * indexation scope. The HTML pages do not carry a robots meta tag; Cloudflare
 * Pages applies the policy through _headers. Guard both the response-header
 * policy and sitemap exclusion here so a build cannot silently lose noindex.
 */
function assertLegacyNoindexPolicy() {
  const headersPath = path.join(root, '_headers');
  const sitemapPath = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(headersPath)) {
    throw new Error('[legacy noindex] dist/_headers is missing; cannot verify the archive policy');
  }
  if (!fs.existsSync(sitemapPath)) {
    throw new Error('[legacy noindex] dist/sitemap.xml is missing; cannot verify sitemap exclusion');
  }

  const headers = fs.readFileSync(headersPath, 'utf8');
  const requiredRules = [
    { route: '/legacy', pattern: /(?:^|\r?\n)\/legacy\s*\r?\n[ \t]+X-Robots-Tag:\s*noindex\s*,\s*follow\s*(?=\r?\n|$)/i },
    { route: '/legacy/*', pattern: /(?:^|\r?\n)\/legacy\/\*\s*\r?\n[ \t]+X-Robots-Tag:\s*noindex\s*,\s*follow\s*(?=\r?\n|$)/i },
  ];
  for (const rule of requiredRules) {
    if (!rule.pattern.test(headers)) {
      throw new Error('[legacy noindex] _headers must apply "X-Robots-Tag: noindex, follow" to ' + rule.route);
    }
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const legacyEntries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map(match => match[1])
    .filter(url => {
      try {
        return new URL(url).pathname.startsWith('/legacy/');
      } catch {
        return false;
      }
    });
  if (legacyEntries.length > 0) {
    throw new Error('[legacy noindex] legacy archive URLs must not appear in sitemap.xml: ' + legacyEntries.join(', '));
  }
  console.log('[legacy noindex] PASS: /legacy and /legacy/* send noindex,follow and no legacy URL is in sitemap.xml');
}

assertLegacyNoindexPolicy();


function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      // Legacy archive pages are intentionally noindex and are not part of the current indexed route set.
      // Their outbound links are retained for visitors, but they are outside this current-site route gate.
      const relativeFile = path.relative(root, full).split(path.sep).join('/');
      if (relativeFile.startsWith('legacy/')) continue;
      const html = fs.readFileSync(full, 'utf8');
      for (const match of html.matchAll(/\bhref\s*=\s*(["'])(.*?)\1/gi)) {
        const raw = match[2].trim();
        if (!raw || raw.startsWith('#') || raw.startsWith('?')) continue;
        let url;
        try {
          url = new URL(raw, origin + '/');
        } catch {
          continue;
        }
        if (url.origin !== origin) continue;
        const pathname = url.pathname;
        if (pathname === '/' || pathname.startsWith('/api/')) continue;
        // Static files are not route URLs and must not be forced to end with a slash.
        if (/(?:^|\/)[^/]*\.[^/]+$/i.test(pathname)) continue;
        checked += 1;
        if (!pathname.endsWith('/')) {
          failures.push(path.relative(root, full) + ': ' + raw + ' -> ' + pathname + '/');
        }
      }
    }
  }
}
if (!fs.existsSync(root)) throw new Error('dist/ is missing; run the production build first');
walk(root);

if (failures.length) {
  console.error('[internal canonical links] FAIL: ' + failures.length + ' internal page links omit the canonical trailing slash');
  for (const failure of failures.slice(0, 100)) console.error(' - ' + failure);
  if (failures.length > 100) console.error(' ... and ' + (failures.length - 100) + ' more');
  process.exit(1);
}
console.log('[internal canonical links] PASS: ' + checked + ' internal route links point directly to canonical trailing-slash URLs');
