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
];

for (const file of required) {
  const filePath = resolve(output, file);
  const info = await stat(filePath).catch(() => null);
  assert.ok(info?.isFile(), `Missing API Studio product output: ${file}`);
}

const landing = await readFile(resolve(output, 'index.html'), 'utf8');
const app = await readFile(resolve(output, 'app/index.html'), 'utf8');
const docs = await readFile(resolve(output, 'docs/index.html'), 'utf8');

assert.match(landing, /API Studio/);
assert.match(landing, /A clearer way to test APIs|API work/i);
assert.doesNotMatch(landing, /google-adsense-account|adsbygoogle|digdevbox\.com\/#website/);
assert.match(app, /noindex,nofollow/i);
assert.match(docs, /Send your first request/);

console.log(`API Studio output contract: ${required.length + 4} checks passed.`);
