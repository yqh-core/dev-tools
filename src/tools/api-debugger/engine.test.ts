import { describe, expect, it } from 'vitest';
import { decodeLink } from '../json-workspace/workspace-link';
import { buildProxyPayload, isRequestAuthConfig, redactAuthQueryUrl, responseToWorkspaceLink, sanitizeForShare, substituteVars } from './engine';

describe('substituteVars', () => {
  it('replaces known variables and lists missing ones', () => {
    const r = substituteVars('https://{{host}}/v1?token={{token}}&x={{host}}', { host: 'api.x.test' });
    expect(r.text).toBe('https://api.x.test/v1?token={{token}}&x=api.x.test');
    expect(r.missing).toEqual(['token']);
  });

  it('leaves text without tokens untouched', () => {
    expect(substituteVars('plain', {}).text).toBe('plain');
  });
});

describe('sanitizeForShare (credentials never in share links)', () => {
  it('strips auth headers case-insensitively and URL credentials', () => {
    const req = {
      method: 'GET',
      url: 'https://user:pass@api.x.test/v1',
      headers: [
        { name: 'Authorization', value: 'Bearer secret' },
        { name: 'cookie', value: 'sid=1' },
        { name: 'X-API-Key', value: 'k' },
        { name: 'Accept', value: 'application/json' },
      ],
      body: '',
    };
    const s = sanitizeForShare(req);
    expect(s.headers).toEqual([{ name: 'Accept', value: 'application/json' }]);
    expect(s.url).toBe('https://api.x.test/v1');
  });

  it('keeps non-auth headers and valid URLs unchanged', () => {
    const req = { method: 'POST', url: 'https://x.test/', headers: [{ name: 'Content-Type', value: 'application/json' }], body: '{}' };
    expect(sanitizeForShare(req)).toEqual(req);
  });
});

describe('buildProxyPayload', () => {
  it('substitutes across url, headers and body, aggregating missing', () => {
    const r = buildProxyPayload(
      { method: 'POST', url: 'https://{{host}}/login', headers: [{ name: 'Authorization', value: 'Bearer {{token}}' }], body: '{"u":"{{user}}"}' },
      { host: 'api.x.test', user: 'a' },
    );
    expect(r.payload.url).toBe('https://api.x.test/login');
    expect(r.payload.headers[0].value).toBe('Bearer {{token}}');
    expect(r.payload.body).toBe('{"u":"a"}');
    expect(r.missing).toEqual(['token']);
  });
});

describe('request Authorization profiles', () => {
  it('validates only the supported, strictly-shaped profile variants', () => {
    expect(isRequestAuthConfig({ type: 'none' })).toBe(true);
    expect(isRequestAuthConfig({ type: 'bearer', token: '{{API_TOKEN}}' })).toBe(true);
    expect(isRequestAuthConfig({ type: 'basic', username: '', password: '' })).toBe(true);
    expect(isRequestAuthConfig({ type: 'api-key-header', key: 'X-API-Key', value: '' })).toBe(true);
    expect(isRequestAuthConfig({ type: 'bearer', token: 'x', unexpected: true })).toBe(false);
    expect(isRequestAuthConfig({ type: 'api-key-query', key: 'x'.repeat(1025), value: 'v' })).toBe(false);
  });

  it('resolves Bearer variables only into the transient send payload', () => {
    const request = {
      method: 'GET',
      url: 'https://api.example.test/users',
      headers: [],
      body: '',
      auth: { type: 'bearer' as const, token: '{{API_TOKEN}}' },
    };
    const result = buildProxyPayload(request, { API_TOKEN: 'live-secret' });
    expect(result.payload.headers).toEqual([{ name: 'Authorization', value: 'Bearer live-secret' }]);
    expect(Object.keys(result.payload).sort()).toEqual(['body', 'headers', 'method', 'url']);
    expect(request.auth.token).toBe('{{API_TOKEN}}');
    expect(JSON.stringify(sanitizeForShare(request))).not.toContain('live-secret');
    expect('auth' in sanitizeForShare(request)).toBe(false);
  });

  it('encodes Basic credentials as UTF-8 before base64', () => {
    const source = '用户:päss';
    const expected = btoa(Array.from(new TextEncoder().encode(source), byte => String.fromCharCode(byte)).join(''));
    const result = buildProxyPayload({
      method: 'GET', url: 'https://api.example.test/', headers: [], body: '',
      auth: { type: 'basic', username: '用户', password: 'päss' },
    }, {});
    expect(result.payload.headers).toEqual([{ name: 'Authorization', value: `Basic ${expected}` }]);
  });

  it('does not replace a manual Authorization header without an explicit choice', () => {
    const request = {
      method: 'GET', url: 'https://api.example.test/', body: '',
      headers: [{ name: 'authorization', value: 'Manual value' }],
      auth: { type: 'bearer' as const, token: 'generated-token' },
    };
    const pending = buildProxyPayload(request, {});
    expect(pending.collision).toEqual({ target: 'header', name: 'Authorization' });
    expect(pending.payload.headers[0].value).toBe('Manual value');
    const replaced = buildProxyPayload(request, {}, { authCollision: 'replace' });
    expect(replaced.collision).toBeUndefined();
    expect(replaced.payload.headers).toEqual([{ name: 'Authorization', value: 'Bearer generated-token' }]);
    const kept = buildProxyPayload(request, {}, { authCollision: 'keep-manual' });
    expect(kept.payload.headers).toEqual([{ name: 'authorization', value: 'Manual value' }]);
    expect(request.headers[0].value).toBe('Manual value');
  });

  it('percent-encodes reserved query-key values once and preserves URL fragments', () => {
    const value = 'a+b &=#%';
    const result = buildProxyPayload({
      method: 'GET', url: 'https://api.example.test/items?lang=en#details', headers: [], body: '',
      auth: { type: 'api-key-query', key: 'api_key', value },
    }, {});
    expect(result.payload.url).toContain('#details');
    const queryText = result.payload.url.split('?')[1].split('#')[0];
    const parsed = new URLSearchParams(queryText);
    expect(parsed.get('api_key')).toBe(value);
    expect(queryText).toContain('api_key=a%2Bb+%26%3D%23%25');
  });

  it('reports query collisions and replaces duplicates only in the effective URL when chosen', () => {
    const request = {
      method: 'GET', url: 'https://api.example.test/items?api_key=old&x=1&api_key=older#tab',
      headers: [], body: '',
      auth: { type: 'api-key-query' as const, key: 'api_key', value: 'new' },
    };
    const pending = buildProxyPayload(request, {});
    expect(pending.collision).toEqual({ target: 'query', name: 'api_key' });
    const replaced = buildProxyPayload(request, {}, { authCollision: 'replace' });
    const [url, fragment] = replaced.payload.url.split('#');
    expect(fragment).toBe('tab');
    const values = [...new URLSearchParams(url.split('?')[1]).getAll('api_key')];
    expect(values).toEqual(['new']);
    expect(url).toContain('x=1');
    expect(request.url).toContain('api_key=old');
  });

  it('fails closed when a selected auth mode has no credential or an invalid header name', () => {
    const missingBearer = buildProxyPayload({
      method: 'GET', url: 'https://api.example.test/', headers: [], body: '',
      auth: { type: 'bearer', token: '' },
    }, {});
    expect(missingBearer.error).toContain('Enter an authentication credential');

    const badHeaderName = buildProxyPayload({
      method: 'GET', url: 'https://api.example.test/', headers: [], body: '',
      auth: { type: 'api-key-header', key: 'Bad Header Name', value: 'secret' },
    }, {});
    expect(badHeaderName.error).toContain('valid HTTP field name');
  });

  it('redacts only generated API-key query values from collection progress URLs', () => {
    const url = 'https://api.example.test/items?lang=en&client_key=actual-secret#details';
    expect(redactAuthQueryUrl(url, {
      type: 'api-key-query', key: '{{KEY_NAME}}', value: '{{KEY_VALUE}}',
    }, { KEY_NAME: 'client_key' })).toBe(
      'https://api.example.test/items?lang=en&client_key=[REDACTED]#details',
    );
    expect(redactAuthQueryUrl(url, { type: 'bearer', token: 'secret' }, {})).toBe(url);
    expect(redactAuthQueryUrl(url, { type: 'api-key-query', key: '{{MISSING}}', value: 'x' }, {})).toBe(url);
  });

  it('rejects CR/LF in resolved auth header names and values', () => {
    const result = buildProxyPayload({
      method: 'GET', url: 'https://api.example.test/', headers: [], body: '',
      auth: { type: 'api-key-header', key: 'X-API-Key', value: '{{INJECT}}' },
    }, { INJECT: 'safe\\r\\nInjected: yes' });
    expect(result.error).toContain('CR or LF');
  });
});

describe('response → WS-2 handoff', () => {
  it('produces a restorable deep-link for small bodies', () => {
    const link = responseToWorkspaceLink('{"a":1}', 'https://digdevbox.com');
    expect(link).toContain('#w=');
    const state = decodeLink(new URL(link as string).hash);
    expect(state.nodes[0].op).toBe('format');
    expect(state.nodes[0].input).toBe('{"a":1}');
  });

  it('returns null over the 8KB limit instead of truncating (negative control)', () => {
    expect(responseToWorkspaceLink('x'.repeat(9000), 'https://digdevbox.com')).toBeNull();
  });
});
