// Cloudflare Pages Function: /api/webstatus?url=example.com
// 由服务端发起请求，规避浏览器 CORS 限制，返回状态码与响应头。
export async function onRequestGet({ request }) {
  const url = new URL(request.url)
  let target = (url.searchParams.get('url') || '').trim()
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target
  if (!/^https?:\/\//i.test(target)) {
    return Response.json({ error: '无效的 URL' }, { status: 400 })
  }
  try {
    let r
    try {
      r = await fetch(target, {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'user-agent': 'DigDevBox/1.0' },
      })
    } catch {
      // 部分服务器不支持 HEAD，回退到 GET
      r = await fetch(target, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'DigDevBox/1.0' } })
    }
    const headers = {}
    r.headers.forEach((v, k) => { headers[k] = v })
    return Response.json({ url: r.url, status: r.status, headers })
  } catch (e) {
    return Response.json({ error: String((e && e.message) || e) }, { status: 502 })
  }
}
