export type HeaderCheckStatus = 'present' | 'missing' | 'review' | 'warning' | 'info';

export interface HeaderCheck {
  id: string
  label: string
  status: HeaderCheckStatus
  value?: string
  detail: string
  recommendation: string
}

export interface ParsedResponseHeaders {
  statusLine?: string
  headers: Record<string, string[]>
  headerCount: number
  malformedLines: number
  error?: string
}

export interface HttpHeaderAnalysis {
  statusLine?: string
  headerCount: number
  malformedLines: number
  baselineChecks: HeaderCheck[]
  additionalFindings: HeaderCheck[]
  baselinePresent: number
  baselineTotal: number
}

export const MAX_RESPONSE_HEADER_INPUT_LENGTH = 65536

const TOKEN_PATTERN = /^[!#$%&'*+.^_\`|~0-9A-Za-z-]+$/
const SAFE_REFERRER_POLICIES = new Set([
  'no-referrer',
  'same-origin',
  'strict-origin',
  'strict-origin-when-cross-origin',
  'no-referrer-when-downgrade',
  'origin',
  'origin-when-cross-origin',
])

function getDirective(policy: string, name: string): string {
  const directive = policy.split(';').map(part => part.trim()).find(part => {
    return part.toLowerCase().startsWith(name.toLowerCase() + ' ')
  })
  return directive?.slice(name.length).trim() ?? ''
}

export function parseResponseHeaders(raw: string): ParsedResponseHeaders {
  if (raw.length > MAX_RESPONSE_HEADER_INPUT_LENGTH) {
    return { headers: {}, headerCount: 0, malformedLines: 0, error: 'Paste no more than 64 KB of response headers.' }
  }

  const headers: Record<string, string[]> = {}
  let statusLine: string | undefined
  let malformedLines = 0
  let headerCount = 0

  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (/^HTTP\/\d(?:\.\d)?\s+\d{3}(?:\s|$)/i.test(trimmed)) {
      statusLine = trimmed
      continue
    }

    const separator = line.indexOf(':')
    if (separator <= 0) {
      malformedLines++
      continue
    }

    const name = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!TOKEN_PATTERN.test(name)) {
      malformedLines++
      continue
    }

    const key = name.toLowerCase()
    headers[key] ??= []
    headers[key].push(value)
    headerCount++
  }

  if (headerCount === 0 && !statusLine) {
    return {
      headers,
      headerCount,
      malformedLines,
      error: 'No valid HTTP response headers found. Paste raw headers or curl -I output.',
    }
  }

  return { statusLine, headers, headerCount, malformedLines }
}

export function analyzeResponseHeaders(raw: string): HttpHeaderAnalysis | { error: string } {
  const parsed = parseResponseHeaders(raw)
  if (parsed.error) return { error: parsed.error }

  const getValues = (name: string) => parsed.headers[name.toLowerCase()] ?? []
  const get = (name: string) => getValues(name).join(', ')
  const has = (name: string) => getValues(name).length > 0
  const baselineChecks: HeaderCheck[] = []

  const hsts = get('strict-transport-security')
  if (!has('strict-transport-security')) {
    baselineChecks.push({
      id: 'hsts',
      label: 'Strict-Transport-Security',
      status: 'missing',
      detail: 'No HSTS policy was found in the pasted response.',
      recommendation: 'For HTTPS sites, consider a deliberate max-age policy. Add includeSubDomains only after confirming every subdomain supports HTTPS.',
    })
  }
  else {
    const maxAge = /(?:^|;)\s*max-age\s*=\s*(\d+)/i.exec(hsts)
    const seconds = maxAge ? Number(maxAge[1]) : 0
    baselineChecks.push({
      id: 'hsts',
      label: 'Strict-Transport-Security',
      status: maxAge && seconds >= 31536000 ? 'present' : 'review',
      value: hsts,
      detail: maxAge
        ? 'HSTS max-age is ' + seconds.toLocaleString('en-US') + ' seconds.'
        : 'The HSTS value does not contain a valid max-age directive.',
      recommendation: 'Use HSTS only on HTTPS responses. Review max-age and subdomain coverage before increasing enforcement.',
    })
  }

  const csp = get('content-security-policy')
  const scriptPolicy = getDirective(csp, 'script-src') || getDirective(csp, 'default-src')
  const hasUnsafeScriptSource = /(?:'unsafe-inline'|'unsafe-eval'|\*)/i.test(scriptPolicy)
  const hasScriptPolicy = Boolean(scriptPolicy)
  baselineChecks.push({
    id: 'csp',
    label: 'Content-Security-Policy',
    status: !has('content-security-policy') ? 'missing' : !hasScriptPolicy || hasUnsafeScriptSource ? 'review' : 'present',
    value: csp || undefined,
    detail: !has('content-security-policy')
      ? 'No enforcing Content-Security-Policy header was found.'
      : !hasScriptPolicy
        ? 'The policy has no script-src or default-src directive for this baseline check.'
        : hasUnsafeScriptSource
          ? 'The effective script source directive contains a broad or unsafe source expression.'
          : 'An enforcing Content-Security-Policy header is present; this parser does not validate the full policy grammar.',
    recommendation: 'Build a policy around the resources your app needs. Avoid broad sources and unsafe script directives; test changes with Content-Security-Policy-Report-Only first.',
  })

  const framePolicy = getDirective(csp, 'frame-ancestors')
  const frameSources = framePolicy.split(/\s+/).filter(Boolean)
  const xFrameOptions = get('x-frame-options')
  const frameProtected = frameSources.some(source => {
    return source === "'none'" || source === "'self'" || /^https?:\/\//i.test(source)
  }) || /^(?:DENY|SAMEORIGIN)$/i.test(xFrameOptions.trim())

  baselineChecks.push({
    id: 'frame',
    label: 'Frame protection',
    status: frameProtected ? 'present' : has('x-frame-options') || framePolicy ? 'review' : 'missing',
    value: framePolicy || xFrameOptions || undefined,
    detail: frameProtected
      ? 'A CSP frame-ancestors directive or recognized X-Frame-Options value is present.'
      : has('x-frame-options') || framePolicy
        ? 'The frame policy is present but uses a value this basic checker cannot confirm.'
        : 'Neither CSP frame-ancestors nor X-Frame-Options was found.',
    recommendation: 'Set CSP frame-ancestors to the specific origins that may embed the page. Use X-Frame-Options: DENY or SAMEORIGIN for legacy support.',
  })

  const contentTypeOptions = get('x-content-type-options')
  baselineChecks.push({
    id: 'nosniff',
    label: 'X-Content-Type-Options',
    status: !has('x-content-type-options') ? 'missing' : /^nosniff$/i.test(contentTypeOptions.trim()) ? 'present' : 'review',
    value: contentTypeOptions || undefined,
    detail: !has('x-content-type-options')
      ? 'No X-Content-Type-Options header was found.'
      : /^nosniff$/i.test(contentTypeOptions.trim())
        ? 'The value is nosniff.'
        : 'The header exists but its value is not nosniff.',
    recommendation: 'Set X-Content-Type-Options: nosniff and send accurate Content-Type values.',
  })

  const referrerPolicy = get('referrer-policy').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
  const recognizedReferrerPolicy = referrerPolicy.some(value => SAFE_REFERRER_POLICIES.has(value))
  const hasUnsafeReferrerPolicy = referrerPolicy.includes('unsafe-url')
  baselineChecks.push({
    id: 'referrer',
    label: 'Referrer-Policy',
    status: !has('referrer-policy') ? 'missing' : recognizedReferrerPolicy && !hasUnsafeReferrerPolicy ? 'present' : 'review',
    value: get('referrer-policy') || undefined,
    detail: !has('referrer-policy')
      ? 'No Referrer-Policy header was found.'
      : recognizedReferrerPolicy
        ? 'A recognized referrer policy is present.'
        : 'The configured referrer policy is unknown or may disclose more URL information than intended.',
    recommendation: 'strict-origin-when-cross-origin is a common privacy-conscious default; choose the policy that matches your application.',
  })

  const permissionsPolicy = get('permissions-policy')
  baselineChecks.push({
    id: 'permissions',
    label: 'Permissions-Policy',
    status: !has('permissions-policy') ? 'missing' : /=\s*\*/.test(permissionsPolicy) ? 'review' : 'present',
    value: permissionsPolicy || undefined,
    detail: !has('permissions-policy')
      ? 'No Permissions-Policy header was found.'
      : /=\s*\*/.test(permissionsPolicy)
        ? 'The policy contains a wildcard feature allow-list.'
        : 'A Permissions-Policy header is present; review each feature allow-list for your app.',
    recommendation: 'Explicitly disable browser features the application does not use, and allow only the origins that need them.',
  })

  const additionalFindings: HeaderCheck[] = []
  const allowOrigin = get('access-control-allow-origin').trim()
  const allowCredentials = get('access-control-allow-credentials').trim()
  if (allowOrigin === '*' && /^true$/i.test(allowCredentials)) {
    additionalFindings.push({
      id: 'cors-wildcard-credentials',
      label: 'CORS wildcard with credentials',
      status: 'warning',
      value: 'Access-Control-Allow-Origin: * + Access-Control-Allow-Credentials: true',
      detail: 'The response combines a wildcard origin with credential support. Browsers do not accept this combination for credentialed CORS requests.',
      recommendation: 'Return a specific allowed origin, validate it against an allow-list, and send Vary: Origin when reflecting allowed origins.',
    })
  }

  if (getValues('set-cookie').some(cookie => {
    return /(?:^|;)\s*samesite\s*=\s*none/i.test(cookie) && !/(?:^|;)\s*secure(?:;|$)/i.test(cookie)
  })) {
    additionalFindings.push({
      id: 'cookie-samesite-none-without-secure',
      label: 'SameSite=None cookie without Secure',
      status: 'warning',
      detail: 'At least one cookie uses SameSite=None without the Secure attribute.',
      recommendation: 'Add Secure to cookies using SameSite=None and review HttpOnly and Path/Domain scope for the application.',
    })
  }

  if (has('x-xss-protection')) {
    additionalFindings.push({
      id: 'legacy-xss-protection',
      label: 'Legacy X-XSS-Protection',
      status: 'info',
      value: get('x-xss-protection'),
      detail: 'X-XSS-Protection is a legacy browser feature and should not be treated as a substitute for CSP.',
      recommendation: 'Prefer a well-tested Content-Security-Policy. Remove the legacy header if it is no longer needed for supported clients.',
    })
  }

  if (has('server') || has('x-powered-by')) {
    const fingerprint = [
      get('server') ? 'Server: ' + get('server') : '',
      get('x-powered-by') ? 'X-Powered-By: ' + get('x-powered-by') : '',
    ].filter(Boolean).join(' · ')
    additionalFindings.push({
      id: 'server-fingerprint',
      label: 'Server technology disclosure',
      status: 'info',
      value: fingerprint,
      detail: 'The response exposes server or framework identification headers.',
      recommendation: 'Consider minimizing unnecessary technology disclosure. This is informational and does not establish a vulnerability by itself.',
    })
  }

  if (parsed.malformedLines > 0) {
    additionalFindings.push({
      id: 'malformed-lines',
      label: 'Unparsed header lines',
      status: 'warning',
      detail: parsed.malformedLines + ' line(s) could not be parsed as HTTP headers.',
      recommendation: 'Paste the raw response header block without terminal progress output or unrelated command text.',
    })
  }

  return {
    statusLine: parsed.statusLine,
    headerCount: parsed.headerCount,
    malformedLines: parsed.malformedLines,
    baselineChecks,
    additionalFindings,
    baselinePresent: baselineChecks.filter(check => check.status === 'present').length,
    baselineTotal: baselineChecks.length,
  }
}
