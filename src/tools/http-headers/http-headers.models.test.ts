import { describe, expect, it } from 'vitest';
import { analyzeResponseHeaders, parseResponseHeaders } from './http-headers.models';

describe('parseResponseHeaders', () => {
  it('parses status lines and case-insensitive response header names', () => {
    const result = parseResponseHeaders('HTTP/2 200 OK\nContent-Type: text/html\nX-Test: one');
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toEqual(['text/html']);
    expect(result.headers['x-test']).toEqual(['one']);
  });

  it('preserves repeated Set-Cookie headers', () => {
    const result = parseResponseHeaders('HTTP/1.1 200 OK\nSet-Cookie: a=1; Secure\nSet-Cookie: b=2; HttpOnly');
    expect(result.headers['set-cookie']).toHaveLength(2);
  });

  it('selects the last response block from a curl redirect chain', () => {
    const result = parseResponseHeaders('HTTP/2 301\nLocation: /final\n\nHTTP/2 200 OK\nContent-Type: text/html');
    expect(result.responseCount).toBe(2);
    expect(result.statusCode).toBe(200);
    expect(result.headers.location).toBeUndefined();
    expect(result.headers['content-type']).toEqual(['text/html']);
  });

  it('ignores curl -v request lines and parses response-prefixed headers', () => {
    const result = parseResponseHeaders('> GET / HTTP/2\n> Host: example.com\n< HTTP/2 200\n< Server: nginx\n< X-Test: ok');
    expect(result.statusCode).toBe(200);
    expect(result.headers.host).toBeUndefined();
    expect(result.headers.server).toEqual(['nginx']);
    expect(result.headers['x-test']).toEqual(['ok']);
  });

  it('joins obsolete folded continuation lines and ignores malformed lines', () => {
    const result = parseResponseHeaders('HTTP/1.1 200 OK\nX-Long: first\n second\nnot-a-header');
    expect(result.headers['x-long']).toEqual(['first second']);
    expect(result.ignoredLines).toBe(1);
  });

  it('returns an empty parse for blank input', () => {
    expect(parseResponseHeaders('')).toMatchObject({ headers: {}, responseCount: 0 });
  });
});

describe('analyzeResponseHeaders', () => {
  it('scores a well-configured response and exposes CSP directives', () => {
    const result = analyzeResponseHeaders([
      'HTTP/2 200 OK',
      'Content-Security-Policy: default-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'',
      'Strict-Transport-Security: max-age=31536000; includeSubDomains',
      'X-Content-Type-Options: nosniff',
      'Referrer-Policy: strict-origin-when-cross-origin',
      'Permissions-Policy: camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy: same-origin',
      'Cross-Origin-Embedder-Policy: require-corp',
      'Cross-Origin-Resource-Policy: same-origin',
      'Set-Cookie: session=abc; Secure; HttpOnly; SameSite=Lax',
    ].join('\n'));
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.cspDirectives.map(item => item.name)).toContain('frame-ancestors');
  });

  it('does not award enforcement points for report-only CSP', () => {
    const result = analyzeResponseHeaders('Content-Security-Policy-Report-Only: default-src \'self\'');
    expect(result.checks.find(item => item.id === 'csp')?.earned).toBe(0);
  });

  it('flags unsafe CSP, weak cookies, CORS wildcard with credentials and noindex', () => {
    const result = analyzeResponseHeaders([
      'HTTP/2 200 OK',
      'Content-Security-Policy: default-src *; script-src \'unsafe-inline\' \'unsafe-eval\'',
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Credentials: true',
      'Set-Cookie: session=abc',
      'X-Robots-Tag: noindex',
    ].join('\n'));
    expect(result.findings.map(item => item.title)).toContain('Weak CSP source expressions');
    expect(result.findings.map(item => item.title)).toContain('Conflicting CORS credentials configuration');
    expect(result.findings.map(item => item.title)).toContain('X-Robots-Tag prevents indexing');
    expect(result.cookies[0].issues).toHaveLength(3);
    expect(result.score).toBeLessThan(100);
  });

  it('does not call optional cross-origin isolation mandatory in its recommendation', () => {
    const result = analyzeResponseHeaders('X-Content-Type-Options: nosniff');
    expect(result.checks.find(item => item.id === 'isolation')?.recommendation).toContain('optional');
  });

  it('describes the response status and cache policy in findings', () => {
    const result = analyzeResponseHeaders('HTTP/2 404 Not Found\nServer: nginx');
    expect(result.findings.map(item => item.title)).toContain('HTTP error response');
    expect(result.findings.map(item => item.title)).toContain('No Cache-Control response policy');
  });
});
