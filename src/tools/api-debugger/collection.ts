/**
 * API-010 · Postman Collection v2.1 导入/导出（与 API-008 OpenAPI 互补的互操作能力）。
 *
 * 导出：saved 集合 → Postman v2.1 JSON。默认剔除认证头（与工具「导出脱敏」隐私边界一致），
 * 可关。url 尽量拆成 Postman 的 host/path/query 结构；相对/含 {{var}} 的 URL 保留 raw。
 * 导入：Postman JSON → 请求集合；嵌套 folder 递归展平（名以「父 / 子」拼接）；
 * url 兼容字符串与 {raw} 对象；非法/空输入转 warnings 不崩溃。
 */
import type { ApiRequestState, KV } from './engine';
import { sanitizeForShare } from './engine';
import type { SavedRequest } from './store';
import type { ImportedRequest } from './openapi';

/** Postman v2.1 的 pre-request/test 事件文本（folder 继承后的合并结果）。 */
export interface ScriptEvents { prerequest?: string; test?: string }

export const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function toPostmanUrl(raw: string): Record<string, unknown> {
  try {
    const u = new URL(raw);
    return {
      raw,
      host: u.hostname.split('.'),
      path: u.pathname.replace(/^\//, '').split('/').filter(Boolean),
      query: [...u.searchParams].map(([key, value]) => ({ key, value })),
    };
  }
  catch {
    return { raw };
  }
}

export function exportCollection(saved: SavedRequest[], name = 'DigDevBox Collection', stripAuth = true): Record<string, unknown> {
  return {
    info: { name, schema: POSTMAN_SCHEMA },
    item: saved.map((s) => {
      const req: ApiRequestState = stripAuth ? sanitizeForShare(s.request) : s.request;
      return {
        name: s.name,
        request: {
          method: req.method,
          header: req.headers.map(h => ({ key: h.name, value: h.value })),
          url: toPostmanUrl(req.url),
          ...(req.body ? { body: { mode: 'raw', raw: req.body } } : {}),
        },
      };
    }),
  };
}

export function importCollection(text: string): { requests: ImportedRequest[]; warnings: string[] } {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { requests: [], warnings: ['Empty input.'] };
  }
  let doc: any;
  try {
    doc = JSON.parse(trimmed);
  }
  catch (e) {
    return { requests: [], warnings: [`Not valid JSON: ${String(e).slice(0, 100)}`] };
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.item)) {
    return { requests: [], warnings: ['Not a Postman collection (missing item array).'] };
  }
  const requests: ImportedRequest[] = [];
  const extractEvents = (item: any, inherited: ScriptEvents | null): ScriptEvents | null => {
    const out: ScriptEvents = {};
    const take = (evs: any[], listen: 'prerequest' | 'test'): string | undefined => {
      const parts: string[] = [];
      for (const ev of evs) {
        if (ev && ev.listen === listen && ev.script) {
          const exec = Array.isArray(ev.script.exec) ? ev.script.exec : (typeof ev.script.exec === 'string' ? [ev.script.exec] : []);
          const body = exec.filter((l: unknown) => typeof l === 'string').join('\n');
          if (body.trim()) parts.push(body);
        }
      }
      return parts.length ? parts.join('\n') : undefined;
    };
    const evs = Array.isArray(item?.event) ? item.event : [];
    // Postman 执行序：folder 继承在前、request 自身在后
    const pre = [inherited?.prerequest, take(evs, 'prerequest')].filter(Boolean).join('\n');
    const test = [inherited?.test, take(evs, 'test')].filter(Boolean).join('\n');
    if (pre) out.prerequest = pre;
    if (test) out.test = test;
    return (out.prerequest || out.test) ? out : null;
  };

  const walk = (items: any[], prefix: string, inherited: ScriptEvents | null = null) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        continue;
      }
      const name = prefix ? `${prefix} / ${it.name ?? 'item'}` : String(it.name ?? 'item');
      if (Array.isArray(it.item)) {
        walk(it.item, name, extractEvents(it, inherited));
        continue;
      }
      const req = it.request;
      if (!req || typeof req !== 'object') {
        continue;
      }
      const method = String(req.method ?? 'GET').toUpperCase();
      const url = typeof req.url === 'string' ? req.url : String(req.url?.raw ?? '');
      const headers: KV[] = Array.isArray(req.header)
        ? req.header.filter((h: any) => h && h.key).map((h: any) => ({ name: String(h.key), value: String(h.value ?? '') }))
        : [];
      const body = typeof req.body?.raw === 'string' ? req.body.raw : '';
      const events = extractEvents(it, inherited);
      requests.push({ name, request: { method, url, headers, body }, ...(events ? { scriptEvents: events } : {}) });
    }
  };
  walk(doc.item, '');
  const warnings: string[] = [];
  if (requests.length === 0) {
    warnings.push('No requests found in collection.');
  }
  return { requests, warnings };
}
