// Cloudflare Pages Function: /api/webstatus?url=example.com
// 由服务端发起请求，规避浏览器 CORS 限制，返回「边缘节点看到的」状态码与响应头。
//
// ── SSRF 防护（对应方案 §8 STEP 5 之 8b / 8c，v1.4.5 重写）────────────────────
// 分层校验，任何一层不过就拒绝，**不只靠平台兜底**：
//   1. 输入    ：协议白名单（仅 http/https）、长度上限、拒绝 URL 内嵌凭据与空白/控制字符
//   2. 主机名  ：拒绝 localhost / *.local / *.internal 等策略后缀，拒绝单标签主机名
//   3. 字面量 IP：按 IP 类型判，覆盖十进制/八进制/十六进制/缩写写法（127.1、2130706433、
//                0x7f.1、0177.0.0.1）与 IPv6（::1、IPv4-mapped、NAT64、6to4 内嵌地址）
//   4. 域名    ：先自己用 DoH 解析一遍，**返回的每个 IP 都必须是公网**，否则拒发请求
//   5. 重定向  ：redirect:'manual'，**每一跳重跑上面整套校验**，最多 MAX_HOPS 跳
//   6. 超时    ：AbortController 12s（与 whois.js 对齐）
//   7. 错误    ：不透出上游报错原文/堆栈；不转发 set-cookie（避免把第三方的凭据性响应头
//                交给任意请求者）
//
// ── 已知残余风险（实测记录，不得删除）─────────────────────────────────────
// Workers 运行时**无法**把出站请求钉在「已校验的那个 IP」上：
//   · fetch() 内部自行解析 DNS；cf.resolveOverride 官方限定「URL host 与覆盖 host 必须同属
//     本 zone」，对用户提交的第三方域名一律被忽略
//     https://developers.cloudflare.com/workers/runtime-apis/request/
//   · connect()（cloudflare:sockets）虽可直连 IP，但 SocketOptions 只有 secureTransport /
//     allowHalfOpen，**没有 SNI / servername 字段**；直连 IP 会让 TLS 的 SNI 变成 IP，
//     vhost 与证书全部不匹配。官方也明确要求「80/443 要发 HTTP 请求就用 fetch」
//     https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
// 因此「校验过的 IP」与「真正建连的 IP」之间理论上有窗口（DNS rebinding / TOCTOU）。
//
// 实测缓解（2026-09-19，probe-rebinding.py 脚本，12 次采样）：
//   用 rbndr.us 构造「同一域名交替返回 127.0.0.1 / 1.1.1.1」，
//   解析到私网的请求被 Cloudflare 边缘 403 拦下、解析到公网的正常建连（409）——
//   即平台在**连接目标层**拦私网，与是否字面量无关。
//   => 残余窗口在当前平台上无法真正打到内网；但本文件不把安全性建立在平台行为上，
//      应用层校验照做，且拒绝时返回本站自己的错误体（可据此区分「应用层拒绝」与「平台拒绝」）。

const MAX_URL_LEN = 2048
const TIMEOUT_MS = 12000
const MAX_HOPS = 3
const MAX_HEADER_COUNT = 60

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

const BLOCKED_HOST_EXACT = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
])
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.cluster.local',
  '.in-addr.arpa',
  '.ip6.arpa',
]

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

/* ── 1. 输入层 ─────────────────────────────────────────────────────────── */

function parseTarget(raw) {
  if (!raw) return { error: '请提供要检测的 URL' }
  if (raw.length > MAX_URL_LEN) return { error: `URL 过长（上限 ${MAX_URL_LEN} 字符）` }
  // 空白 / 控制字符一律拒绝：可用于绕过前缀匹配或注入请求头
  if (/[\u0000-\u0020\u007f]/.test(raw)) return { error: 'URL 含空白或控制字符' }

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw

  let u
  try {
    u = new URL(candidate)
  } catch {
    return { error: '无效的 URL' }
  }
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    return { error: `不支持的协议 ${u.protocol.replace(':', '')}（仅允许 http / https）` }
  }
  if (u.username || u.password) return { error: 'URL 不允许包含用户名或密码' }
  if (!u.hostname) return { error: 'URL 缺少主机名' }

  return { url: u.toString() }
}

/* ── 2. 目标校验：字面量 IP → 直接判类型；域名 → DoH 预解析后判全部结果 ── */

async function guardTarget(rawUrl, signal) {
  const host = normalizeHost(new URL(rawUrl).hostname)
  if (!host) return { error: '主机名不合法' }

  // 先判 IP 字面量，再套主机名策略 —— 顺序不能反：
  // 公共 IPv6 字面量（如 2606:4700::1111）不含 "."，若先走「单标签主机名」策略会被误拒。
  const v4 = parseIpv4(host)
  if (v4 !== null) {
    return isBlockedIpv4(v4)
      ? { error: `目标 IP ${host} 属于私网 / 保留地址，已拒绝` }
      : { ok: true }
  }

  const v6 = parseIpv6(host)
  if (v6 !== null) {
    return isBlockedIpv6(v6)
      ? { error: `目标 IP ${host} 属于私网 / 保留地址，已拒绝` }
      : { ok: true }
  }

  if (isBlockedHostname(host)) return { error: `目标主机 ${host} 不被允许访问` }

  // 域名：先解析，全部结果都必须是公网
  let ips
  try {
    ips = await resolveHost(host, signal)
  } catch (e) {
    return { error: abortLike(e) ? '解析目标域名超时' : `无法解析目标域名 ${host}` }
  }
  if (!ips.length) return { error: `目标域名 ${host} 没有解析到任何地址` }

  for (const ip of ips) {
    if (isBlockedAddress(ip)) {
      return { error: `目标域名 ${host} 解析到私网 / 保留地址 ${ip}，已拒绝` }
    }
  }
  return { ok: true }
}

function isBlockedAddress(ip) {
  const v4 = parseIpv4(ip)
  if (v4 !== null) return isBlockedIpv4(v4)
  const v6 = parseIpv6(ip)
  if (v6 !== null) return isBlockedIpv6(v6)
  return true // 认不出来的一律按不安全处理
}

function normalizeHost(host) {
  let h = String(host || '').trim().toLowerCase()
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1) // IPv6 字面量
  while (h.endsWith('.')) h = h.slice(0, -1) // 根点
  return h
}

function isBlockedHostname(host) {
  if (BLOCKED_HOST_EXACT.has(host)) return true
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true
  if (!host.includes('.')) return true // 单标签主机名（内网短名）一律拒绝
  return false
}

/* ── 3. IPv4：按 inet_aton 语义，支持 1~4 段与十进制/八进制/十六进制 ── */

function parseIpv4(input) {
  const s = String(input).trim()
  if (!/^[0-9a-fx.]+$/i.test(s)) return null
  const parts = s.split('.')
  if (parts.length === 0 || parts.length > 4) return null
  if (parts.some((p) => p === '')) return null

  const nums = []
  for (const p of parts) {
    let n
    if (/^0[xX][0-9a-f]+$/i.test(p)) n = parseInt(p.slice(2), 16)
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p.slice(1), 8)
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10)
    else return null
    if (!Number.isFinite(n) || n < 0) return null
    nums.push(n)
  }

  const k = nums.length
  for (let i = 0; i < k - 1; i++) {
    if (nums[i] > 255) return null
  }
  const lastShift = 8 * (4 - (k - 1))
  if (nums[k - 1] > Math.pow(2, lastShift) - 1) return null

  let head = 0
  for (let i = 0; i < k - 1; i++) head = head * 256 + nums[i]
  const value = head * Math.pow(2, lastShift) + nums[k - 1]
  if (value < 0 || value > 0xffffffff) return null
  return value >>> 0
}

// 私网 / 保留 / 特殊用途 IPv4 段
const BLOCKED_V4_CIDRS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

function isBlockedIpv4(v) {
  return BLOCKED_V4_CIDRS.some(([base, bits]) => {
    const b = parseIpv4(base)
    if (b === null) return false
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return ((v & mask) >>> 0) === ((b & mask) >>> 0)
  })
}

/* ── 4. IPv6 ──────────────────────────────────────────────────────────── */

function parseIpv6(input) {
  const s = String(input).trim()
  if (!s.includes(':')) return null
  let body = s
  if (body.includes('%')) body = body.slice(0, body.indexOf('%')) // zone id

  // 内嵌 IPv4（::ffff:1.2.3.4 / ::1.2.3.4）
  let tail = null
  const lastColon = body.lastIndexOf(':')
  if (body.slice(lastColon + 1).includes('.')) {
    const v4 = parseIpv4(body.slice(lastColon + 1))
    if (v4 === null) return null
    tail = [(v4 >>> 16) & 0xffff, v4 & 0xffff]
    body = body.slice(0, lastColon + 1) + '0:0'
  }

  const [head, rest] = body.split('::')
  const left = head ? head.split(':').filter((x) => x !== '') : []
  const right = rest !== undefined ? (rest ? rest.split(':').filter((x) => x !== '') : []) : null

  const parseGroups = (arr) => {
    const out = []
    for (const g of arr) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }
  const l = parseGroups(left)
  const r = right === null ? [] : parseGroups(right)
  if (l === null || r === null) return null

  let groups
  if (right === null) {
    groups = l
  } else {
    const fill = 8 - l.length - r.length
    if (fill < 0) return null
    groups = [...l, ...new Array(fill).fill(0), ...r]
  }
  if (tail) groups.splice(8 - tail.length, tail.length, ...tail)
  return groups.length === 8 ? groups : null
}

function isBlockedIpv6(g) {
  if (!g || g.length !== 8) return true
  if (g.every((x) => x === 0)) return true // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true // fc00::/7 ULA
  if ((g[0] & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true // 2001:db8::/32 文档用
  const emb = ((g[6] << 16) | g[7]) >>> 0
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIpv4(emb) // ::ffff:0:0/96
  if (g[0] === 0x0064 && g[1] === 0xff9b) return isBlockedIpv4(emb) // 64:ff9b::/96 NAT64
  if (g[0] === 0x2002) return isBlockedIpv4(((g[1] << 16) | g[2]) >>> 0) // 2002::/16 6to4
  return false
}

/* ── 5. DoH 预解析（带第二家服务商兜底） ──────────────────────────────── */

const DOH_PROVIDERS = [
  (name, type) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
  (name, type) => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
]

async function resolveHost(host, signal) {
  const out = new Set()
  let lastErr = null
  let answered = false

  for (const make of DOH_PROVIDERS) {
    for (const type of ['A', 'AAAA']) {
      try {
        const r = await fetch(make(host, type), {
          headers: { accept: 'application/dns-json' },
          signal,
        })
        if (!r.ok) throw new Error('DoH HTTP ' + r.status)
        const j = await r.json()
        answered = true
        const want = type === 'A' ? 1 : 28
        for (const ans of j.Answer || []) {
          if (ans && ans.type === want && typeof ans.data === 'string') out.add(ans.data)
        }
      } catch (e) {
        lastErr = e
        if (abortLike(e)) throw e
      }
    }
    if (out.size) return [...out]
  }

  // 一家都没答复 → 视为基础设施故障，抛出去让上层给出「解析失败」而非「没有地址」
  if (!answered && lastErr) throw lastErr
  return []
}

/* ── 6. 发请求 / 工具 ─────────────────────────────────────────────────── */

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

function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function abortLike(e) {
  return /abort|timeout|timed out/i.test(String((e && e.message) || e))
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
