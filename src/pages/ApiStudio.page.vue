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
import type { CollectionNode, RequestNode, TreeNode } from '@/tools/api-debugger/collection-tree';
import {
  addFolder,
  addRequest,
  countRequests,
  findRequestNode,
  folderMoveOptions,
  isFolderNode,
  loadCollectionTree,
  removeNode,
  renameNode,
  reorderNode,
  reparentNode,
  serializeCollectionTree,
  updateRequestNode,
} from '@/tools/api-debugger/collection-tree';
import type { CollectionRunSummary, RunnerResponse, SendFn } from '@/tools/api-debugger/runner';
import { formatCollectionReportText, runCollectionTree } from '@/tools/api-debugger/runner';
import { runScriptIsolated } from '@/tools/api-debugger/script-sandbox';

const TREE_KEY = '***';
const LEGACY_SAVED_KEY = 'api-deb…aved';
const LEGACY_SCRIPTS_KEY = 'api-deb…ipts';

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
    selectRequest(r.node.id);
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

// ── 选择 / 编辑器 ───────────────────────────────────────────────────
function selectRequest(id: string) {
  selectedId.value = id;
}
const selected = computed<RequestNode | null>(() =>
  selectedId.value ? findRequestNode(tree.value, selectedId.value) : null,
);

const edName = ref('');
const edMethod = ref('GET');
const edUrl = ref('');
const edBody = ref('');
watch(() => selected.value?.id, () => {
  const s = selected.value;
  edName.value = s?.name ?? '';
  edMethod.value = s?.request.method ?? 'GET';
  edUrl.value = s?.request.url ?? '';
  edBody.value = s?.request.body ?? '';
}, { immediate: true });

function commitEditor() {
  if (!selectedId.value || !selected.value) {
    return;
  }
  const request = { ...selected.value.request, method: edMethod.value, url: edUrl.value, body: edBody.value };
  const r = updateRequestNode(tree.value, selectedId.value, { name: edName.value, request });
  if (r.error) {
    banner.value = r.error;
  }
  else {
    applyTree(r.tree);
  }
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

async function onRun() {
  if (countRequests(tree.value) === 0) {
    banner.value = 'Nothing to run yet — add a request first.';
    return;
  }
  running.value = true;
  runOutput.value = '';
  runSummary.value = null;
  try {
    const summary = await runCollectionTree(tree.value, {}, runnerSend, {
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

const canReorder = computed(() => rows.value.length > 0);
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
        <button class="api-tool-btn" type="button" title="New request" @click="addRequestTo(null)">
          + Request
        </button>
        <button class="api-tool-btn" type="button" title="New folder" @click="addFolderTo(null)">
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

      <div class="api-tree" role="tree">
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
          :class="{ 'is-selected': 'request' in row.node && row.node.id === selectedId }"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          role="treeitem"
          :aria-selected="'request' in row.node && row.node.id === selectedId"
        >
          <!-- 文件夹 -->
          <template v-if="isFolderNode(row.node)">
            <button class="api-caret" type="button" :aria-label="collapsed.has(row.node.id) ? 'Expand' : 'Collapse'" @click="toggleCollapse(row.node.id)">
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
            <span v-else class="api-row-name" @dblclick="startRename(row.node.id)">
              {{ row.node.name }}
            </span>

            <div class="api-row-actions">
              <button class="api-mini-btn" type="button" title="Add request here" @click="addRequestTo(row.node.id)">
                +
              </button>
              <n-dropdown trigger="click" :options="nodeMenu(row.node)" @select="(k: string) => onMenuSelect(k, row.node)">
                <button class="api-mini-btn" type="button" aria-label="More actions">
                  ⋯
                </button>
              </n-dropdown>
            </div>
          </template>

          <!-- 请求 -->
          <template v-else>
            <span class="api-caret-spacer" aria-hidden="true" />
            <button class="api-method-badge" type="button" :style="{ color: methodColor(row.node.request.method), borderColor: methodColor(row.node.request.method) }" @click="selectRequest(row.node.id)">
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
            <span v-else class="api-row-name" @click="selectRequest(row.node.id)" @dblclick="startRename(row.node.id)">
              {{ row.node.name }}
            </span>

            <div class="api-row-actions">
              <button class="api-mini-btn" :disabled="!canReorder" type="button" title="Move up" @click="reorder(row.node.id, -1)">
                ↑
              </button>
              <button class="api-mini-btn" :disabled="!canReorder" type="button" title="Move down" @click="reorder(row.node.id, 1)">
                ↓
              </button>
              <n-dropdown trigger="click" :options="nodeMenu(row.node)" @select="(k: string) => onMenuSelect(k, row.node)">
                <button class="api-mini-btn" type="button" aria-label="More actions">
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
      <div v-if="banner" class="api-banner" role="status">
        {{ banner }}
      </div>

      <div v-if="selected" class="api-editor-form">
        <div class="api-field-row">
          <input v-model="edName" class="api-name-input" placeholder="Request name" @change="commitEditor">
          <n-select :value="edMethod" :options="methodOptions" class="api-method-select" @update:value="(v) => { edMethod = String(v); commitEditor() }" />
        </div>
        <input v-model="edUrl" class="api-url-input" placeholder="https://api.example.com/endpoint" @change="commitEditor">
        <textarea v-model="edBody" class="api-body-input" placeholder="Request body (raw)" @change="commitEditor" />

        <div v-if="runSummary" class="api-run-result">
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
</style>
