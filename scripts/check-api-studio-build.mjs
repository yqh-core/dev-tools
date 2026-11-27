import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist-api-studio');
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
  const filePath = resolve(output, file);
  const info = await stat(filePath).catch(() => null);
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
  assert.match(html, /<title>[^<]+<\\/title>/i, 'Missing title for ' + route);
  assert.match(html, /name="description"/i, 'Missing description for ' + route);
  assert.match(html, /property="og:title"/i, 'Missing OpenGraph title for ' + route);
  assert.match(html, /property="og:description"/i, 'Missing OpenGraph description for ' + route);
  assert.match(html, /application\\/ld\\+json/i, 'Missing structured data for ' + route);
}

const landing = await readFile(resolve(output, 'index.html'), 'utf8');
const app = await readFile(resolve(output, 'app/index.html'), 'utf8');
const docs = await readFile(resolve(output, 'docs/index.html'), 'utf8');
const robots = await readFile(resolve(output, 'robots.txt'), 'utf8');

assert.match(landing, /API Studio/);
assert.match(landing, /A clearer way to test APIs|API work/i);
assert.doesNotMatch(landing, /google-adsense-account|adsbygoogle|digdevbox\\.com\\/#website/);
assert.match(app, /noindex,nofollow/i);
assert.doesNotMatch(app, /rel="canonical"/i);
assert.match(docs, /Send your first request/);
assert.match(robots, /Disallow: \\/app\\//);

const siteUrl = process.env.API_STUDIO_SITE_URL?.trim();
const sitemapPath = resolve(output, 'sitemap.xml');
const sitemap = await stat(sitemapPath).catch(() => null);
if (siteUrl) {
  assert.ok(sitemap?.isFile(), 'A configured product origin must emit sitemap.xml');
  for (const [route, file] of routes.filter(([route]) => route !== '/app/')) {
    const html = await readFile(resolve(output, file), 'utf8');
    assert.match(html, new RegExp('<link\\\\s+rel="canonical"\\\\s+href="' + siteUrl.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
  }
  assert.doesNotMatch(await readFile(sitemapPath, 'utf8'), /<loc>[^<]*\\/app\\//);
}
else {
  assert.ok(!sitemap, 'Do not emit a sitemap with an unselected placeholder domain');
  assert.doesNotMatch(landing, /rel="canonical"/i);
}

console.log('API Studio output contract: ' + (required.length + routes.length * 4 + 8) + ' checks passed.');
