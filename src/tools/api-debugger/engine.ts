/**
 * WS-1 请求引擎（WP-003 阶段 B）：变量替换、分享脱敏、响应→WS-2 直传。
 *
 * 安全边界（yqh 裁定 + advisor 清单）：
 *  · 分享链接**默认剔除凭据**（authorization/cookie/x-api-key/proxy-authorization 与 URL 内嵌账号密码），v1 不提供带凭据分享选项；
 *  · 埋点不携带 token/请求体/响应体（本工作台本轮不接埋点，测量客户端冻结）；
 *  · 请求/响应体不发送服务端存储（apiproxy 仅瞬时转发）。
 */

import { makeNode } from '../json-workspace/pipeline';
import { LinkTooLargeError, encodeLink } from '../json-workspace/workspace-link';

export interface KV { name: string; value: string }
export interface ApiRequestState { method: string; url: string; headers: KV[]; body: string }

export const AUTH_HEADER_NAMES = ['authorization', 'cookie', 'x-api-key', 'proxy-authorization'];
export const HANDOFF_KEY = 'digdevbox:ws-handoff';

/** {{name}} 替换；缺失变量保留原样并列出（不静默吞）。 */
export function substituteVars(text: string, env: Record<string, string>): { text: string; missing: string[] } {
  const missing: string[] = [];
  const out = text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (whole, name: string) => {
    if (Object.prototype.hasOwnProperty.call(env, name)) {
      return env[name];
    }
    if (!missing.includes(name)) {
      missing.push(name);
    }
    return whole;
  });
  return { text: out, missing };
}

/** 分享脱敏：剔除凭据头与 URL 内嵌凭据。 */
export function sanitizeForShare(req: ApiRequestState): ApiRequestState {
  let url = req.url;
  try {
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = '';
      u.password = '';
      url = u.toString();
    }
  }
  catch {
    // 非法 URL 原样保留（发送时会报错），脱敏不掩盖输入问题
  }
  return {
    ...req,
    url,
    headers: req.headers.filter(h => !AUTH_HEADER_NAMES.includes(h.name.trim().toLowerCase())),
  };
}

/** 组装 apiproxy payload（变量替换后）。 */
export function buildProxyPayload(req: ApiRequestState, env: Record<string, string>): { payload: { url: string; method: string; headers: KV[]; body: string }; missing: string[] } {
  const u = substituteVars(req.url, env);
  const b = substituteVars(req.body, env);
  const missing = [...u.missing];
  const headers = req.headers.map((h) => {
    const r = substituteVars(h.value, env);
    for (const m of r.missing) {
      if (!missing.includes(m)) {
        missing.push(m);
      }
    }
    return { name: h.name, value: r.text };
  });
  for (const m of b.missing) {
    if (!missing.includes(m)) {
      missing.push(m);
    }
  }
  return { payload: { url: u.text, method: req.method, headers, body: b.text }, missing };
}

/** 响应体 → WS-2 deep-link；超 8KB 返回 null（调用方改走 localStorage handoff）。 */
export function responseToWorkspaceLink(body: string, origin: string): string | null {
  try {
    return encodeLink([makeNode('format', body, { indent: 2, sort: false })], `${origin}/json-workspace`);
  }
  catch (e) {
    if (e instanceof LinkTooLargeError) {
      return null;
    }
    throw e;
  }
}

/** 大响应 handoff：写 localStorage，WS-2 挂载时消费一次即删。 */
export function stashHandoff(body: string): void {
  localStorage.setItem(HANDOFF_KEY, JSON.stringify({ v: 1, nodes: [{ op: 'format', input: body, params: { indent: 2, sort: false } }] }));
}
