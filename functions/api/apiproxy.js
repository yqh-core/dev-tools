// Cloudflare Pages Function: POST /api/apiproxy
// WP-003 阶段 B · WS-1 API Debug 的服务端中继：由边缘代發用户请求，规避浏览器 CORS。
//
// 安全边界（yqh 裁定 + advisor 边界清单）：
//   · 复用 _ssrf.js 整套校验链（与 webstatus 同一套，不写第二套更弱的）：协议白名单 /
//     主机名策略 / 字面量 IP 多写法 / DoH 全公网 / 重定向逐跳重校 / 超时 / 不透出上游错误原文。
//   · 方法白名单；请求体 256 KiB、响应体 1 MiB、头数 60、单头值 8 KiB 上限（超限明确拒绝，不截断）。
//   · 按 IP 限流 30 req/min。**isolate 本地内存滑窗**：isolate 回收即重置、多 isolate 不共享——
//     这是 v1 的诚实边界；部署时应叠加 CF 平台级 rate limiting 规则（属部署裁定内容）。
//   · 不记录日志、不存储请求/响应体（仅瞬时转发）；不转发 set-cookie。
//   · 拒绝用户自带 host / connection / transfer-encoding / content-length（由 fetch 管理）。
//   · 已知残余风险（DNS rebinding 理论窗口 + 平台连接层缓解实测）见 _ssrf.js 头部，不得删除。
//
// 隐私：请求经 Cloudflare 边缘瞬时转发。工具页与隐私政策须如实披露（文案属单独授权）。

import { MAX_HEADER_COUNT, MAX_HOPS, TIMEOUT_MS, abortLike, guardTarget, isRedirect, parseTarget } from './_ssrf.js';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const MAX_REQ_BODY = 256 * 1024;
const MAX_RESP_BODY = 1024 * 1024;
const MAX_HEADER_VALUE = 8 * 1024;
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 30;
const FORBIDDEN_REQ_HEADERS = new Set(['host', 'connection', 'transfer-encoding', 'content-length']);
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const rateBuckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateBuckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  rateBuckets.set(ip, arr);
  if (rateBuckets.size > 5000) {
    // 驱逐最早插入的条目（Map 保持插入序），避免 clear() 一次性清空全部限流
    let drop = rateBuckets.size - 4000;
    for (const key of rateBuckets.keys()) {
      if (drop-- <= 0) {
        break;
      }
      rateBuckets.delete(key);
    }
  }
  return false;
}

export async function onRequestPost({ request }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip)) {
    return fail('Rate limit exceeded (30 requests per minute per IP). Try again later.', 429);
  }

  let payload;
  try {
    payload = await request.json();
  }
  catch {
    return fail('Request body must be JSON.', 400);
  }
  if (payload === null || typeof payload !== 'object') {
    return fail('Request body must be a JSON object.', 400);
  }

  const method = String(payload.method || 'GET').toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return fail(`Method ${method} is not allowed.`, 405);
  }

  const body = payload.body === undefined || payload.body === null ? '' : String(payload.body);
  // 按 UTF-8 字节数判定而非 String.length：Unicode 输入不得突破标称字节上限
  if (new TextEncoder().encode(body).byteLength > MAX_REQ_BODY) {
    return fail(`Request body exceeds the ${MAX_REQ_BODY} byte limit.`, 413);
  }

  const rawHeaders = Array.isArray(payload.headers) ? payload.headers : [];
  if (rawHeaders.length > MAX_HEADER_COUNT) {
    return fail(`Too many headers (limit ${MAX_HEADER_COUNT}).`, 400);
  }
  const headers = {};
  for (const h of rawHeaders) {
    if (h === null || typeof h !== 'object') {
      return fail('Each header must be an object with name and value.', 400);
    }
    const name = String(h.name || '');
    const value = String(h.value ?? '');
    if (!HEADER_NAME_RE.test(name)) {
      return fail(`Invalid header name: ${name.slice(0, 40)}`, 400);
    }
    if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) {
      return fail('Header name/value must not contain CR/LF.', 400);
    }
    if (new TextEncoder().encode(value).byteLength > MAX_HEADER_VALUE) {
      return fail(`Header ${name} exceeds the ${MAX_HEADER_VALUE} byte limit.`, 400);
    }
    if (FORBIDDEN_REQ_HEADERS.has(name.toLowerCase())) {
      return fail(`Header ${name} is managed by the proxy and cannot be set.`, 400);
    }
    headers[name] = value;
  }

  const parsed = parseTarget(String(payload.url || ''));
  if (parsed.error) {
    return fail(parsed.error, 400);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    let current = parsed.url;
    let currentMethod = method;
    let currentBody = body;
    let hops = 0;

    for (;;) {
      const guard = await guardTarget(current, controller.signal);
      if (guard.error) {
        return fail(guard.error, 403);
      }
      let resp;
      try {
        resp = await fetch(current, {
          method: currentMethod,
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            ...headers,
            'user-agent': 'DigDevBox-API-Debug/1.0 (+https://digdevbox.com/)',
          },
          ...(currentMethod === 'GET' || currentMethod === 'HEAD' ? {} : { body: currentBody }),
        });
      }
      catch (e) {
        return upstreamFail(e);
      }

      const location = resp.headers.get('location');
      if (isRedirect(resp.status) && location) {
        hops += 1;
        if (hops > MAX_HOPS) {
          return fail(`Too many redirects (limit ${MAX_HOPS}).`, 400);
        }
        let next;
        try {
          next = new URL(location, current).toString();
        }
        catch {
          return fail('Redirect target is not a valid URL.', 502);
        }
        const nextParsed = parseTarget(next);
        if (nextParsed.error) {
          return fail(`Redirect rejected: ${nextParsed.error}`, 403);
        }
        // S1：跨主机重定向与 HTTPS→HTTP 降级不自动跟随——
        // 凭据与请求体只发往用户显式指定的目标；重定向目标返回 UI 由用户显式决定是否重发。
        const curUrl = new URL(current);
        const nextUrl = new URL(nextParsed.url);
        const crossHost = nextUrl.hostname !== curUrl.hostname;
        const downgrade = curUrl.protocol === 'https:' && nextUrl.protocol === 'http:';
        if (crossHost || downgrade) {
          return Response.json({
            url: current,
            status: resp.status,
            statusText: resp.statusText,
            headers: collectHeaders(resp),
            body: '',
            elapsedMs: Date.now() - started,
            redirect: nextParsed.url,
            followed: false,
            note: crossHost
              ? 'Cross-host redirect not auto-followed; credentials and request body were not forwarded. Send to the redirect target explicitly if intended.'
              : 'HTTPS-to-HTTP downgrade redirect not auto-followed; credentials and request body were not forwarded.',
          });
        }
        current = nextParsed.url;
        if (resp.status === 303) {
          currentMethod = 'GET';
          currentBody = '';
        }
        continue;
      }

      // S1：流式限量读取，超限立即 cancel，不先把整个响应体读进内存再判
      const chunks = [];
      let received = 0;
      let exceeded = false;
      if (resp.body) {
        const reader = resp.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          received += value.byteLength;
          if (received > MAX_RESP_BODY) {
            exceeded = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      if (exceeded) {
        return fail(`Response body exceeds the ${MAX_RESP_BODY} byte limit; not returned.`, 413);
      }
      const buf = new Uint8Array(received);
      let off = 0;
      for (const c of chunks) {
        buf.set(c, off);
        off += c.byteLength;
      }
      const text = new TextDecoder().decode(buf);

      return Response.json({
        url: current,
        status: resp.status,
        statusText: resp.statusText,
        headers: collectHeaders(resp),
        body: text,
        elapsedMs: Date.now() - started,
        followed: true,
      });
    }
  }
  catch (e) {
    return upstreamFail(e);
  }
  finally {
    clearTimeout(timer);
  }
}

function collectHeaders(resp) {
  const outHeaders = {};
  let n = 0;
  resp.headers.forEach((v, k) => {
    if (n >= MAX_HEADER_COUNT) {
      return;
    }
    if (k.toLowerCase() === 'set-cookie') {
      return;
    }
    outHeaders[k] = v;
    n += 1;
  });
  return outHeaders;
}

function fail(message, status) {
  return Response.json({ error: message }, { status });
}

function upstreamFail(e) {
  return Response.json(
    {
      error: abortLike(e)
        ? 'The target site timed out. Try again later.'
        : 'Could not reach the target site (it may not exist, refuse connections, or be unreachable).',
    },
    { status: 502 },
  );
}
