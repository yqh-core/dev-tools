/**
 * API-010 · Postman Collection v2.1 导入/导出（与 API-008 OpenAPI 互补的互操作能力）。
 *
 * 本模块提供两套互操作，边界清晰（G3 纪律：flat 遗留路径与树模型并存、互不破坏）：
 *  · 【flat 遗留路径】exportCollection / importCollection——字节级保留 G3 前口径，
 *    供 API-006/010/011 回归锁、历史调用方使用（嵌套 folder 展平为「父 / 子」名、
 *    doc/folder 级事件在导入期并入每个请求执行链）。改签名=毁回归锁，禁止。
 *  · 【G3 树模型】importCollectionTree / exportCollectionTree——嵌套 folder 保留为有稳定 ID 的
 *    结构化实体（`_postman_id ?? id ?? 路径确定性哈希`），folder 级事件留在 folder 节点 scripts 上
 *    （不在导入期展平/拼接），执行链由 runner 运行期从树计算（见 collection-tree.ts / runner.ts）。
 *    导出保树，导出 → 导入 → 再导出 round-trip 保留嵌套与节点 ID。
 *  · 未知条目/非 raw 体/auth/未知 listen 全部进 warning（不静默丢弃，矩阵见 IMPORT_FIELD_MATRIX.md）。
 */
import type { ApiRequestState, KV } from './engine';
import { sanitizeForShare } from './engine';
import type { SavedRequest } from './store';
import type { ImportedRequest } from './openapi';
import type { CollectionNode, RequestNode, TreeNode } from './collection-tree';
import { cleanScriptEvents, countRequests, deterministicNodeId, isFolderNode, uniqueNodeId } from './collection-tree';

/** Postman v2.1 的 pre-request/test 事件文本（flat 路径 = folder 继承后的合并结果；树路径 = 节点自身脚本）。 */
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

// ════════════════════════════════════════════════════════════════════════
// flat 遗留路径（G3 前口径，字节级保留——回归锁与历史调用方依赖）
// ════════════════════════════════════════════════════════════════════════

export function exportCollection(saved: SavedRequest[], name = 'DigDevBox Collection', stripAuth = true, collectionScripts?: { prerequest?: string; test?: string }): Record<string, unknown> {
  // A-002/A-003：手动集合级脚本导出为 Postman doc 级事件（round-trip 闭合：
  // 导出 doc 级 → 导入时按契约 v1.1 合并进各请求执行链，语义不丢）。
  const docEvents: { listen: string; script: { exec: string[] } }[] = [];
  if (collectionScripts?.prerequest?.trim()) {
    docEvents.push({ listen: 'prerequest', script: { exec: collectionScripts.prerequest.split('\n') } });
  }
  if (collectionScripts?.test?.trim()) {
    docEvents.push({ listen: 'test', script: { exec: collectionScripts.test.split('\n') } });
  }
  return {
    info: { name, schema: POSTMAN_SCHEMA },
    ...(docEvents.length ? { event: docEvents } : {}),
    item: saved.map((s) => {
      const req: ApiRequestState = stripAuth ? sanitizeForShare(s.request) : s.request;
      // API-011：脚本事件导出为 Postman v2.1 event（exec 按行数组）——导入/导出往返不丢脚本
      const events: { listen: string; script: { exec: string[] } }[] = [];
      if (s.scriptEvents?.prerequest) {
        events.push({ listen: 'prerequest', script: { exec: s.scriptEvents.prerequest.split('\n') } });
      }
      if (s.scriptEvents?.test) {
        events.push({ listen: 'test', script: { exec: s.scriptEvents.test.split('\n') } });
      }
      return {
        name: s.name,
        request: {
          method: req.method,
          header: req.headers.map(h => ({ key: h.name, value: h.value })),
          url: toPostmanUrl(req.url),
          ...(req.body ? { body: { mode: 'raw', raw: req.body } } : {}),
        },
        ...(events.length ? { event: events } : {}),
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
        if (body.trim()) {
          parts.push(body);
        }
      }
    }
    return parts.length ? parts.join('\n') : undefined;
  };
  const docPre = takeEvents(doc.event, 'prerequest');
  const docTest = takeEvents(doc.event, 'test');
  for (const ev of doc.event ?? []) {
    if (ev && typeof ev === 'object' && typeof ev.listen === 'string' && ev.listen !== 'prerequest' && ev.listen !== 'test') {
      warnings.push(`Collection event listen "${ev.listen}" is not prerequest/test — ignored (Postman v2.1 subset).`);
    }
  }

  const walk = (items: any[], prefix: string, preChain: string[], testChain: string[]) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') {
        // 终审 P1-06：未知/损坏条目不静默跳过——进 warning 列表（UI 可见）
        warnings.push(`Non-object entry in item array (prefix: "${prefix || 'collection'}") — skipped.`);
        continue;
      }
      const name = prefix ? `${prefix} / ${it.name ?? 'item'}` : String(it.name ?? 'item');
      const ownPre = takeEvents(it.event, 'prerequest');
      const ownTest = takeEvents(it.event, 'test');
      for (const ev of it.event ?? []) {
        if (ev && typeof ev === 'object' && typeof ev.listen === 'string' && ev.listen !== 'prerequest' && ev.listen !== 'test') {
          warnings.push(`Request "${name}" event listen "${ev.listen}" is not prerequest/test — ignored (Postman v2.1 subset).`);
        }
      }
      if (Array.isArray(it.item)) {
        walk(it.item, name, ownPre ? [...preChain, ownPre] : preChain, ownTest ? [ownTest, ...testChain] : testChain);
        continue;
      }
      const req = it.request;
      if (!req || typeof req !== 'object') {
        warnings.push(`Item "${name}" is neither a folder (no item array) nor a request (no request object) — skipped.`);
        continue;
      }
      if (req.auth !== undefined) {
        warnings.push(`Request "${name}" declares auth — auth is not applied by the importer (declare headers explicitly).`);
      }
      // 终审 P1-06：非 raw body 模式（urlencoded/formdata/graphql/file/binary）不静默丢弃——进 warning
      const body = typeof req.body?.raw === 'string' ? req.body.raw : '';
      if (req.body && typeof req.body === 'object' && typeof req.body.raw !== 'string') {
        warnings.push(`Request "${name}" body mode "${String((req.body as any).mode ?? 'unknown')}" is not imported (only raw string bodies) — re-enter the body manually.`);
      }
      const method = String(req.method ?? 'GET').toUpperCase();
      const url = typeof req.url === 'string' ? req.url : String(req.url?.raw ?? '');
      const headers: KV[] = Array.isArray(req.header)
        ? req.header.filter((h: any) => h && h.key).map((h: any) => ({ name: String(h.key), value: String(h.value ?? '') }))
        : [];
      // 契约 v1：prerequest = 外层链 + 自身；test = 自身 + 外层链（内层先跑）
      const pre = [...preChain, ...(ownPre ? [ownPre] : [])].filter(Boolean).join('\n');
      const test = [...(ownTest ? [ownTest] : []), ...testChain].filter(Boolean).join('\n');
      const scriptEvents: ScriptEvents = {};
      if (pre) {
        scriptEvents.prerequest = pre;
      }
      if (test) {
        scriptEvents.test = test;
      }
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

// ════════════════════════════════════════════════════════════════════════
// G3 树模型互操作（嵌套保形 + 稳定 ID；执行链不在导入期拼接，运行期由 runner 从树计算）
// ════════════════════════════════════════════════════════════════════════

/** 从事件数组取某 listen 的脚本正文（同层多段按出现顺序 '\n' 拼接）。 */
function takeNodeEvents(evs: unknown[] | undefined, listen: 'prerequest' | 'test'): string | undefined {
  const parts: string[] = [];
  for (const ev of evs ?? []) {
    if (ev && typeof ev === 'object' && (ev as Record<string, unknown>).listen === listen && (ev as Record<string, unknown>).script) {
      const script = (ev as Record<string, unknown>).script as Record<string, unknown>;
      const exec = Array.isArray(script.exec) ? script.exec : (typeof script.exec === 'string' ? [script.exec] : []);
      const body = exec.filter((l: unknown) => typeof l === 'string').join('\n');
      if (body.trim()) {
        parts.push(body);
      }
    }
  }
  return parts.length ? parts.join('\n') : undefined;
}

export interface ImportCollectionTreeResult { tree: CollectionNode; warnings: string[]; requestCount: number }

/** Postman v2.1 → 树（G3）：folder 保留为结构化节点，事件留在各自节点 scripts 上。 */
export function importCollectionTree(text: string): ImportCollectionTreeResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { tree: { id: 'root-empty', name: 'Collection', items: [] }, warnings: ['Empty input.'], requestCount: 0 };
  }
  let doc: any;
  try {
    doc = JSON.parse(trimmed);
  }
  catch (e) {
    return { tree: { id: 'root-empty', name: 'Collection', items: [] }, warnings: [`Not valid JSON: ${String(e).slice(0, 100)}`], requestCount: 0 };
  }
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.item)) {
    return { tree: { id: 'root-empty', name: 'Collection', items: [] }, warnings: ['Not a Postman collection (missing item array).'], requestCount: 0 };
  }
  const warnings: string[] = [];
  const docPre = takeNodeEvents(doc.event, 'prerequest');
  const docTest = takeNodeEvents(doc.event, 'test');
  for (const ev of doc.event ?? []) {
    if (ev && typeof ev === 'object' && typeof ev.listen === 'string' && ev.listen !== 'prerequest' && ev.listen !== 'test') {
      warnings.push(`Collection event listen "${ev.listen}" is not prerequest/test — ignored (Postman v2.1 subset).`);
    }
  }
  const info = doc.info && typeof doc === 'object' && doc.info && typeof doc.info === 'object' ? doc.info : {};
  const rootId = typeof doc._postman_id === 'string'
    ? doc._postman_id
    : (typeof info._postman_id === 'string' ? info._postman_id : deterministicNodeId('collection-root'));
  const rootName = typeof info.name === 'string' && info.name.trim() ? info.name.trim() : 'Imported collection';
  const root: CollectionNode = {
    id: rootId,
    name: rootName,
    items: [],
    ...(docPre || docTest ? { scripts: { ...(docPre ? { prerequest: docPre } : {}), ...(docTest ? { test: docTest } : {}) } } : {}),
  };
  /** ID 口径：源 `_postman_id ?? id`；缺失用「祖先路径/名」确定性哈希（重导入幂等）；撞 ID 唯一化。 */
  const nodeId = (it: any, seed: string): string => {
    const preferred = typeof it._postman_id === 'string'
      ? it._postman_id
      : (typeof it.id === 'string' ? it.id : deterministicNodeId(seed));
    return uniqueNodeId(root, preferred);
  };
  const walk = (items: any[], parent: CollectionNode, seed: string) => {
    for (const it of items ?? []) {
      if (!it || typeof it !== 'object') {
        // 终审 P1-06：未知/损坏条目不静默跳过——进 warning 列表（UI 可见）
        warnings.push(`Non-object entry in item array (prefix: "${seed || 'collection'}") — skipped.`);
        continue;
      }
      const name = typeof it.name === 'string' && it.name.trim() ? it.name.trim() : 'item';
      const pathSeed = seed ? `${seed}/${name}` : name;
      const ownPre = takeNodeEvents(it.event, 'prerequest');
      const ownTest = takeNodeEvents(it.event, 'test');
      for (const ev of it.event ?? []) {
        if (ev && typeof ev === 'object' && typeof ev.listen === 'string' && ev.listen !== 'prerequest' && ev.listen !== 'test') {
          warnings.push(`Item "${pathSeed}" event listen "${ev.listen}" is not prerequest/test — ignored (Postman v2.1 subset).`);
        }
      }
      if (Array.isArray(it.item)) {
        const folderScripts = cleanScriptEvents({ ...(ownPre ? { prerequest: ownPre } : {}), ...(ownTest ? { test: ownTest } : {}) });
        const folder: CollectionNode = {
          id: nodeId(it, pathSeed),
          name,
          items: [],
          ...(folderScripts ? { scripts: folderScripts } : {}),
        };
        parent.items.push(folder);
        walk(it.item, folder, pathSeed);
        continue;
      }
      const req = it.request;
      if (!req || typeof req !== 'object') {
        warnings.push(`Item "${pathSeed}" is neither a folder (no item array) nor a request (no request object) — skipped.`);
        continue;
      }
      if (req.auth !== undefined) {
        warnings.push(`Request "${pathSeed}" declares auth — auth is not applied by the importer (declare headers explicitly).`);
      }
      // 终审 P1-06：非 raw body 模式（urlencoded/formdata/graphql/file/binary）不静默丢弃——进 warning
      const body = typeof req.body?.raw === 'string' ? req.body.raw : '';
      if (req.body && typeof req.body === 'object' && typeof req.body.raw !== 'string') {
        warnings.push(`Request "${pathSeed}" body mode "${String((req.body as any).mode ?? 'unknown')}" is not imported (only raw string bodies) — re-enter the body manually.`);
      }
      const method = String(req.method ?? 'GET').toUpperCase();
      const url = typeof req.url === 'string' ? req.url : String(req.url?.raw ?? '');
      const headers: KV[] = Array.isArray(req.header)
        ? req.header.filter((h: any) => h && h.key).map((h: any) => ({ name: String(h.key), value: String(h.value ?? '') }))
        : [];
      const requestState: ApiRequestState = { method, url, headers, body };
      const scripts = cleanScriptEvents({ ...(ownPre ? { prerequest: ownPre } : {}), ...(ownTest ? { test: ownTest } : {}) });
      const node: RequestNode = { id: nodeId(it, pathSeed), name, request: requestState, ...(scripts ? { scripts } : {}) };
      parent.items.push(node);
    }
  };
  walk(doc.item, root, '');
  if (docPre || docTest) {
    warnings.push('Collection-level scripts were kept as the collection node scripts (they run before/after every request at run time, Postman semantics).');
  }
  const requestCount = countRequests(root);
  if (requestCount === 0) {
    warnings.push('No requests found in collection.');
  }
  return { tree: root, warnings, requestCount };
}

/** 树 → Postman v2.1 JSON（保形：folder 嵌套 item、folder/doc 级事件、节点 `_postman_id` round-trip）。
 *  stripAuth 默认开（与分享脱敏边界一致，可关）。 */
export function exportCollectionTree(tree: CollectionNode, stripAuth = true): Record<string, unknown> {
  const eventsOf = (scripts: ScriptEvents | undefined): { listen: string; script: { exec: string[] } }[] => {
    const events: { listen: string; script: { exec: string[] } }[] = [];
    if (scripts?.prerequest?.trim()) {
      events.push({ listen: 'prerequest', script: { exec: scripts.prerequest.split('\n') } });
    }
    if (scripts?.test?.trim()) {
      events.push({ listen: 'test', script: { exec: scripts.test.split('\n') } });
    }
    return events;
  };
  const exportNode = (node: TreeNode): Record<string, unknown> => {
    const events = eventsOf(node.scripts);
    const base: Record<string, unknown> = { name: node.name, _postman_id: node.id };
    if (isFolderNode(node)) {
      return { ...base, ...(events.length ? { event: events } : {}), item: node.items.map(exportNode) };
    }
    const req = stripAuth ? sanitizeForShare(node.request) : node.request;
    // sanitizeForShare 剔除凭据头/URL 内嵌凭据；请求体原样保留（导出提示已明示该边界）
    const postmanRequest: Record<string, unknown> = {
      method: req.method,
      header: req.headers.map(h => ({ key: h.name, value: h.value })),
      url: toPostmanUrl(req.url),
      ...(req.body ? { body: { mode: 'raw', raw: req.body } } : {}),
    };
    return { ...base, ...(events.length ? { event: events } : {}), request: postmanRequest };
  };
  const docEvents = eventsOf(tree.scripts);
  return {
    info: { name: tree.name, _postman_id: tree.id, schema: POSTMAN_SCHEMA },
    ...(docEvents.length ? { event: docEvents } : {}),
    item: tree.items.map(exportNode),
  };
}
