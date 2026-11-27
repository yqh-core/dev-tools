// Cloudflare Pages Function: POST /api/apiproxy
// WP-003 阶段 B · WS-1 API Debug 的服务端中继：由边缘代發用户请求，规避浏览器 CORS。
//
// 安全边界（yqh 裁定 + advisor 边界清单）：
//   · 复用 _ssrf.js 整套校验链（与 webstatus 同一套，不写第二套更弱的）：协议白名单 /
//     主机名策略 / 字面量 IP 多写法 / DoH 全公网 / 重定向逐跳重校 / 超时 / 不透出上游错误原文。
//   · 入站 JSON 包络 2 MiB；请求体 256 KiB、响应体 1 MiB、头数 60、单头值 8 KiB 上限（超限明确拒绝，不截断）。
//   · 默认保留 v1 isolate 本地 30 req/min 限流，保证向后兼容。API_RELAY_RATE_LIMIT_MODE=shared
//     时通过独立 Durable Object 强制 per-IP 30/min、10/10s burst、4 concurrent；缺绑定/secret/DO故障时 fail-closed。
//   · 不记录日志、不存储请求/响应体（仅瞬时转发）；不转发 set-cookie。
//   · 拒绝用户自带 host / connection / transfer-encoding / content-length（由 fetch 管理）。
//   · 已知残余风险（DNS rebinding 理论窗口 + 平台连接层缓解实测）见 _ssrf.js 头部，不得删除。
//
// 隐私：请求经 Cloudflare 边缘瞬时转发。工具页与隐私政策须如实披露（文案属单独授权）。

import { MAX_HEADER_COUNT, MAX_HOPS, TIMEOUT_MS, abortLike, guardTarget, isRedirect, parseTarget } from './_ssrf.js';

const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const MAX_INBOUND_BODY = 2 * 1024 * 1024;
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

async function readJsonPayload(request) {
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return { error: 'Invalid Content-Length header.', status: 400 };
    }
    if (Number(contentLength) > MAX_INBOUND_BODY) {
      return { error: `Request JSON exceeds the ${MAX_INBOUND_BODY} byte limit.`, status: 413 };
    }
  }

  if (!request.body) {
    return { error: 'Request body must be JSON.', status: 400 };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      received += value.byteLength;
      if (received > MAX_INBOUND_BODY) {
        try {
          await reader.cancel();
        }
        catch {
          // The request is already rejected; cancellation is best-effort.
        }
        return { error: `Request JSON exceeds the ${MAX_INBOUND_BODY} byte limit.`, status: 413 };
      }
      chunks.push(value);
    }
  }
  catch {
    return { error: 'Request body could not be read.', status: 400 };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { payload: JSON.parse(text) };
  }
  catch {
    return { error: 'Request body must be valid UTF-8 JSON.', status: 400 };
  }
}

// A successful shared-mode acquire holds a short lease until the relay handler
// finishes. Local mode remains the backward-compatible rollout default until
// the external Worker, Pages binding and secret are configured in Cloudflare.
async function sharedRateLimitIdentity(ip, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('Shared limiter HMAC key is missing or too short.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function acquireRateLimit(request, env) {
  const mode = env?.API_RELAY_RATE_LIMIT_MODE || 'local';
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  if (mode === 'local') {
    if (rateLimited(ip)) {
      return { response: fail('Rate limit exceeded (30 requests per minute per IP). Try again later.', 429) };
    }
    return { release: null };
  }

  if (mode !== 'shared') {
    return { response: fail('The API relay rate-limit configuration is invalid. Please try again later.', 503) };
  }

  const namespace = env?.API_RELAY_LIMITER;
  const secret = env?.API_RELAY_RATE_LIMIT_HMAC_KEY;
  if (!namespace || typeof namespace.idFromName !== 'function' || typeof namespace.get !== 'function' || ip === 'unknown' || !ip || /[\r\n]/.test(ip)) {
    return { response: fail('The API relay is temporarily unavailable because shared abuse protection is not configured.', 503) };
  }

  let stub;
  let leaseId;
  try {
    const identity = await sharedRateLimitIdentity(ip, secret);
    stub = namespace.get(namespace.idFromName(identity));
    leaseId = crypto.randomUUID();
    const response = await stub.fetch('https://limiter.internal/acquire', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leaseId }),
    });
    const decision = await response.json().catch(() => null);

    if (response.status === 429 && decision?.allowed === false) {
      const retryAfter = Math.max(1, Math.min(3600, Math.ceil(Number(decision.retryAfterSeconds) || 1)));
      const message = decision.reason === 'concurrency'
        ? 'Too many API requests are already running for this IP. Wait for one to finish and retry.'
        : 'API request rate limit reached (30 per minute and 10 per 10-second burst per IP). Try again later.';
      return { response: fail(message, 429, { 'retry-after': String(retryAfter) }) };
    }

    if (!response.ok || decision?.allowed !== true) {
      return { response: fail('The API relay is temporarily unavailable because shared abuse protection could not be reached.', 503) };
    }
  }
  catch {
    return { response: fail('The API relay is temporarily unavailable because shared abuse protection could not be reached.', 503) };
  }

  return {
    release: async () => {
      const response = await stub.fetch('https://limiter.internal/release', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leaseId }),
      });
      if (!response.ok) {
        throw new Error('Shared limiter lease release failed.');
      }
    },
  };
}

export async function onRequestPost({ request, env }) {
  let admission;
  try {
    admission = await acquireRateLimit(request, env);
  }
  catch {
    return fail('The API relay is temporarily unavailable because shared abuse protection could not be reached.', 503);
  }

  if (admission.response) {
    return admission.response;
  }

  try {
    return await proxyRequest(request);
  }
  finally {
    if (admission.release) {
      try {
        await admission.release();
      }
      catch {
        // A failed release is bounded by the Durable Object's 20-second lease.
        // Do not replace a response after the upstream request may have run.
      }
    }
  }
}

async function proxyRequest(request) {
  const parsedPayload = await readJsonPayload(request);
  if (parsedPayload.error) {
    return fail(parsedPayload.error, parsedPayload.status);
  }
  const payload = parsedPayload.payload;
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
        // S1.1（外部审查整改）：自动跟随仅限完全相同 Origin（scheme+host+port，
        // 默认端口归一化）。原 S1 仅比 hostname，同主机异端口（不同 Origin）会被
        // 误判为同主机而继续转发凭据/请求体——已收紧。同主机 http→https 升级
        // 也不再自动跟随（Origin 不同），由用户显式重发。
        // 凭据与请求体只发往用户显式指定的目标；重定向目标返回 UI 由用户显式决定是否重发。
        const curUrl = new URL(current);
        const nextUrl = new URL(nextParsed.url);
        const crossOrigin = nextUrl.origin !== curUrl.origin;
        const downgrade = curUrl.protocol === 'https:' && nextUrl.protocol === 'http:';
        if (crossOrigin || downgrade) {
          return Response.json({
            url: current,
            status: resp.status,
            statusText: resp.statusText,
            headers: collectHeaders(resp),
            body: '',
            elapsedMs: Date.now() - started,
            redirect: nextParsed.url,
            followed: false,
            note: downgrade
              ? 'HTTPS-to-HTTP downgrade redirect not auto-followed; credentials and request body were not forwarded.'
              : 'Cross-origin redirect not auto-followed; credentials and request body were not forwarded. Send to the redirect target explicitly if intended.',
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

function fail(message, status, headers = {}) {
  return Response.json({ error: message }, { status, headers });
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
