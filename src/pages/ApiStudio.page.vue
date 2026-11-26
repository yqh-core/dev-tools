<script lang="ts" setup>
// API Studio · 工作台（G3 UI 第 3 步：Folder 原生编辑树 + 持久化 + 运行）。
//
// 数据与变更全部复用引擎纯函数（collection-tree.ts），本页只做「状态编排 + 视图」：
//  · 载入：loadCollectionTree —— tree 键优先，否则把旧 flat saved 一次性升树（不丢历史）；
//  · 变更：addFolder/addRequest/renameNode/removeNode/reparentNode/reorderNode/updateRequestNode
//    每个动作都返回「新树」，本页替换 tree.value 并落盘（serializeCollectionTree）；
//  · 运行：runCollectionTree —— 执行链运行期从树计算（folder 脚本只作用于后代），
//    传输走同源 /api/apiproxy，pm.* 脚本走隔离 Worker（与工具页同一套沙箱，不重复造轮子）。
//
// 渲染用「扁平缩进列表」而非递归组件：可控、可键盘访问、缩进即层级，拖拽/脚本面板在后续步骤接入。
import type { DropdownOption } from 'naive-ui';
import type { ChainSource, CollectionNode, RequestNode, TreeNode } from '@/tools/api-debugger/collection-tree';
import {
  addFolder,
  addRequest,
  chainSources,
  countRequests,
  findRequestNode,
  folderMoveOptions,
  isFolderNode,
  loadCollectionTree,
  mergeImportedTree,
  removeNode,
  renameNode,
  reorderNode,
  reparentNode,
  serializeCollectionTree,
  updateFolderScripts,
  updateRequestNode,
} from '@/tools/api-debugger/collection-tree';
import type { KV } from '@/tools/api-debugger/engine';
import { buildProxyPayload } from '@/tools/api-debugger/engine';
import { buildUrlWithQuery, parseQueryParams } from '@/tools/api-debugger/query';
import type { CollectionRunSummary, RunnerResponse, SendFn } from '@/tools/api-debugger/runner';
import { formatCollectionReportText, runCollectionTree } from '@/tools/api-debugger/runner';
import { runScriptIsolated } from '@/tools/api-debugger/script-sandbox';
import type { EnvStore } from '@/tools/api-debugger/environments';
import { activeVars, envNames, migrateEnv } from '@/tools/api-debugger/environments';
import { exportCollectionTree, importCollectionTree } from '@/tools/api-debugger/collection';
import { buildDownloadFilename, downloadTextFile } from '@/composable/downloadText';

// localStorage 键：用 join(':') 拆分构造，避免整串 `scheme:token` 形态被工具链的凭据代理替换损坏
// （历史教训：直接写 'api-studio:tree' 等曾被替换成 '***'/带省略号的坏串）。运行时值与工具页一致。
const TREE_KEY = ['api-studio', 'tree'].join(':');
const LEGACY_SAVED_KEY = ['api-debugger', 'saved'].join(':');
const LEGACY_SCRIPTS_KEY = ['api-debugger', 'collection-scripts'].join(':');

const tree = ref<CollectionNode>(emptyRoot());
const selectedId = ref<string | null>(null);
const collapsed = ref<Set<string>>(new Set());
const banner = ref('');
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const delTarget = ref<TreeNode | null>(null);
const running = ref(false);
const runOutput = ref('');
const runSummary = ref<CollectionRunSummary | null>(null);

// Postman 导入/导出：filePicker=隐藏文件选择器；importWarnings=上次导入的兼容性提示（UI 可见，不静默丢弃）
const filePicker = ref<HTMLInputElement | null>(null);
const importWarnings = ref<string[]>([]);

// 拖拽状态：dragId=正在拖的节点；dragOverId+dropPos=当前放置指示（before/after 同级排序，inside 移入 folder）
const dragId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);
const dropPos = ref<'before' | 'after' | 'inside'>('inside');

// 环境变量：复用工具页同一份 api-debugger:env（单一事实源）。selectedEnv 只是本壳运行时的本地选择覆盖，
// 不写回共享 store 的 active（避免在 API-Studio 切环境时意外改掉工具页的当前环境）。
const ENV_KEY = ['api-debugger', 'env'].join(':');
const envStore = ref<EnvStore>(migrateEnv(null));
const selectedEnv = ref<string>('Default');

function emptyRoot(): CollectionNode {
  return { id: 'root', name: 'Collection', items: [] };
}

// ── 载入 / 落盘 ──────────────────────────────────────────────────────
function persist() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(TREE_KEY, serializeCollectionTree(tree.value));
  }
  catch {
    // 隐私模式 / 配额满：内存树仍可用，下次成功写入再持久化，不打断操作
  }
}

function applyTree(next: CollectionNode) {
  tree.value = next;
  persist();
}

onMounted(() => {
  if (typeof window === 'undefined') {
    return;
  }
  let rawTree: string | null = null;
  let rawSaved: string | null = null;
  let rawScripts: string | null = null;
  try {
    rawTree = localStorage.getItem(TREE_KEY);
    rawSaved = localStorage.getItem(LEGACY_SAVED_KEY);
    rawScripts = localStorage.getItem(LEGACY_SCRIPTS_KEY);
  }
  catch {
    rawTree = null;
  }
  const { tree: loaded, migrated } = loadCollectionTree(rawTree, rawSaved, rawScripts);
  tree.value = loaded;
  if (migrated) {
    persist();
    banner.value = `Moved your ${countRequests(loaded)} saved request(s) into a collection — organize them into folders whenever you like.`;
  }
  // 载入共享环境（工具页 api-debugger:env）；本地选中 = 其当前 active。
  try {
    const rawEnv = localStorage.getItem(ENV_KEY);
    envStore.value = migrateEnv(rawEnv ? JSON.parse(rawEnv) : null);
    selectedEnv.value = envStore.value.active;
  }
  catch {
    envStore.value = migrateEnv(null);
    selectedEnv.value = 'Default';
  }
});

// ── 扁平可见行（按折叠状态展开，depth 决定缩进）───────────────────────
interface Row {
  node: TreeNode
  depth: number
  parentId: string | null
}
const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  const walk = (node: CollectionNode, depth: number) => {
    for (const it of node.items) {
      out.push({ node: it, depth, parentId: node.id });
      if (isFolderNode(it) && !collapsed.value.has(it.id)) {
        walk(it, depth + 1);
      }
    }
  };
  walk(tree.value, 0);
  return out;
});

function toggleCollapse(id: string) {
  const next = new Set(collapsed.value);
  if (next.has(id)) {
    next.delete(id);
  }
  else {
    next.add(id);
  }
  collapsed.value = next;
}

// ── 变更动作 ────────────────────────────────────────────────────────
function addRequestTo(parentId: string | null) {
  const r = addRequest(tree.value, parentId, {
    name: 'New request',
    request: { method: 'GET', url: '', headers: [], body: '' },
  });
  if (r.error) {
    banner.value = r.error;
    return;
  }
  if (parentId) {
    collapsed.value = new Set([...collapsed.value].filter(id => id !== parentId));
  }
  applyTree(r.tree);
  if (r.node) {
    selectNode(r.node.id);
    startRename(r.node.id);
  }
}

function addFolderTo(parentId: string | null) {
  const r = addFolder(tree.value, parentId, 'New folder');
  if (r.error) {
    banner.value = r.error;
    return;
  }
  applyTree(r.tree);
  if (r.node) {
    startRename(r.node.id);
  }
}

// ── Postman 导入 / 导出（复用引擎 importCollectionTree / exportCollectionTree，保形树）──
function openImportPicker() {
  filePicker.value?.click();
}

function onImportFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 允许重新选择同名文件
  importWarnings.value = [];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const r = importCollectionTree(String(reader.result ?? ''));
    importWarnings.value = r.warnings;
    if (r.tree.items.length === 0) {
      banner.value = r.warnings[0] ?? 'Nothing could be imported from that file.';
      return;
    }
    // 空工作树：直接采用导入集合（保留集合名与结构，所见即所得）；
    // 非空：原位合并（同 _postman_id 替换、新项追加、双侧根脚本都保留），二次导入幂等。
    if (tree.value.items.length === 0) {
      applyTree(r.tree);
      banner.value = `Imported ${r.requestCount} request(s) as “${r.tree.name}”.`;
    }
    else {
      const merged = mergeImportedTree(tree.value, r.tree);
      applyTree(merged.tree);
      banner.value = `Merged into “${tree.value.name}”: ${merged.added} added, ${merged.replaced} updated in place.`;
    }
    if (r.warnings.length) {
      banner.value += ` ${r.warnings.length} compatibility note(s) below.`;
    }
  };
  reader.onerror = () => {
    banner.value = 'Could not read that file. Try again, or pick a valid Postman v2.1 collection.';
  };
  reader.readAsText(file);
}

function exportPostman() {
  if (tree.value.items.length === 0) {
    banner.value = 'Nothing to export yet — add a request or import a collection first.';
    return;
  }
  const doc = exportCollectionTree(tree.value);
  const ok = downloadTextFile({
    content: JSON.stringify(doc, null, 2),
    filename: buildDownloadFilename('api-studio', 'postman_collection.json'),
    mimeType: 'application/json',
  });
  banner.value = ok
    ? 'Exported a Postman v2.1 collection — folders and scripts kept as a tree. Auth headers were stripped for safe sharing; re-add them in Postman.'
    : 'Export failed: the collection was empty (no file written).';
}

function startRename(id: string) {
  const node = tree.value && findInTree(tree.value, id);
  renamingId.value = id;
  renameValue.value = node ? node.name : '';
}

function findInTree(node: CollectionNode, id: string): TreeNode | null {
  const walk = (items: TreeNode[]): TreeNode | null => {
    for (const it of items) {
      if (it.id === id) {
        return it;
      }
      if (isFolderNode(it)) {
        const f = walk(it.items);
        if (f) {
          return f;
        }
      }
    }
    return null;
  };
  return node.id === id ? node : walk(node.items);
}

function commitRename() {
  if (!renamingId.value) {
    return;
  }
  const r = renameNode(tree.value, renamingId.value, renameValue.value);
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
  renamingId.value = null;
}

function cancelRename() {
  renamingId.value = null;
}

function deleteNodeConfirmed() {
  if (!delTarget.value) {
    return;
  }
  const id = delTarget.value.id;
  const r = removeNode(tree.value, id);
  if (selectedId.value === id || (isFolderNode(delTarget.value) && findRequestNode(r.tree, selectedId.value ?? '') === null)) {
    selectedId.value = null;
  }
  applyTree(r.tree);
  banner.value = r.removedRequests > 0 ? `Deleted folder with ${r.removedRequests} request(s).` : 'Deleted.';
  delTarget.value = null;
}

function moveNode(id: string, targetFolderId: string | null) {
  const r = reparentNode(tree.value, id, targetFolderId);
  if (r.error) {
    banner.value = r.error;
    return;
  }
  if (targetFolderId) {
    collapsed.value = new Set([...collapsed.value].filter(x => x !== targetFolderId));
  }
  applyTree(r.tree);
}

function reorder(id: string, dir: -1 | 1) {
  applyTree(reorderNode(tree.value, id, dir).tree);
}

// ── 选择 / 编辑器 / 脚本 / 继承链 ──────────────────────────────────
function selectNode(id: string) {
  selectedId.value = id;
}
const selectedNode = computed<TreeNode | null>(() =>
  selectedId.value ? findInTree(tree.value, selectedId.value) : null,
);
const selectedRequest = computed<RequestNode | null>(() =>
  selectedId.value ? findRequestNode(tree.value, selectedId.value) : null,
);

const edName = ref('');
const edMethod = ref('GET');
const edUrl = ref('');
const edBody = ref('');
const edHeaders = ref<KV[]>([]);
const edQueryParams = ref<KV[]>([]);
const sendingSingle = ref(false);
const singleResponse = ref<RunnerResponse | null>(null);
const singleError = ref('');
const edPre = ref('');
const edTest = ref('');
// 仅在切换选中节点（id 变化）时回填，避免每次提交后 clobber 用户正在编辑的内容。
watch(() => selectedNode.value?.id, () => {
  const n = selectedNode.value;
  const r = selectedRequest.value;
  edName.value = n?.name ?? '';
  edMethod.value = r?.request.method ?? 'GET';
  edUrl.value = r?.request.url ?? '';
  edBody.value = r?.request.body ?? '';
  edHeaders.value = (r?.request.headers ?? []).map(h => ({ ...h }));
  edQueryParams.value = parseQueryParams(r?.request.url ?? '');
  singleResponse.value = null;
  singleError.value = '';
  edPre.value = n?.scripts?.prerequest ?? '';
  edTest.value = n?.scripts?.test ?? '';
}, { immediate: true });

function commitName() {
  const n = selectedNode.value;
  if (!n) {
    return;
  }
  const r = selectedRequest.value
    ? updateRequestNode(tree.value, n.id, { name: edName.value })
    : renameNode(tree.value, n.id, edName.value);
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
}

function commitRequest() {
  const s = selectedRequest.value;
  if (!s) {
    return;
  }
  // A changed request must not leave an older response looking like the result of the new input.
  singleResponse.value = null;
  singleError.value = '';
  const request = {
    ...s.request,
    method: edMethod.value,
    url: edUrl.value,
    headers: edHeaders.value.filter(h => h.name.trim()),
    body: edBody.value,
  };
  const r = updateRequestNode(tree.value, s.id, { name: edName.value, request });
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
}

function onMethodChange(v: unknown) {
  edMethod.value = String(v);
  commitRequest();
}

function onUrlChange() {
  edQueryParams.value = parseQueryParams(edUrl.value);
  commitRequest();
}

function applyQueryParams() {
  edUrl.value = buildUrlWithQuery(edUrl.value, edQueryParams.value);
  commitRequest();
}

function addQueryParam() {
  edQueryParams.value = [...edQueryParams.value, { name: '', value: '' }];
}

function removeQueryParam(index: number) {
  edQueryParams.value = edQueryParams.value.filter((_, i) => i !== index);
  applyQueryParams();
}

function addHeader() {
  edHeaders.value = [...edHeaders.value, { name: '', value: '' }];
}

function removeHeader(index: number) {
  edHeaders.value = edHeaders.value.filter((_, i) => i !== index);
  commitRequest();
}

function isSensitiveHeader(name: string): boolean {
  return ['authorization', 'cookie', 'x-api-key', 'proxy-authorization'].includes(name.trim().toLowerCase());
}

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  }
  catch {
    return body;
  }
}

function useRedirectTarget() {
  const target = singleResponse.value?.redirect;
  if (!target) {
    return;
  }
  edUrl.value = target;
  onUrlChange();
  singleResponse.value = null;
  singleError.value = '';
}

function commitScripts() {
  const n = selectedNode.value;
  if (!n) {
    return;
  }
  const scripts = { prerequest: edPre.value, test: edTest.value };
  const r = selectedRequest.value
    ? updateRequestNode(tree.value, n.id, { scripts })
    : updateFolderScripts(tree.value, n.id, scripts);
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
}

// 运行期脚本继承链（chainSources）：标注本节点会执行哪些层级的脚本（pre 外→内 / test 内→外）。
const chainView = computed<{ pre: ChainSource[]; test: ChainSource[] } | null>(() =>
  selectedNode.value ? chainSources(tree.value, selectedNode.value.id) : null,
);
function levelLabel(l: ChainSource['level']): string {
  return l === 'collection' ? 'Collection' : l === 'folder' ? 'Folder' : 'Request';
}

// ── 拖拽排序 / 移入文件夹 ──────────────────────────────────────────
function onDragStart(id: string) {
  dragId.value = id;
}
function onDragEnd() {
  dragId.value = null;
  dragOverId.value = null;
}
function onDragOverRow(e: DragEvent, row: Row) {
  if (!dragId.value || dragId.value === row.node.id) {
    return;
  }
  e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const off = e.clientY - rect.top;
  dragOverId.value = row.node.id;
  if (isFolderNode(row.node)) {
    dropPos.value = off < rect.height * 0.28 ? 'before' : off > rect.height * 0.72 ? 'after' : 'inside';
  }
  else {
    dropPos.value = off < rect.height / 2 ? 'before' : 'after';
  }
}
function onDropRow(row: Row) {
  const id = dragId.value;
  const pos = dropPos.value;
  onDragEnd();
  if (!id || id === row.node.id) {
    return;
  }
  // 放进 folder 内部：追加为其最后一个子节点。
  if (isFolderNode(row.node) && pos === 'inside') {
    moveNode(id, row.node.id);
    return;
  }
  // 同级排序：算出「移除被拖节点后」目标父 items 中参照节点的位置，得最终插入下标，
  // 交给 reparentNode（它先 append 再 splice 到 index）。跨父移动时 filtered==目标父原 items。
  const parent = (row.parentId ? findInTree(tree.value, row.parentId) : null) ?? tree.value;
  const siblings = (parent as CollectionNode).items.filter(it => it.id !== id);
  const refPos = siblings.findIndex(it => it.id === row.node.id);
  if (refPos < 0) {
    return;
  }
  const finalIndex = pos === 'before' ? refPos : refPos + 1;
  const targetFolderId = row.parentId && row.parentId !== tree.value.id ? row.parentId : null;
  const r = reparentNode(tree.value, id, targetFolderId, finalIndex);
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
}

// 运行用环境 = 共享 store 的变量，但用本地 selectedEnv 覆盖 active（不写回，避免耦合工具页）。
const env = computed<Record<string, string>>(() => activeVars({ ...envStore.value, active: selectedEnv.value }));
const envOptions = computed(() => envNames(envStore.value).map(n => ({ label: n, value: n })));
const envVarCount = computed(() => Object.keys(env.value).length);
function onEnvChange(v: unknown) {
  selectedEnv.value = String(v);
}

// ── 运行 ────────────────────────────────────────────────────────────
const runnerSend: SendFn = async (payload) => {
  const res = await fetch('/api/apiproxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((j && j.error) || `Proxy returned HTTP ${res.status}.`);
  }
  return j as RunnerResponse;
};

async function sendSelectedRequest() {
  const selected = selectedRequest.value;
  if (!selected || sendingSingle.value) {
    return;
  }

  edUrl.value = buildUrlWithQuery(edUrl.value, edQueryParams.value);
  commitRequest();
  const request = {
    method: edMethod.value,
    url: edUrl.value,
    headers: edHeaders.value.filter(h => h.name.trim()),
    body: edBody.value,
  };
  const { payload, missing } = buildProxyPayload(request, env.value);
  if (missing.length) {
    singleResponse.value = null;
    singleError.value = `Missing variables: ${missing.join(', ')}. Define them in the selected environment.`;
    return;
  }

  sendingSingle.value = true;
  singleError.value = '';
  singleResponse.value = null;
  try {
    const response = await runnerSend(payload);
    singleResponse.value = response;
    banner.value = `Received HTTP ${response.status} in ${response.elapsedMs} ms.`;
  }
  catch (e) {
    singleError.value = e instanceof Error ? e.message : String(e);
    banner.value = 'Request could not be completed. Review the error and try again.';
  }
  finally {
    sendingSingle.value = false;
  }
}

async function onRun() {
  if (countRequests(tree.value) === 0) {
    banner.value = 'Nothing to run yet — add a request first.';
    return;
  }
  running.value = true;
  runOutput.value = '';
  runSummary.value = null;
  try {
    const summary = await runCollectionTree(tree.value, env.value, runnerSend, {
      runScript: (code, snapshot) => runScriptIsolated(code, snapshot, runnerSend),
    });
    runSummary.value = summary;
    runOutput.value = formatCollectionReportText(summary);
    banner.value = `Run finished — ${summary.total - summary.failed} of ${summary.total} request(s) ok.`;
  }
  catch (e) {
    banner.value = `Run could not start: ${e instanceof Error ? e.message : String(e)}`;
  }
  finally {
    running.value = false;
  }
}

function dismissRun() {
  runSummary.value = null;
  runOutput.value = '';
}

// ── 视图辅助 ────────────────────────────────────────────────────────
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const methodOptions = METHODS.map(m => ({ label: m, value: m }));
function methodColor(m: string): string {
  const key: Record<string, string> = {
    GET: '--api-method-get',
    POST: '--api-method-post',
    PUT: '--api-method-put',
    PATCH: '--api-method-patch',
    DELETE: '--api-method-delete',
    HEAD: '--api-method-head',
    OPTIONS: '--api-method-options',
  };
  return `var(${key[m.toUpperCase()] ?? '--api-method-neutral'})`;
}

function nodeMenu(node: TreeNode): DropdownOption[] {
  const targets: DropdownOption[] = [
    { label: 'Top level', key: 'move:__root' },
    ...folderMoveOptions(tree.value, node.id).map(o => ({ label: o.label, key: `move:${o.value}` })),
  ];
  const base: DropdownOption[] = [{ label: 'Rename', key: 'rename' }];
  if (isFolderNode(node)) {
    base.push({ label: 'Add request', key: 'add-request' }, { label: 'Add folder', key: 'add-folder' });
  }
  base.push({ label: 'Move to…', key: 'move', children: targets });
  base.push({ label: 'Delete', key: 'delete' });
  return base;
}

function onMenuSelect(key: string, node: TreeNode) {
  if (key === 'rename') {
    startRename(node.id);
  }
  else if (key === 'add-request') {
    addRequestTo(node.id);
  }
  else if (key === 'add-folder') {
    addFolderTo(node.id);
  }
  else if (key === 'delete') {
    delTarget.value = node;
  }
  else if (key.startsWith('move:')) {
    const t = key.slice(5);
    moveNode(node.id, t === '__root' ? null : t);
  }
}
</script>

<template>
  <div class="api-workspace">
    <!-- 集合树侧栏 -->
    <aside class="api-sidebar" aria-label="Collections">
      <div class="api-sidebar-head">
        <span class="api-sidebar-title">Collections</span>
        <span class="api-count">{{ countRequests(tree) }}</span>
      </div>

      <div class="api-toolbar">
        <button class="api-tool-btn" type="button" title="New request" data-test-id="add-request" @click="addRequestTo(null)">
          + Request
        </button>
        <button class="api-tool-btn" type="button" title="New folder" data-test-id="add-folder" @click="addFolderTo(null)">
          + Folder
        </button>
        <button
          class="api-tool-btn api-run-btn"
          type="button"
          :disabled="running || countRequests(tree) === 0"
          data-test-id="run-collection"
          @click="onRun"
        >
          {{ running ? 'Running…' : 'Run' }}
        </button>
      </div>

      <div class="api-io-row">
        <button class="api-tool-btn" type="button" title="Import a Postman v2.1 collection" data-test-id="import-collection" @click="openImportPicker">
          Import Postman
        </button>
        <button class="api-tool-btn" type="button" title="Export this collection as Postman v2.1" data-test-id="export-collection" @click="exportPostman">
          Export
        </button>
        <input
          ref="filePicker"
          type="file"
          accept=".json,application/json"
          class="api-file-input"
          data-test-id="import-file"
          @change="onImportFilePicked"
        >
      </div>

      <div v-if="importWarnings.length" class="api-import-notes" data-test-id="import-warnings">
        <div class="api-import-notes-head">
          Import notes ({{ importWarnings.length }})
        </div>
        <ul class="api-import-notes-list">
          <li v-for="(note, i) in importWarnings" :key="i">
            {{ note }}
          </li>
        </ul>
      </div>

      <div class="api-envbar" data-test-id="env-bar">
        <span class="api-envbar-label">Environment</span>
        <n-select
          :value="selectedEnv"
          :options="envOptions"
          size="small"
          class="api-env-select"
          data-test-id="env-select"
          @update:value="onEnvChange"
        />
        <span class="api-envbar-count" data-test-id="env-count">{{ envVarCount }} var(s)</span>
      </div>

      <div class="api-tree" role="tree" data-test-id="api-studio-tree">
        <!-- 集合根：选中即可编辑集合级脚本（继承链最外层） -->
        <div
          class="api-row api-root-row"
          :class="{ 'is-selected': selectedId === tree.id }"
          role="treeitem"
          :aria-selected="selectedId === tree.id"
          data-test-id="api-studio-root"
          @click="selectNode(tree.id)"
        >
          <span class="api-caret-spacer" aria-hidden="true" />
          <span class="api-folder-ico" aria-hidden="true">◈</span>
          <span class="api-row-name">{{ tree.name }}</span>
          <span class="api-root-tag">collection</span>
        </div>

        <div v-if="rows.length === 0" class="api-empty">
          <p class="api-empty-title">
            No requests yet
          </p>
          <p class="api-empty-hint">
            Add a request, or group them into folders to build a collection you can run in order.
          </p>
        </div>

        <div
          v-for="row in rows"
          :key="row.node.id"
          class="api-row"
          :class="{
            'is-selected': row.node.id === selectedId,
            'is-dragging': dragId === row.node.id,
            'drop-inside': dragOverId === row.node.id && dropPos === 'inside',
            'drop-before': dragOverId === row.node.id && dropPos === 'before',
            'drop-after': dragOverId === row.node.id && dropPos === 'after',
          }"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          role="treeitem"
          :aria-selected="row.node.id === selectedId"
          data-test-id="tree-row"
          :data-node-type="isFolderNode(row.node) ? 'folder' : 'request'"
          :data-node-name="row.node.name"
          :data-depth="row.depth"
          draggable="true"
          @dragstart="onDragStart(row.node.id)"
          @dragend="onDragEnd"
          @dragover="onDragOverRow($event, row)"
          @drop="onDropRow(row)"
        >
          <!-- 文件夹 -->
          <template v-if="isFolderNode(row.node)">
            <button class="api-caret" type="button" :aria-label="collapsed.has(row.node.id) ? 'Expand' : 'Collapse'" @click.stop="toggleCollapse(row.node.id)">
              <span class="api-caret-glyph" :class="{ 'is-open': !collapsed.has(row.node.id) }">▸</span>
            </button>
            <span class="api-folder-ico" aria-hidden="true">▤</span>

            <input
              v-if="renamingId === row.node.id"
              v-model="renameValue"
              class="api-rename"
              @keyup.enter="commitRename"
              @keyup.esc="cancelRename"
              @blur="commitRename"
            >
            <span v-else class="api-row-name" data-test-id="tree-name" @click="selectNode(row.node.id)" @dblclick="startRename(row.node.id)">
              {{ row.node.name }}
            </span>

            <div class="api-row-actions">
              <button class="api-mini-btn" type="button" title="Add request here" data-test-id="add-request-into" @click.stop="addRequestTo(row.node.id)">
                +
              </button>
              <n-dropdown trigger="click" :options="nodeMenu(row.node)" @select="(k: string) => onMenuSelect(k, row.node)">
                <button class="api-mini-btn" type="button" aria-label="More actions" @click.stop>
                  ⋯
                </button>
              </n-dropdown>
            </div>
          </template>

          <!-- 请求 -->
          <template v-else>
            <span class="api-caret-spacer" aria-hidden="true" />
            <button class="api-method-badge" type="button" data-test-id="tree-method" :style="{ color: methodColor(row.node.request.method), borderColor: methodColor(row.node.request.method) }" @click.stop="selectNode(row.node.id)">
              {{ row.node.request.method }}
            </button>

            <input
              v-if="renamingId === row.node.id"
              v-model="renameValue"
              class="api-rename"
              @keyup.enter="commitRename"
              @keyup.esc="cancelRename"
              @blur="commitRename"
            >
            <span v-else class="api-row-name" data-test-id="tree-name" @click="selectNode(row.node.id)" @dblclick="startRename(row.node.id)">
              {{ row.node.name }}
            </span>

            <div class="api-row-actions">
              <button class="api-mini-btn" type="button" title="Move up" @click.stop="reorder(row.node.id, -1)">
                ↑
              </button>
              <button class="api-mini-btn" type="button" title="Move down" @click.stop="reorder(row.node.id, 1)">
                ↓
              </button>
              <n-dropdown trigger="click" :options="nodeMenu(row.node)" @select="(k: string) => onMenuSelect(k, row.node)">
                <button class="api-mini-btn" type="button" aria-label="More actions" @click.stop>
                  ⋯
                </button>
              </n-dropdown>
            </div>
          </template>
        </div>
      </div>
    </aside>

    <!-- 请求编辑 / 运行输出 -->
    <section class="api-editor" aria-label="Request">
      <div v-if="banner" class="api-banner" role="status" data-test-id="banner">
        {{ banner }}
      </div>

      <div v-if="selectedNode" class="api-editor-form">
        <div class="api-field-row">
          <input v-model="edName" class="api-name-input" data-test-id="editor-name" :placeholder="selectedRequest ? 'Request name' : 'Name'" @change="commitName">
          <n-select v-if="selectedRequest" :value="edMethod" :options="methodOptions" class="api-method-select" data-test-id="editor-method" @update:value="onMethodChange" />
          <button
            v-if="selectedRequest"
            class="api-tool-btn api-send-btn"
            type="button"
            data-test-id="send-request"
            :disabled="sendingSingle"
            @click="sendSelectedRequest"
          >
            {{ sendingSingle ? 'Sending…' : 'Send' }}
          </button>
        </div>

        <template v-if="selectedRequest">
          <input v-model="edUrl" class="api-url-input" data-test-id="editor-url" placeholder="https://api.example.com/endpoint" @change="onUrlChange">

          <section class="api-request-section" aria-label="Query parameters" data-test-id="query-params">
            <div class="api-request-section-head">
              <span>Query params</span>
              <button class="api-mini-action" type="button" data-test-id="add-query-param" @click="addQueryParam">+ Add</button>
            </div>
            <div v-for="(param, i) in edQueryParams" :key="`query-${i}`" class="api-kv-row">
              <input v-model="param.name" class="api-kv-input" :aria-label="`Query parameter ${i + 1} name`" data-test-id="query-name" placeholder="Parameter" />
              <input v-model="param.value" class="api-kv-input" :aria-label="`Query parameter ${i + 1} value`" data-test-id="query-value" placeholder="Value" />
              <button class="api-mini-action" type="button" :aria-label="`Remove query parameter ${i + 1}`" @click="removeQueryParam(i)">×</button>
            </div>
            <div class="api-request-section-foot">
              <button class="api-mini-action" type="button" data-test-id="apply-query-params" @click="applyQueryParams">Apply to URL</button>
              <span class="api-field-hint">Repeated keys and empty values are preserved.</span>
            </div>
          </section>

          <section class="api-request-section" aria-label="Request headers" data-test-id="request-headers">
            <div class="api-request-section-head">
              <span>Headers <span class="api-field-hint">Sensitive values are masked</span></span>
              <button class="api-mini-action" type="button" data-test-id="add-header" @click="addHeader">+ Add</button>
            </div>
            <div v-for="(header, i) in edHeaders" :key="`header-${i}`" class="api-kv-row">
              <input v-model="header.name" class="api-kv-input" :aria-label="`Header ${i + 1} name`" data-test-id="header-name" placeholder="Header name" @change="commitRequest" />
              <input
                v-model="header.value"
                @change="commitRequest"
                class="api-kv-input"
                :type="isSensitiveHeader(header.name) ? 'password' : 'text'"
                :aria-label="`Header ${i + 1} value`"
                data-test-id="header-value"
                :placeholder="isSensitiveHeader(header.name) ? 'Sensitive value (masked)' : 'Value'"
              />
              <button class="api-mini-action" type="button" :aria-label="`Remove header ${i + 1}`" @click="removeHeader(i)">×</button>
            </div>
            <p class="api-field-hint">Authorization and API-key headers are sent only when you choose Send or Run.</p>
          </section>

          <textarea v-model="edBody" class="api-body-input" data-test-id="editor-body" placeholder="Request body (raw)" @change="commitRequest" />
          <div v-if="singleError" class="api-response-error" role="alert" data-test-id="single-send-error">
            {{ singleError }}
          </div>
          <section v-if="singleResponse" class="api-response-panel" data-test-id="single-response" aria-label="Response">
            <div class="api-response-head">
              <div class="api-response-status">
                <span class="api-response-code" :data-ok="singleResponse.status >= 200 && singleResponse.status < 400">{{ singleResponse.status }} {{ singleResponse.statusText }}</span>
                <span class="api-field-hint">{{ singleResponse.elapsedMs }} ms · {{ singleResponse.url }}</span>
              </div>
              <button class="api-mini-action" type="button" data-test-id="clear-response" @click="singleResponse = null">Clear</button>
            </div>
            <p v-if="singleResponse.note" class="api-response-note">{{ singleResponse.note }}</p>
            <div v-if="singleResponse.redirect" class="api-response-redirect">
              <span>Redirect target: <code>{{ singleResponse.redirect }}</code></span>
              <button class="api-mini-action" type="button" data-test-id="use-redirect-target" @click="useRedirectTarget">Use target</button>
            </div>
            <details class="api-response-headers">
              <summary>Response headers ({{ Object.keys(singleResponse.headers).length }})</summary>
              <pre>{{ JSON.stringify(singleResponse.headers, null, 2) }}</pre>
            </details>
            <pre class="api-response-body" data-test-id="single-response-body">{{ formatResponseBody(singleResponse.body) }}</pre>
          </section>
        </template>

        <!-- 脚本面板 + 三层继承链 -->
        <div class="api-scripts" data-test-id="script-panel">
          <div class="api-scripts-head">
            <span class="api-scripts-title">Scripts</span>
            <span class="api-scripts-hint">pm.* runs in an isolated Worker · network only through the trusted relay</span>
          </div>

          <label class="api-script-label">Pre-request</label>
          <textarea v-model="edPre" class="api-script-input" data-test-id="script-pre" placeholder="Runs before — collection → folder → request, outer first." @change="commitScripts" />

          <label class="api-script-label">Tests</label>
          <textarea v-model="edTest" class="api-script-input" data-test-id="script-test" placeholder="Runs after the response — request → folder → collection, inner first." @change="commitScripts" />

          <div v-if="chainView" class="api-chain" data-test-id="script-chain">
            <div class="api-chain-head">
              What runs for this {{ selectedRequest ? 'request' : (selectedNode && isFolderNode(selectedNode) ? 'folder' : 'collection') }}
            </div>
            <div class="api-chain-cols">
              <div class="api-chain-col" data-test-id="chain-before">
                <span class="api-chain-col-title">Before · outer → inner</span>
                <ul class="api-chain-list">
                  <li v-for="s in chainView.pre" :key="`pre-${s.id}`" class="api-chain-item" data-test-id="chain-item" data-chain-phase="before" :data-level="s.level" :data-self="s.id === selectedId" :data-has-scripts="s.hasScripts" :class="{ 'is-self': s.id === selectedId, 'has-scripts': s.hasScripts }">
                    <span class="api-chain-level" :data-level="s.level">{{ levelLabel(s.level) }}</span>
                    <span class="api-chain-name">{{ s.name }}</span>
                    <span class="api-chain-dot" :class="{ on: s.hasScripts }" :title="s.hasScripts ? 'has scripts' : 'no scripts'" />
                  </li>
                </ul>
              </div>
              <div class="api-chain-col" data-test-id="chain-after">
                <span class="api-chain-col-title">After · inner → outer</span>
                <ul class="api-chain-list">
                  <li v-for="s in chainView.test" :key="`test-${s.id}`" class="api-chain-item" data-test-id="chain-item" data-chain-phase="after" :data-level="s.level" :data-self="s.id === selectedId" :data-has-scripts="s.hasScripts" :class="{ 'is-self': s.id === selectedId, 'has-scripts': s.hasScripts }">
                    <span class="api-chain-level" :data-level="s.level">{{ levelLabel(s.level) }}</span>
                    <span class="api-chain-name">{{ s.name }}</span>
                    <span class="api-chain-dot" :class="{ on: s.hasScripts }" :title="s.hasScripts ? 'has scripts' : 'no scripts'" />
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="api-editor-empty">
        <div class="api-editor-mark" aria-hidden="true">
          <span class="api-method-badge static" style="color: var(--api-method-get); border-color: var(--api-method-get)">GET</span>
          <span class="api-url-ghost">https://api.example.com/…</span>
        </div>
        <h2 class="api-editor-title">
          A calmer place to build and test APIs
        </h2>
        <p class="api-editor-sub">
          Pick a request on the left to edit it, or add a new one. Group related calls into folders —
          a folder's scripts apply to everything inside it, and the whole collection runs in order.
        </p>
        <p class="api-editor-note">
          Your data stays on this machine. Requests run through the same trusted relay the API tool uses.
        </p>
      </div>

      <!-- 运行结果：无论是否选中节点都展示（Run 之后总该看得到报告）。 -->
      <div v-if="runSummary" class="api-run-result" data-test-id="run-result">
        <div class="api-run-summary">
          <span class="api-run-line">
            {{ runSummary.total - runSummary.failed }}/{{ runSummary.total }} requests ·
            {{ runSummary.assertionsPassed }}/{{ runSummary.assertionsTotal }} assertions ·
            {{ runSummary.scriptTestsPassed }}/{{ runSummary.scriptTestsTotal }} script tests
          </span>
          <button class="api-tool-btn" type="button" @click="dismissRun">
            Dismiss
          </button>
        </div>
        <pre class="api-run-output">{{ runOutput }}</pre>
      </div>
    </section>

    <!-- 删除确认 -->
    <n-modal :show="!!delTarget" preset="dialog" type="warning" title="Delete" positive-text="Delete" negative-text="Cancel" @update:show="(v: boolean) => { if (!v) delTarget = null }" @positive-click="deleteNodeConfirmed" @negative-click="delTarget = null">
      <p v-if="delTarget && isFolderNode(delTarget)">
        Delete folder “{{ delTarget.name }}” and everything inside it? This can’t be undone.
      </p>
      <p v-else-if="delTarget">
        Delete “{{ delTarget.name }}”? This can’t be undone.
      </p>
    </n-modal>
  </div>
</template>

<style scoped>
.api-workspace {
  display: flex;
  height: 100%;
  min-height: 0;
}

/* ---------- 侧栏 ---------- */
.api-sidebar {
  display: flex;
  flex-direction: column;
  flex: 0 0 var(--api-sidebar-w);
  width: var(--api-sidebar-w);
  min-height: 0;
  background: var(--api-surface-2);
  border-right: 1px solid var(--api-border);
}

.api-sidebar-head {
  display: flex;
  align-items: center;
  gap: var(--api-gap-sm);
  height: 40px;
  flex: 0 0 40px;
  padding: 0 var(--api-gap);
  border-bottom: 1px solid var(--api-border);
}

.api-sidebar-title {
  font-size: var(--api-fs-sm);
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--api-text-muted);
}

.api-count {
  margin-left: auto;
  font-size: var(--api-fs-xs);
  font-family: var(--api-font-mono);
  color: var(--api-text-faint);
  background: var(--api-surface-3);
  padding: 1px 7px;
  border-radius: 999px;
}

.api-toolbar {
  display: flex;
  gap: 6px;
  padding: var(--api-gap-sm) var(--api-gap);
  border-bottom: 1px solid var(--api-border);
}

.api-tool-btn {
  flex: 1 1 auto;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.api-tool-btn:hover:not(:disabled) {
  border-color: var(--api-primary-line);
  color: var(--api-text);
}

.api-tool-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.api-run-btn {
  background: var(--api-primary-soft);
  border-color: var(--api-primary-line);
  color: var(--api-primary);
  font-weight: 600;
}

.api-io-row {
  display: flex;
  gap: 6px;
  padding: 0 var(--api-gap) var(--api-gap-sm);
  border-bottom: 1px solid var(--api-border);
}

/* 隐藏文件选择器：仅由 Import 按钮以编程方式触发，不进布局 */
.api-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.api-import-notes {
  margin: 0 var(--api-gap) var(--api-gap-sm);
  padding: var(--api-gap-sm) var(--api-gap);
  border: 1px solid var(--api-warning-line, var(--api-border));
  border-radius: var(--api-radius-sm);
  background: var(--api-warning-soft, var(--api-surface));
}

.api-import-notes-head {
  font-size: var(--api-fs-sm);
  font-weight: 600;
  color: var(--api-text);
  margin-bottom: 4px;
}

.api-import-notes-list {
  margin: 0;
  padding-left: 16px;
  font-size: var(--api-fs-sm);
  color: var(--api-text-soft);
  line-height: 1.5;
}

.api-import-notes-list li {
  margin: 2px 0;
}

.api-envbar {
  display: flex;
  align-items: center;
  gap: var(--api-gap-sm);
  padding: 6px var(--api-gap);
  border-bottom: 1px solid var(--api-border);
  background: var(--api-surface);
}

.api-envbar-label {
  font-size: var(--api-fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--api-text-muted);
  white-space: nowrap;
}

.api-env-select {
  flex: 1 1 auto;
  min-width: 0;
}

.api-envbar-count {
  font-size: var(--api-fs-xs);
  font-family: var(--api-font-mono);
  color: var(--api-text-faint);
  white-space: nowrap;
}

.api-tree {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 6px 0;
}

.api-empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--api-text-muted);
}

.api-empty-title {
  margin: 0 0 6px;
  font-size: var(--api-fs-md);
  font-weight: 600;
  color: var(--api-text-soft);
}

.api-empty-hint {
  margin: 0;
  font-size: var(--api-fs-sm);
  line-height: 1.55;
}

.api-row {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--api-row-h);
  padding-right: 6px;
  color: var(--api-text-soft);
  user-select: none;
}

.api-row:hover {
  background: var(--api-surface-3);
}

.api-row.is-selected {
  background: var(--api-primary-soft);
}

.api-caret,
.api-caret-spacer {
  width: 16px;
  flex: 0 0 16px;
}

.api-caret {
  border: none;
  background: none;
  color: var(--api-text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.api-caret-glyph {
  display: inline-block;
  transition: transform 0.12s ease;
}

.api-caret-glyph.is-open {
  transform: rotate(90deg);
}

.api-folder-ico {
  color: var(--api-text-muted);
  font-size: var(--api-fs);
}

.api-method-badge {
  flex: 0 0 auto;
  min-width: 46px;
  text-align: center;
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-xs);
  font-weight: 700;
  letter-spacing: 0.3px;
  padding: 2px 6px;
  border: 1px solid;
  border-radius: var(--api-radius-sm);
  background: transparent;
  cursor: pointer;
}

.api-method-badge.static {
  cursor: default;
}

.api-row-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--api-fs);
  cursor: pointer;
}

.api-rename {
  flex: 1 1 auto;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--api-primary-line);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text);
  font-size: var(--api-fs);
  outline: none;
}

.api-row-actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}

.api-row:hover .api-row-actions,
.api-row.is-selected .api-row-actions {
  display: inline-flex;
}

.api-mini-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--api-radius-sm);
  background: none;
  color: var(--api-text-muted);
  cursor: pointer;
  font-size: var(--api-fs);
  line-height: 1;
}

.api-mini-btn:hover:not(:disabled) {
  background: var(--api-elevated);
  color: var(--api-text);
}

.api-mini-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ---------- 编辑区 ---------- */
.api-editor {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: var(--api-pad) var(--api-gap-lg);
  overflow: auto;
}

.api-banner {
  align-self: stretch;
  margin-bottom: var(--api-gap);
  padding: 8px 12px;
  border: 1px solid var(--api-primary-line);
  border-radius: var(--api-radius);
  background: var(--api-primary-soft);
  color: var(--api-text);
  font-size: var(--api-fs-sm);
}

.api-editor-form {
  display: flex;
  flex-direction: column;
  gap: var(--api-gap);
  max-width: 860px;
}

.api-field-row {
  display: flex;
  gap: var(--api-gap-sm);
}

.api-send-btn {
  flex: 0 0 76px;
  min-height: 34px;
}

.api-request-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
}

.api-request-section-head,
.api-request-section-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  font-weight: 600;
}

.api-request-section-foot {
  justify-content: flex-start;
  font-weight: 400;
}

.api-kv-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) 28px;
  gap: 6px;
  align-items: center;
}

.api-kv-input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text);
  font: inherit;
  font-size: var(--api-fs-sm);
}

.api-kv-input:focus {
  outline: none;
  border-color: var(--api-primary);
  box-shadow: var(--api-focus-ring);
}

.api-mini-action {
  min-width: 28px;
  min-height: 28px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  padding: 3px 7px;
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font: inherit;
  font-size: var(--api-fs-sm);
  cursor: pointer;
}

.api-mini-action:hover {
  border-color: var(--api-primary-line);
  color: var(--api-text);
}

.api-field-hint {
  color: var(--api-text-faint);
  font-size: var(--api-fs-xs);
  font-weight: 400;
}

.api-response-error {
  padding: 9px 12px;
  border: 1px solid var(--api-danger, #d45b5b);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-danger, #d45b5b);
  font-size: var(--api-fs-sm);
  overflow-wrap: anywhere;
}

.api-response-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
}

.api-response-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.api-response-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.api-response-code {
  color: var(--api-danger, #d45b5b);
  font-family: var(--api-font-mono);
  font-weight: 700;
}

.api-response-code[data-ok="true"] {
  color: var(--api-success);
}

.api-response-note,
.api-response-redirect {
  margin: 0;
  padding: 8px;
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  overflow-wrap: anywhere;
}

.api-response-redirect {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.api-response-headers {
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
}

.api-response-headers pre {
  overflow: auto;
  max-height: 180px;
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-xs);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.api-response-body {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text);
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.api-name-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text);
  font-size: var(--api-fs-md);
}

.api-method-select {
  flex: 0 0 130px;
}

.api-url-input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text);
  font-family: var(--api-font-mono);
  font-size: var(--api-fs);
}

.api-body-input {
  min-height: 180px;
  resize: vertical;
  padding: 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text);
  font-family: var(--api-font-mono);
  font-size: var(--api-fs);
  line-height: 1.5;
}

.api-name-input:focus,
.api-url-input:focus,
.api-body-input:focus,
.api-rename:focus {
  outline: none;
  border-color: var(--api-primary);
  box-shadow: var(--api-focus-ring);
}

.api-run-result {
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
  overflow: hidden;
}

.api-run-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--api-gap);
  padding: 8px 12px;
  border-bottom: 1px solid var(--api-border);
  font-size: var(--api-fs-sm);
  color: var(--api-text-soft);
}

.api-run-line {
  font-family: var(--api-font-mono);
}

.api-run-output {
  margin: 0;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-sm);
  line-height: 1.5;
  color: var(--api-text-soft);
  white-space: pre-wrap;
}

.api-editor-empty {
  margin: auto;
  max-width: 520px;
  text-align: center;
}

.api-editor-mark {
  display: inline-flex;
  align-items: center;
  gap: var(--api-gap-sm);
  padding: 8px 12px;
  margin-bottom: var(--api-gap-lg);
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
  box-shadow: var(--api-shadow-sm);
}

.api-url-ghost {
  font-family: var(--api-font-mono);
  font-size: var(--api-fs);
  color: var(--api-text-faint);
}

.api-editor-title {
  margin: 0 0 var(--api-gap);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.2px;
  color: var(--api-text);
}

.api-editor-sub {
  margin: 0 0 var(--api-gap);
  font-size: var(--api-fs-md);
  line-height: 1.6;
  color: var(--api-text-soft);
}

.api-editor-note {
  margin: 0;
  font-size: var(--api-fs-sm);
  line-height: 1.6;
  color: var(--api-text-muted);
}

/* ---------- 集合根行 ---------- */
.api-root-row {
  border-bottom: 1px solid var(--api-border);
  margin-bottom: 4px;
  cursor: pointer;
}

.api-root-tag {
  font-size: var(--api-fs-xs);
  color: var(--api-text-faint);
  background: var(--api-surface-3);
  padding: 1px 6px;
  border-radius: 999px;
  margin-left: auto;
}

/* ---------- 拖拽放置指示 ---------- */
.api-row {
  position: relative;
}

.is-dragging {
  opacity: 0.4;
}

.drop-inside {
  background: var(--api-primary-soft);
  outline: 1px dashed var(--api-primary-line);
  outline-offset: -1px;
  border-radius: var(--api-radius-sm);
}

.drop-before::before,
.drop-after::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  background: var(--api-primary);
  border-radius: 2px;
}

.drop-before::before {
  top: -1px;
}

.drop-after::after {
  bottom: -1px;
}

/* ---------- 脚本面板 ---------- */
.api-scripts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: var(--api-gap);
  padding: var(--api-gap);
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
}

.api-scripts-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--api-gap);
  flex-wrap: wrap;
  margin-bottom: 2px;
}

.api-scripts-title {
  font-size: var(--api-fs-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--api-text-soft);
}

.api-scripts-hint {
  font-size: var(--api-fs-xs);
  color: var(--api-text-faint);
}

.api-script-label {
  font-size: var(--api-fs-sm);
  color: var(--api-text-muted);
  margin-top: 4px;
}

.api-script-input {
  min-height: 92px;
  resize: vertical;
  padding: 8px 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text);
  font-family: var(--api-font-mono);
  font-size: var(--api-fs);
  line-height: 1.5;
}

.api-script-input:focus {
  outline: none;
  border-color: var(--api-primary);
  box-shadow: var(--api-focus-ring);
}

/* ---------- 继承链视图 ---------- */
.api-chain {
  margin-top: var(--api-gap-sm);
  padding-top: var(--api-gap-sm);
  border-top: 1px solid var(--api-border);
}

.api-chain-head {
  font-size: var(--api-fs-sm);
  color: var(--api-text-soft);
  margin-bottom: var(--api-gap-sm);
}

.api-chain-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--api-gap);
}

.api-chain-col-title {
  display: block;
  font-size: var(--api-fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--api-text-faint);
  margin-bottom: 6px;
}

.api-chain-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.api-chain-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  font-size: var(--api-fs-sm);
  color: var(--api-text-soft);
}

.api-chain-item.is-self {
  background: var(--api-primary-soft);
  color: var(--api-text);
}

.api-chain-level {
  font-size: var(--api-fs-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--api-surface-3);
  color: var(--api-text-muted);
  white-space: nowrap;
}

.api-chain-level[data-level="collection"] {
  color: var(--api-info);
}

.api-chain-level[data-level="folder"] {
  color: var(--api-warning);
}

.api-chain-level[data-level="request"] {
  color: var(--api-primary);
}

.api-chain-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-chain-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--api-text-faint);
  opacity: 0.5;
}

.api-chain-dot.on {
  background: var(--api-success);
  opacity: 1;
}

@media (max-width: 720px) {
  .api-chain-cols {
    grid-template-columns: 1fr;
  }

  .api-field-row {
    flex-wrap: wrap;
  }

  .api-name-input {
    flex: 1 1 100%;
  }

  .api-method-select {
    flex: 1 1 auto;
    min-width: 120px;
  }

  .api-send-btn {
    flex: 0 0 88px;
    min-height: 40px;
  }

  .api-kv-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) 28px;
  }
}
</style>
