import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('dist');
const siteSource = fs.readFileSync(path.resolve('src/seo/site.ts'), 'utf8');
const originMatch = siteSource.match(/export const SITE_ORIGIN = ['"]([^'"]+)['"]/);
if (!originMatch) throw new Error('Unable to read SITE_ORIGIN from src/seo/site.ts');
const origin = new URL(originMatch[1]).origin;
const failures = [];
let checked = 0;

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
