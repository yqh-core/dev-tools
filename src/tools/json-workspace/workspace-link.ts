/**
 * Deep-link 编解码（WP-003 阶段 A，对标 CyberChef #recipe=&input=）。
 *
 * 状态 = { v:1, nodes:[{op,input?,params}] } → JSON → utf8 → base64url → #w=...
 * 纪律：
 *  - 整条 URL 超过 LINK_LIMIT（8KB）→ 抛 LinkTooLargeError，**绝不静默截断**；
 *  - 解码失败/版本不符/未知 op → 抛 WorkspaceLinkError，不返回半残状态冒充成功；
 *  - 凭据警告由 UI 负责（状态里可能含用户数据，链接持有者可见）。
 */

import { type NodeParams, OP_IDS, type OpId, PARSE_SOURCES, type PipelineNode, TRANSFORM_TARGETS, TYPE_LANGS } from './pipeline';

export const LINK_LIMIT = 8192;

export class WorkspaceLinkError extends Error {}
export class LinkTooLargeError extends WorkspaceLinkError {
  constructor(public readonly size: number) {
    super(`Share link would be ${size} bytes, over the ${LINK_LIMIT}-byte limit. Export the state file instead — nothing was truncated.`);
  }
}

export interface LinkNode { op: OpId; input?: string; params: NodeParams }
export interface LinkState { v: 1; nodes: LinkNode[] }

export function encodeBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 参数白名单清洗：只保留已知键且类型正确，其余丢弃（fail-closed）。 */
function sanitizeParams(raw: unknown): NodeParams {
  if (raw === null || typeof raw !== 'object') {
    return {};
  }
  const r = raw as Record<string, unknown>;
  const p: NodeParams = {};
  if (typeof r.indent === 'number' && Number.isInteger(r.indent) && r.indent >= 0 && r.indent <= 8) {
    p.indent = r.indent;
  }
  if (typeof r.sort === 'boolean') {
    p.sort = r.sort;
  }
  if (typeof r.query === 'string') {
    p.query = r.query;
  }
  if (typeof r.target === 'string' && (TRANSFORM_TARGETS as string[]).includes(r.target)) {
    p.target = r.target as NodeParams['target'];
  }
  if (typeof r.lang === 'string' && (TYPE_LANGS as string[]).includes(r.lang)) {
    p.lang = r.lang as NodeParams['lang'];
  }
  if (typeof r.rootName === 'string') {
    p.rootName = r.rootName;
  }
  if (typeof r.other === 'string') {
    p.other = r.other;
  }
  if (typeof r.source === 'string' && (PARSE_SOURCES as string[]).includes(r.source)) {
    p.source = r.source as NodeParams['source'];
  }
  return p;
}

/** 校验外部状态（deep-link 与状态文件共用）。失败抛错，不静默。 */
export function validateState(obj: unknown): LinkState {
  if (obj === null || typeof obj !== 'object') {
    throw new WorkspaceLinkError('Invalid workspace state: not an object.');
  }
  const o = obj as Record<string, unknown>;
  if (o.v !== 1) {
    throw new WorkspaceLinkError(`Unsupported workspace state version: ${String(o.v)}.`);
  }
  if (!Array.isArray(o.nodes) || o.nodes.length === 0) {
    throw new WorkspaceLinkError('Invalid workspace state: nodes must be a non-empty array.');
  }
  const nodes: LinkNode[] = o.nodes.map((n, i) => {
    if (n === null || typeof n !== 'object') {
      throw new WorkspaceLinkError(`Invalid workspace state: node ${i} is not an object.`);
    }
    const node = n as Record<string, unknown>;
    if (typeof node.op !== 'string' || !(OP_IDS as string[]).includes(node.op)) {
      throw new WorkspaceLinkError(`Invalid workspace state: node ${i} has unknown op "${String(node.op)}".`);
    }
    if (node.input !== undefined && typeof node.input !== 'string') {
      throw new WorkspaceLinkError(`Invalid workspace state: node ${i} input must be a string.`);
    }
    return {
      op: node.op as OpId,
      ...(typeof node.input === 'string' ? { input: node.input } : {}),
      params: sanitizeParams(node.params),
    };
  });
  return { v: 1, nodes };
}

/** 编码整条分享 URL。超限抛 LinkTooLargeError（不截断）。 */
export function encodeLink(nodes: PipelineNode[], base: string): string {
  const state: LinkState = {
    v: 1,
    nodes: nodes.map(n => ({
      op: n.op,
      ...(n.inputOverride !== undefined ? { input: n.inputOverride } : {}),
      params: n.params,
    })),
  };
  const url = `${base}#w=${encodeBase64Url(JSON.stringify(state))}`;
  if (url.length > LINK_LIMIT) {
    throw new LinkTooLargeError(url.length);
  }
  return url;
}

/** 解码 #w=... hash。失败抛 WorkspaceLinkError。 */
export function decodeLink(hash: string): LinkState {
  if (!hash.startsWith('#w=')) {
    throw new WorkspaceLinkError('Not a workspace link: hash must start with #w=.');
  }
  const payload = hash.slice(3);
  if (payload === '') {
    throw new WorkspaceLinkError('Empty workspace link payload.');
  }
  let json: string;
  try {
    json = decodeBase64Url(payload);
  }
  catch {
    throw new WorkspaceLinkError('Workspace link payload is not valid base64url.');
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  }
  catch {
    throw new WorkspaceLinkError('Workspace link payload is not valid JSON.');
  }
  return validateState(obj);
}
