/**
 * apiproxy _live 集成证据（Node 直调 onRequestPost，真实 fetch/DoH，无 stub）。
 * 用法: node live-apiproxy.mjs   （在 ws-api 目录下跑，ESM import functions）
 */
import { onRequestPost } from './functions/api/apiproxy.js';

const mk = (payload, ip) => new Request('https://digdevbox.com/api/apiproxy', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
  body: JSON.stringify(payload),
});

const results = [];
async function t(name, payload, ip, expect) {
  const r = await onRequestPost({ request: mk(payload, ip) });
  const j = await r.json().catch(() => null);
  const ok = expect(r.status, j);
  results.push({ name, status: r.status, ok, detail: JSON.stringify(j).slice(0, 160) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  [HTTP ${r.status}] ${JSON.stringify(j).slice(0, 120)}`);
}

// 本地出口只放行 SNI 域名 TLS：纯 IP 连接与 DoH 均被网络层阻断（curl 四组合实测）。
// 因此本地无法证明"发送成功"，只能证明 fail-closed：不可达目标绝不返回 200。
// 发送成功路径留待生产边缘（CF egress + DoH 可用）部署后复验。
await t('live unreachable target fail-closed (never 200)', { url: 'https://8.8.8.8/resolve?name=example.com&type=A', method: 'GET' }, '203.0.113.10', s => s !== 200);
await t('live SSRF 169.254.169.254', { url: 'http://169.254.169.254/' }, '203.0.113.11', s => s === 403);
await t('live SSRF 127.1 shorthand', { url: 'http://127.1/' }, '203.0.113.12', s => s === 403);
await t('live SSRF decimal 2130706433', { url: 'http://2130706433/' }, '203.0.113.13', s => s === 403);
await t('live SSRF metadata host', { url: 'http://metadata.google.internal/' }, '203.0.113.14', s => s === 403);
await t('live SSRF IPv6 ::1', { url: 'http://[::1]/' }, '203.0.113.15', s => s === 403);
await t('live method TRACE rejected', { url: 'https://example.com/', method: 'TRACE' }, '203.0.113.16', s => s === 405);
await t('live redirect-to-private never returns 200', { url: 'https://httpbin.org/redirect-to?url=http%3A%2F%2F127.0.0.1%2F&status_code=302' }, '203.0.113.17', s => s !== 200);

const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} PASS ====`);
process.exit(failed.length ? 1 : 0);