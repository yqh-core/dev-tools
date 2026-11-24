import { describe, expect, it } from 'vitest';
import {
  analyzeRedirects,
  generateRedirectOutput,
  parseRedirectInput,
} from './redirect-generator.service';

describe('parseRedirectInput', () => {
  it('parses CSV with a header and quoted commas', () => {
    const rows = parseRedirectInput('Source URL,Target URL\n/old,/new\n"/old,comma","/new,comma"');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, source: '/old', target: '/new' });
    expect(rows[1]).toMatchObject({ source: '/old,comma', target: '/new,comma' });
  });

  it('parses tab-separated and arrow-separated pairs', () => {
    expect(parseRedirectInput('/old\t/new')[0]).toMatchObject({ source: '/old', target: '/new' });
    expect(parseRedirectInput('/legacy -> https://example.com/new')[0]).toMatchObject({
      source: '/legacy',
      target: 'https://example.com/new',
    });
  });

  it('keeps malformed rows visible as parse errors', () => {
    expect(parseRedirectInput('/old,')[0].parseError).toContain('Each row needs');
    expect(parseRedirectInput('"unfinished,/new')[0].parseError).toContain('Unclosed quoted');
  });

  it('rejects oversized input and row counts', () => {
    expect(() => parseRedirectInput('x'.repeat(200_001))).toThrow(RangeError);
    const rows = Array.from({ length: 1001 }, (_, index) => `/old-${index},/new-${index}`).join('\n');
    expect(() => parseRedirectInput(rows)).toThrow(RangeError);
  });
});

describe('analyzeRedirects', () => {
  it('normalizes absolute source URLs to exact paths', () => {
    const result = analyzeRedirects('https://example.com/old-page,https://example.com/new-page');
    expect(result.rows[0]).toMatchObject({
      sourcePath: '/old-page',
      targetPath: '/new-page',
      sourceUrl: 'https://example.com/old-page',
    });
  });

  it('rejects source query strings, unsupported protocols and invalid destinations', () => {
    const result = analyzeRedirects([
      'https://example.com/old?campaign=1,/new',
      'javascript:alert(1),/new',
      '/old,javascript:alert(1)',
    ].join('\n'));
    expect(result.errors).toBe(3);
    expect(result.rows[0].issues[0].message).toContain('query string');
    expect(result.rows[1].issues.some(issue => issue.code === 'invalid-source')).toBe(true);
    expect(result.rows[2].issues.some(issue => issue.code === 'invalid-target')).toBe(true);
  });

  it('detects same-host absolute self redirects', () => {
    const result = analyzeRedirects('https://example.com/same,https://example.com/same');
    expect(result.rows[0].issues.some(issue => issue.code === 'self-redirect')).toBe(true);
  });

  it('rejects quoted paths that could break generated server configuration', () => {
    const result = analyzeRedirects('/old\"; return 200,/new');
    expect(result.rows[0].issues.some(issue => issue.code === 'invalid-source')).toBe(true);
  });

  it('flags duplicate sources and self redirects', () => {
    const result = analyzeRedirects('/old,/new\n/old,/other\n/same,/same');
    expect(result.rows[1].issues.some(issue => issue.code === 'duplicate-source')).toBe(true);
    expect(result.rows[2].issues.some(issue => issue.code === 'self-redirect')).toBe(true);
    expect(result.errors).toBe(2);
  });

  it('warns when a destination continues through another redirect', () => {
    const result = analyzeRedirects('/old,/middle\n/middle,/final');
    expect(result.rows[0].issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'redirect-chain',
    }));
    expect(result.errors).toBe(0);
  });

  it('marks every mapping involved in a redirect loop as an error', () => {
    const result = analyzeRedirects('/a,/b\n/b,/c\n/c,/a');
    expect(result.rows.every(row => row.issues.some(issue => issue.code === 'redirect-loop'))).toBe(true);
    expect(result.valid).toBe(0);
  });
});

describe('generateRedirectOutput', () => {
  const analysis = analyzeRedirects('/old+page,/new-page\n/legacy,/final');

  it('generates Apache mod_alias exact-path RedirectMatch rules', () => {
    const output = generateRedirectOutput(analysis, 'apache', '301');
    expect(output).toContain('RedirectMatch 301 "^/old\\+page$" "/new-page"');
    expect(output).toContain('RedirectMatch 301 "^/legacy$" "/final"');
  });

  it('generates Nginx exact-match locations rather than prefix matches', () => {
    const output = generateRedirectOutput(analysis, 'nginx', '308');
    expect(output).toContain('location = /old+page { return 308 "/new-page"; }');
    expect(output).toContain('location = /legacy { return 308 "/final"; }');
  });

  it('generates Cloudflare Bulk Redirect CSV with seven columns and no header row', () => {
    const output = generateRedirectOutput(analysis, 'cloudflare', '301', {
      origin: 'https://example.com/',
      preserveQueryString: true,
    });
    const lines = output.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].split(',')).toHaveLength(7);
    expect(lines[0]).toContain('"https://example.com/old+page","https://example.com/new-page","301","TRUE"');
    expect(lines[1]).toContain('"FALSE","FALSE","FALSE"');
  });

  it('rejects an invalid Cloudflare site origin', () => {
    expect(() => generateRedirectOutput(analysis, 'cloudflare', '301', { origin: 'https://example.com/path' }))
      .toThrow('site origin');
  });

  it('does not export rows with validation errors', () => {
    const mixed = analyzeRedirects('/good,/new\n/bad,/bad\n/javascript,javascript:alert(1)');
    const output = generateRedirectOutput(mixed, 'nginx', '301');
    expect(output).toContain('location = /good');
    expect(output).not.toContain('/bad');
    expect(output).not.toContain('/javascript');
  });
});
