import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.env.API_STUDIO_PRODUCT_OUTPUT || 'dist-api-studio');
const isPreview = process.env.API_STUDIO_PREVIEW === '1';
const required = [
  'index.html',
  'app/index.html',
  'docs/index.html',
  'docs/first-request/index.html',
  'docs/collections/index.html',
  'docs/scripts-and-assertions/index.html',
  'docs/privacy/index.html',
  'api-studio-mark.svg',
  'robots.txt',
];

for (const file of required) {
  const info = await stat(resolve(output, file)).catch(() => null);
  assert.ok(info?.isFile(), 'Missing API Studio product output: ' + file);
}

const routes = [
  ['/', 'index.html'],
  ['/app/', 'app/index.html'],
  ['/docs/', 'docs/index.html'],
  ['/docs/first-request/', 'docs/first-request/index.html'],
  ['/docs/collections/', 'docs/collections/index.html'],
  ['/docs/scripts-and-assertions/', 'docs/scripts-and-assertions/index.html'],
  ['/docs/privacy/', 'docs/privacy/index.html'],
];

for (const [route, file] of routes) {
  const html = await readFile(resolve(output, file), 'utf8');
  assert.ok(html.includes('<title>') && html.includes('</title>'), 'Missing title for ' + route);
  assert.ok(html.includes('name="description"'), 'Missing description for ' + route);
  assert.ok(html.includes('property="og:title"'), 'Missing OpenGraph title for ' + route);
  assert.ok(html.includes('property="og:description"'), 'Missing OpenGraph description for ' + route);
  assert.ok(html.includes('type="application/ld+json"'), 'Missing structured data for ' + route);
}

const landing = await readFile(resolve(output, 'index.html'), 'utf8');
const app = await readFile(resolve(output, 'app/index.html'), 'utf8');
const docs = await readFile(resolve(output, 'docs/index.html'), 'utf8');
const robots = await readFile(resolve(output, 'robots.txt'), 'utf8');
const siteUrl = process.env.API_STUDIO_SITE_URL?.trim();
const sitemapPath = resolve(output, 'sitemap.xml');
const sitemapInfo = await stat(sitemapPath).catch(() => null);

assert.ok(landing.includes('API Studio'));
assert.ok(landing.includes('A clearer way to test APIs') || landing.includes('API work'));
assert.ok(!landing.includes('google-adsense-account') && !landing.includes('adsbygoogle'));
assert.ok(app.includes('noindex,nofollow'));
assert.ok(!app.includes('rel="canonical"'));
assert.ok(docs.includes('Send your first request'));

if (isPreview) {
  assert.ok(!siteUrl, 'A PR Preview must not receive a production canonical origin.');
  for (const [route, file] of routes) {
    const html = await readFile(resolve(output, file), 'utf8');
    assert.ok(html.includes('name="robots" content="noindex,nofollow"'), 'Preview route must be noindex: ' + route);
    assert.ok(!html.includes('rel="canonical"'), 'Preview routes must not emit canonicals: ' + route);
  }
  assert.ok(robots.includes('Disallow: /'), 'Preview robots.txt must block indexing.');
  assert.ok(!sitemapInfo, 'A PR Preview must not publish a sitemap.');
}
else if (siteUrl) {
  assert.ok(sitemapInfo?.isFile(), 'A configured product origin must emit sitemap.xml');
  const origin = new URL(siteUrl).origin;
  for (const [route, file] of routes.filter(([route]) => route !== '/app/')) {
    const html = await readFile(resolve(output, file), 'utf8');
    const canonical = new URL(route, origin + '/').href;
    assert.ok(html.includes('rel="canonical" href="' + canonical + '"'), 'Incorrect canonical for ' + route);
  }
  const sitemap = await readFile(sitemapPath, 'utf8');
  assert.ok(!sitemap.includes('/app/'), 'The noindex workspace must not enter sitemap.xml');
  assert.ok(robots.includes('Disallow: /app/'));
}
else {
  assert.ok(!sitemapInfo, 'Do not emit a sitemap with an unselected placeholder domain');
  assert.ok(!landing.includes('rel="canonical"'));
  assert.ok(robots.includes('Disallow: /app/'));
}

console.log('API Studio output contract: ' + (required.length + routes.length * 5 + 8) + ' checks passed.');
