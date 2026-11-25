/**
 * Apply archive-wide noindex,follow to every retained legacy HTML page.
 *
 * Current strategy: the archive remains available to existing visitors and
 * its links remain crawlable, but the Chinese-only historical pages are outside
 * the English-first US/EU search index. Response-header rules in _headers are
 * retained as defense in depth; the HTML directive makes the policy explicit
 * to crawlers even when an intermediary/function response omits that header.
 *
 * This is a deterministic, idempotent build preparation step. It traverses
 * every HTML file under public/legacy (including the archive index), normalizes
 * any existing robots meta tag to exactly "noindex, follow", and fails closed
 * when a file has no usable <head>.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacyDir = join(root, 'public', 'legacy');
const ROBOTS_META_RE = /<meta\b[^>]*\bname\s*=\s*(['"])robots\1[^>]*>/gi;
const MARK = '<meta name="robots" content="noindex, follow">';

function applyNoindexMeta(html, fileLabel = 'legacy HTML') {
  if (!/<head\b[^>]*>/i.test(html) || !/<\/head\s*>/i.test(html)) {
    throw new Error(`[legacy noindex] ${fileLabel}: missing a complete <head> element`);
  }
  const withoutRobotsMeta = html.replace(ROBOTS_META_RE, '');
  return withoutRobotsMeta.replace(/[ \t\r\n]*<\/head\s*>/i, `\n  ${MARK}\n</head>`);
}

// Small independent fixtures protect replacement, normalization and idempotency.
const fixtures = [
  '<!doctype html><html><head><meta charset="utf-8"><title>One</title></head></html>',
  '<html><head><title>Two</title><meta name="robots" content="index,follow"></head></html>',
  "<html><head><meta name='robots' content='noindex'><title>Three</title></head></html>",
];
for (const [index, fixture] of fixtures.entries()) {
  const once = applyNoindexMeta(fixture, `fixture-${index + 1}`);
  const twice = applyNoindexMeta(once, `fixture-${index + 1}`);
  const tags = [...once.matchAll(/<meta\b[^>]*\bname\s*=\s*(['"])robots\1[^>]*>/gi)];
  assert.equal(tags.length, 1, `fixture-${index + 1} must contain exactly one robots meta tag`);
  assert.match(tags[0][0], /content=["']noindex,\s*follow["']/i);
  assert.equal(twice, once, `fixture-${index + 1} must be idempotent`);
}

async function collectHtml(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectHtml(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) found.push(fullPath);
  }
  return found.sort();
}

const files = await collectHtml(legacyDir);
if (files.length === 0) throw new Error('[legacy noindex] no legacy HTML files found; refusing an empty pass');

let patched = 0;
let alreadyCorrect = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const next = applyNoindexMeta(html, relative(root, file));
  if (next === html) alreadyCorrect++;
  else {
    await writeFile(file, next, 'utf8');
    patched++;
  }
}

console.log(`[legacy noindex] PASS: ${files.length} HTML files covered; ${patched} updated, ${alreadyCorrect} already correct`);
console.log('[legacy noindex] All pages remain available; meta robots is noindex, follow; sitemap exclusion and X-Robots-Tag remain separately checked.');
