// Cloudflare Pages Function: /api/whois?domain=example.com
// 域名注册信息查询，基于 RDAP（WHOIS 的官方继任协议，HTTPS + JSON）。
//
// 两处实测结论（与本机 curl 表现不同，务必保留）：
// 1) 不要直连 WHOIS(TCP 43)：Cloudflare 边缘出口下 connect() 能建连
//    （connect/opened 均 ok）但数据面收不到字节（bytes=0），原始 WHOIS 在该环境不可用。
// 2) rdap.org 会按 User-Agent 拦截数据中心请求：Workers 默认 UA 直接 403，
//    必须显式带一个浏览器 UA 才返回 200。

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const RDAP_HEADERS = {
  accept: 'application/rdap+json, application/json',
  'user-agent': BROWSER_UA,
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  const domain = normalize(url.searchParams.get('domain'))
  if (!domain) return Response.json({ error: '无效的域名' }, { status: 400 })

  const enc = encodeURIComponent(domain)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    // 主通道：rdap.org 引导服务（自动跳转到各后缀的权威 RDAP 服务器）
    let resp = await fetch('https://rdap.org/domain/' + enc, {
      headers: RDAP_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })

    // 回退通道：IANA 引导文件 → 权威服务器直连
    if (!resp.ok && resp.status !== 404) {
      const tld = domain.slice(domain.lastIndexOf('.') + 1)
      const base = await rdapBaseFor(tld, controller.signal)
      if (base) {
        resp = await fetch(base + 'domain/' + enc, {
          headers: RDAP_HEADERS,
          redirect: 'follow',
          signal: controller.signal,
        })
      }
    }

    if (resp.status === 404) {
      return Response.json(
        { error: '未找到该域名的注册信息（域名可能尚未注册，或该后缀暂不支持 RDAP）。' },
        { status: 404 },
      )
    }
    if (!resp.ok) {
      return Response.json({ error: '查询失败：RDAP 服务返回 ' + resp.status }, { status: 502 })
    }

    const data = await resp.json()
    return Response.json({ domain, raw: formatRdap(data), source: resp.url })
  } catch (e) {
    const msg = String((e && e.message) || e)
    return Response.json(
      { error: /abort/i.test(msg) ? '查询超时，请稍后重试。' : msg },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}

function normalize(input) {
  const d = (input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d) ? d : ''
}

async function rdapBaseFor(tld, signal) {
  try {
    const r = await fetch('https://data.iana.org/rdap/dns.json', {
      headers: { 'user-agent': BROWSER_UA },
      signal,
    })
    if (!r.ok) return ''
    const j = await r.json()
    for (const svc of j.services || []) {
      const [tlds, urls] = svc
      if (Array.isArray(tlds) && tlds.some((t) => String(t).toLowerCase() === tld)) {
        return Array.isArray(urls) && urls[0] ? String(urls[0]).replace(/\/?$/, '/') : ''
      }
    }
  } catch (_) {
    /* 回退通道失败则忽略 */
  }
  return ''
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
}

function vcardName(entities, role) {
  const list = Array.isArray(entities) ? entities : []
  const hit = list.find((e) => Array.isArray(e.roles) && e.roles.includes(role))
  if (!hit) return ''
  const v = hit.vcardArray && hit.vcardArray[1]
  if (Array.isArray(v)) {
    const fn = v.find((x) => Array.isArray(x) && x[0] === 'fn')
    if (fn && fn[3]) return String(fn[3])
  }
  return hit.handle || ''
}

function formatRdap(data) {
  const lines = []
  const name = data.unicodeName || data.ldhName || ''
  if (name) lines.push('域名          : ' + name)
  if (data.unicodeName && data.ldhName) lines.push('ASCII         : ' + data.ldhName)

  if (Array.isArray(data.status) && data.status.length) {
    lines.push('状态          : ' + data.status.join('、'))
  }

  const registrar = vcardName(data.entities, 'registrar')
  if (registrar) lines.push('注册商        : ' + registrar)

  const map = {
    registration: '注册时间      : ',
    expiration: '到期时间      : ',
    'last changed': '最近更新      : ',
    'last update of RDAP database': 'RDAP 库更新   : ',
    transfer: '转移时间      : ',
  }
  const events = Array.isArray(data.events) ? data.events : []
  for (const ev of events) {
    const label = map[ev.eventAction]
    if (label && ev.eventDate) lines.push(label + fmtDate(ev.eventDate))
  }

  const ns = Array.isArray(data.nameservers)
    ? data.nameservers.map((n) => (n.ldhName || '').toLowerCase()).filter(Boolean)
    : []
  if (ns.length) lines.push('DNS 服务器    : ' + ns.join('、'))

  if (data.secureDNS) {
    lines.push('DNSSEC        : ' + (data.secureDNS.delegationSigned ? '已签名 (signed)' : '未签名 (unsigned)'))
  }

  const registrant = vcardName(data.entities, 'registrant')
  if (registrant) lines.push('注册人        : ' + registrant)

  if (!lines.length) return JSON.stringify(data, null, 2)
  return lines.join('\n')
}
