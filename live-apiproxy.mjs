/**
 * apiproxy _live 集成证据（Node 直调 onRequestPost，真实 fetch/DoH，无 stub）。
 * 用法: node live-apiproxy.mjs   （在 worktree 目录下跑，ESM import functions）
 * 生产复验: LIVE_BASE=https://digdevbox.com node live-apiproxy.mjs （走真实 TLS，无需 env hack）
 * TLS 说明：日志中 NODE_TLS_REJECT_UNAUTHORIZED=0 警告来自本机 MITM 出口环境变量（脚本继承），
 *   非本脚本设置，也不代表生产 Worker 的 TLS 行为；生产 Worker 在 CF 边缘正常校验 TLS。
 */
import process from 'node:process';
import { onRequestPost } from './functions/api/apiproxy.js';

const LIVE_BASE = process.env.LIVE_BASE || '';

function mk(payload, ip) {
  return new Request('https://digdevbox.com/api/apiproxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(payload),
  });
}

function call(payload, ip) {
  if (LIVE_BASE) {
    return fetch(`${LIVE_BASE}/api/apiproxy`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify(payload),
    });
  }
  return onRequestPost({ request: mk(payload, ip) });
}

const results = [];
async function t(name, payload, ip, expect) {
  const r = await call(payload, ip);
  const j = await r.json().catch(() => null);
  const ok = expect(r.status, j);
  results.push({ name, status: r.status, ok, detail: JSON.stringify(j).slice(0, 160) });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}  [HTTP ${r.status}] ${JSON.stringify(j).slice(0, 120)}\n`);
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
process.stdout.write(`\n==== ${results.length - failed.length}/${results.length} PASS ====\n`);
process.exit(failed.length ? 1 : 0);
