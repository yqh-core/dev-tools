import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const fixture = JSON.parse(await readFile(resolve(root, 'scripts/fixtures/gsc-redirect-urls-2026-11-21.json'), 'utf8'));
const redirectsText = await readFile(resolve(root, 'public/_redirects'), 'utf8');
const explicitLegacyTargets = new Map();

for (const rawLine of redirectsText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const [source, target, status] = line.split(/\s+/);
  if (status === '301' && source?.startsWith('/legacy/') && !source.includes('*') && target) {
    explicitLegacyTargets.set(source, target);
  }
}

const notesMigrationSources = new Set([
  '/posts/google-seo-keyword-research-tools',
  '/posts/frontend-performance-optimization',
  '/posts/google-seo-link-building',
  '/posts/google-seo-ranking-factors',
  '/posts/vitepress-guide',
]);

function classify(source) {
  const url = new URL(source);
  if (url.hostname === 'notes.digdevbox.com' && notesMigrationSources.has(url.pathname)) return 'explicit';
  if (url.hostname === 'www.digdevbox.com' && explicitLegacyTargets.has(url.pathname)) return 'explicit';
  return 'normalization';
}

function expectedExplicitUrl(source) {
  const url = new URL(source);
  if (url.hostname === 'notes.digdevbox.com' && notesMigrationSources.has(url.pathname)) {
    return 'https://notes.digdevbox.com/zh' + url.pathname + url.search;
  }
  if (url.hostname === 'www.digdevbox.com' && explicitLegacyTargets.has(url.pathname)) {
    return new URL(explicitLegacyTargets.get(url.pathname), 'https://www.digdevbox.com').href;
  }
  return null;
}

function expectedNormalizedUrl(source) {
  const url = new URL(source);
  if (!['digdevbox.com', 'www.digdevbox.com'].includes(url.hostname)) return null;
  url.protocol = 'https:';
  url.hostname = 'www.digdevbox.com';
  if (url.pathname !== '/' && !url.pathname.endsWith('/')) url.pathname += '/';
  url.hash = '';
  return url.href;
}

function readCanonical(html, baseUrl) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  for (const tag of links) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase().split(/\s+/) || [];
    if (!rel.includes('canonical')) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) {
      try { return new URL(href, baseUrl).href; } catch { return href; }
    }
  }
  return null;
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const timeoutMs = 15000;
const maxHops = 10;
const results = [];

for (const source of fixture.urls) {
  const category = classify(source);
  const expectedDestination = category === 'normalization' ? expectedNormalizedUrl(source) : expectedExplicitUrl(source);
  const seen = new Set();
  const hops = [];
  let current = source;
  let finalStatus = null;
  let canonical = null;
  let error = null;
  let loop = false;

  try {
    for (let index = 0; index <= maxHops; index++) {
      if (seen.has(current)) {
        loop = true;
        error = 'redirect_loop';
        break;
      }
      seen.add(current);

      const response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'DigDevBox-ReadOnly-Redirect-Audit/1.0 (+https://www.digdevbox.com/)',
          'accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        },
      });

      const location = response.headers.get('location');
      hops.push({ url: current, status: response.status, location });
      if (redirectStatuses.has(response.status) && location) {
        await response.body?.cancel();
        current = new URL(location, current).href;
        continue;
      }

      finalStatus = response.status;
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
        const html = await response.text();
        canonical = readCanonical(html, current);
      } else {
        await response.body?.cancel();
      }
      break;
    }
  } catch (err) {
    error = (err?.name || 'Error') + ': ' + (err?.message || String(err));
  }

  const finalUrl = current;
  const redirectCount = hops.filter((hop) => redirectStatuses.has(hop.status) && hop.location).length;
  const canonicalExpected = expectedDestination || finalUrl;
  const checks = {
    hasRedirect: redirectCount > 0,
    noLoop: !loop,
    finalHttp200: finalStatus === 200,
    canonicalPresent: Boolean(canonical),
    canonicalMatchesExpected: Boolean(canonical && canonical === canonicalExpected),
    destinationMatchesExpected: Boolean(expectedDestination && finalUrl === expectedDestination),
  };
  const passed = !error && Object.values(checks).every(Boolean);

  results.push({
    source,
    category,
    redirectCount,
    hops,
    finalUrl,
    finalStatus,
    canonical,
    expectedDestination,
    checks,
    passed,
    error,
  });

  console.log((passed ? 'PASS ' : 'FAIL ') + category + ' ' + source + ' -> ' + (finalStatus ?? 'NO_STATUS') + ' (' + redirectCount + ' redirects)');
}

const counts = {
  total: results.length,
  explicit: results.filter((item) => item.category === 'explicit').length,
  normalization: results.filter((item) => item.category === 'normalization').length,
  passed: results.filter((item) => item.passed).length,
  failed: results.filter((item) => !item.passed).length,
};
const summary = {
  snapshot: fixture.snapshot,
  generatedAt: new Date().toISOString(),
  counts,
  results,
};

await writeFile(resolve(root, 'gsc-redirect-audit-results.json'), JSON.stringify(summary, null, 2) + '\n');
const lines = [
  '# GSC redirect-chain audit',
  '',
  'Snapshot: ' + fixture.snapshot,
  'Generated: ' + summary.generatedAt,
  '',
  '- Total: ' + counts.total,
  '- Explicit migration redirects: ' + counts.explicit,
  '- Host/slash normalization candidates: ' + counts.normalization,
  '- PASS: ' + counts.passed,
  '- FAIL: ' + counts.failed,
  '',
  '| Source | Class | Redirects | Final status | Final URL | Canonical | Result |',
  '|---|---|---:|---:|---|---|---|',
  ...results.map((item) => '| ' + item.source + ' | ' + item.category + ' | ' + item.redirectCount + ' | ' + (item.finalStatus ?? '—') + ' | ' + item.finalUrl + ' | ' + (item.canonical || 'MISSING') + ' | ' + (item.passed ? 'PASS' : 'FAIL') + ' |'),
  '',
  'Each redirect hop, raw status, Location header, final status and canonical URL is preserved in the JSON artifact.',
  'A failure means the chain could not be fully verified or the final canonical/destination did not match the source-class expectation; it does not by itself authorize a production redirect change.',
];
await writeFile(resolve(root, 'gsc-redirect-audit-summary.md'), lines.join('\n') + '\n');

console.log('\nSUMMARY', JSON.stringify(counts));
if (counts.failed > 0) process.exitCode = 1;
