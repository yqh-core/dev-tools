import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../../functions/api/apiproxy.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

let ipCounter = 0;
function mkReq(payload, rawBody) {
  ipCounter += 1;
  return new Request('https://digdevbox.com/api/apiproxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': `203.0.113.${ipCounter}` },
    body: rawBody !== undefined ? rawBody : JSON.stringify(payload),
  });
}
const okFetch = () => vi.fn(async () => new Response('{"ok":1}', { status: 200, statusText: 'OK', headers: { 'set-cookie': 'a=b', 'x-t': '1' } }));
// DoH-aware stub：解析查询返回公网 A 记录，其余走目标响应工厂。
// 不带 DoH 感知的 stub 会让 guardTarget 解析空结果 → 403，造成假失败/假通过。
function dohAware(targetFn) {
  return vi.fn(async (url, init) => {
    const u = String(url);
    if (u.includes('dns-query') || u.includes('dns.google')) {
      return Response.json({ Answer: [{ type: 1, data: '93.184.216.34' }] });
    }
    return targetFn(url, init);
  });
}

describe('apiproxy request validation', () => {
  it('rejects non-JSON body', async () => {
    const r = await onRequestPost({ request: mkReq(null, 'not json') });
    expect(r.status).toBe(400);
  });

  it('rejects disallowed method', async () => {
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com', method: 'TRACE' }) });
    expect(r.status).toBe(405);
  });

  it('rejects SSRF literal before any fetch (negative control)', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'http://169.254.169.254/latest/meta-data/' }) });
    expect(r.status).toBe(403);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects oversized request body', async () => {
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com', body: 'x'.repeat(256 * 1024 + 1) }) });
    expect(r.status).toBe(413);
  });

  it('rejects an oversized outer JSON envelope before parsing or forwarding it', async () => {
    const spy = okFetch();
    vi.stubGlobal('fetch', spy);
    const raw = JSON.stringify({ url: 'https://example.com/', padding: 'x'.repeat(2 * 1024 * 1024) });
    const r = await onRequestPost({ request: mkReq(null, raw) });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'Request JSON exceeds the 2097152 byte limit.' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects CRLF header injection and forbidden headers', async () => {
    const crlf = await onRequestPost({ request: mkReq({ url: 'https://example.com', headers: [{ name: 'x-a', value: 'a\r\nb' }] }) });
    expect(crlf.status).toBe(400);
    const host = await onRequestPost({ request: mkReq({ url: 'https://example.com', headers: [{ name: 'host', value: 'evil.com' }] }) });
    expect(host.status).toBe(400);
    const many = await onRequestPost({ request: mkReq({ url: 'https://example.com', headers: Array.from({ length: 61 }, (_, i) => ({ name: `x-${i}`, value: 'v' })) }) });
    expect(many.status).toBe(400);
  });
});

describe('apiproxy forwarding', () => {
  it('returns status/headers/body and strips set-cookie', async () => {
    vi.stubGlobal('fetch', dohAware(okFetch()));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/api', method: 'GET' }) });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.status).toBe(200);
    expect(j.body).toBe('{"ok":1}');
    expect(j.headers['x-t']).toBe('1');
    expect(j.headers['set-cookie']).toBeUndefined();
    expect(typeof j.elapsedMs).toBe('number');
  });

  it('same-host redirect with DNS rebinding to private IP blocked per-hop (403)', async () => {
    // S1 后跨主机重定向直接停止跟随；逐跳重校仍守同主机重定向的 DNS rebinding 路径：
    // 首跳 DoH 公网、第二跳 DoH 私网 → 循环顶 guardTarget 拦下 403。
    let dohCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('dns-query') || u.includes('dns.google')) {
        dohCalls++;
        const ip = dohCalls <= 2 ? '93.184.216.34' : '127.0.0.1';
        return Response.json({ Answer: [{ type: 1, data: ip }] });
      }
      return new Response(null, { status: 302, headers: { location: 'https://example.com/rebound' } });
    }));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(403);
    const j = await r.json();
    expect(j.error).toContain('127.0.0.1');
  });

  it('cross-host redirect to private IP stopped without any request to it', async () => {
    const spy = dohAware(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } }));
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.followed).toBe(false);
    const privateCalls = spy.mock.calls.filter(c => String(c[0]).includes('127.0.0.1'));
    expect(privateCalls.length).toBe(0);
  });

  it('stops after redirect hop limit', async () => {
    vi.stubGlobal('fetch', dohAware(async () => new Response(null, { status: 302, headers: { location: 'https://example.com/' } })));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(400);
  });

  it('303 switches method to GET and drops body', async () => {
    const spy = dohAware(vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 303, headers: { location: 'https://example.com/final' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 })));
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/', method: 'POST', body: 'a=1' }) });
    expect(r.status).toBe(200);
    const targetCalls = spy.mock.calls.filter(c => !String(c[0]).includes('dns-query') && !String(c[0]).includes('dns.google'));
    expect(targetCalls[1][1].method).toBe('GET');
    expect(targetCalls[1][1].body).toBeUndefined();
  });

  it('refuses oversized response body instead of truncating', async () => {
    vi.stubGlobal('fetch', dohAware(async () => new Response(new Uint8Array(1024 * 1024 + 1), { status: 200 })));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(413);
  });

  it('blocks domain resolving to private IP via DoH', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('dns-query') || String(url).includes('dns.google')) {
        return Response.json({ Answer: [{ type: 1, data: '10.0.0.1' }] });
      }
      return new Response('should not reach', { status: 200 });
    }));
    const r = await onRequestPost({ request: mkReq({ url: 'https://evil.example.com/' }) });
    expect(r.status).toBe(403);
  });

  it('rate limits per IP at 30 req/min', async () => {
    vi.stubGlobal('fetch', dohAware(okFetch()));
    const ip = '198.51.100.77';
    let last;
    for (let i = 0; i < 31; i++) {
      const req = new Request('https://digdevbox.com/api/apiproxy', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ url: 'https://example.com/' }),
      });
      last = await onRequestPost({ request: req });
    }
    expect(last.status).toBe(429);
  });
});

describe('apiproxy S1 redirect credential policy', () => {
  const redirectFetch = (status, location) => dohAware(async () => new Response(null, { status, headers: { location } }));

  it.each([301, 302, 303, 307, 308])('cross-host %i not auto-followed, credentials not forwarded', async (status) => {
    const spy = redirectFetch(status, 'https://other.example.net/steal');
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/', headers: [{ name: 'Authorization', value: 'Bearer SECRET' }] }) });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.followed).toBe(false);
    expect(j.redirect).toBe('https://other.example.net/steal');
    expect(j.note).toContain('not auto-followed');
    const targetCalls = spy.mock.calls.filter(c => String(c[0]).includes('other.example.net'));
    expect(targetCalls.length).toBe(0);
  });

  it('same-host https redirect follows and keeps headers', async () => {
    const spy = dohAware(vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com/final' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 })));
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/', headers: [{ name: 'Authorization', value: 'Bearer X' }] }) });
    const j = await r.json();
    expect(j.followed).toBe(true);
    const targetCalls = spy.mock.calls.filter(c => !String(c[0]).includes('dns-query') && !String(c[0]).includes('dns.google'));
    expect(targetCalls[1][1].headers.Authorization).toBe('Bearer X');
  });

  it('https-to-http downgrade not auto-followed', async () => {
    vi.stubGlobal('fetch', redirectFetch(302, 'http://example.com/plain'));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    const j = await r.json();
    expect(j.followed).toBe(false);
    expect(j.note).toContain('downgrade');
  });

  it('cross-host without credentials also not auto-followed (uniform policy)', async () => {
    vi.stubGlobal('fetch', redirectFetch(302, 'https://other.example.net/x'));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    const j = await r.json();
    expect(j.followed).toBe(false);
  });

  // ── S1.1 外部审查整改：完整 Origin 边界（同主机异端口 = 不同 Origin）──
  it.each([301, 302, 303, 307, 308])('same-host cross-port %i not auto-followed; credentials AND body never reach the other port', async (status) => {
    const spy = redirectFetch(status, 'https://example.com:8443/collect');
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({
      request: mkReq({
        url: 'https://example.com/api',
        method: 'POST',
        body: 'password=SECRET_BODY',
        headers: [{ name: 'Authorization', value: 'Bearer SECRET' }],
      }),
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.followed).toBe(false);
    expect(j.redirect).toBe('https://example.com:8443/collect');
    expect(j.note).toContain('not auto-followed');
    // 负控核心：异端口目标零请求——凭据与请求体都没有被转发
    const portCalls = spy.mock.calls.filter(c => String(c[0]).includes(':8443'));
    expect(portCalls.length).toBe(0);
  });

  it('same-host cross-port without credentials also not auto-followed (uniform policy)', async () => {
    vi.stubGlobal('fetch', redirectFetch(302, 'https://example.com:8443/x'));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    const j = await r.json();
    expect(j.followed).toBe(false);
  });

  it('same-host http-to-https upgrade no longer auto-followed (Origin differs; explicit resend required)', async () => {
    const spy = redirectFetch(302, 'https://example.com/final');
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({
      request: mkReq({ url: 'http://example.com/', headers: [{ name: 'Authorization', value: 'Bearer X' }] }),
    });
    const j = await r.json();
    expect(j.followed).toBe(false);
    const targetCalls = spy.mock.calls.filter(c => String(c[0]).startsWith('https://example.com'));
    expect(targetCalls.length).toBe(0);
  });

  it('default-port equivalence still followed (https 443 normalized to same Origin)', async () => {
    const spy = dohAware(vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com:443/final' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 })));
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/', headers: [{ name: 'Authorization', value: 'Bearer X' }] }) });
    const j = await r.json();
    expect(j.followed).toBe(true);
    const targetCalls = spy.mock.calls.filter(c => !String(c[0]).includes('dns-query') && !String(c[0]).includes('dns.google'));
    expect(targetCalls[1][1].headers.Authorization).toBe('Bearer X');
  });

  it('same explicit non-default port still followed (Origin includes port)', async () => {
    const spy = dohAware(vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://example.com:8443/final' } }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 })));
    vi.stubGlobal('fetch', spy);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com:8443/' }) });
    const j = await r.json();
    expect(j.followed).toBe(true);
  });

  it('unicode body byte cap enforced (String.length under cap, bytes over)', async () => {
    const body = 'é'.repeat(200000);
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/', method: 'POST', body }) });
    expect(r.status).toBe(413);
  });

  it('oversized streamed response aborted with 413', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
        controller.enqueue(new Uint8Array(1024));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', dohAware(async () => new Response(stream, { status: 200 })));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(413);
  });
});

describe('apiproxy shared Durable Object rate limiter', () => {
  const secret = 'test-only-hmac-secret-with-more-than-32-bytes';
  const ip = '198.51.100.42';

  function sharedRequest(payload, address = ip) {
    return new Request('https://digdevbox.com/api/apiproxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': address },
      body: JSON.stringify(payload),
    });
  }

  function makeBinding({
    acquireStatus = 200,
    acquireBody = { allowed: true },
    releaseStatus = 200,
    throwOnAcquire = false,
  } = {}) {
    const identities = [];
    const calls = [];
    return {
      identities,
      calls,
      idFromName(name) {
        identities.push(name);
        return { name };
      },
      get(id) {
        return {
          async fetch(input, init) {
            const request = new Request(input, init);
            const path = new URL(request.url).pathname;
            const body = await request.json();
            calls.push({ identity: id.name, path, body });
            if (path === '/acquire') {
              if (throwOnAcquire) {
                throw new Error('synthetic DO backend failure');
              }
              return Response.json(acquireBody, { status: acquireStatus });
            }
            return Response.json({ released: true }, { status: releaseStatus });
          },
        };
      },
    };
  }

  const sharedEnv = namespace => ({
    API_RELAY_RATE_LIMIT_MODE: 'shared',
    API_RELAY_LIMITER: namespace,
    API_RELAY_RATE_LIMIT_HMAC_KEY: secret,
  });

  it('HMACs the Cloudflare client IP and sends only an opaque lease ID to the DO', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding();
    vi.stubGlobal('fetch', dohAware(okFetch()));

    const payload = {
      url: 'https://example.com/private',
      method: 'POST',
      headers: [{ name: 'Authorization', value: 'Bearer TOP_SECRET_VALUE' }],
      body: 'REQUEST_BODY_SECRET',
    };
    const first = await onRequestPost({ request: sharedRequest(payload), env: sharedEnv(binding) });
    const second = await onRequestPost({ request: sharedRequest(payload), env: sharedEnv(binding) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(binding.identities).toHaveLength(2);
    expect(binding.identities[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(binding.identities[0]).toBe(binding.identities[1]);
    expect(binding.identities[0]).not.toContain(ip);
    expect(binding.calls.map(call => call.path)).toEqual(['/acquire', '/release', '/acquire', '/release']);
    expect(binding.calls.every(call => Object.keys(call.body).length === 1 && typeof call.body.leaseId === 'string')).toBe(true);
    expect(JSON.stringify(binding.calls)).not.toContain(ip);
    expect(JSON.stringify(binding.calls)).not.toContain('TOP_SECRET_VALUE');
    expect(JSON.stringify(binding.calls)).not.toContain('REQUEST_BODY_SECRET');
  });

  it('uses different Durable Object identities for different client IPs', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding();
    vi.stubGlobal('fetch', dohAware(okFetch()));

    await onRequestPost({ request: sharedRequest({ url: 'https://example.com/a' }, '198.51.100.10'), env: sharedEnv(binding) });
    await onRequestPost({ request: sharedRequest({ url: 'https://example.com/b' }, '198.51.100.11'), env: sharedEnv(binding) });

    expect(binding.identities).toHaveLength(2);
    expect(binding.identities[0]).not.toBe(binding.identities[1]);
  });

  it('fails closed before the upstream fetch when the shared binding is missing', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestPost({
      request: sharedRequest({ url: 'https://example.com/' }),
      env: { API_RELAY_RATE_LIMIT_MODE: 'shared', API_RELAY_RATE_LIMIT_HMAC_KEY: secret },
    });

    expect(response.status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('fails closed before the upstream fetch when the shared limiter backend throws', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding({ throwOnAcquire: true });
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestPost({
      request: sharedRequest({ url: 'https://example.com/' }),
      env: sharedEnv(binding),
    });

    expect(response.status).toBe(503);
    expect(binding.calls.map(call => call.path)).toEqual(['/acquire']);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('passes a shared 429 and Retry-After through without reaching the upstream target', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding({
      acquireStatus: 429,
      acquireBody: { allowed: false, reason: 'window', retryAfterSeconds: 17 },
    });
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestPost({
      request: sharedRequest({ url: 'https://example.com/' }),
      env: sharedEnv(binding),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(await response.json()).toEqual({
      error: 'API request rate limit reached (30 per minute and 10 per 10-second burst per IP). Try again later.',
    });
    expect(binding.calls.map(call => call.path)).toEqual(['/acquire']);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('requires a strong HMAC secret in shared mode', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding();
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await onRequestPost({
      request: sharedRequest({ url: 'https://example.com/' }),
      env: {
        API_RELAY_RATE_LIMIT_MODE: 'shared',
        API_RELAY_LIMITER: binding,
        API_RELAY_RATE_LIMIT_HMAC_KEY: 'too-short',
      },
    });

    expect(response.status).toBe(503);
    expect(binding.calls).toHaveLength(0);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('releases an acquired lease even when the request envelope is invalid', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding();
    const request = new Request('https://digdevbox.com/api/apiproxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: 'not json',
    });

    const response = await onRequestPost({ request, env: sharedEnv(binding) });

    expect(response.status).toBe(400);
    expect(binding.calls.map(call => call.path)).toEqual(['/acquire', '/release']);
  });

  it('does not replace an upstream result when lease release fails', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const binding = makeBinding({ releaseStatus: 503 });
    vi.stubGlobal('fetch', dohAware(okFetch()));

    const response = await onRequestPost({
      request: sharedRequest({ url: 'https://example.com/' }),
      env: sharedEnv(binding),
    });

    expect(response.status).toBe(200);
    expect(binding.calls.map(call => call.path)).toEqual(['/acquire', '/release']);
  });
});
