/**
 * API Studio · Collection 树模型（G3 / yqh 裁定③；终审包 P1-05 + 07 修复指令 #9）。
 *
 * 设计边界：
 *  · 内部标准模型 = 有稳定 ID 的 Collection/Folder/Request 树（任务书 §5「内部 Collection 模型与外部格式解耦」）；
 *    旧 flat SavedRequest 模型保留为迁移源与 API-006 回归锁（store.ts 不动）；
 *  · 脚本执行链**运行期从树结构计算**（pre: collection→folder→request 外→内；test: request→folder→collection 内→外，
 *    契约 v1.1 顺序不变）——不把合并文本拼到请求上作唯一持久模型（终审 P1-05 判据）；
 *  · 全部纯函数 + 不可变更新（返回新树），与 store 快照纪律一致；脏存储 fail-closed（parseCollectionTree 返回 null）；
 *  · ID 口径：导入取 Postman `_postman_id ?? id`，缺失用 path+name 确定性哈希（重导入幂等）；手动保存 newNodeId()。
 */
import type { ApiRequestState } from './engine';
import { NAME_MAX, SAVED_CAP, type SavedRequest, cloneRequest, isValidName } from './store';
import { type Assertion, cloneAssertions, parseAssertions } from './assertions';
import type { ImportedRequest } from './openapi';

/** Postman v2.1 的 pre-request/test 事件文本（节点自身脚本；继承链运行期计算）。 */
export interface ScriptEvents { prerequest?: string; test?: string }

/** 请求节点（树叶子）。 */
export interface RequestNode {
  id: string
  name: string
  request: ApiRequestState
  assertions?: Assertion[]
  scripts?: ScriptEvents
}

/** 集合/文件夹节点（可嵌套；root 是同形的顶层集合节点）。 */
export interface CollectionNode {
  id: string
  name: string
  scripts?: ScriptEvents
  items: TreeNode[]
}

export type TreeNode = CollectionNode | RequestNode;

/** Runner 执行单元：链已按契约计算好（运行期从祖先链拼接，不持久化到请求节点）。 */
export interface ExecutableRequest {
  id: string
  /** 展示名 = 祖先 folder 路径拼接（'A / B / Req'；任务书 §9/B4 失败可定位到层级）。 */
  name: string
  method: string
  url: string
  request: ApiRequestState
  assertions?: Assertion[]
  prerequest: string
  test: string
}

export const isFolderNode = (n: TreeNode): n is CollectionNode => 'items' in n;

export function newNodeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** djb2 → base36：同输入同输出（重导入/重解析幂等的 ID 根基）。 */
function djb2(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function deterministicNodeId(seed: string): string {
  return `n-${djb2(seed)}`;
}

export function emptyCollection(name = 'Collection'): CollectionNode {
  return { id: newNodeId(), name, items: [] };
}

/** 深拷贝（数据全 JSON 形状；切断引用共享，与 store.cloneRequest 同纪律）。 */
export function cloneTree(tree: CollectionNode): CollectionNode {
  return JSON.parse(JSON.stringify(tree)) as CollectionNode;
}

// ── 查询 ──────────────────────────────────────────────────────────────
export function findNode(tree: CollectionNode, id: string): { node: TreeNode; parent: CollectionNode | null; index: number } | null {
  if (tree.id === id) {
    return { node: tree, parent: null, index: -1 };
  }
  const walk = (items: TreeNode[], parent: CollectionNode): { node: TreeNode; parent: CollectionNode | null; index: number } | null => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.id === id) {
        return { node: it, parent, index: i };
      }
      if (isFolderNode(it)) {
        const r = walk(it.items, it);
        if (r) {
          return r;
        }
      }
    }
    return null;
  };
  return walk(tree.items, tree);
}

export function findRequestNode(tree: CollectionNode, id: string): RequestNode | null {
  const f = findNode(tree, id);
  return f && !isFolderNode(f.node) ? f.node : null;
}

/** 祖先 folder 链（外→内，不含 root，不含自身）。 */
export function ancestorFolders(tree: CollectionNode, id: string): CollectionNode[] {
  const path: CollectionNode[] = [];
  const walk = (items: TreeNode[], trail: CollectionNode[]): boolean => {
    for (const it of items) {
      if (it.id === id) {
        path.push(...trail);
        return true;
      }
      if (isFolderNode(it) && walk(it.items, [...trail, it])) {
        return true;
      }
    }
    return false;
  };
  walk(tree.items, []);
  return path;
}

/** 节点路径名（祖先 folder 名；root 除外）。请求展示路径 = pathNames + 自身名。 */
export function pathNames(tree: CollectionNode, id: string): string[] {
  return ancestorFolders(tree, id).map(f => f.name);
}

/** 请求展示名（'A / B / Req'；无 folder 时=自身名）。 */
export function requestPathLabel(tree: CollectionNode, id: string): string {
  const f = findNode(tree, id);
  if (!f || isFolderNode(f.node)) {
    return '';
  }
  const p = pathNames(tree, id);
  return p.length ? `${p.join(' / ')} / ${f.node.name}` : f.node.name;
}

export function countRequests(tree: CollectionNode): number {
  let n = 0;
  const walk = (items: TreeNode[]) => {
    for (const it of items) {
      if (isFolderNode(it)) {
        walk(it.items);
      }
      else {
        n++;
      }
    }
  };
  walk(tree.items);
  return n;
}

function countNodeRequests(node: TreeNode): number {
  return isFolderNode(node) ? countRequests(node) : 1;
}

/** 文档序第一个请求节点（导入后「载入第一个」语义）。 */
export function firstRequestNode(tree: CollectionNode): RequestNode | null {
  const walk = (items: TreeNode[]): RequestNode | null => {
    for (const it of items) {
      if (isFolderNode(it)) {
        const r = walk(it.items);
        if (r) {
          return r;
        }
      }
      else {
        return it;
      }
    }
    return null;
  };
  return walk(tree.items);
}

/** 移动到目标 folder 的选项（排除自身与后代防环；root 作为「Top level」由调用方处理）。 */
export function folderMoveOptions(tree: CollectionNode, excludeId?: string): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const walk = (items: TreeNode[], trail: string[]) => {
    for (const it of items) {
      if (!isFolderNode(it)) {
        continue;
      }
      if (excludeId && (it.id === excludeId || isDescendantOf(it, excludeId))) {
        continue;
      }
      const p = [...trail, it.name];
      out.push({ label: p.join(' / '), value: it.id });
      walk(it.items, p);
    }
  };
  walk(tree.items, []);
  return out;
}

function isDescendantOf(folder: CollectionNode, id: string): boolean {
  return folder.items.some(it => it.id === id || (isFolderNode(it) && isDescendantOf(it, id)));
}

// ── 脚本链（契约 v1.1；运行期计算）────────────────────────────────────
export interface ChainSource { level: 'collection' | 'folder' | 'request'; id: string; name: string; hasScripts: boolean }

function hasScripts(scripts?: ScriptEvents): boolean {
  return !!scripts && (!!scripts.prerequest || !!scripts.test);
}

/** 继承来源提示（P1-05 判据）：pre 外→内 / test 内→外，带层级与对象名。 */
export function chainSources(tree: CollectionNode, nodeId: string): { pre: ChainSource[]; test: ChainSource[] } | null {
  const f = findNode(tree, nodeId);
  if (!f) {
    return null;
  }
  const isRoot = f.node.id === tree.id;
  const own: ChainSource = isRoot
    ? { level: 'collection', id: f.node.id, name: f.node.name, hasScripts: hasScripts(f.node.scripts) }
    : { level: isFolderNode(f.node) ? 'folder' : 'request', id: f.node.id, name: f.node.name, hasScripts: hasScripts(f.node.scripts) };
  const folders = ancestorFolders(tree, nodeId).map(n => ({ level: 'folder' as const, id: n.id, name: n.name, hasScripts: hasScripts(n.scripts) }));
  const collection: ChainSource = { level: 'collection', id: tree.id, name: tree.name, hasScripts: hasScripts(tree.scripts) };
  if (isRoot) {
    return { pre: [collection], test: [collection] };
  }
  // pre 执行序：collection → folders(外→内) → 自身；test 执行序：自身 → folders(内→外) → collection
  return { pre: [collection, ...folders, own], test: [own, ...[...folders].reverse(), collection] };
}

function joinChain(parts: Array<string | undefined>): string {
  return parts.filter(p => !!p && p.trim()).join('\n');
}

/** 请求的 pre/test 执行链文本（与旧导入期合并逐字等价：pre=[根,祖先外→内,自身]，test=[自身,祖先内→外,根]）。 */
export function scriptChain(tree: CollectionNode, requestId: string): { pre: string; test: string } {
  const node = findRequestNode(tree, requestId);
  if (!node) {
    return { pre: '', test: '' };
  }
  const folders = ancestorFolders(tree, requestId);
  return {
    pre: joinChain([tree.scripts?.prerequest, ...folders.map(f => f.scripts?.prerequest), node.scripts?.prerequest]),
    test: joinChain([node.scripts?.test, ...[...folders].reverse().map(f => f.scripts?.test), tree.scripts?.test]),
  };
}

/** 文档序深度优先展开为执行单元（Runner 消费面；空 folder 不贡献单元）。 */
export function executablesFromTree(tree: CollectionNode): ExecutableRequest[] {
  const out: ExecutableRequest[] = [];
  const walk = (items: TreeNode[], folders: CollectionNode[]) => {
    for (const it of items) {
      if (isFolderNode(it)) {
        walk(it.items, [...folders, it]);
        continue;
      }
      const chain = scriptChain(tree, it.id);
      const p = folders.map(f => f.name);
      out.push({
        id: it.id,
        name: p.length ? `${p.join(' / ')} / ${it.name}` : it.name,
        method: it.request.method,
        url: it.request.url,
        request: it.request,
        ...(it.assertions ? { assertions: it.assertions } : {}),
        prerequest: chain.pre,
        test: chain.test,
      });
    }
  };
  walk(tree.items, []);
  return out;
}

// ── 变更（纯函数，返回新树）──────────────────────────────────────────
export function cleanScriptEvents(scripts: ScriptEvents | undefined): ScriptEvents | undefined {
  if (!scripts) {
    return undefined;
  }
  const out: ScriptEvents = {};
  if (typeof scripts.prerequest === 'string' && scripts.prerequest.trim()) {
    out.prerequest = scripts.prerequest;
  }
  if (typeof scripts.test === 'string' && scripts.test.trim()) {
    out.test = scripts.test;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 合并两段脚本（导入 doc 级事件与手动集合脚本共存：现有段在前、导入段在后，同 '\n' 拼接；空段不进）。 */
export function mergeScriptEvents(a: ScriptEvents | undefined, b: ScriptEvents | undefined): ScriptEvents | undefined {
  const merged: ScriptEvents = {};
  for (const key of ['prerequest', 'test'] as const) {
    const parts = [a?.[key], b?.[key]].filter(v => typeof v === 'string' && (v as string).trim()) as string[];
    if (parts.length) {
      merged[key] = parts.join('\n');
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}

/** 唯一化：首选 ID 已存在则追加 -2/-3…（导入合并防撞）。 */
export function uniqueNodeId(tree: CollectionNode, preferred: string): string {
  if (!findNode(tree, preferred)) {
    return preferred;
  }
  let i = 2;
  while (findNode(tree, `${preferred}-${i}`)) {
    i++;
  }
  return `${preferred}-${i}`;
}

function insertNode(tree: CollectionNode, parentFolderId: string | null, node: TreeNode): { tree: CollectionNode; error?: string } {
  if (parentFolderId === null) {
    return { tree: { ...tree, items: [...tree.items, node] } };
  }
  const f = findNode(tree, parentFolderId);
  if (!f || !isFolderNode(f.node)) {
    return { tree, error: `Target folder not found: ${parentFolderId}` };
  }
  return { tree: replaceFolderItems(tree, parentFolderId, [...f.node.items, node]) };
}

function replaceFolderItems(tree: CollectionNode, folderId: string, items: TreeNode[]): CollectionNode {
  if (tree.id === folderId) {
    return { ...tree, items };
  }
  return {
    ...tree,
    items: tree.items.map((it) => {
      if (isFolderNode(it)) {
        if (it.id === folderId) {
          return { ...it, items };
        }
        return replaceFolderItems(it, folderId, items);
      }
      return it;
    }),
  };
}

export function addFolder(tree: CollectionNode, parentFolderId: string | null, name: string, id = newNodeId()): { tree: CollectionNode; node: CollectionNode | null; error?: string } {
  if (!isValidName(name)) {
    return { tree, node: null, error: `Folder name must be 1-${NAME_MAX} characters.` };
  }
  const node: CollectionNode = { id, name: name.trim(), items: [] };
  const r = insertNode(tree, parentFolderId, node);
  return r.error ? { tree, node: null, error: r.error } : { tree: r.tree, node };
}

export interface AddRequestInput { id?: string; name: string; request: ApiRequestState; assertions?: Assertion[]; scripts?: ScriptEvents }

export function addRequest(tree: CollectionNode, parentFolderId: string | null, input: AddRequestInput, cap: number = SAVED_CAP): { tree: CollectionNode; node: RequestNode | null; error?: string } {
  if (!isValidName(input.name)) {
    return { tree, node: null, error: `Name must be 1-${NAME_MAX} characters.` };
  }
  if (countRequests(tree) >= cap) {
    return { tree, node: null, error: `Collection is full (${cap}). Delete an entry first.` };
  }
  const node: RequestNode = {
    id: input.id ?? newNodeId(),
    name: input.name.trim(),
    request: cloneRequest(input.request),
    ...(input.assertions ? { assertions: cloneAssertions(input.assertions) } : {}),
    ...(cleanScriptEvents(input.scripts) ? { scripts: cleanScriptEvents(input.scripts) } : {}),
  };
  const r = insertNode(tree, parentFolderId, node);
  return r.error ? { tree, node: null, error: r.error } : { tree: r.tree, node };
}

/** 删除节点（folder 级联其全部后代）；root 不可删（返回 removed=null）。 */
export function removeNode(tree: CollectionNode, id: string): { tree: CollectionNode; removed: TreeNode | null; removedRequests: number } {
  if (tree.id === id) {
    return { tree, removed: null, removedRequests: 0 };
  }
  const f = findNode(tree, id);
  if (!f || !f.parent) {
    return { tree, removed: null, removedRequests: 0 };
  }
  const removed = f.node;
  const items = f.parent.items.filter(it => it.id !== id);
  return { tree: replaceFolderItems(tree, f.parent.id, items), removed, removedRequests: countNodeRequests(removed) };
}

/** 上移/下移（同父内交换位置；root 与越界 no-op）。 */
export function reorderNode(tree: CollectionNode, id: string, dir: -1 | 1): { tree: CollectionNode } {
  const f = findNode(tree, id);
  if (!f || !f.parent) {
    return { tree };
  }
  const i = f.index;
  const j = i + dir;
  if (j < 0 || j >= f.parent.items.length) {
    return { tree };
  }
  const items = [...f.parent.items];
  const tmp = items[i];
  items[i] = items[j];
  items[j] = tmp;
  return { tree: replaceFolderItems(tree, f.parent.id, items) };
}

/** 移动节点到另一 folder（或顶层）；禁止移入自身/后代（树环防呆）。 */
export function reparentNode(tree: CollectionNode, id: string, newParentFolderId: string | null, index?: number): { tree: CollectionNode; error?: string } {
  if (tree.id === id) {
    return { tree, error: 'The collection root cannot be moved.' };
  }
  const f = findNode(tree, id);
  if (!f || !f.parent) {
    return { tree, error: `Node not found: ${id}` };
  }
  if (newParentFolderId !== null) {
    if (newParentFolderId === id) {
      return { tree, error: 'A folder cannot be moved into itself.' };
    }
    const target = findNode(tree, newParentFolderId);
    if (!target || !isFolderNode(target.node)) {
      return { tree, error: `Target folder not found: ${newParentFolderId}` };
    }
    if (isFolderNode(f.node) && findNode(f.node, newParentFolderId)) {
      return { tree, error: 'A folder cannot be moved into its own subfolder.' };
    }
  }
  const node = f.node;
  const removed = removeNode(tree, id);
  const inserted = insertNode(removed.tree, newParentFolderId, node);
  if (inserted.error) {
    return { tree, error: inserted.error };
  }
  if (index === undefined) {
    return { tree: inserted.tree };
  }
  // 落到指定索引：在新父 items 内把该节点移到 index（插入默认在末尾）
  const nf = findNode(inserted.tree, newParentFolderId ?? inserted.tree.id);
  if (!nf) {
    return { tree: inserted.tree };
  }
  const parentItems = nf.parent ? nf.parent.items : inserted.tree.items;
  const cur = parentItems.findIndex(it => it.id === id);
  if (cur < 0) {
    return { tree: inserted.tree };
  }
  const items = [...parentItems];
  const [moved] = items.splice(cur, 1);
  items.splice(Math.max(0, Math.min(index, items.length)), 0, moved);
  return { tree: replaceFolderItems(inserted.tree, nf.parent ? nf.parent.id : inserted.tree.id, items) };
}

export function renameNode(tree: CollectionNode, id: string, name: string): { tree: CollectionNode; error?: string } {
  if (!isValidName(name)) {
    return { tree, error: `Name must be 1-${NAME_MAX} characters.` };
  }
  if (!findNode(tree, id)) {
    return { tree, error: `Node not found: ${id}` };
  }
  const rebuild = (n: TreeNode): TreeNode => (n.id === id
    ? { ...n, name: name.trim() }
    : isFolderNode(n) ? { ...n, items: n.items.map(rebuild) } : n);
  return { tree: { ...tree, items: tree.items.map(rebuild) } };
}

/** folder/root 脚本保存（只持久化非空段；脏字段不落盘——与 store 白名单同纪律）。 */
export function updateFolderScripts(tree: CollectionNode, id: string, scripts: ScriptEvents): { tree: CollectionNode; error?: string } {
  const f = findNode(tree, id);
  if (!f || !isFolderNode(f.node)) {
    return { tree, error: `Folder not found: ${id}` };
  }
  const clean = cleanScriptEvents(scripts);
  const rebuild = (n: CollectionNode): CollectionNode => ({
    ...n,
    ...(n.id === id ? (clean ? { scripts: clean } : { scripts: undefined }) : {}),
    items: n.items.map(it => isFolderNode(it) ? rebuild(it) : it),
  });
  return { tree: rebuild(tree) };
}

/** 请求节点更新（快照深拷贝切断引用；name 可选改名）。 */
export function updateRequestNode(tree: CollectionNode, id: string, patch: { name?: string; request?: ApiRequestState; assertions?: Assertion[]; scripts?: ScriptEvents }): { tree: CollectionNode; node: RequestNode | null; error?: string } {
  const f = findNode(tree, id);
  if (!f || isFolderNode(f.node)) {
    return { tree, node: null, error: `Request not found: ${id}` };
  }
  const name = patch.name !== undefined ? patch.name.trim() : f.node.name;
  if (!isValidName(name)) {
    return { tree, node: null, error: `Name must be 1-${NAME_MAX} characters.` };
  }
  const rebuild = (n: TreeNode): TreeNode => {
    if (n.id === id) {
      return {
        ...n,
        name,
        ...(patch.request !== undefined ? { request: cloneRequest(patch.request) } : {}),
        ...(patch.assertions !== undefined ? { assertions: cloneAssertions(patch.assertions) } : {}),
        ...(patch.scripts !== undefined ? { scripts: cleanScriptEvents(patch.scripts) } : {}),
      } as RequestNode;
    }
    if (isFolderNode(n)) {
      return { ...n, items: n.items.map(rebuild) };
    }
    return n;
  };
  const next = { ...tree, items: tree.items.map(rebuild) } as CollectionNode;
  return { tree: next, node: findRequestNode(next, id) };
}

// ── 存储解析（白名单形状校验；脏数据 fail-closed）─────────────────────
function isKVArray(v: unknown): v is { name: string; value: string }[] {
  return Array.isArray(v) && v.every(h => h && typeof h === 'object' && typeof (h as Record<string, unknown>).name === 'string' && typeof (h as Record<string, unknown>).value === 'string');
}

function isRequestShape(v: unknown): v is ApiRequestState {
  if (!v || typeof v !== 'object') {
    return false;
  }
  const r = v as Record<string, unknown>;
  return typeof r.method === 'string' && typeof r.url === 'string' && typeof r.body === 'string' && isKVArray(r.headers);
}

function parseScriptEvents(raw: unknown): ScriptEvents | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const s = raw as Record<string, unknown>;
  const out: ScriptEvents = {};
  if (typeof s.prerequest === 'string') {
    out.prerequest = s.prerequest;
  }
  if (typeof s.test === 'string') {
    out.test = s.test;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseNode(raw: unknown, seen: Set<string>): TreeNode | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== 'string' || typeof n.name !== 'string' || seen.has(n.id)) {
    return null;
  }
  const scripts = parseScriptEvents(n.scripts);
  if (Array.isArray(n.items)) {
    seen.add(n.id);
    const items: TreeNode[] = [];
    for (const it of n.items) {
      const p = parseNode(it, seen);
      if (p) {
        items.push(p);
      }
    }
    return { id: n.id, name: n.name, items, ...(scripts ? { scripts } : {}) };
  }
  if (isRequestShape(n.request)) {
    seen.add(n.id);
    const assertions = n.assertions === undefined ? undefined : parseAssertions(n.assertions);
    return {
      id: n.id,
      name: n.name,
      request: n.request,
      ...(assertions !== undefined ? { assertions } : {}),
      ...(scripts ? { scripts } : {}),
    };
  }
  return null;
}

/** localStorage 存储解析：items 缺失 → null（fail-closed）；name 缺失 → 'Collection' 宽容（我们写的存储必有名）。
 *  注：与 parseSaved 不同，树不按 cap 截断——截断会 orphan 结构；上限在添加面强制。 */
export function parseCollectionTree(raw: unknown): CollectionNode | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const n = raw as Record<string, unknown>;
  if (!Array.isArray(n.items)) {
    return null;
  }
  const id = typeof n.id === 'string' ? n.id : newNodeId();
  const name = typeof n.name === 'string' && n.name.trim() ? n.name : 'Collection';
  const seen = new Set<string>([id]);
  const items: TreeNode[] = [];
  for (const it of n.items) {
    const p = parseNode(it, seen);
    if (p) {
      items.push(p);
    }
  }
  const scripts = parseScriptEvents(n.scripts);
  return { id, name, items, ...(scripts ? { scripts } : {}) };
}

// ── 迁移与合并 ────────────────────────────────────────────────────────
/** 旧 flat 存储迁移（一次性、幂等、不受 cap 限制——迁移既有数据不是新增）：
 *  flat SavedRequest[] → root 级请求节点；旧集合脚本 storage → root.scripts。 */
export function migrateLegacyCollection(saved: SavedRequest[], collectionScripts?: ScriptEvents): CollectionNode {
  const clean = cleanScriptEvents(collectionScripts);
  const tree: CollectionNode = {
    id: newNodeId(),
    name: 'Collection',
    items: saved.map((s) => {
      const node: RequestNode = { id: s.id, name: s.name, request: s.request };
      if (s.assertions) {
        node.assertions = s.assertions;
      }
      if (s.scriptEvents) {
        node.scripts = s.scriptEvents;
      }
      return node;
    }),
    ...(clean ? { scripts: clean } : {}),
  };
  return tree;
}

/** OpenAPI 导入包装：确定性 ID（name+method+url 哈希）→ 重导入按 id 替换原位（幂等）。 */
export function requestNodeFromImported(imp: ImportedRequest): RequestNode {
  return {
    id: deterministicNodeId(`openapi:${imp.name}:${imp.request.method}:${imp.request.url}`),
    name: imp.name,
    request: imp.request,
    ...(imp.scriptEvents ? { scripts: imp.scriptEvents } : {}),
  };
}

export interface MergeTreeResult { tree: CollectionNode; added: number; replaced: number; scriptsMerged: boolean }

/** 单文件导入合并（幂等）：同 id 节点**原位替换**（任意深度，保留位置，重导入不重复）；新 id 唯一化后追加根层。
 *  根脚本 = 现有手动集合脚本 ⊕ 导入 doc 级事件（mergeScriptEvents，现有段在前）——挑战者 BLOCKER 修复：
 *  旧模型 doc 事件导入期并入每请求链、手动集合脚本独立叠加，两层并存时都执行；树模型下两层都在根节点，
 *  合并必须保留双侧文本，丢失任一侧=静默丢脚本。
 *  计数口径：added/replaced = 节点级（folder+request；folder 替换=整子树原位更新，其新子节点不再重复计数）。 */
export function mergeImportedTree(existing: CollectionNode, imported: CollectionNode): MergeTreeResult {
  let added = 0;
  let replaced = 0;
  let next = cloneTree(existing);
  const replaceInTree = (t: CollectionNode, id: string, node: TreeNode): CollectionNode => ({
    ...t,
    items: t.items.map(it => (it.id === id ? node : isFolderNode(it) ? replaceInTree(it, id, node) : it)),
  });
  if (imported.scripts) {
    const mergedScripts = mergeScriptEvents(next.scripts, imported.scripts);
    next = { ...next, ...(mergedScripts ? { scripts: mergedScripts } : { scripts: undefined }) };
  }
  const process = (items: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = [];
    for (const it of items) {
      if (findNode(next, it.id)) {
        replaced++;
        next = replaceInTree(next, it.id, it); // 原位替换完成，不进追加列表（防同 id 双份）
        continue;
      }
      const node = isFolderNode(it) ? { ...it, items: process(it.items) } : it;
      const uid = uniqueNodeId(next, node.id);
      added++;
      out.push(uid === node.id ? node : { ...node, id: uid });
    }
    return out;
  };
  next = { ...next, items: [...next.items, ...process(imported.items)] };
  return { tree: next, added, replaced, scriptsMerged: !!imported.scripts };
}

/** 目录合并（CLI 多文件口径=文档序 concat，**不替换**：不同文件的节点都保留，ID 冲突时唯一化；
 *  与旧 flat 目录合并语义一致——排序后逐文件追加。旧名展平、新名保持嵌套）。
 *  各文件 doc 级脚本并入根脚本（mergeScriptEvents 累积）——旧口径下各文件 doc 事件各自并入其请求链，全部执行。
 *  计数口径：added=请求节点数（与旧 flat 目录合并的请求计数口径一致）。 */
export function appendTreeItems(existing: CollectionNode, imported: CollectionNode): { tree: CollectionNode; added: number } {
  let next = cloneTree(existing);
  if (imported.scripts) {
    const mergedScripts = mergeScriptEvents(next.scripts, imported.scripts);
    next = { ...next, ...(mergedScripts ? { scripts: mergedScripts } : { scripts: undefined }) };
  }
  const idSet = new Set<string>();
  const collect = (n: TreeNode): void => {
    idSet.add(n.id);
    if (isFolderNode(n)) {
      n.items.forEach(collect);
    }
  };
  collect(next);
  let added = 0;
  const walk = (items: TreeNode[]): TreeNode[] => items.map((it) => {
    let node = isFolderNode(it) ? { ...it, items: walk(it.items) } : it;
    if (idSet.has(node.id)) {
      let i = 2;
      while (idSet.has(`${node.id}-${i}`)) {
        i++;
      }
      node = { ...node, id: `${node.id}-${i}` };
    }
    idSet.add(node.id);
    if (!isFolderNode(node)) {
      added++;
    }
    return node;
  });
  next = { ...next, items: [...next.items, ...walk(imported.items)] };
  return { tree: next, added };
}
