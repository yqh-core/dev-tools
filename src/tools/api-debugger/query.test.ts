import { describe, expect, it } from 'vitest';
import { authHeaderPreset, buildUrlWithQuery, parseQueryParams } from './query';

describe('parseQueryParams', () => {
  it('extracts ordered rows and decodes', () => {
    expect(parseQueryParams('https://api.x.test/v1?b=2&a=hello%20world')).toEqual([
      { name: 'b', value: '2' },
      { name: 'a', value: 'hello world' },
    ]);
  });
  it('keeps duplicate keys (HTTP allows multi-value)', () => {
    expect(parseQueryParams('https://x.test/?tag=a&tag=b')).toEqual([
      { name: 'tag', value: 'a' },
      { name: 'tag', value: 'b' },
    ]);
  });
  it('treats + as space (URLSearchParams semantics)', () => {
    expect(parseQueryParams('https://x.test/?q=a+b')).toEqual([{ name: 'q', value: 'a b' }]);
  });
  it('no query / empty / relative / hash-only → [] (paired negative)', () => {
    expect(parseQueryParams('https://x.test/path')).toEqual([]);
    expect(parseQueryParams('https://x.test/?')).toEqual([]);
    expect(parseQueryParams('/relative/path')).toEqual([]);
    expect(parseQueryParams('https://x.test/#frag?not=query')).toEqual([]);
  });
  it('ignores ? inside fragment', () => {
    expect(parseQueryParams('https://x.test/p?a=1#frag?x=2')).toEqual([{ name: 'a', value: '1' }]);
  });
  it('tolerates {{var}} placeholders without throwing', () => {
    expect(parseQueryParams('https://x.test/?id={{userId}}')).toEqual([{ name: 'id', value: '{{userId}}' }]);
  });
});

describe('buildUrlWithQuery', () => {
  it('replaces query, preserves path and hash', () => {
    expect(buildUrlWithQuery('https://x.test/p?old=1#frag', [{ name: 'new', value: '2' }])).toBe('https://x.test/p?new=2#frag');
  });
  it('encodes names and values', () => {
    expect(buildUrlWithQuery('https://x.test/', [{ name: 'a b', value: 'c&d' }])).toBe('https://x.test/?a+b=c%26d');
  });
  it('skips empty-name rows (negative control)', () => {
    expect(buildUrlWithQuery('https://x.test/', [{ name: '', value: 'ghost' }, { name: 'ok', value: '1' }])).toBe('https://x.test/?ok=1');
  });
  it('removes ? when no rows', () => {
    expect(buildUrlWithQuery('https://x.test/p?a=1', [])).toBe('https://x.test/p');
  });
  it('hash-only URL does not duplicate hash (regression)', () => {
    expect(buildUrlWithQuery('https://x.test/p#frag', [{ name: 'a', value: '1' }])).toBe('https://x.test/p?a=1#frag');
    expect(buildUrlWithQuery('https://x.test/p#frag', [])).toBe('https://x.test/p#frag');
  });
  it('preserves {{var}} placeholders literally (regression: substitution must still match)', () => {
    expect(buildUrlWithQuery('https://x.test/', [{ name: 'id', value: '{{userId}}' }])).toBe('https://x.test/?id={{userId}}');
  });
});

describe('round-trip conservation (paired)', () => {
  it('parse(build(url, parse(url))) preserves rows', () => {
    const url = 'https://x.test/p?b=2&a=hello%20world&tag=a&tag=b#frag';
    const rows = parseQueryParams(url);
    expect(parseQueryParams(buildUrlWithQuery(url, rows))).toEqual(rows);
  });
  it('empty rows round-trip to empty', () => {
    const url = 'https://x.test/p';
    expect(parseQueryParams(buildUrlWithQuery(url, parseQueryParams(url)))).toEqual([]);
  });
});

describe('authHeaderPreset (API-Key helper)', () => {
  it('bearer', () => {
    expect(authHeaderPreset('bearer', 'tok123')).toEqual({ name: 'Authorization', value: 'Bearer tok123' });
  });
  it('basic encodes user:pass', () => {
    expect(authHeaderPreset('basic', 'pass', 'user')).toEqual({ name: 'Authorization', value: `Basic ${btoa('user:pass')}` });
  });
  it('api-key → X-API-Key header', () => {
    expect(authHeaderPreset('api-key', 'k-9')).toEqual({ name: 'X-API-Key', value: 'k-9' });
  });
  it('empty / whitespace token → null (negative control: no empty auth)', () => {
    expect(authHeaderPreset('bearer', '')).toBeNull();
    expect(authHeaderPreset('api-key', '   ')).toBeNull();
  });
  it('trims token', () => {
    expect(authHeaderPreset('bearer', '  t  ')?.value).toBe('Bearer t');
  });
});
