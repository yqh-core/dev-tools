export type HeaderCheckStatus = 'pass' | 'warn' | 'missing';

export interface ParsedResponseHeaders {
  statusLine?: string
  statusCode?: number
  headers: Record<string, string[]>
  responseCount: number
  ignoredLines: number
}

export interface HeaderCheck {
  id: string
  title: string
  points: number
  earned: number
  status: HeaderCheckStatus
  detail: string
  recommendation: string
}

export interface HeaderFinding {
  severity: 'high' | 'medium' | 'info'
  title: string
  detail: string
}

export interface HeaderAnalysis {
  parsed: ParsedResponseHeaders
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  checks: HeaderCheck[]
  findings: HeaderFinding[]
  cookies: { name: string; issues: string[] }[]
  cspDirectives: { name: string; value: string }[]
}

;

function headerValues(headers: Record<string, string[]>, name: string): string[] {
  return headers[name.toLowerCase()] ?? [];
}

function firstHeader(headers: Record<string, string[]>, name: string): string {
  return headerValues(headers, name).at(-1) ?? '';
}

function parseCspDirectives(value: string): { name: string; value: string }[] {
  return value
    .split(';')
    .map((directive) => {
      const [name = '', ...parts] = directive.trim().split(/\s+/);
      return { name: name.toLowerCase(), value: parts.join(' ') };
    })
    .filter(directive => directive.name);
}

/**
 * Parse raw response headers copied from curl -I/-i/-L or browser DevTools.
 * Request lines printed by curl -v are ignored; repeated headers such as Set-Cookie
 * are preserved. When redirects are included, the last response block is analyzed.
 */
export function parseResponseHeaders(raw: string): ParsedResponseHeaders {
  const blocks: { statusLine?: string; headers: Record<string, string[]>; ignoredLines: number }[] = [];
  let current: { statusLine?: string; headers: Record<string, string[]>; ignoredLines: number } = {
    headers: {},
    ignoredLines: 0,
  };
  let lastHeaderName: string | undefined;

  const pushCurrent = () => {
    if (current.statusLine || Object.keys(current.headers).length > 0) {
      blocks.push(current);
    }
    current = { headers: {}, ignoredLines: 0 };
    lastHeaderName = undefined;
  };

  for (const originalLine of raw.replace(/\r/g, '').split('\n')) {
    const line = originalLine.trimEnd();
    const responseLine = line.startsWith('< ') ? line.slice(2).trim() : line.trim();

    if (/^HTTP\/\d(?:\.\d)?\s+\d{3}(?:\s|$)/i.test(responseLine)) {
      pushCurrent();
      current.statusLine = responseLine;
      continue;
    }

    // curl -v's request headers and transfer diagnostics are not response headers.
    if (/^(?:> |\* |\[|\$ )/.test(line) || !line.trim()) {
      continue;
    }

    // Obsolete folded header continuation: attach it to the preceding field.
    if (/^\s/.test(line) && lastHeaderName) {
      const values = current.headers[lastHeaderName];
      values[values.length - 1] = `${values.at(-1) ?? ''} ${line.trim()}`.trim();
      continue;
    }

    const separator = line.indexOf(':');
    if (separator <= 0) {
      current.ignoredLines += 1;
      lastHeaderName = undefined;
      continue;
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name)) {
      current.ignoredLines += 1;
      lastHeaderName = undefined;
      continue;
    }

    current.headers[name] ??= [];
    current.headers[name].push(value);
    lastHeaderName = name;
  }

  pushCurrent();
  const selected = blocks.at(-1) ?? { headers: {}, ignoredLines: 0 };
  const code = selected.statusLine?.match(/\s(\d{3})(?:\s|$)/)?.[1];

  return {
    statusLine: selected.statusLine,
    statusCode: code ? Number(code) : undefined,
    headers: selected.headers,
    responseCount: blocks.length,
    ignoredLines: blocks.reduce((sum, block) => sum + block.ignoredLines, 0),
  };
}

function check(
  id: string,
  title: string,
  points: number,
  earned: number,
  detail: string,
  recommendation: string,
): HeaderCheck {
  return {
    id,
    title,
    points,
    earned,
    status: earned >= points ? 'pass' : earned > 0 ? 'warn' : 'missing',
    detail,
    recommendation,
  };
}

function cookieAudit(values: string[]): HeaderAnalysis['cookies'] {
  return values.map((value, index) => {
    const parts = value.split(';').map(part => part.trim());
    const name = parts[0]?.split('=')[0]?.trim() || `Cookie ${index + 1}`;
    const attributes = new Set(parts.slice(1).map(part => part.split('=')[0].toLowerCase()));
    const issues: string[] = [];
    if (!attributes.has('secure')) {
      issues.push('Secure is missing');
    }
    if (!attributes.has('httponly')) {
      issues.push('HttpOnly is missing (appropriate for session cookies)');
    }
    if (!attributes.has('samesite')) {
      issues.push('SameSite is not explicit');
    }
    return { name, issues };
  });
}

/**
 * A transparent header-coverage checklist, not an OWASP score or a full security audit.
 * Cross-origin isolation is optional for many sites; recommendations must be checked
 * against the site's embed, worker and third-party resource requirements.
 */
export function analyzeResponseHeaders(raw: string): HeaderAnalysis {
  const parsed = parseResponseHeaders(raw);
  const headers = parsed.headers;
  const csp = headerValues(headers, 'content-security-policy').join('; ');
  const cspReportOnly = firstHeader(headers, 'content-security-policy-report-only');
  const cspDirectives = parseCspDirectives(csp);
  const directive = (name: string) => cspDirectives.find(item => item.name === name)?.value ?? '';
  const findings: HeaderFinding[] = [];

  const cspUnsafe = /(?:'unsafe-inline'|'unsafe-eval'|\*)/i.test(csp);
  const cspEarned = csp ? (cspUnsafe ? 18 : directive('default-src') || directive('script-src') ? 25 : 20) : 0;
  const cspDetail = csp
    ? cspUnsafe
      ? 'A policy is present, but it contains broad or unsafe source expressions.'
      : 'A Content-Security-Policy header is present.'
    : cspReportOnly
      ? 'Only a report-only policy is present; it does not enforce restrictions.'
      : 'No enforcing Content-Security-Policy header was found.';

  const hsts = firstHeader(headers, 'strict-transport-security');
  const maxAge = Number(hsts.match(/max-age\s*=\s*(\d+)/i)?.[1] ?? 0);
  const hstsEarned = hsts ? (maxAge >= 31536000 ? 20 : maxAge > 0 ? 12 : 0) : 0;

  const framePolicy = directive('frame-ancestors');
  const xFrame = firstHeader(headers, 'x-frame-options').toLowerCase();
  const frameProtected = Boolean(framePolicy && !framePolicy.includes('*'))
    || ['deny', 'sameorigin'].includes(xFrame);
  const nosniff = firstHeader(headers, 'x-content-type-options').toLowerCase() === 'nosniff';
  const referrer = firstHeader(headers, 'referrer-policy').toLowerCase();
  const referrerSafe = referrer.split(',').every(value => [
    'no-referrer',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'origin',
    'origin-when-cross-origin',
  ].includes(value.trim()));
  const permissions = firstHeader(headers, 'permissions-policy').trim();
  const coop = firstHeader(headers, 'cross-origin-opener-policy').trim();
  const coep = firstHeader(headers, 'cross-origin-embedder-policy').trim();
  const corp = firstHeader(headers, 'cross-origin-resource-policy').trim();
  const isolationEarned = (coop ? 4 : 0) + (coep ? 3 : 0) + (corp ? 3 : 0);

  const checks: HeaderCheck[] = [
    check('csp', 'Content Security Policy', 25, cspEarned, cspDetail,
      'Start with a report-only policy, review real resource requirements and violations, then enforce a policy tailored to the application.'),
    check('hsts', 'Strict Transport Security', 20, hstsEarned,
      hsts ? `HSTS max-age is ${maxAge || 'missing'} seconds.` : 'No HSTS header was found.',
      'Only send HSTS over HTTPS. Confirm every covered subdomain supports HTTPS before adding includeSubDomains; do not enable preload by default.'),
    check('frame', 'Frame protection', 15, frameProtected ? 15 : 0,
      frameProtected ? 'CSP frame-ancestors or X-Frame-Options restricts embedding.' : 'No frame restriction was detected.',
      'Use CSP frame-ancestors with the origins that genuinely need to embed the page; X-Frame-Options is a legacy fallback.'),
    check('nosniff', 'MIME sniffing protection', 10, nosniff ? 10 : 0,
      nosniff ? 'X-Content-Type-Options is set to nosniff.' : 'X-Content-Type-Options: nosniff was not found.',
      'Send X-Content-Type-Options: nosniff and ensure Content-Type matches each response body.'),
    check('referrer', 'Referrer policy', 10, referrer ? (referrerSafe ? 10 : 4) : 0,
      referrer ? `Referrer-Policy is ${referrer}.` : 'No Referrer-Policy was found.',
      'A common privacy-conscious choice is strict-origin-when-cross-origin; choose a policy that matches your analytics and navigation needs.'),
    check('permissions', 'Permissions policy', 10, permissions ? 10 : 0,
      permissions ? 'A Permissions-Policy header is present.' : 'No Permissions-Policy was found.',
      'Explicitly disable browser capabilities the application does not use, such as camera, microphone or geolocation, while preserving required features.'),
    check('isolation', 'Cross-origin isolation', 10, isolationEarned,
      `COOP: ${coop || 'not set'}; COEP: ${coep || 'not set'}; CORP: ${corp || 'not set'}.`,
      'These policies are optional and can break embeds or cross-origin assets. Add them only when the application needs cross-origin isolation and after testing dependencies.'),
  ];

  const cookies = cookieAudit(headerValues(headers, 'set-cookie'));
  for (const cookie of cookies) {
    if (cookie.issues.length > 0) {
      findings.push({
        severity: 'medium',
        title: `Cookie ${cookie.name}`,
        detail: cookie.issues.join('; '),
      });
    }
  }

  const server = firstHeader(headers, 'server');
  const poweredBy = firstHeader(headers, 'x-powered-by');
  if (server || poweredBy) {
    findings.push({
      severity: 'info',
      title: 'Server information disclosure',
      detail: [server && `Server: ${server}`, poweredBy && `X-Powered-By: ${poweredBy}`].filter(Boolean).join('; '),
    });
  }

  const corsOrigin = firstHeader(headers, 'access-control-allow-origin');
  const corsCredentials = firstHeader(headers, 'access-control-allow-credentials').toLowerCase();
  if (corsOrigin === '*' && corsCredentials === 'true') {
    findings.push({
      severity: 'high',
      title: 'Conflicting CORS credentials configuration',
      detail: 'Access-Control-Allow-Origin: * cannot be used with Access-Control-Allow-Credentials: true in a credentialed browser response.',
    });
  }

  if (csp.includes('\'unsafe-inline\'') || csp.includes('\'unsafe-eval\'')) {
    findings.push({
      severity: 'high',
      title: 'Weak CSP source expressions',
      detail: 'The policy contains unsafe-inline or unsafe-eval. Reduce inline execution with nonces or hashes and remove eval where possible.',
    });
  }
  if (csp.includes('*')) {
    findings.push({
      severity: 'medium',
      title: 'Broad CSP wildcard source',
      detail: 'A wildcard source may permit resources from more origins than intended. Narrow it to the origins the application actually uses.',
    });
  }

  const xRobots = firstHeader(headers, 'x-robots-tag');
  if (/\bnoindex\b/i.test(xRobots)) {
    findings.push({
      severity: 'high',
      title: 'X-Robots-Tag prevents indexing',
      detail: 'This response includes noindex. Confirm that it is intentional for the document URL; it can keep a page out of search results.',
    });
  }

  if (!firstHeader(headers, 'cache-control')) {
    findings.push({
      severity: 'info',
      title: 'No Cache-Control response policy',
      detail: 'Review caching separately for HTML, immutable static assets and personalized responses; one policy should not be copied across all routes.',
    });
  }
  if (parsed.statusCode && parsed.statusCode >= 300 && parsed.statusCode < 400) {
    findings.push({
      severity: 'info',
      title: 'Redirect response',
      detail: `The analyzed response is HTTP ${parsed.statusCode}. With curl -L, the final response block is analyzed.`,
    });
  }
  if (parsed.statusCode && parsed.statusCode >= 400) {
    findings.push({
      severity: 'high',
      title: 'HTTP error response',
      detail: `The analyzed response returned HTTP ${parsed.statusCode}; confirm the URL and intended status before treating the headers as a page baseline.`,
    });
  }
  if (parsed.responseCount > 1) {
    findings.push({
      severity: 'info',
      title: 'Multiple response blocks detected',
      detail: `${parsed.responseCount} response blocks were found. The final block is scored; earlier blocks are usually redirect hops or proxy responses.`,
    });
  }

  const cookiePenalty = Math.min(10, cookies.reduce((sum, cookie) => sum + cookie.issues.length * 2, 0));
  const disclosurePenalty = Math.min(4, (server ? 2 : 0) + (poweredBy ? 2 : 0));
  const baseScore = checks.reduce((sum, item) => sum + item.earned, 0);
  const score = Math.max(0, Math.min(100, baseScore - cookiePenalty - disclosurePenalty));

  return {
    parsed,
    score,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 45 ? 'D' : 'F',
    checks,
    findings,
    cookies,
    cspDirectives,
  };
}
