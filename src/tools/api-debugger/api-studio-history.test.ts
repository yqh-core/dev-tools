import { describe, expect, it } from 'vitest'
import type { ApiRequestState } from './engine'
import {
  API_STUDIO_HISTORY_CAP,
  API_STUDIO_HISTORY_ENTRY_MAX_BYTES,
  API_STUDIO_HISTORY_TTL_MS,
  parseApiStudioHistory,
  pushApiStudioHistory,
  removeApiStudioHistory,
  sanitizeApiStudioHistoryRequest,
  type ApiStudioHistoryEntry,
} from './api-studio-history'

const now = 1_800_000_000_000
const request: ApiRequestState = {
  method: 'POST',
  url: 'https://user:pass@api.example.test/v1/items?access_token=raw-token&limit=10&token={{accessToken}}',
  headers: [
    { name: 'Authorization', value: 'Bearer raw-token' },
    { name: 'X-Custom-Token', value: 'raw-token' },
    { name: 'Accept', value: 'application/json' },
  ],
  body: '{"accessToken":"raw-token","name":"sample"}',
}

function entry(id: string, at: number): ApiStudioHistoryEntry {
  return {
    id,
    at,
    request: { method: 'GET', url: 'https://api.example.test/items', headers: [], body: '' },
    status: 200,
    elapsedMs: 12,
    credentialsRemoved: false,
    secretValuesRedacted: false,
    bodyOmitted: false,
  }
}

describe('sanitizeApiStudioHistoryRequest', () => {
  it('removes credential headers, URL userinfo and raw credential query values while preserving variables', () => {
    const result = sanitizeApiStudioHistoryRequest(request)
    expect(result).not.toBeNull()
    expect(result!.request.url).not.toContain('user')
    expect(result!.request.url).not.toContain('raw-token')
    expect(result!.request.url).toContain('limit=10')
    expect(result!.request.url).toContain('accessToken')
    expect(result!.request.headers).toEqual([{ name: 'Accept', value: 'application/json' }])
    expect(result!.credentialsRemoved).toBe(true)
  })

  it('redacts marked values in URL, remaining headers and body without mutating input', () => {
    const input = {
      ...request,
      url: 'https://api.example.test/items?trace={{token}}&note=marked-secret-value',
      headers: [{ name: 'X-Trace', value: 'marked-secret-value' }],
      body: '{"token":"marked-secret-value"}',
    }
    const result = sanitizeApiStudioHistoryRequest(input, ['marked-secret-value'])
    expect(result).not.toBeNull()
    expect(JSON.stringify(result!.request)).not.toContain('marked-secret-value')
    expect(result!.secretValuesRedacted).toBe(true)
    expect(input.body).toContain('marked-secret-value')
  })

  it('omits an oversized body but retains the replayable request shell', () => {
    const large = { ...request, body: 'x'.repeat(API_STUDIO_HISTORY_ENTRY_MAX_BYTES + 10) }
    const result = sanitizeApiStudioHistoryRequest(large)
    expect(result).not.toBeNull()
    expect(result!.request.body).toBe('')
    expect(result!.bodyOmitted).toBe(true)
  })

  it('refuses an oversized URL/header envelope rather than writing an unbounded entry', () => {
    const large = { ...request, url: `https://api.example.test/${'x'.repeat(API_STUDIO_HISTORY_ENTRY_MAX_BYTES + 100)}`, body: '' }
    expect(sanitizeApiStudioHistoryRequest(large)).toBeNull()
  })
})

describe('parseApiStudioHistory', () => {
  it('drops malformed, expired and implausibly future entries', () => {
    const good = entry('good', now)
    const stale = entry('stale', now - API_STUDIO_HISTORY_TTL_MS - 1)
    const future = entry('future', now + 6 * 60 * 1000)
    const malformed = { ...good, request: { ...good.request, headers: 'invalid' } }
    expect(parseApiStudioHistory([good, stale, future, malformed, null], now).map(item => item.id)).toEqual(['good'])
  })

  it('deduplicates and orders newest first, with a hard 50-entry cap', () => {
    const many = Array.from({ length: API_STUDIO_HISTORY_CAP + 8 }, (_, i) => entry(`id-${i}`, now - i))
    const parsed = parseApiStudioHistory([many[0], ...many.slice(1), { ...many[0], status: 500 }], now)
    expect(parsed).toHaveLength(API_STUDIO_HISTORY_CAP)
    expect(parsed[0].id).toBe('id-0')
    expect(parsed.some(item => item.id === 'id-50')).toBe(false)
  })
})

describe('pushApiStudioHistory / removeApiStudioHistory', () => {
  it('prepends entries, expires old entries, caps the list and does not mutate inputs', () => {
    const old = entry('old', now - API_STUDIO_HISTORY_TTL_MS - 1)
    const current = Array.from({ length: API_STUDIO_HISTORY_CAP }, (_, i) => entry(`id-${i}`, now - i))
    const next = pushApiStudioHistory([old, ...current], entry('new', now + 1), now + 1)
    expect(next).toHaveLength(API_STUDIO_HISTORY_CAP)
    expect(next[0].id).toBe('new')
    expect(next.some(item => item.id === 'old')).toBe(false)
    expect(current).toHaveLength(API_STUDIO_HISTORY_CAP)
    expect(removeApiStudioHistory(next, 'new').map(item => item.id)).not.toContain('new')
  })
})
