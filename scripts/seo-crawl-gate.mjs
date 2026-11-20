/**
 * Production SEO crawl gate.
 *
 * The SiteOne crawler is evidence collection, not a pass/fail gate by itself.
 * This script turns critical crawler findings into explicit release failures.
 *
 * Growth-priority sites: main, DigImg, IP Locator, StreamPlay, TTSReader,
 * ImageForge and Forge Notes.
 * Fangdai and Geek Typing remain technical-health-only under the current
 * US/EU strategy: their findings are reported but do not block growth releases.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.argv[2] || 'reports';

const SITES = [
  { slug: 'main', label: 'Main site', priority: true },
  { slug: 'digimg', label: 'DigImg', priority: true },
  { slug: 'ip-locator', label: 'IP Locator', priority: true },
  { slug: 'streamplay', label: 'StreamPlay', priority: true },
  { slug: 'tts-reader', label: 'TTS Reader', priority: true },
  { slug: 'imageforge', label: 'ImageForge', priority: true },
  { slug: 'forge-notes', label: 'Forge Notes', priority: true },
  { slug: 'fangdai', label: 'Fangdai (technical health only)', priority: false },
  { slug: 'geek-typing', label: 'Geek Typing (technical health only)', priority: false },
];

const REQUIRED_SEO_CHECKS = [
  'seo-title-missing',
  'seo-meta-description-missing',
  'seo-canonical-missing',
];

function imageForgeWorkerCandidate(row) {
  try {
    const target = new URL(row.url);
    const source = new URL(row.sourceUqId);
    return target.hostname === 'draw.digdevbox.com'
      && target.pathname === '/index.js'
      && source.hostname === 'draw.digdevbox.com'
      && source.pathname === '/dist/bundle.js';
  } catch {
    return false;
  }
}

/**
 * SiteOne's JS parser mistakes a Browserify/webworkify module identifier for
 * a network URL. Verify the current deployed bundle before accepting it:
 * the module is embedded under "/index.js" and webworkify creates a Blob URL
 * and starts new Worker(blobUrl); it does not fetch /index.js over HTTP.
 */
async function verifyImageForgeWorkerFalsePositive(row) {
  if (!imageForgeWorkerCandidate(row)) return false;

  const response = await fetch(row.sourceUqId, {
    headers: { 'cache-control': 'no-cache' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error('Could not verify ImageForge bundle false positive: HTTP ' + response.status);
  }

  const bundle = await response.text();
  return bundle.includes('"/index.js":[function')
    && bundle.includes('new Worker(_)')
    && bundle.includes('createObjectURL(y)');
}

async function readReport(site) {
  const file = join(ROOT, 'seo-crawl-' + site.slug, site.slug + '.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

async function evaluateSite(site) {
  const report = await readReport(site);
  const summary = report.summary?.items || [];
  const errors = [];
  const warnings = [];
  const robots = summary.find(item => String(item.aplCode || '').startsWith('robots-txt-'));

  if (!robots || !['NOTICE', 'OK'].includes(robots.status)) {
    const message = 'robots.txt was not positively verified by the crawler';
    (site.priority ? errors : warnings).push(message);
  }

  for (const code of REQUIRED_SEO_CHECKS) {
    const item = summary.find(entry => entry.aplCode === code);
    if (!item || item.status !== 'OK') {
      (site.priority ? errors : warnings).push(item?.text || code + ' result missing');
    }
  }

  const notFoundTable = report.tables?.['404'];
  if (!notFoundTable || !Array.isArray(notFoundTable.rows)) {
    errors.push('crawler report is missing its 404 evidence table');
  }

  const notFoundRows = notFoundTable?.rows || [];
  const accepted = [];
  const untriaged = [];

  for (const row of notFoundRows) {
    if (site.slug === 'imageforge' && await verifyImageForgeWorkerFalsePositive(row)) {
      accepted.push(row);
    } else {
      untriaged.push(row);
    }
  }

  if (site.priority && untriaged.length > 0) {
    for (const row of untriaged) {
      errors.push('HTTP 404: ' + row.url + ' (discovered from ' + row.sourceUqId + ')');
    }
  } else if (!site.priority && untriaged.length > 0) {
    warnings.push(untriaged.length + ' HTTP 404 finding(s); technical-health-only site, not a US/EU growth release blocker');
  }

  if (accepted.length > 0) {
    warnings.push(accepted.length + ' verified SiteOne JS-parser false positive(s): Browserify/webworkify module ID, not a network request');
  }

  return {
    site,
    pages: report.stats?.totalUrls ?? 'unknown',
    status200: report.stats?.countByStatus?.['200'] ?? 0,
    notFound: notFoundRows.length,
    accepted: accepted.length,
    errors,
    warnings,
  };
}

async function main() {
  if (process.argv.includes('--self-test')) {
    const good = {
      url: 'https://draw.digdevbox.com/index.js',
      sourceUqId: 'https://draw.digdevbox.com/dist/bundle.js?v=example',
    };
    const wrongTarget = { ...good, url: 'https://draw.digdevbox.com/missing.js' };
    const wrongSource = { ...good, sourceUqId: 'https://draw.digdevbox.com/app.js' };
    if (!imageForgeWorkerCandidate(good)) throw new Error('self-test failed: expected Browserify candidate');
    if (imageForgeWorkerCandidate(wrongTarget)) throw new Error('self-test failed: accepted wrong target');
    if (imageForgeWorkerCandidate(wrongSource)) throw new Error('self-test failed: accepted wrong source');
    console.log('PASS: SEO crawl gate self-tests');
    return;
  }

  const results = [];
  for (const site of SITES) {
    try {
      results.push(await evaluateSite(site));
    } catch (error) {
      results.push({
        site,
        pages: 'unknown',
        status200: 0,
        notFound: 'unknown',
        accepted: 0,
        errors: [error.message],
        warnings: [],
      });
    }
  }

  console.log('Production SEO crawl quality gate');
  console.log('Growth-priority sites: zero untriaged 404s, robots.txt verified, title/description/canonical present.');
  console.log('Technical-health-only sites are monitored and reported without blocking US/EU growth releases.');
  for (const result of results) {
    const label = result.site.priority ? 'GROWTH' : 'TECH-ONLY';
    console.log(
      '[' + label + '] ' + result.site.label
      + ' | crawled=' + result.pages
      + ' | HTTP 200=' + result.status200
      + ' | 404=' + result.notFound
      + ' | accepted false positives=' + result.accepted,
    );
    for (const warning of result.warnings) console.log('  WARNING: ' + warning);
    for (const error of result.errors) console.error('  FAIL: ' + error);
  }

  const failures = results.flatMap(result => result.errors.map(error => result.site.label + ': ' + error));
  if (failures.length > 0) {
    console.error('FAIL: ' + failures.length + ' production SEO crawl gate finding(s)');
    process.exitCode = 1;
    return;
  }

  console.log('PASS: all growth-priority sites passed the production SEO crawl gate.');
}

main().catch(error => {
  console.error('SEO crawl gate crashed:', error);
  process.exitCode = 1;
});
