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
const dohAware = targetFn => vi.fn(async (url, init) => {
  const u = String(url);
  if (u.includes('dns-query') || u.includes('dns.google')) {
    return Response.json({ Answer: [{ type: 1, data: '93.184.216.34' }] });
  }
  return targetFn(url, init);
});

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

  it('blocks redirect to private network (per-hop revalidation)', async () => {
    vi.stubGlobal('fetch', dohAware(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } })));
    const r = await onRequestPost({ request: mkReq({ url: 'https://example.com/' }) });
    expect(r.status).toBe(403);
    const j = await r.json();
    // 逐跳重校有两种拒绝口：parseTarget 分支（Redirect rejected）或循环顶 guardTarget（私网 IP）。
    // 断言私网 IP 出现在错误里 = 重定向目标确实被重新校验并拦下。
    expect(j.error).toContain('127.0.0.1');
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