/**
 * API-004 · 请求参数表 + API-Key 助手（对标 Postman / Hoppscotch 的 Params 与 Auth 页）。
 *
 * 设计边界：
 *  · 纯函数，URL↔参数行双向转换可单测（含往返守恒与负控）；
 *  · 容忍相对 URL / 含 {{var}} 占位 / 无 scheme 的输入，不抛异常；
 *  · 参数名空行跳过；重复键保留（HTTP 允许同键多值）；编码用 URLSearchParams 语义。
 */
import type { KV } from './engine';

/** 从 URL 提取 query 参数行（保序、保留重复键、解码）。无 query → []。 */
export function parseQueryParams(url: string): KV[] {
  const q = queryIndexOf(url);
  if (q < 0) {
    return [];
  }
  let query = url.slice(q + 1);
  const hash = query.indexOf('#');
  if (hash >= 0) {
    query = query.slice(0, hash);
  }
  if (!query) {
    return [];
  }
  const rows: KV[] = [];
  // URLSearchParams 把 + 当空格、按 & 分割、解码 %XX —— 与浏览器一致。
  for (const [name, value] of new URLSearchParams(query)) {
    rows.push({ name, value });
  }
  return rows;
}

/** 用参数行重建 URL 的 query（保留 path 与 hash；空名行跳过；无行则去掉 ?）。 */
export function buildUrlWithQuery(url: string, params: KV[]): string {
  const hashIdx = url.indexOf('#');
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const beforeHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const q = beforeHash.indexOf('?');
  const base = q < 0 ? beforeHash : beforeHash.slice(0, q);
  const sp = new URLSearchParams();
  for (const p of params) {
    if (p.name.trim() !== '') {
      sp.append(p.name, p.value);
    }
  }
  const qs = sp.toString();
  return base + (qs ? `?${qs}` : '') + hash;
}

function queryIndexOf(url: string): number {
  // 只认 hash 之前的 ?（忽略 fragment 里的 ?）。
  const hashIdx = url.indexOf('#');
  const scope = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  return scope.indexOf('?');
}

export type AuthPresetKind = 'bearer' | 'basic' | 'api-key';

/** API-Key / Auth 助手：生成一条认证头。空凭据 → null（不加空头）。 */
export function authHeaderPreset(kind: AuthPresetKind, token: string, username = ''): KV | null {
  const t = token.trim();
  if (!t) {
    return null;
  }
  if (kind === 'bearer') {
    return { name: 'Authorization', value: `Bearer ${t}` };
  }
  if (kind === 'basic') {
    return { name: 'Authorization', value: `Basic ${btoa(`${username}:${t}`)}` };
  }
  return { name: 'X-API-Key', value: t };
}
