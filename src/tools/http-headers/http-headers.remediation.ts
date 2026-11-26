import type { HeaderAnalysis } from './http-headers.models';

export type HeaderRemediationPlatform = 'nginx' | 'apache' | 'caddy' | 'vercel' | 'cloudflare-pages';

const SAFE_HEADER_FIXES = {
  nosniff: {
    name: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  referrer: {
    name: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  hsts: {
    name: 'Strict-Transport-Security',
    value: 'max-age=31536000',
  },
} as const;

/**
 * Generate only deterministic, low-context response-header additions.
 *
 * CSP, frame policy, Permissions-Policy, CORS and cookie changes are deliberately
 * excluded: their correct values depend on the app's origins, embeds, APIs and
 * session design. HSTS is emitted only when missing, without includeSubDomains
 * or preload; deploy it only after HTTPS readiness has been verified.
 */
export function buildHeaderRemediation(
  analysis: HeaderAnalysis,
  platform: HeaderRemediationPlatform,
): string {
  const missing = new Set(
    analysis.checks
      .filter(item => item.status === 'missing')
      .map(item => item.id),
  );

  const directives = [
    missing.has('nosniff') ? SAFE_HEADER_FIXES.nosniff : undefined,
    missing.has('referrer') ? SAFE_HEADER_FIXES.referrer : undefined,
    missing.has('hsts') ? SAFE_HEADER_FIXES.hsts : undefined,
  ].filter((item): item is (typeof SAFE_HEADER_FIXES)[keyof typeof SAFE_HEADER_FIXES] => Boolean(item));

  if (directives.length === 0) {
    if (platform === 'vercel') {
      return JSON.stringify({ headers: [] }, null, 2);
    }
    return [
      '# No low-context header additions are suggested for this response.',
      '# Review the individual findings for app-specific configuration.',
      '# CSP, CORS, cookies, frame policy and Permissions-Policy are intentionally not generated here.',
    ].join('\n');
  }

  if (platform === 'vercel') {
    return JSON.stringify({
      headers: [{
        source: '/(.*)',
        headers: directives.map(directive => ({
          key: directive.name,
          value: directive.value,
        })),
      }],
    }, null, 2);
  }

  const lines: string[] = [
    '# Generated from missing header checks only. Review before deploying.',
  ];

  if (missing.has('hsts')) {
    lines.push(
      '# HSTS: add only on HTTPS after confirming every covered hostname is HTTPS-ready.',
      '# includeSubDomains and preload are intentionally omitted.',
    );
  }

  if (platform === 'nginx') {
    for (const directive of directives) {
      lines.push(`add_header ${directive.name} "${directive.value}" always;`);
    }
  }
  else if (platform === 'apache') {
    lines.push('<IfModule mod_headers.c>');
    for (const directive of directives) {
      lines.push(`  Header always set ${directive.name} "${directive.value}"`);
    }
    lines.push('</IfModule>');
  }
  else if (platform === 'caddy') {
    lines.push('header {');
    for (const directive of directives) {
      lines.push(`  ${directive.name} "${directive.value}"`);
    }
    lines.push('}');
  }
  else {
    lines.push('/*');
    for (const directive of directives) {
      lines.push(`  ${directive.name}: ${directive.value}`);
    }
  }

  lines.push(
    '',
    '# Not generated: CSP, frame policy, Permissions-Policy, CORS and cookie flags.',
    '# Their values depend on your app, allowed origins, embeds and authentication model.',
  );

  return lines.join('\n');
}
