import { describe, expect, it } from 'vitest';
import { decodeLink } from '../json-workspace/workspace-link';
import { buildProxyPayload, responseToWorkspaceLink, sanitizeForShare, substituteVars } from './engine';

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
