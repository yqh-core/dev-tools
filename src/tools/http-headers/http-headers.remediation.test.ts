import { describe, expect, it } from 'vitest';
import { analyzeResponseHeaders } from './http-headers.models';
import { buildHeaderRemediation } from './http-headers.remediation';

const missingHeaders = analyzeResponseHeaders('HTTP/2 200 OK');

describe('buildHeaderRemediation', () => {
  it('generates Nginx directives for only clearly missing low-context headers', () => {
    const result = buildHeaderRemediation(missingHeaders, 'nginx');

    expect(result).toContain('add_header X-Content-Type-Options "nosniff" always;');
    expect(result).toContain('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
    expect(result).toContain('add_header Strict-Transport-Security "max-age=31536000" always;');
    expect(result).toContain('HSTS');
    expect(result).toContain('includeSubDomains and preload are intentionally omitted');
    expect(result).not.toContain('Content-Security-Policy');
  });

  it('formats Apache, Caddy and Cloudflare Pages syntax', () => {
    expect(buildHeaderRemediation(missingHeaders, 'apache'))
      .toContain('Header always set X-Content-Type-Options "nosniff"');
    expect(buildHeaderRemediation(missingHeaders, 'caddy'))
      .toContain('header {\n  X-Content-Type-Options "nosniff"');
    expect(buildHeaderRemediation(missingHeaders, 'cloudflare-pages'))
      .toContain('/*\n  X-Content-Type-Options: nosniff');
  });

  it('does not overwrite an existing referrer policy or weak-but-present HSTS value', () => {
    const analysis = analyzeResponseHeaders([
      'HTTP/2 200 OK',
      'Referrer-Policy: no-referrer',
      'Strict-Transport-Security: max-age=86400',
      'X-Content-Type-Options: nosniff',
    ].join('\n'));

    const result = buildHeaderRemediation(analysis, 'nginx');
    expect(result).toContain('No low-context header additions');
    expect(result).not.toContain('Referrer-Policy');
    expect(result).not.toContain('Strict-Transport-Security');
  });
});
