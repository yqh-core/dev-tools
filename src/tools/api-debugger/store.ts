/**
 * API-006 请求历史与集合（WP-A 批1）。
 *
 * 设计边界：
 *  · 纯函数核心 + 存储适配分离，全部逻辑可单测（含负控）；
 *  · 历史/集合只存本机 localStorage，凭据不出本机；导出/分享一律走 sanitizeForShare
 *    （剔除凭据头与 URL 内嵌凭据；请求 body 原样保留——导出/分享提示已明示该边界）；
 *  · 不接埋点（测量客户端冻结），不改 apiproxy，不动 WS-2。
 */

import type { ApiRequestState } from './engine';
import { sanitizeForShare } from './engine';

export interface HistoryEntry {
  id: string
  at: number
  request: ApiRequestState
  status: number | null
  elapsedMs: number | null
  error?: string
}

export interface SavedRequest {
  id: string
  name: string
  request: ApiRequestState
  createdAt: number
  updatedAt: number
}

export const HISTORY_CAP = 50;
export const SAVED_CAP = 100;
export const NAME_MAX = 80;

export function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n.length <= NAME_MAX;
}

/** 新条目置顶；超出上限截断最旧。不修改入参。 */
export function pushHistory(list: HistoryEntry[], entry: HistoryEntry, cap: number = HISTORY_CAP): HistoryEntry[] {
  return [entry, ...list].slice(0, Math.max(0, cap));
}

export function removeHistory(list: HistoryEntry[], id: string): HistoryEntry[] {
  return list.filter(e => e.id !== id);
}

/** 保存快照深拷贝（外部审查整改 API-006a）：
 *  调用方传入的可能是响应式活引用（headers 数组后续会被原地编辑），
 *  直接存引用会让已保存集合随后续编辑静默变化。method/url/body 为字符串不可变，
 *  headers 逐项拷贝即可切断共享。 */
export function cloneRequest(request: ApiRequestState): ApiRequestState {
  return { ...request, headers: request.headers.map(h => ({ ...h })) };
}

/** 保存当前请求；同名（trim 后大小写不敏感）覆盖更新，保留原 id/createdAt。
 *  入参请求一律深拷贝为快照，保存后与原请求彻底解耦。 */
export function saveRequest(
  list: SavedRequest[],
  name: string,
  request: ApiRequestState,
  now: number,
  newId: string,
  cap: number = SAVED_CAP,
): { list: SavedRequest[]; saved: SavedRequest | null; error?: string } {
  if (!isValidName(name)) {
    return { list, saved: null, error: `Name must be 1-${NAME_MAX} characters.` };
  }
  const trimmed = name.trim();
  const snapshot = cloneRequest(request);
  const i = list.findIndex(s => s.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (i >= 0) {
    const updated: SavedRequest = { ...list[i], name: trimmed, request: snapshot, updatedAt: now };
    const next = [...list];
    next[i] = updated;
    return { list: next, saved: updated };
  }
  if (list.length >= cap) {
    return { list, saved: null, error: `Collection is full (${cap}). Delete an entry first.` };
  }
  const saved: SavedRequest = { id: newId, name: trimmed, request: snapshot, createdAt: now, updatedAt: now };
  return { list: [saved, ...list], saved };
}

export function removeSaved(list: SavedRequest[], id: string): SavedRequest[] {
  return list.filter(s => s.id !== id);
}

export function renameSaved(list: SavedRequest[], id: string, name: string, now: number): { list: SavedRequest[]; error?: string } {
  if (!isValidName(name)) {
    return { list, error: `Name must be 1-${NAME_MAX} characters.` };
  }
  const trimmed = name.trim();
  const clash = list.some(s => s.id !== id && s.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (clash) {
    return { list, error: 'Another saved request already uses this name.' };
  }
  return { list: list.map(s => s.id === id ? { ...s, name: trimmed, updatedAt: now } : s) };
}

/** 导出用：集合导出与分享同策略——凭据默认剔除。 */
export function exportSavedRequest(saved: SavedRequest): ApiRequestState {
  return sanitizeForShare(saved.request);
}

function isKVArray(v: unknown): v is { name: string; value: string }[] {
  return Array.isArray(v) && v.every(h => h && typeof h === 'object' && typeof (h as any).name === 'string' && typeof (h as any).value === 'string');
}

function isRequest(v: unknown): v is ApiRequestState {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const r = v as Record<string, unknown>;
  return typeof r.method === 'string' && typeof r.url === 'string' && typeof r.body === 'string' && isKVArray(r.headers);
}

/** 损坏/版本不符/结构非法 → 返回空列表（不抛错、不静默接受脏数据）。 */
export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((e): e is HistoryEntry => {
    if (!e || typeof e !== 'object') {
      return false;
    }
    const h = e as Record<string, unknown>;
    return typeof h.id === 'string' && typeof h.at === 'number' && isRequest(h.request)
      && (h.status === null || typeof h.status === 'number')
      && (h.elapsedMs === null || typeof h.elapsedMs === 'number')
      && (h.error === undefined || typeof h.error === 'string');
  }).slice(0, HISTORY_CAP);
}

export function parseSaved(raw: unknown): SavedRequest[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: SavedRequest[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') {
      continue;
    }
    const s = e as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.createdAt !== 'number' || typeof s.updatedAt !== 'number' || !isRequest(s.request)) {
      continue;
    }
    if (seen.has(s.id)) {
      continue;
    }
    seen.add(s.id);
    out.push({ id: s.id, name: s.name, request: s.request as ApiRequestState, createdAt: s.createdAt, updatedAt: s.updatedAt });
    if (out.length >= SAVED_CAP) {
      break;
    }
  }
  return out;
}
