import { describe, expect, it } from 'vitest';
import { analyzeResponseHeaders, parseResponseHeaders } from './http-headers-analyzer.models';

describe('parseResponseHeaders', () => {
  it('parses a curl -I response block with case-insensitive names and duplicate headers', () => {
    const result = parseResponseHeaders([
      'HTTP/2 200',
      'content-type: text/html; charset=utf-8',
      'Set-Cookie: a=1; Secure; HttpOnly',
      'set-cookie: b=2; Secure; SameSite=Lax',
      '',
    ].join('\n'));

    expect(result.statusLine).toBe('HTTP/2 200');
    expect(result.headers['set-cookie']).toHaveLength(2);
    expect(result.headerCount).toBe(3);
  });

  it('reports malformed input lines and refuses inputs above 64 KB', () => {
    const malformed = parseResponseHeaders('HTTP/1.1 200 OK\nnot a header');
    expect(malformed.malformedLines).toBe(1);
    expect(parseResponseHeaders('a'.repeat(65537)).error).toContain('64 KB');
  });
});

describe('analyzeResponseHeaders', () => {
  it('recognizes a baseline response with HSTS, CSP, frame protection, nosniff, referrer and permissions policy', () => {
    const result = analyzeResponseHeaders([
      'HTTP/2 200',
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
      "Content-Security-Policy: default-src 'self'; script-src 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options: nosniff',
      'X-Frame-Options: DENY',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy: camera=(), microphone=(), geolocation=()',
    ].join('\n'));

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.baselinePresent).toBe(6);
    expect(result.baselineTotal).toBe(6);
  });

  it('flags weak values and keeps absent headers separate from present headers', () => {
    const result = analyzeResponseHeaders([
      'HTTP/1.1 200 OK',
      'Strict-Transport-Security: max-age=60',
      "Content-Security-Policy: default-src *; script-src 'unsafe-inline'",
      'X-Content-Type-Options: nosniffplease',
      'Referrer-Policy: unsafe-url',
      'Permissions-Policy: camera=*',
    ].join('\n'));

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.baselineChecks.filter(check => check.status === 'review')).toHaveLength(6);
    expect(result.baselineChecks.filter(check => check.status === 'missing')).toHaveLength(1);
  });

  it('flags credentialed wildcard CORS and insecure SameSite=None cookies', () => {
    const result = analyzeResponseHeaders([
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Credentials: true',
      'Set-Cookie: session=abc; SameSite=None; HttpOnly',
      'X-XSS-Protection: 1; mode=block',
      'Server: nginx',
    ].join('\n'));

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.additionalFindings.map(item => item.id)).toContain('cors-wildcard-credentials');
    expect(result.additionalFindings.map(item => item.id)).toContain('cookie-samesite-none-without-secure');
    expect(result.additionalFindings.map(item => item.id)).toContain('legacy-xss-protection');
    expect(result.additionalFindings.map(item => item.id)).toContain('server-fingerprint');
  });

  it('supports an empty response status line while reporting missing baselines', () => {
    const result = analyzeResponseHeaders('HTTP/2 204');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.baselineChecks).toHaveLength(6);
    expect(result.baselinePresent).toBe(0);
  });
});
