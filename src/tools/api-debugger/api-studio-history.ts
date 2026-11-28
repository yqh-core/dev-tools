import type { ApiRequestState } from './engine'
import { AUTH_HEADER_NAMES, sanitizeForShare } from './engine'
import { redactText } from './report'

export interface ApiStudioHistoryEntry {
  id: string
  at: number
  request: ApiRequestState
  status: number | null
  elapsedMs: number | null
  credentialsRemoved: boolean
  secretValuesRedacted: boolean
  bodyOmitted: boolean
}

export const API_STUDIO_HISTORY_CAP = 50
export const API_STUDIO_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const API_STUDIO_HISTORY_ENTRY_MAX_BYTES = 16 * 1024

const SENSITIVE_QUERY_NAME = /^(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|key|secret|client[_-]?secret|password|passwd|signature|sig|authorization|auth|session)$/i
const SENSITIVE_HEADER_NAME = /(?:authorization|cookie|token|secret|api[_-]?key|credential|session|password|signature)/i
const VARIABLE_PLACEHOLDER = /^\{\{\s*[A-Za-z_][A-Za-z0-9_]*\s*\}\}$/

function stripSensitiveQueryValues(raw: string): string {
  try {
    const url = new URL(raw)
    for (const [name, value] of [...url.searchParams.entries()]) {
      if (SENSITIVE_QUERY_NAME.test(name) && !VARIABLE_PLACEHOLDER.test(value.trim())) {
        url.searchParams.delete(name)
      }
    }
    return url.toString()
  }
  catch {
    return raw
  }
}

function utf8Size(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

/**
 * Build a replayable local history snapshot without the usual credential surfaces.
 * Request bodies may still contain unmarked free-form secrets; callers must disclose
 * that boundary and keep this data in browser-local storage only.
 */
export function sanitizeApiStudioHistoryRequest(
  request: ApiRequestState,
  secretValues: string[] = [],
): { request: ApiRequestState; credentialsRemoved: boolean; secretValuesRedacted: boolean; bodyOmitted: boolean } | null {
  const shared = sanitizeForShare(request)
  const urlWithoutCredentialParams = stripSensitiveQueryValues(shared.url)
  const headers = shared.headers
    .filter(header => !SENSITIVE_HEADER_NAME.test(header.name.trim()) && !AUTH_HEADER_NAMES.includes(header.name.trim().toLowerCase()))
    .map(header => ({ name: header.name, value: redactText(header.value, secretValues) }))
  const safeRequest: ApiRequestState = {
    method: request.method,
    url: redactText(urlWithoutCredentialParams, secretValues),
    headers,
    body: redactText(request.body, secretValues),
  }

  const credentialsRemoved = shared.headers.length !== request.headers.length || urlWithoutCredentialParams !== shared.url
  const secretValuesRedacted = safeRequest.url !== urlWithoutCredentialParams
    || safeRequest.headers.some((header, index) => header.value !== headers[index]?.value)
    || safeRequest.body !== request.body

  let bodyOmitted = false
  if (utf8Size(JSON.stringify(safeRequest)) > API_STUDIO_HISTORY_ENTRY_MAX_BYTES) {
    safeRequest.body = ''
    bodyOmitted = true
  }
  if (utf8Size(JSON.stringify(safeRequest)) > API_STUDIO_HISTORY_ENTRY_MAX_BYTES) {
    return null
  }

  return { request: safeRequest, credentialsRemoved, secretValuesRedacted, bodyOmitted }
}

function isRequest(value: unknown): value is ApiRequestState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const request = value as Record<string, unknown>
  return typeof request.method === 'string'
    && request.method.length > 0
    && request.method.length <= 20
    && typeof request.url === 'string'
    && request.url.length <= 8192
    && typeof request.body === 'string'
    && request.body.length <= API_STUDIO_HISTORY_ENTRY_MAX_BYTES
    && Array.isArray(request.headers)
    && request.headers.length <= 100
    && request.headers.every(header =>
      !!header
      && typeof header === 'object'
      && typeof (header as Record<string, unknown>).name === 'string'
      && typeof (header as Record<string, unknown>).value === 'string',
    )
}

export function parseApiStudioHistory(raw: unknown, now = Date.now()): ApiStudioHistoryEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const cutoff = now - API_STUDIO_HISTORY_TTL_MS
  const seen = new Set<string>()
  const entries: ApiStudioHistoryEntry[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue
    }
    const entry = item as Record<string, unknown>
    if (
      typeof entry.id !== 'string'
      || !entry.id.trim()
      || entry.id.length > 128
      || typeof entry.at !== 'number'
      || !Number.isFinite(entry.at)
      || entry.at < cutoff
      || entry.at > now + 5 * 60 * 1000
      || !isRequest(entry.request)
      || !(entry.status === null || (typeof entry.status === 'number' && Number.isInteger(entry.status) && entry.status >= 100 && entry.status <= 599))
      || !(entry.elapsedMs === null || (typeof entry.elapsedMs === 'number' && Number.isFinite(entry.elapsedMs) && entry.elapsedMs >= 0))
      || typeof entry.credentialsRemoved !== 'boolean'
      || typeof entry.secretValuesRedacted !== 'boolean'
      || typeof entry.bodyOmitted !== 'boolean'
      || seen.has(entry.id)
    ) {
      continue
    }
    seen.add(entry.id)
    entries.push({
      id: entry.id,
      at: entry.at,
      request: {
        method: entry.request.method,
        url: entry.request.url,
        headers: entry.request.headers.map(header => ({ name: header.name, value: header.value })),
        body: entry.request.body,
      },
      status: entry.status,
      elapsedMs: entry.elapsedMs,
      credentialsRemoved: entry.credentialsRemoved,
      secretValuesRedacted: entry.secretValuesRedacted,
      bodyOmitted: entry.bodyOmitted,
    })
  }

  return entries.sort((a, b) => b.at - a.at).slice(0, API_STUDIO_HISTORY_CAP)
}

export function pushApiStudioHistory(
  entries: ApiStudioHistoryEntry[],
  entry: ApiStudioHistoryEntry,
  now = Date.now(),
): ApiStudioHistoryEntry[] {
  const cutoff = now - API_STUDIO_HISTORY_TTL_MS
  return [entry, ...entries.filter(item => item.id !== entry.id && item.at >= cutoff)]
    .sort((a, b) => b.at - a.at)
    .slice(0, API_STUDIO_HISTORY_CAP)
}

export function removeApiStudioHistory(entries: ApiStudioHistoryEntry[], id: string): ApiStudioHistoryEntry[] {
  return entries.filter(entry => entry.id !== id)
}
