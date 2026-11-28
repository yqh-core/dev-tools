import type { ApiRequestState, KV } from './engine';

export const API_STUDIO_HISTORY_KEY = ['api-studio', 'request-history'].join(':');
export const API_STUDIO_HISTORY_CAP = 50;
export const API_STUDIO_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const API_STUDIO_HISTORY_REDACTED = '[REDACTED]';

export interface ApiStudioHistoryEntry {
  id: string
  at: number
  request: ApiRequestState
  status: number | null
  elapsedMs: number | null
}

interface HistoryInput {
  id: string
  at: number
  request: ApiRequestState
  status: number | null
  elapsedMs: number | null
}

const CREDENTIAL_HEADER = /authorization|(?:^|[-_])auth(?:$|[-_])|cookie|token|secret|password|passwd|credential|api[-_]?key|access[-_]?key|signature|(?:^|[-_])sig(?:$|[-_])|session/i;
const CREDENTIAL_QUERY = /(?:^|[-_])(?:auth(?:orization)?|token|secret|password|passwd|credential|api[-_]?key|access[-_]?key|client[-_]?secret|signature|sig|session|cookie)(?:$|[-_])/i;
const VARIABLE_PLACEHOLDER = /(\{\{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*\}\})/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPlaceholder(value: string): boolean {
  return /^\s*\{\{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*\}\}\s*$/.test(value);
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  }
  catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.split('').map(char => '\\^$.*+?()[]{}|'.includes(char) ? `\\${char}` : char).join('');
}

/**
 * Redact literal values of marked secret variables without rewriting unresolved
 * {{variable}} placeholders. Short values use token boundaries to avoid
 * replacing arbitrary characters throughout a request body.
 */
export function redactMarkedSecrets(value: string, secretValues: string[] = []): string {
  const secrets = [...new Set(secretValues.filter((secret): secret is string => typeof secret === 'string' && secret.length > 0))]
    .sort((a, b) => b.length - a.length);
  if (secrets.length === 0 || !value) {
    return value;
  }

  const patterns = secrets.map((secret) => {
    const literal = escapeRegExp(secret);
    return secret.length <= 3 && /^[A-Za-z0-9_]+$/.test(secret)
      ? `(?<![A-Za-z0-9_])${literal}(?![A-Za-z0-9_])`
      : literal;
  });
  const matcher = new RegExp(patterns.join('|'), 'g');

  // Split around variable tokens so the user's unresolved template survives.
  return value.split(VARIABLE_PLACEHOLDER)
    .map((part, index) => index % 2 === 0 ? part.replace(matcher, API_STUDIO_HISTORY_REDACTED) : part)
    .join('');
}

function stripUrlUserInfo(value: string): string {
  const scheme = value.indexOf('://');
  if (scheme < 0) {
    return value;
  }
  const authorityStart = scheme + 3;
  const tail = value.slice(authorityStart);
  const boundary = tail.search(/[/?#]/);
  const authorityEnd = boundary < 0 ? value.length : authorityStart + boundary;
  const authority = value.slice(authorityStart, authorityEnd);
  const at = authority.lastIndexOf('@');
  if (at < 0) {
    return value;
  }
  return value.slice(0, authorityStart) + authority.slice(at + 1) + value.slice(authorityEnd);
}

function redactSensitiveQueryValues(value: string): string {
  const hash = value.indexOf('#');
  const beforeHash = hash < 0 ? value : value.slice(0, hash);
  const fragment = hash < 0 ? '' : value.slice(hash);
  const query = beforeHash.indexOf('?');
  if (query < 0) {
    return value;
  }

  const parts = beforeHash.slice(query + 1).split('&').map((part) => {
    const equal = part.indexOf('=');
    const key = equal < 0 ? part : part.slice(0, equal);
    const rawValue = equal < 0 ? '' : part.slice(equal + 1);
    const decodedKey = decodeQueryPart(key);
    const decodedValue = decodeQueryPart(rawValue);
    if (!CREDENTIAL_QUERY.test(decodedKey) || isPlaceholder(decodedValue)) {
      return part;
    }
    return `${key}=${API_STUDIO_HISTORY_REDACTED}`;
  });

  return `${beforeHash.slice(0, query + 1)}${parts.join('&')}${fragment}`;
}

/** Sanitized, immutable request snapshot safe for the bounded browser-local history. */
export function sanitizeApiStudioHistoryRequest(
  request: ApiRequestState,
  secretValues: string[] = [],
): ApiRequestState {
  const redactedUrl = redactMarkedSecrets(request.url, secretValues);
  const url = redactSensitiveQueryValues(stripUrlUserInfo(redactedUrl));
  const headers: KV[] = request.headers
    .filter(header => !CREDENTIAL_HEADER.test(header.name.trim()))
    .map(header => ({
      name: header.name,
      value: redactMarkedSecrets(header.value, secretValues),
    }));

  return {
    method: request.method,
    url,
    headers,
    body: redactMarkedSecrets(request.body, secretValues),
  };
}

/** Construct only the approved fields; no response data or raw error can enter history. */
export function createApiStudioHistoryEntry(input: HistoryInput, secretValues: string[] = []): ApiStudioHistoryEntry {
  return {
    id: input.id,
    at: input.at,
    request: sanitizeApiStudioHistoryRequest(input.request, secretValues),
    status: input.status,
    elapsedMs: input.elapsedMs,
  };
}

export function pushApiStudioHistory(
  entries: ApiStudioHistoryEntry[],
  entry: ApiStudioHistoryEntry,
  cap = API_STUDIO_HISTORY_CAP,
): ApiStudioHistoryEntry[] {
  return [entry, ...entries].slice(0, Math.max(0, cap));
}

export function removeApiStudioHistory(
  entries: ApiStudioHistoryEntry[],
  id: string,
): ApiStudioHistoryEntry[] {
  return entries.filter(entry => entry.id !== id);
}

function isRequest(value: unknown): value is ApiRequestState {
  if (!isRecord(value) || typeof value.method !== 'string' || typeof value.url !== 'string' || typeof value.body !== 'string' || !Array.isArray(value.headers)) {
    return false;
  }
  return value.headers.every(header =>
    isRecord(header) && typeof header.name === 'string' && typeof header.value === 'string',
  );
}

/** Versioned storage parser: malformed and older-than-30-day rows are discarded. */
export function parseApiStudioHistory(raw: unknown, now = Date.now()): ApiStudioHistoryEntry[] {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.entries)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: ApiStudioHistoryEntry[] = [];
  for (const candidate of raw.entries) {
    if (!isRecord(candidate)
      || typeof candidate.id !== 'string'
      || candidate.id.length === 0
      || candidate.id.length > 128
      || typeof candidate.at !== 'number'
      || !Number.isFinite(candidate.at)
      || candidate.at > now + 5 * 60 * 1000
      || now - candidate.at > API_STUDIO_HISTORY_RETENTION_MS
      || !isRequest(candidate.request)
      || !(candidate.status === null || (typeof candidate.status === 'number' && Number.isFinite(candidate.status)))
      || !(candidate.elapsedMs === null || (typeof candidate.elapsedMs === 'number' && Number.isFinite(candidate.elapsedMs) && candidate.elapsedMs >= 0))
      || seen.has(candidate.id)) {
      continue;
    }

    seen.add(candidate.id);
    entries.push({
      id: candidate.id,
      at: candidate.at,
      request: sanitizeApiStudioHistoryRequest(candidate.request),
      status: candidate.status,
      elapsedMs: candidate.elapsedMs,
    });
  }

  return entries.sort((a, b) => b.at - a.at).slice(0, API_STUDIO_HISTORY_CAP);
}

export function serializeApiStudioHistory(entries: ApiStudioHistoryEntry[]): string {
  return JSON.stringify({
    version: 1,
    entries: entries.slice(0, API_STUDIO_HISTORY_CAP),
  });
}
