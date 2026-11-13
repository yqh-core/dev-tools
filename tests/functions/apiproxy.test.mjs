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
