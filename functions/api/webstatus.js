// Cloudflare Pages Function: /api/webstatus?url=example.com
// 由服务端发起请求，规避浏览器 CORS 限制，返回「边缘节点看到的」状态码与响应头。
//
// SSRF 校验链已抽至 ./_ssrf.js（WP-003 阶段 B，与 apiproxy.js 共用同一套）。
// 分层校验语义、已知残余风险（DNS rebinding 理论窗口）与 2026-09-19 实测缓解记录
// 全部保留在 _ssrf.js 头部注释，不得删除。本文件行为与抽取前逐字一致。

import { MAX_HEADER_COUNT, MAX_HOPS, TIMEOUT_MS, abortLike, guardTarget, isRedirect, parseTarget } from './_ssrf.js'

export async function onRequestGet({ request }) {
  const raw = (new URL(request.url).searchParams.get('url') || '').trim()

  const parsed = parseTarget(raw)
  if (parsed.error) return fail(parsed.error, 400)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let current = parsed.url
    let hops = 0

    for (;;) {
      // 每一跳都重跑整套校验（含重新解析 DNS）—— 重定向到私网在这里被拦下
      const guard = await guardTarget(current, controller.signal)
      if (guard.error) return fail(guard.error, 403)

      let resp
      try {
        resp = await send(current, 'HEAD', controller.signal)
      } catch {
        // 部分服务器不支持 HEAD，回退 GET
        try {
          resp = await send(current, 'GET', controller.signal)
        } catch (e) {
          return upstreamFail(e)
        }
      }

      const location = resp.headers.get('location')
      if (isRedirect(resp.status) && location) {
        hops += 1
        if (hops > MAX_HOPS) return fail(`重定向次数超过 ${MAX_HOPS} 次，已停止跟踪`, 400)
        let next
        try {
          next = new URL(location, current).toString()
        } catch {
          return fail('重定向目标不是合法 URL', 502)
        }
        const nextParsed = parseTarget(next)
        if (nextParsed.error) return fail(`重定向被拒绝：${nextParsed.error}`, 403)
        current = nextParsed.url
        continue
      }

      const headers = {}
      let n = 0
      resp.headers.forEach((v, k) => {
        if (n >= MAX_HEADER_COUNT) return
        if (k.toLowerCase() === 'set-cookie') return
        headers[k] = v
        n += 1
      })

      return Response.json({ url: current, status: resp.status, headers })
    }
  } catch (e) {
    return upstreamFail(e)
  } finally {
    clearTimeout(timer)
  }
}

function send(url, method, signal) {
  return fetch(url, {
    method,
    redirect: 'manual',
    signal,
    headers: {
      'user-agent': 'DigDevBox/1.0 (+https://digdevbox.com/)',
      accept: '*/*',
    },
  })
}

function fail(message, status) {
  return Response.json({ error: message }, { status })
}

function upstreamFail(e) {
  return Response.json(
    {
      error: abortLike(e)
        ? '目标站点响应超时，请稍后重试。'
        : '无法连接到目标站点（可能不存在、拒绝访问或网络不可达）。',
    },
    { status: 502 },
  )
}