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
  const warnings: string[] = [];
  /**
   * 脚本执行顺序契约 v1（2026-11-17 核验，对标 Postman 官方执行序——不凭记忆）：
   *   pre-request：collection → folder → request（由外到内，外层先跑）
   *   test：        request → folder → collection（由内到外，内层先跑）
   * 同层多段事件按文件内出现顺序拼接；集合级事件并入每个请求的执行链。
   * 契约文件：src/tools/api-debugger/SCRIPT-CONTRACT.md（与实现同源维护）。
   */
  const takeEvents = (evs: any[] | undefined, listen: 'prerequest' | 'test'): string | undefined => {
    const parts: string[] = [];
    for (const ev of evs ?? []) {
      if (ev && ev.listen === listen && ev.script) {
        const exec = Array.isArray(ev.script.exec) ? ev.script.exec : (typeof ev.script.exec === 'string' ? [ev.script.exec] : []);
        const body = exec.filter((l: unknown) => typeof l === 'string').join('\n');
        if (body.trim()) parts.push(body);
      }
    }
    return parts.length ? parts.join('\n') : undefined;
  };
  const docPre = takeEvents(doc.event, 'prerequest');
  const docTest = takeEvents(doc.event, 'test');

  const walk = (items: any[], prefix: string, preChain: string[], testChain: string[]) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        continue;
      }
      const name = prefix ? `${prefix} / ${it.name ?? 'item'}` : String(it.name ?? 'item');
      const ownPre = takeEvents(it.event, 'prerequest');
      const ownTest = takeEvents(it.event, 'test');
      if (Array.isArray(it.item)) {
        walk(it.item, name, ownPre ? [...preChain, ownPre] : preChain, ownTest ? [ownTest, ...testChain] : testChain);
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
      // 契约 v1：prerequest = 外层链 + 自身；test = 自身 + 外层链（内层先跑）
      const pre = [...preChain, ...(ownPre ? [ownPre] : [])].filter(Boolean).join('\n');
      const test = [...(ownTest ? [ownTest] : []), ...testChain].filter(Boolean).join('\n');
      const scriptEvents: ScriptEvents = {};
      if (pre) scriptEvents.prerequest = pre;
      if (test) scriptEvents.test = test;
      requests.push({ name, request: { method, url, headers, body }, ...(Object.keys(scriptEvents).length ? { scriptEvents } : {}) });
    }
  };
  walk(doc.item, '', docPre ? [docPre] : [], docTest ? [docTest] : []);
  if (docPre || docTest) {
    warnings.push('Collection-level scripts were merged into each request execution chain (Postman semantics).');
  }
  if (requests.length === 0) {
    warnings.push('No requests found in collection.');
  }
  return { requests, warnings };
}
