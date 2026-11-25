import fs from 'node:fs';
import path from 'node:path';
import { analyzeInternalLinkGraph } from './internal-link-graph.mjs';

const root = path.resolve('dist');
const siteSource = fs.readFileSync(path.resolve('src/seo/site.ts'), 'utf8');
const originMatch = siteSource.match(/export const SITE_ORIGIN = ['"]([^'"]+)['"]/);
if (!originMatch) throw new Error('Unable to read SITE_ORIGIN from src/seo/site.ts');
const origin = new URL(originMatch[1]).origin;
const failures = [];
const graphPages = [];
let checked = 0;

/**
 * The legacy archive remains available to visitors, but every retained HTML
 * page is outside the current English-first US/EU indexation scope. _headers
 * provides a response-header defense; each built HTML file must also carry an
 * explicit noindex,follow meta directive because Pages Functions can bypass
 * _headers response processing. The build guards both mechanisms and sitemap exclusion.
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

  const legacyRoot = path.join(root, 'legacy');
  if (!fs.existsSync(legacyRoot)) {
    throw new Error('[legacy noindex] dist/legacy is missing');
  }
  const legacyHtmlFiles = [];
  function walkLegacy(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkLegacy(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) legacyHtmlFiles.push(full);
    }
  }
  walkLegacy(legacyRoot);
  if (legacyHtmlFiles.length === 0) {
    throw new Error('[legacy noindex] no built legacy HTML files found; refusing an empty pass');
  }
  const legacyMetaFailures = [];
  for (const file of legacyHtmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const robotsTags = [...html.matchAll(/<meta\b[^>]*\bname\s*=\s*(['"])robots\\1[^>]*>/gi)];
    const robotsContent = robotsTags[0]?.[0]?.match(/\bcontent\s*=\s*(['"])(.*?)\\1/i)?.[2] ?? '';
    const directives = new Set(robotsContent.toLowerCase().split(',').map(value => value.trim()));
    if (robotsTags.length !== 1 || !directives.has('noindex') || !directives.has('follow')) {
      legacyMetaFailures.push(path.relative(root, file).split(path.sep).join('/'));
    }
  }
  if (legacyMetaFailures.length > 0) {
    throw new Error('[legacy noindex] built HTML pages missing exactly one noindex,follow directive: '
      + legacyMetaFailures.slice(0, 40).join(', ')
      + (legacyMetaFailures.length > 40 ? ' … +' + (legacyMetaFailures.length - 40) + ' more' : ''));
  }
  console.log('[legacy noindex] PASS: ' + legacyHtmlFiles.length + ' HTML files contain exactly one noindex,follow meta directive');

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const legacyEntries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map(match => match[1])
    .filter(url => {
      try {
        const pathname = new URL(url).pathname;
        return pathname === '/legacy' || pathname.startsWith('/legacy/');
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
      graphPages.push({ file: relativeFile, html });
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

const sitemapText = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => match[1]);
const linkGraph = analyzeInternalLinkGraph(graphPages, sitemapUrls, origin);
const bands = linkGraph.distribution;

console.log(
  '[internal link graph] ' + linkGraph.counts.length + ' sitemap routes: '
  + bands.zero + ' orphan, ' + bands.oneToTwo + ' with 1–2 inlinks, '
  + bands.threeToSix + ' with 3–6, ' + bands.sevenPlus + ' with 7+.',
);
console.log('[internal link graph] 7+ is a diagnostic heuristic from the SEO course, not a ranking-factor guarantee.');

if (linkGraph.belowSeven.length) {
  console.log('[internal link graph] Review candidates below 7 inbound links (first 40):');
  for (const item of linkGraph.belowSeven.slice(0, 40)) {
    console.log(' - ' + item.route + ': ' + item.inlinks);
  }
}

if (linkGraph.orphans.length) {
  console.error('[internal link graph] FAIL: sitemap routes have no crawlable inbound anchor links:');
  for (const route of linkGraph.orphans.slice(0, 100)) console.error(' - ' + route);
  if (linkGraph.orphans.length > 100) console.error(' ... and ' + (linkGraph.orphans.length - 100) + ' more');
  process.exit(1);
}
