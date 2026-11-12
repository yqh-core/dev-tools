import { describe, expect, it } from 'vitest';
import { parseCurl, tokenizeCurl } from './curl';

describe('tokenizeCurl', () => {
  it('handles single/double quotes and line continuation', () => {
    expect(tokenizeCurl('curl -H \'a: b\' "x y"')).toEqual(['curl', '-H', 'a: b', 'x y']);
    expect(tokenizeCurl('curl \\\n -X POST')).toEqual(['curl', '-X', 'POST']);
    expect(tokenizeCurl('curl -d "a=\\"b\\""')).toEqual(['curl', '-d', 'a="b"']);
  });

  it('throws on unterminated quotes (negative control)', () => {
    expect(() => tokenizeCurl('curl -H \'abc')).toThrow();
  });
});

describe('parseCurl', () => {
  it('parses a simple GET', () => {
    const r = parseCurl('curl https://api.example.com/users?page=2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.method).toBe('GET');
      expect(r.request.url).toBe('https://api.example.com/users?page=2');
      expect(r.request.body).toBe('');
    }
  });

  it('parses POST with headers and data', () => {
    const r = parseCurl('curl -X POST https://api.example.com/login -H \'Content-Type: application/json\' -d \'{"u":"a","p":"b"}\'');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.method).toBe('POST');
      expect(r.request.headers).toEqual([{ name: 'Content-Type', value: 'application/json' }]);
      expect(r.request.body).toBe('{"u":"a","p":"b"}');
    }
  });

  it('infers POST from data and joins multiple -d with &', () => {
    const r = parseCurl('curl https://x.test -d a=1 -d b=2');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.method).toBe('POST');
      expect(r.request.body).toBe('a=1&b=2');
      expect(r.request.headers.some(h => h.name === 'Content-Type' && h.value === 'application/x-www-form-urlencoded')).toBe(true);
    }
  });

  it('--json sets JSON headers', () => {
    const r = parseCurl('curl https://x.test --json \'{"a":1}\'');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.headers.some(h => h.name === 'Content-Type' && h.value === 'application/json')).toBe(true);
    }
  });

  it('-u produces Basic auth header', () => {
    const r = parseCurl('curl https://x.test -u user:pass');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.headers).toEqual([{ name: 'Authorization', value: `Basic ${btoa('user:pass')}` }]);
    }
  });

  it('reports ignored flags as warnings, not silent skips', () => {
    const r = parseCurl('curl -k -L --compressed https://x.test');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.length).toBe(3);
    }
  });

  it('rejects unknown flags, @file data, missing URL, bad header (negative controls)', () => {
    expect(parseCurl('curl --frobnicate https://x.test').ok).toBe(false);
    expect(parseCurl('curl https://x.test -d @secret.txt').ok).toBe(false);
    expect(parseCurl('curl -X GET').ok).toBe(false);
    expect(parseCurl('curl https://x.test -H \'nocolon\'').ok).toBe(false);
    expect(parseCurl('wget https://x.test').ok).toBe(false);
    expect(parseCurl('curl -F file=@a.png https://x.test').ok).toBe(false);
  });

  it('supports --flag=value form and --url', () => {
    const r = parseCurl('curl --url=https://x.test --request=PUT');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.url).toBe('https://x.test');
      expect(r.request.method).toBe('PUT');
    }
  });
});
