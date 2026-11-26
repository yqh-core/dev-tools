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

const HTTP_500_RECHECK_USER_AGENTS = [
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
];

/**
 * SiteOne occasionally records an isolated 500 while the same production
 * document is available to both Googlebot and a normal browser. Never waive
 * a 500 on that evidence alone: require two independent no-cache GETs, both
 * HTTP-successful and both resolving to the exact original canonical URL.
 * Persistent failures, redirects, timeouts and transport errors still fail.
 */
async function recheckSiteOne500(row, fetchImpl = fetch) {
  let expectedUrl;
  try {
    expectedUrl = new URL(row.url).href;
  } catch {
    return { ok: false, reason: 'invalid finding URL', probes: [] };
  }

  const probes = [];
  for (const userAgent of HTTP_500_RECHECK_USER_AGENTS) {
    try {
      const response = await fetchImpl(expectedUrl, {
        redirect: 'follow',
        headers: {
          'user-agent': userAgent,
          'cache-control': 'no-cache',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });
      probes.push({
        userAgent: userAgent.startsWith('Googlebot/') ? 'Googlebot' : 'browser',
        status: response.status,
        finalUrl: response.url,
        ok: response.ok && response.url === expectedUrl,
      });
    } catch (error) {
      probes.push({
        userAgent: userAgent.startsWith('Googlebot/') ? 'Googlebot' : 'browser',
        status: null,
        finalUrl: '',
        ok: false,
        error: error.message,
      });
    }
  }

  return {
    ok: probes.length === HTTP_500_RECHECK_USER_AGENTS.length && probes.every(probe => probe.ok),
    reason: probes.every(probe => probe.ok)
      ? 'Googlebot and browser both returned HTTP success at the exact canonical URL'
      : 'at least one independent probe did not return HTTP success at the exact canonical URL',
    probes,
  };
}

async function readReport(site) {
  const file = join(ROOT, 'seo-crawl-' + site.slug, site.slug + '.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
}

function isHttpError(row) {
  const match = String(row?.status ?? '').match(/^(\d{3})(?:\b|:)/);
  return Boolean(match && Number(match[1]) >= 400);
}

function httpStatusCode(row) {
  const code = Number.parseInt(String(row?.status ?? '').slice(0, 3), 10);
  return Number.isInteger(code) && code >= 100 && code <= 599 ? code : 0;
}

function isCrawlerTransportError(row) {
  const status = String(row?.status ?? '');
  return /^-\d+:/.test(status) && !/^-\d+:SKIPPED$/.test(status);
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

  const redirectTable = report.tables?.redirects;
  if (!redirectTable || !Array.isArray(redirectTable.rows)) {
    (site.priority ? errors : warnings).push('crawler report is missing its redirects evidence table');
  }
  const redirectRows = redirectTable?.rows || [];
  if (redirectRows.length > 0) {
    warnings.push(redirectRows.length + ' redirect hop(s) found; update internal links to point directly to final URLs');
  }

  const notFoundTable = report.tables?.['404'];
  if (!notFoundTable || !Array.isArray(notFoundTable.rows)) {
    errors.push('crawler report is missing its 404 evidence table');
  }

  const notFoundRows = notFoundTable?.rows || [];
  const skippedRows = report.tables?.skipped?.rows || [];
  const accepted = [];
  const accepted500s = [];
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

  // The 404 table is not a complete HTTP-health signal: 403/429/5xx responses
  // can appear in results without being represented there. Inspect every result
  // and fail on all HTTP error statuses, while excluding only independently
  // verified ImageForge Browserify worker-parser false positives.
  const acceptedUrls = new Set(accepted.map(row => row.url));
  const httpErrors = (report.results || []).filter(row =>
    isHttpError(row) && !acceptedUrls.has(row.url),
  );
  if (httpErrors.length > 0) {
    for (const row of httpErrors) {
      const message = 'HTTP ' + row.status + ': ' + row.url;
      const statusCode = httpStatusCode(row);

      if (site.priority && statusCode === 500) {
        const recheck = await recheckSiteOne500(row);
        if (recheck.ok) {
          accepted500s.push(row);
          warnings.push(
            'SiteOne reported HTTP 500 for ' + row.url
            + ', but independent Googlebot and browser GETs both returned HTTP success at the exact canonical URL; '
            + 'treated as an isolated crawler response and retained for monitoring',
          );
          continue;
        }
        errors.push(
          message + '; independent Googlebot/browser recheck failed: '
          + JSON.stringify(recheck.probes),
        );
        continue;
      }

      (site.priority ? errors : warnings).push(message);
    }
  }

  // SiteOne negative statuses such as -4:SEND-ERROR are crawler transport
  // failures, not HTTP responses. Surface them separately instead of allowing
  // a zero-404 report to imply that every discovered URL was fetched.
  const transportErrors = (report.results || []).filter(isCrawlerTransportError);
  for (const row of transportErrors) {
    warnings.push('Crawler transport failure (' + row.status + '): ' + row.url);
  }

  return {
    site,
    pages: report.stats?.totalUrls ?? 'unknown',
    status200: report.stats?.countByStatus?.['200'] ?? 0,
    notFound: notFoundRows.length,
    redirects: redirectRows.length,
    transportErrors: transportErrors.length,
    skippedOutOfScope: skippedRows.length,
    accepted: accepted.length + accepted500s.length,
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
    if (!isHttpError({ status: '404' }) || !isHttpError({ status: '500' }) || !isHttpError({ status: '429' })) {
      throw new Error('self-test failed: expected 4xx/5xx HTTP responses to fail');
    }
    if (httpStatusCode({ status: '500' }) !== 500
        || httpStatusCode({ status: '429' }) !== 429
        || httpStatusCode({ status: '-4:SEND-ERROR' }) !== 0) {
      throw new Error('self-test failed: HTTP status code parsing is incorrect');
    }
    if (isHttpError({ status: '200' }) || isHttpError({ status: '301' }) || isHttpError({ status: '-6:SKIPPED' })) {
      throw new Error('self-test failed: accepted status was treated as an HTTP error');
    }
    if (!isCrawlerTransportError({ status: '-4:SEND-ERROR' })) {
      throw new Error('self-test failed: crawler SEND-ERROR was not surfaced');
    }
    if (isCrawlerTransportError({ status: '-6:SKIPPED' }) || isCrawlerTransportError({ status: '200' })) {
      throw new Error('self-test failed: skipped or successful result was treated as a transport error');
    }
    if (!imageForgeWorkerCandidate(good)) throw new Error('self-test failed: expected Browserify candidate');
    if (imageForgeWorkerCandidate(wrongTarget)) throw new Error('self-test failed: accepted wrong target');
    if (imageForgeWorkerCandidate(wrongSource)) throw new Error('self-test failed: accepted wrong source');
    const recovered500 = await recheckSiteOne500(
      { url: 'https://www.digdevbox.com/uuid-generator/' },
      async url => ({ ok: true, status: 200, url }),
    );
    if (!recovered500.ok || recovered500.probes.length !== 2) {
      throw new Error('self-test failed: two successful canonical rechecks should classify a SiteOne 500 as transient');
    }
    const persistent500 = await recheckSiteOne500(
      { url: 'https://www.digdevbox.com/uuid-generator/' },
      async url => ({ ok: false, status: 500, url }),
    );
    if (persistent500.ok) {
      throw new Error('self-test failed: a persistent 500 must remain a blocking finding');
    }
    const redirected200 = await recheckSiteOne500(
      { url: 'https://www.digdevbox.com/uuid-generator/' },
      async url => ({ ok: true, status: 200, url: 'https://www.digdevbox.com/other-page/' }),
    );
    if (redirected200.ok) {
      throw new Error('self-test failed: a redirected URL must not clear the original route 500');
    }
    console.log('PASS: SEO crawl gate self-tests (including strict dual-UA HTTP 500 recheck)');
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
        redirects: 'unknown',
        transportErrors: 'unknown',
        accepted: 0,
        errors: [error.message],
        warnings: [],
      });
    }
  }

  console.log('Production SEO crawl quality gate');
  console.log('Growth-priority sites: zero untriaged 404s, robots.txt verified, title/description/canonical present; redirect hops and crawler transport failures are surfaced separately.');
  console.log('Technical-health-only sites are monitored and reported without blocking US/EU growth releases.');
  for (const result of results) {
    const label = result.site.priority ? 'GROWTH' : 'TECH-ONLY';
    console.log(
      '[' + label + '] ' + result.site.label
      + ' | crawled=' + result.pages
      + ' | HTTP 200=' + result.status200
      + ' | 404=' + result.notFound
      + ' | redirect hops=' + result.redirects
      + ' | crawler transport errors=' + result.transportErrors
      + ' | accepted false positives=' + result.accepted
      + ' | out-of-scope links skipped=' + result.skippedOutOfScope,
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
