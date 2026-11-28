import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/webstatus.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeRequest(target = 'https://93.184.216.34/') {
  return new Request(`https://digdevbox.com/api/webstatus?url=${encodeURIComponent(target)}`);
}

describe('/api/webstatus response semantics', () => {
  it('treats an upstream 404 as a received HTTP response and returns the final URL', async () => {
    const upstream = vi.fn(async () => new Response(null, {
      status: 404,
      headers: {
        'content-type': 'text/plain',
        'x-origin-result': 'not-found',
        'set-cookie': 'session=secret; HttpOnly',
      },
    }));
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest('https://93.184.216.34/missing') });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      url: 'https://93.184.216.34/missing',
      status: 404,
      headers: {
        'content-type': 'text/plain',
        'x-origin-result': 'not-found',
      },
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][1].method).toBe('HEAD');
    expect(upstream.mock.calls[0][1].redirect).toBe('manual');
    expect(upstream.mock.calls[0][1].headers).toEqual({
      'user-agent': 'DigDevBox/1.0 (+https://digdevbox.com/)',
      accept: '*/*',
    });
  });

  it('falls back to GET only when the HEAD fetch throws', async () => {
    const upstream = vi.fn()
      .mockRejectedValueOnce(new Error('HEAD transport failed'))
      .mockResolvedValueOnce(new Response('body', { status: 200, headers: { 'x-final': 'yes' } }));
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.map(call => call[1].method)).toEqual(['HEAD', 'GET']);
  });

  it('does not treat a returned 405 response as a thrown HEAD failure', async () => {
    const upstream = vi.fn(async () => new Response(null, { status: 405 }));
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe(405);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls[0][1].method).toBe('HEAD');
  });

  it('follows redirects and returns the final URL and response only', async () => {
    const upstream = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/final/path' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { 'x-final': 'landed' } }));
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest('https://93.184.216.34/start') });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.url).toBe('https://93.184.216.34/final/path');
    expect(payload.status).toBe(200);
    expect(payload.headers).toEqual({ 'x-final': 'landed' });
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.every(call => call[1].redirect === 'manual')).toBe(true);
  });

  it('revalidates redirect destinations and never fetches a private target', async () => {
    const upstream = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/admin' },
    }));
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest('https://93.184.216.34/start') });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('127.0.0.1');
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(upstream.mock.calls.every(call => !String(call[0]).includes('127.0.0.1'))).toBe(true);
  });

  it('stops after the configured three-redirect limit', async () => {
    const upstream = vi.fn(async (url) => {
      const current = new URL(String(url));
      const next = Number(current.pathname.slice(1) || '0') + 1;
      return new Response(null, { status: 302, headers: { location: `/${next}` } });
    });
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestGet({ request: makeRequest('https://93.184.216.34/0') });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain('3');
    expect(upstream).toHaveBeenCalledTimes(4);
  });

  it('returns no more than 60 headers and never returns Set-Cookie', async () => {
    const headers = new Headers({ 'set-cookie': 'token=private' });
    for (let index = 0; index < 65; index++) {
      headers.set(`x-header-${String(index).padStart(2, '0')}`, `value-${index}`);
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200, headers })));

    const response = await onRequestGet({ request: makeRequest() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(payload.headers)).toHaveLength(60);
    expect(payload.headers['set-cookie']).toBeUndefined();
  });

  it('keeps response headers when the upstream response has no numeric status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: null,
      headers: new Headers({ 'x-partial': 'visible' }),
    })));

    const response = await onRequestGet({ request: makeRequest() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBeNull();
    expect(payload.headers).toEqual({ 'x-partial': 'visible' });
  });

  it('reports a transport failure separately from an upstream HTTP response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network unavailable');
    }));

    const response = await onRequestGet({ request: makeRequest() });
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.status).toBeUndefined();
    expect(payload.error).toContain('无法连接');
  });
});
