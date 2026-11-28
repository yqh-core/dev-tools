/**
 * WS-1 请求引擎（WP-003 阶段 B）：变量替换、分享脱敏、响应→WS-2 直传。
 *
 * 安全边界（yqh 裁定 + advisor 清单）：
 *  · 分享链接**默认剔除凭据**（authorization/cookie/x-api-key/proxy-authorization 与 URL 内嵌账号密码），v1 不提供带凭据分享选项；
 *  · 埋点不携带 token/请求体/响应体（本工作台本轮不接埋点，测量客户端冻结）；
 *  · 请求/响应体不发送服务端存储（apiproxy 仅瞬时转发）。
 */

import { makeNode } from '../json-workspace/pipeline-defs';
import { LinkTooLargeError, encodeLink } from '../json-workspace/workspace-link';

export interface KV { name: string; value: string }

export type RequestAuthConfig =
  | { type: 'none' }
  | { type: 'bearer'; token: string }
  | { type: 'basic'; username: string; password: string }
  | { type: 'api-key-header' | 'api-key-query'; key: string; value: string };

export interface ApiRequestState {
  method: string
  url: string
  headers: KV[]
  body: string
  /** Per-request auth intent; effective credentials are derived only at explicit Send/Run. */
  auth?: RequestAuthConfig
}

export interface AuthCollision {
  target: 'header' | 'query'
  name: string
}

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
  const { auth: _auth, ...safeRequest } = req;
  return {
    ...safeRequest,
    url,
    headers: req.headers.filter(h => !AUTH_HEADER_NAMES.includes(h.name.trim().toLowerCase())),
  };
}

/** Validate the persisted auth union without accepting unknown credential fields. */
export function isRequestAuthConfig(value: unknown): value is RequestAuthConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const auth = value as Record<string, unknown>;
  const stringField = (name: string, max = 20000) => typeof auth[name] === 'string' && (auth[name] as string).length <= max;
  if (auth.type === 'none') {
    return Object.keys(auth).every(key => key === 'type');
  }
  if (auth.type === 'bearer') {
    return Object.keys(auth).every(key => key === 'type' || key === 'token') && stringField('token');
  }
  if (auth.type === 'basic') {
    return Object.keys(auth).every(key => key === 'type' || key === 'username' || key === 'password')
      && stringField('username') && stringField('password');
  }
  if (auth.type === 'api-key-header' || auth.type === 'api-key-query') {
    return Object.keys(auth).every(key => key === 'type' || key === 'key' || key === 'value')
      && stringField('key', 1024) && stringField('value');
  }
  return false;
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function queryKeyExists(url: string, key: string): boolean {
  const hash = url.indexOf('#');
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const query = beforeHash.indexOf('?');
  if (query < 0) {
    return false;
  }
  return [...new URLSearchParams(beforeHash.slice(query + 1)).keys()].includes(key);
}

function removeQueryKey(url: string, key: string): string {
  const hash = url.indexOf('#');
  const fragment = hash < 0 ? '' : url.slice(hash);
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const query = beforeHash.indexOf('?');
  if (query < 0) {
    return url;
  }
  const base = beforeHash.slice(0, query);
  const kept = beforeHash.slice(query + 1).split('&').filter((part) => {
    if (!part) {
      return false;
    }
    const rawName = part.split('=', 1)[0];
    let name = rawName;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, ' '));
    }
    catch {
      // Retain malformed name as entered.
    }
    return name !== key;
  });
  return base + (kept.length ? `?${kept.join('&')}` : '') + fragment;
}

function appendQueryValue(url: string, key: string, value: string): string {
  const hash = url.indexOf('#');
  const fragment = hash < 0 ? '' : url.slice(hash);
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const query = beforeHash.indexOf('?');
  const base = query < 0 ? beforeHash : beforeHash.slice(0, query);
  const existing = query < 0 ? '' : beforeHash.slice(query + 1);
  const encoded = new URLSearchParams([[key, value]]).toString();
  const separator = !existing ? '' : existing.endsWith('&') ? '' : '&';
  return `${base}?${existing}${separator}${encoded}${fragment}`;
}

function mergeMissing(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

/** Hide generated API-key query values in UI/progress URLs without changing the actual send payload. */
export function redactAuthQueryUrl(
  url: string,
  auth: RequestAuthConfig | undefined,
  env: Record<string, string>,
): string {
  if (!auth || auth.type !== 'api-key-query') {
    return url;
  }
  const resolvedKey = substituteVars(auth.key, env);
  if (resolvedKey.missing.length || !resolvedKey.text) {
    return url;
  }
  const hash = url.indexOf('#');
  const fragment = hash < 0 ? '' : url.slice(hash);
  const beforeHash = hash < 0 ? url : url.slice(0, hash);
  const query = beforeHash.indexOf('?');
  if (query < 0) {
    return url;
  }
  const masked = beforeHash.slice(query + 1).split('&').map((part) => {
    const equal = part.indexOf('=');
    const rawName = equal < 0 ? part : part.slice(0, equal);
    let name = rawName;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, ' '));
    }
    catch {
      // Keep malformed parameter name.
    }
    return name === resolvedKey.text ? `${rawName}=[REDACTED]` : part;
  });
  return `${beforeHash.slice(0, query + 1)}${masked.join('&')}${fragment}`;
}

/** Redact resolved auth fields from UI/error text without changing the request payload. */
export function redactAuthSensitiveText(
  text: string,
  auth: RequestAuthConfig | undefined,
  env: Record<string, string>,
): string {
  if (!auth || auth.type === 'none' || !text) {
    return text;
  }
  const values = auth.type === 'bearer'
    ? [auth.token]
    : auth.type === 'basic'
      ? [auth.username, auth.password, `Basic ${encodeBase64Utf8(`${substituteVars(auth.username, env).text}:${substituteVars(auth.password, env).text}`)}`]
      : [auth.value];
  let safe = text;
  for (const raw of values) {
    if (!raw) {
      continue;
    }
    const resolved = substituteVars(raw, env);
    if (resolved.missing.length || !resolved.text || /^\s*\{\{/.test(resolved.text)) {
      continue;
    }
    safe = safe.split(resolved.text).join('[REDACTED]');
  }
  return safe;
}

/** Assemble an apiproxy payload. Auth remains persisted as intent; credentials are transient here. */
export function buildProxyPayload(
  req: ApiRequestState,
  env: Record<string, string>,
  options: { authCollision?: 'replace' | 'keep-manual' } = {},
): { payload: { url: string; method: string; headers: KV[]; body: string }; missing: string[]; collision?: AuthCollision; error?: string } {
  const u = substituteVars(req.url, env);
  const b = substituteVars(req.body, env);
  const missing = [...u.missing];
  mergeMissing(missing, b.missing);
  const headers: KV[] = req.headers.map((header) => {
    const resolved = substituteVars(header.value, env);
    mergeMissing(missing, resolved.missing);
    return { name: header.name, value: resolved.text };
  });
  let url = u.text;
  const auth = req.auth;
  if (!auth || auth.type === 'none') {
    return { payload: { url, method: req.method, headers, body: b.text }, missing };
  }

  const resolve = (value: string) => {
    const result = substituteVars(value, env);
    mergeMissing(missing, result.missing);
    return result.text;
  };

  if (auth.type === 'bearer' || auth.type === 'basic') {
    const username = auth.type === 'basic' ? resolve(auth.username) : '';
    const credential = auth.type === 'basic' ? resolve(auth.password) : resolve(auth.token);
    const value = auth.type === 'basic'
      ? (username || credential ? `Basic ${encodeBase64Utf8(`${username}:${credential}`)}` : '')
      : (credential ? `Bearer ${credential}` : '');
    if ((auth.type === 'bearer' && !credential) || (auth.type === 'basic' && !username && !credential)) {
      return {
        payload: { url, method: req.method, headers, body: b.text },
        missing,
        error: 'Enter a Basic Auth username or password, or reference an environment variable, before sending.',
      };
    }
    if (/[\r\n]/.test(value)) {
      return { payload: { url, method: req.method, headers, body: b.text }, missing, error: 'Authentication header values cannot contain CR or LF characters.' };
    }
    const name = 'Authorization';
    const collision = headers.some(header => header.name.trim().toLowerCase() === name.toLowerCase())
      ? { target: 'header' as const, name }
      : undefined;
    if (collision && !options.authCollision) {
      return { payload: { url, method: req.method, headers, body: b.text }, missing, collision };
    }
    if (collision && options.authCollision === 'keep-manual') {
      return { payload: { url, method: req.method, headers, body: b.text }, missing };
    }
    const nextHeaders = collision
      ? headers.filter(header => header.name.trim().toLowerCase() !== name.toLowerCase())
      : [...headers];
    nextHeaders.push({ name, value });
    return { payload: { url, method: req.method, headers: nextHeaders, body: b.text }, missing };
  }

  const name = resolve(auth.key).trim();
  const value = resolve(auth.value);
  if (!name || !value) {
    return {
      payload: { url, method: req.method, headers, body: b.text },
      missing,
      error: 'Enter an API key name and value or reference an environment variable before sending.',
    };
  }
  if (/[\r\n]/.test(name) || (auth.type === 'api-key-header' && /[\r\n]/.test(value))) {
    return { payload: { url, method: req.method, headers, body: b.text }, missing, error: 'Authentication header names and values cannot contain CR or LF characters.' };
  }
  if (auth.type === 'api-key-header' && !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name)) {
    return { payload: { url, method: req.method, headers, body: b.text }, missing, error: 'The API key header name is not a valid HTTP field name.' };
  }

  if (auth.type === 'api-key-header') {
    const collision = headers.some(header => header.name.trim().toLowerCase() === name.toLowerCase())
      ? { target: 'header' as const, name }
      : undefined;
    if (collision && !options.authCollision) {
      return { payload: { url, method: req.method, headers, body: b.text }, missing, collision };
    }
    if (collision && options.authCollision === 'keep-manual') {
      return { payload: { url, method: req.method, headers, body: b.text }, missing };
    }
    const nextHeaders = collision
      ? headers.filter(header => header.name.trim().toLowerCase() !== name.toLowerCase())
      : [...headers];
    nextHeaders.push({ name, value });
    return { payload: { url, method: req.method, headers: nextHeaders, body: b.text }, missing };
  }

  const collision = queryKeyExists(url, name) ? { target: 'query' as const, name } : undefined;
  if (collision && !options.authCollision) {
    return { payload: { url, method: req.method, headers, body: b.text }, missing, collision };
  }
  if (collision && options.authCollision === 'keep-manual') {
    return { payload: { url, method: req.method, headers, body: b.text }, missing };
  }
  if (collision) {
    url = removeQueryKey(url, name);
  }
  url = appendQueryValue(url, name, value);
  return { payload: { url, method: req.method, headers, body: b.text }, missing };
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
