import { describe, expect, it } from 'vitest';
import type { ApiRequestState } from './engine';
import {
  API_STUDIO_HISTORY_CAP,
  API_STUDIO_HISTORY_REDACTED,
  API_STUDIO_HISTORY_RETENTION_MS,
  createApiStudioHistoryEntry,
  parseApiStudioHistory,
  pushApiStudioHistory,
  redactMarkedSecrets,
  removeApiStudioHistory,
  sanitizeApiStudioHistoryRequest,
  serializeApiStudioHistory,
} from './request-history';

const request: ApiRequestState = {
  method: 'POST',
  url: 'https://user:password@api.example.test/v1/items?api_key=private-key&access_token={{accessToken}}&page=2',
  headers: [
    { name: 'Authorization', value: 'Bearer raw-token' },
    { name: 'X-API-Key', value: 'private-key' },
    { name: 'X-Trace-Id', value: 'trace-123' },
    { name: 'Content-Type', value: 'application/json' },
  ],
  body: '{"token":"marked-secret-value","note":"keep this text","template":"{{accessToken}}"}',
};

describe('API Studio private request history', () => {
  it('removes URL userinfo and credential-like headers and redacts sensitive query values', () => {
    const safe = sanitizeApiStudioHistoryRequest(request);
    expect(safe.url).not.toContain('user:password@');
    expect(safe.url).toContain('api_key=[REDACTED]');
    expect(safe.url).toContain('access_token={{accessToken}}');
    expect(safe.url).toContain('page=2');
    expect(safe.headers.map(header => header.name)).toEqual(['X-Trace-Id', 'Content-Type']);
    expect(safe.headers[0].value).toBe('trace-123');
  });

  it('redacts marked environment values in URLs, retained headers and bodies but preserves templates', () => {
    const input: ApiRequestState = {
      method: 'POST',
      url: 'https://api.example.test/v1/marked-secret-value?token={{secretToken}}',
      headers: [{ name: 'X-Trace-Id', value: 'marked-secret-value' }],
      body: '{"accessToken":"marked-secret-value","template":"{{secretToken}}"}',
    };
    const safe = sanitizeApiStudioHistoryRequest(input, ['marked-secret-value', '123']);
    expect(safe.url).toContain(API_STUDIO_HISTORY_REDACTED);
    expect(safe.url).toContain('{{secretToken}}');
    expect(safe.headers[0].value).toBe(API_STUDIO_HISTORY_REDACTED);
    expect(safe.body).toContain(API_STUDIO_HISTORY_REDACTED);
    expect(safe.body).toContain('{{secretToken}}');
    expect(redactMarkedSecrets('item123 and value 1234', ['123'])).toBe('item123 and value 1234');
  });

  it('uses short-secret token boundaries instead of replacing characters inside words', () => {
    expect(redactMarkedSecrets('a token: a, value: abc', ['a'])).toBe('[REDACTED] token: [REDACTED], value: abc');
  });

  it('creates a minimal entry and never persists response or error fields', () => {
    const entry = createApiStudioHistoryEntry({
      id: 'entry-1',
      at: 1000,
      request,
      status: 503,
      elapsedMs: 25,
    });
    expect(Object.keys(entry).sort()).toEqual(['at', 'elapsedMs', 'id', 'request', 'status']);
    expect(entry.status).toBe(503);
    expect(entry).not.toHaveProperty('response');
    expect(entry).not.toHaveProperty('error');
  });

  it('keeps newest first, caps at 50 and does not mutate the input list', () => {
    const first = createApiStudioHistoryEntry({ id: 'old', at: 1, request, status: 200, elapsedMs: 1 });
    const base = [first];
    let entries = base;
    for (let i = 0; i < API_STUDIO_HISTORY_CAP + 5; i++) {
      entries = pushApiStudioHistory(entries, createApiStudioHistoryEntry({
        id: `entry-${i}`,
        at: i + 2,
        request,
        status: 200,
        elapsedMs: 1,
      }));
    }
    expect(entries).toHaveLength(API_STUDIO_HISTORY_CAP);
    expect(entries[0].id).toBe(`entry-${API_STUDIO_HISTORY_CAP + 4}`);
    expect(entries.some(entry => entry.id === 'old')).toBe(false);
    expect(base).toHaveLength(1);
  });

  it('drops expired, future, malformed and duplicate records and sorts newest first', () => {
    const now = 50 * 24 * 60 * 60 * 1000;
    const current = createApiStudioHistoryEntry({ id: 'new', at: now - 1, request, status: 200, elapsedMs: 2 });
    const old = createApiStudioHistoryEntry({ id: 'expired', at: now - API_STUDIO_HISTORY_RETENTION_MS - 1, request, status: 200, elapsedMs: 2 });
    const parsed = parseApiStudioHistory({
      version: 1,
      entries: [
        old,
        { ...current, id: 'older', at: now - 100 },
        current,
        current,
        { id: 'bad', at: 'yesterday', request, status: 200, elapsedMs: 1 },
        { id: 'future', at: now + 10 * 60 * 1000, request, status: 200, elapsedMs: 1 },
        { id: 'malformed', at: now, request: { ...request, headers: 'bad' }, status: null, elapsedMs: null },
      ],
    }, now);
    expect(parsed.map(entry => entry.id)).toEqual(['new', 'older']);
  });

  it('round-trips the versioned envelope and strips credential fields again on read', () => {
    const entry = createApiStudioHistoryEntry({ id: 'safe', at: 100, request, status: null, elapsedMs: 10 });
    const serialized = serializeApiStudioHistory([entry]);
    const parsed = parseApiStudioHistory(JSON.parse(serialized), 200);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].request.headers.map(header => header.name)).toEqual(['X-Trace-Id', 'Content-Type']);
  });

  it('removes only the requested entry', () => {
    const entries = [
      createApiStudioHistoryEntry({ id: 'one', at: 1, request, status: 200, elapsedMs: 1 }),
      createApiStudioHistoryEntry({ id: 'two', at: 2, request, status: null, elapsedMs: 2 }),
    ];
    expect(removeApiStudioHistory(entries, 'one').map(entry => entry.id)).toEqual(['two']);
    expect(entries).toHaveLength(2);
  });
});
