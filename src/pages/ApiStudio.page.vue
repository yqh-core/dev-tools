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
  findNode,
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
  requestNodeFromImported,
} from '@/tools/api-debugger/collection-tree';
import type { KV } from '@/tools/api-debugger/engine';
import { buildProxyPayload } from '@/tools/api-debugger/engine';
import * as assertionEngine from '@/tools/api-debugger/assertions';
import { buildUrlWithQuery, parseQueryParams } from '@/tools/api-debugger/query';
import type { CollectionRunSummary, RunnerResponse, SendFn } from '@/tools/api-debugger/runner';
import { formatCollectionReportText, runCollectionTree } from '@/tools/api-debugger/runner';
import { redactText } from '@/tools/api-debugger/report';
import { runScriptIsolated } from '@/tools/api-debugger/script-sandbox';
import * as environmentEngine from '@/tools/api-debugger/environments';
import { exportCollectionTree, importCollectionTree } from '@/tools/api-debugger/collection';
import { importOpenApi } from '@/tools/api-debugger/openapi';
import type { ImportedRequest } from '@/tools/api-debugger/openapi';
import { buildDownloadFilename, downloadTextFile } from '@/composable/downloadText';
import {
  API_STUDIO_BACKUP_MAX_BYTES,
  createApiStudioBackup,
  parseApiStudioBackup,
  planApiStudioRestore,
  previewApiStudioBackup,
  serializeApiStudioBackup,
} from '@/tools/api-debugger/backup';
import type {
  ApiStudioBackupPreview,
  ApiStudioBackupV1,
  BackupRestoreStrategy,
} from '@/tools/api-debugger/backup';

type Assertion = assertionEngine.Assertion;
type AssertionReport = assertionEngine.AssertionReport;
type AssertionType = assertionEngine.AssertionType;
type EnvStore = environmentEngine.EnvStore;
type VarScope = environmentEngine.VarScope;

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
const runSignal = ref<{ aborted: boolean } | null>(null);
const cancelRequested = ref(false);
const runSecretValues = ref<string[]>([]);
const runProgress = ref<{
  completed: number
  total: number
  current: { id: string; name: string; method: string; url: string } | null
}>({ completed: 0, total: 0, current: null });
const runResultStatus = computed(() => {
  const summary = runSummary.value;
  if (!summary) {
    return '';
  }
  return summary.cancelled ? 'Cancelled' : summary.stoppedEarly ? 'Stopped early' : summary.allPassed ? 'All checks passed' : 'Completed with failures';
});

// Postman 导入/导出：filePicker=隐藏文件选择器；importWarnings=上次导入的兼容性提示（UI 可见，不静默丢弃）
const filePicker = ref<HTMLInputElement | null>(null);
const importWarnings = ref<string[]>([]);
const openApiFilePicker = ref<HTMLInputElement | null>(null);
const openApiFileName = ref('');
const openApiSpecText = ref('');
const openApiServerUrl = ref('');
const openApiTargetFolder = ref('');
const openApiConflictMode = ref<'skip' | 'replace' | 'append'>('skip');
const OPENAPI_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const openApiPreview = computed(() => openApiSpecText.value
  ? importOpenApi(openApiSpecText.value, { serverUrl: openApiServerUrl.value || undefined })
  : null);
const backupFilePicker = ref<HTMLInputElement | null>(null);
const backupRestore = ref<{ backup: ApiStudioBackupV1; preview: ApiStudioBackupPreview } | null>(null);
const backupRestoreStrategy = ref<BackupRestoreStrategy>('replace');
const revealedVars = ref<Set<string>>(new Set());

// 拖拽状态：dragId=正在拖的节点；dragOverId+dropPos=当前放置指示（before/after 同级排序，inside 移入 folder）
const dragId = ref<string | null>(null);
const dragOverId = ref<string | null>(null);
const dropPos = ref<'before' | 'after' | 'inside'>('inside');

// 环境变量：复用工具页同一份 api-debugger:env（单一事实源）。selectedEnv 只是本壳运行时的本地选择覆盖，
// 不写回共享 store 的 active（避免在 API-Studio 切环境时意外改掉工具页的当前环境）。
const ENV_KEY = ['api-debugger', 'env'].join(':');
const STUDIO_SELECTED_ENV_KEY = ['api-studio', 'selected-environment'].join(':');
const envStore = ref<EnvStore>(environmentEngine.migrateEnv(null));
const selectedEnv = ref<string>('Default');
const renameEnvDraft = ref('Default');

function persistSelectedEnvironment(name = selectedEnv.value) {
  try {
    localStorage.setItem(STUDIO_SELECTED_ENV_KEY, name);
  }
  catch {
    // The active choice still works in memory when optional preference storage is unavailable.
  }
}

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
    envStore.value = environmentEngine.migrateEnv(rawEnv ? JSON.parse(rawEnv) : null);
    const savedSelection = localStorage.getItem(STUDIO_SELECTED_ENV_KEY);
    selectedEnv.value = savedSelection && Object.prototype.hasOwnProperty.call(envStore.value.envs, savedSelection)
      ? savedSelection
      : envStore.value.active;
  }
  catch {
    envStore.value = environmentEngine.migrateEnv(null);
    selectedEnv.value = 'Default';
  }
  renameEnvDraft.value = selectedEnv.value;
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


// ── OpenAPI 3.x import (local parse + explicit preview; never sends a request) ──
function openOpenApiPicker() {
  openApiFilePicker.value?.click();
}

function cancelOpenApiImport() {
  openApiSpecText.value = '';
  openApiFileName.value = '';
  openApiServerUrl.value = '';
  openApiTargetFolder.value = '';
  openApiConflictMode.value = 'skip';
}

function onOpenApiFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  if (file.size > OPENAPI_IMPORT_MAX_BYTES) {
    banner.value = 'OpenAPI file is too large (maximum 2 MB). Your current collection was not changed.';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const raw = String(reader.result ?? '');
    const parsed = importOpenApi(raw);
    if (parsed.requests.length === 0) {
      banner.value = parsed.warnings[0] ?? 'No OpenAPI operations could be imported. Your collection was not changed.';
      return;
    }
    openApiFileName.value = file.name;
    openApiSpecText.value = raw;
    openApiServerUrl.value = parsed.servers[0] ?? '';
    openApiTargetFolder.value = '';
    openApiConflictMode.value = 'skip';
    banner.value = 'OpenAPI spec parsed locally. Review the preview before adding requests.';
  };
  reader.onerror = () => {
    banner.value = 'Could not read the OpenAPI file. Your current collection was not changed.';
  };
  reader.readAsText(file);
}

function findOpenApiDuplicate(source: CollectionNode, imported: ImportedRequest): RequestNode | null {
  const targetMethod = imported.request.method.trim().toUpperCase();
  const targetUrl = imported.request.url.trim();
  const walk = (items: TreeNode[]): RequestNode | null => {
    for (const item of items) {
      if (isFolderNode(item)) {
        const nested = walk(item.items);
        if (nested) {
          return nested;
        }
      }
      else if (item.request.method.trim().toUpperCase() === targetMethod && item.request.url.trim() === targetUrl) {
        return item;
      }
    }
    return null;
  };
  return walk(source.items);
}

function hasOpenApiRequestName(source: CollectionNode, name: string): boolean {
  const target = name.trim().toLowerCase();
  const walk = (items: TreeNode[]): boolean => items.some((item) => {
    if (isFolderNode(item)) {
      return walk(item.items);
    }
    return item.name.trim().toLowerCase() === target;
  });
  return walk(source.items);
}

const openApiDuplicateCount = computed(() => {
  const parsed = openApiPreview.value;
  if (!parsed) {
    return 0;
  }
  const seen = new Set<string>();
  let count = 0;
  for (const request of parsed.requests) {
    const key = `${request.request.method.trim().toUpperCase()} ${request.request.url.trim()}`;
    if (findOpenApiDuplicate(tree.value, request) || seen.has(key)) {
      count++;
    }
    seen.add(key);
  }
  return count;
});

function confirmOpenApiImport() {
  const parsed = openApiPreview.value;
  if (!parsed || parsed.requests.length === 0) {
    banner.value = 'There are no supported OpenAPI operations to import.';
    return;
  }
  const parentId = openApiTargetFolder.value || null;
  if (parentId) {
    const target = findNode(tree.value, parentId);
    if (!target || !isFolderNode(target.node)) {
      banner.value = 'The selected destination folder no longer exists. Review the preview and choose another folder.';
      return;
    }
  }

  // Build against an immutable working copy and persist once, only after every
  // request has been accepted by the collection tree helpers.
  let nextTree = tree.value;
  let added = 0;
  let replaced = 0;
  let skipped = 0;
  let firstImportedId = '';
  for (const imported of parsed.requests) {
    const duplicate = findOpenApiDuplicate(nextTree, imported);
    if (duplicate && openApiConflictMode.value === 'skip') {
      skipped++;
      continue;
    }
    if (duplicate && openApiConflictMode.value === 'replace') {
      nextTree = removeNode(nextTree, duplicate.id).tree;
    }

    let name = imported.name;
    let id: string | undefined = requestNodeFromImported(imported).id;
    if (duplicate && openApiConflictMode.value === 'append') {
      let suffix = 2;
      const baseName = imported.name;
      name = `${baseName} (imported ${suffix})`;
      while (hasOpenApiRequestName(nextTree, name)) {
        suffix++;
        name = `${baseName} (imported ${suffix})`;
      }
      id = undefined;
    }

    const inserted = addRequest(nextTree, parentId, {
      ...(id ? { id } : {}),
      name,
      request: imported.request,
    });
    if (inserted.error || !inserted.node) {
      banner.value = `Import stopped: ${inserted.error ?? 'a request could not be added'}. No partial collection changes were saved.`;
      return;
    }
    nextTree = inserted.tree;
    if (!firstImportedId) {
      firstImportedId = inserted.node.id;
    }
    added++;
    if (duplicate && openApiConflictMode.value === 'replace') {
      replaced++;
    }
  }

  if (added > 0) {
    applyTree(nextTree);
    if (firstImportedId) {
      selectNode(firstImportedId);
    }
    if (parentId) {
      collapsed.value = new Set([...collapsed.value].filter(id => id !== parentId));
    }
  }
  const warningCount = parsed.warnings.length;
  banner.value = `OpenAPI import complete: ${added} added, ${replaced} replaced, ${skipped} skipped.${warningCount ? ` Review ${warningCount} compatibility note(s) in the preview.` : ''}`;
  cancelOpenApiImport();
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

function openBackupRestorePicker() {
  backupFilePicker.value?.click();
}

function exportWorkspaceBackup(includeSecrets = false) {
  if (includeSecrets && !window.confirm('This backup will contain marked secret values, authentication headers and URL credentials. Anyone with the file may be able to use those credentials. Continue?')) {
    return;
  }
  const archive = createApiStudioBackup(tree.value, envStore.value, { includeSecrets });
  const ok = downloadTextFile({
    content: serializeApiStudioBackup(archive),
    filename: buildDownloadFilename('api-studio', 'backup.json'),
    mimeType: 'application/json',
  });
  banner.value = ok
    ? (includeSecrets
        ? 'Full backup exported. It includes secrets and credentials; store it securely.'
        : 'Redacted backup exported. Marked secrets and standard authentication fields were removed; unmarked credentials in free-form text may remain.')
    : 'Could not start the backup download. Check browser download permissions.';
}

function onBackupRestoreFilePicked(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) {
    return;
  }
  if (file.size > API_STUDIO_BACKUP_MAX_BYTES) {
    banner.value = 'Backup file is too large (maximum 10 MB). Your current workspace was not changed.';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = parseApiStudioBackup(String(reader.result ?? ''));
      const preview = previewApiStudioBackup(backup, tree.value, envStore.value);
      backupRestore.value = { backup, preview };
      backupRestoreStrategy.value = 'replace';
      banner.value = 'Backup validated. Review the contents and choose how to restore it.';
    }
    catch (error) {
      backupRestore.value = null;
      banner.value = `Backup rejected: ${error instanceof Error ? error.message : String(error)} Your current workspace was not changed.`;
    }
  };
  reader.onerror = () => {
    banner.value = 'Could not read the backup file. Your current workspace was not changed.';
  };
  reader.readAsText(file);
}

function cancelBackupRestore() {
  backupRestore.value = null;
}

function applyBackupRestore() {
  const pending = backupRestore.value;
  if (!pending) {
    return;
  }
  if (pending.backup.security.secretsIncluded && !window.confirm('This archive includes secret values and request credentials. Restoring it will put those credentials into this browser origin. Continue?')) {
    return;
  }
  if (backupRestoreStrategy.value === 'replace' && !window.confirm('Replace the current API Studio collection and environments with this backup? This overwrites the current workspace data.')) {
    return;
  }
  const next = planApiStudioRestore(tree.value, envStore.value, pending.backup, backupRestoreStrategy.value);
  const nextTree = serializeCollectionTree(next.collection);
  const nextEnv = JSON.stringify(next.environments);
  let oldTree: string | null;
  let oldEnv: string | null;
  try {
    // Read both previous values before the first write. A read failure must never
    // trigger rollback code that could remove an existing key we did not inspect.
    oldTree = localStorage.getItem(TREE_KEY);
    oldEnv = localStorage.getItem(ENV_KEY);
  }
  catch {
    banner.value = 'Browser storage is unavailable. Your current workspace was not changed.';
    return;
  }
  let treeWritten = false;
  let envWritten = false;
  try {
    localStorage.setItem(TREE_KEY, nextTree);
    treeWritten = true;
    localStorage.setItem(ENV_KEY, nextEnv);
    envWritten = true;
  }
  catch {
    let rolledBack = true;
    try {
      if (treeWritten) {
        if (oldTree === null) {
          localStorage.removeItem(TREE_KEY);
        }
        else {
          localStorage.setItem(TREE_KEY, oldTree);
        }
      }
      if (envWritten) {
        if (oldEnv === null) {
          localStorage.removeItem(ENV_KEY);
        }
        else {
          localStorage.setItem(ENV_KEY, oldEnv);
        }
      }
    }
    catch {
      rolledBack = false;
    }
    banner.value = rolledBack
      ? 'Restore could not be saved. The previous browser data was restored; free up browser storage and try again.'
      : 'Restore and automatic rollback both encountered a browser-storage error. Do not refresh this tab until you have exported or copied any unsaved workspace data.';
    return;
  }
  tree.value = next.collection;
  envStore.value = next.environments;
  selectedEnv.value = next.environments.active;
  renameEnvDraft.value = next.environments.active;
  persistSelectedEnvironment(next.environments.active);
  revealedVars.value = new Set();
  selectedId.value = null;
  runSummary.value = null;
  runOutput.value = '';
  backupRestore.value = null;
  banner.value = backupRestoreStrategy.value === 'replace'
    ? `Restored ${next.addedRequests} request(s) and ${next.addedEnvironments} environment(s). Existing workspace data was replaced.`
    : `Merged backup: ${next.addedRequests} new request(s), ${next.replacedNodes} existing node(s) updated, ${next.addedEnvironments} environment(s) added. Existing environment values were kept on conflicts.`;
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
const edAssertions = ref<Assertion[]>([]);
const sendingSingle = ref(false);
const singleResponse = ref<RunnerResponse | null>(null);
const singleAssertionReport = ref<AssertionReport | null>(null);
const singleError = ref('');
const singleCanRetry = ref(false);
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
  edAssertions.value = (r?.assertions ?? []).map(assertion => ({ ...assertion }));
  singleResponse.value = null;
  singleAssertionReport.value = null;
  singleError.value = '';
  singleCanRetry.value = false;
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
  singleCanRetry.value = false;
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

const assertionTypeOptions = [
  { label: 'Status code', value: 'status' },
  { label: 'JSON field', value: 'json' },
  { label: 'Response header', value: 'header' },
  { label: 'Response time', value: 'time' },
];
function assertionId(): string {
  return `assertion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
function assertionOperatorOptions(type: AssertionType) {
  return assertionEngine.OPS_BY_TYPE[type].map(operator => ({ label: assertionEngine.OP_LABELS[operator] ?? operator, value: operator }));
}
function assertionNeedsTarget(assertion: Assertion): boolean {
  return assertion.type === 'json' || assertion.type === 'header';
}
function assertionNeedsExpected(assertion: Assertion): boolean {
  return assertion.operator !== 'exists' && assertion.operator !== 'not_exists';
}
function commitAssertions() {
  const request = selectedRequest.value;
  if (!request) {
    return;
  }
  singleAssertionReport.value = null;
  const result = updateRequestNode(tree.value, request.id, { assertions: edAssertions.value });
  if (result.error) {
    banner.value = result.error;
    return;
  }
  applyTree(result.tree);
}
function addAssertion(type: AssertionType = 'status') {
  if (edAssertions.value.length >= assertionEngine.ASSERTIONS_CAP) {
    banner.value = `You can add up to ${assertionEngine.ASSERTIONS_CAP} assertions to one request.`;
    return;
  }
  edAssertions.value = [...edAssertions.value, assertionEngine.makeAssertion(assertionId(), type)];
  commitAssertions();
}
function changeAssertionType(assertion: Assertion, value: unknown) {
  const type = String(value) as AssertionType;
  if (!Object.prototype.hasOwnProperty.call(assertionEngine.OPS_BY_TYPE, type)) {
    return;
  }
  const fresh = assertionEngine.makeAssertion(assertion.id, type);
  Object.assign(assertion, fresh, { enabled: assertion.enabled });
  commitAssertions();
}
function removeAssertion(index: number) {
  edAssertions.value = edAssertions.value.filter((_, i) => i !== index);
  commitAssertions();
}
function updateAssertion(assertion: Assertion) {
  // Incomplete rules remain visible and fail closed when the request is sent.
  if (assertionEngine.assertionProblem(assertion)) {
    singleAssertionReport.value = null;
  }
  commitAssertions();
}
function changeAssertionOperator(assertion: Assertion, value: unknown) {
  assertion.operator = String(value);
  updateAssertion(assertion);
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
const envManagerOpen = ref(false);
const activeScope = ref<VarScope>('environment');
const scopeOptions: { label: string; value: VarScope }[] = [
  { label: 'Environment', value: 'environment' },
  { label: 'Collection', value: 'collection' },
  { label: 'Global', value: 'global' },
];
const newEnvName = ref('');
const newVarName = ref('');
const newVarValue = ref('');
const newVarSecret = ref(false);

const selectedEnvStore = computed<EnvStore>(() => ({
  ...envStore.value,
  active: envStore.value.envs[selectedEnv.value] ? selectedEnv.value : envStore.value.active,
}));
const env = computed<Record<string, string>>(() => environmentEngine.activeVars(selectedEnvStore.value));
const envOptions = computed(() => environmentEngine.envNames(envStore.value).map(name => ({ label: name, value: name })));
const envVarCount = computed(() => Object.keys(env.value).length);
const scopeRows = computed(() => Object.entries(environmentEngine.scopeVars(selectedEnvStore.value, activeScope.value))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, value]) => ({
    name,
    value,
    secret: environmentEngine.isSecret(selectedEnvStore.value, name),
    effectiveScope: environmentEngine.scopeOf(selectedEnvStore.value, name),
  })));

function scopeLabel(scope: VarScope | null): string {
  if (scope === 'environment') {
    return 'Environment';
  }
  if (scope === 'collection') {
    return 'Collection';
  }
  return scope === 'global' ? 'Global' : 'Not defined';
}

function persistEnvStore(next: EnvStore, preferredEnvironment = selectedEnv.value) {
  // Studio edits a temporary active environment; keep the legacy API Debugger default unchanged.
  const legacyActive = envStore.value.active;
  const active = Object.prototype.hasOwnProperty.call(next.envs, legacyActive) ? legacyActive : next.active;
  const persisted: EnvStore = { ...next, active };
  envStore.value = persisted;
  selectedEnv.value = Object.prototype.hasOwnProperty.call(persisted.envs, preferredEnvironment)
    ? preferredEnvironment
    : active;
  renameEnvDraft.value = selectedEnv.value;
  revealedVars.value = new Set();
  try {
    localStorage.setItem(ENV_KEY, JSON.stringify(persisted));
  }
  catch {
    banner.value = 'Changes are active in this tab but could not be saved to browser storage. Keep this tab open and check the browser storage settings.';
  }
  persistSelectedEnvironment();
}

function onEnvChange(v: unknown) {
  const name = String(v);
  if (!Object.prototype.hasOwnProperty.call(envStore.value.envs, name)) {
    return;
  }
  selectedEnv.value = name;
  renameEnvDraft.value = name;
  persistSelectedEnvironment(name);
  revealedVars.value = new Set();
}

function createEnvironment() {
  const name = newEnvName.value.trim();
  if (!name) {
    banner.value = 'Enter a name for the new environment.';
    return;
  }
  const current = selectedEnvStore.value;
  const next = environmentEngine.addEnv(current, name);
  if (next === current) {
    banner.value = 'That environment name is empty or already in use.';
    return;
  }
  persistEnvStore(next, name);
  newEnvName.value = '';
  banner.value = `Created environment "${name}". The legacy API Debugger default was not changed.`;
}

function renameEnvironment() {
  const oldName = selectedEnv.value;
  const nextName = renameEnvDraft.value.trim();
  if (!nextName) {
    banner.value = 'Enter a name for this environment.';
    return;
  }
  if (nextName === oldName) {
    return;
  }
  const current = selectedEnvStore.value;
  const next = environmentEngine.renameEnv(current, oldName, nextName);
  if (next === current) {
    banner.value = 'That name is already used by another environment.';
    return;
  }
  persistEnvStore(next, nextName);
  banner.value = `Renamed "${oldName}" to "${nextName}".`;
}

function variableExistsInAnyScope(store: EnvStore, name: string): boolean {
  if (Object.prototype.hasOwnProperty.call(store.global ?? {}, name)
    || Object.prototype.hasOwnProperty.call(store.collection ?? {}, name)) {
    return true;
  }
  return Object.values(store.envs).some(vars => Object.prototype.hasOwnProperty.call(vars, name));
}

function clearOrphanedSecretMarkers(store: EnvStore): EnvStore {
  return (store.secrets ?? []).reduce(
    (next, name) => variableExistsInAnyScope(next, name) ? next : environmentEngine.setSecret(next, name, false),
    store,
  );
}

function deleteEnvironment() {
  const oldName = selectedEnv.value;
  const current = selectedEnvStore.value;
  const next = environmentEngine.deleteEnv(current, oldName);
  if (next === current) {
    banner.value = 'Keep at least one environment. The last environment cannot be deleted.';
    return;
  }
  persistEnvStore(clearOrphanedSecretMarkers(next), next.active);
  banner.value = `Deleted environment "${oldName}".`;
}

function updateScopeVariable(name: string, value: string) {
  const current = selectedEnvStore.value;
  const next = environmentEngine.setScopeVar(current, activeScope.value, name, value);
  persistEnvStore(next);
}

function renameScopeVariable(oldName: string, newNameValue: string, value: string) {
  const newName = newNameValue.trim();
  if (!newName) {
    banner.value = 'Variable names cannot be empty.';
    return;
  }
  if (newName === oldName) {
    return;
  }
  const current = selectedEnvStore.value;
  const scope = environmentEngine.scopeVars(current, activeScope.value);
  if (Object.prototype.hasOwnProperty.call(scope, newName)) {
    banner.value = 'A variable with that name already exists in this scope.';
    return;
  }
  const wasSecret = environmentEngine.isSecret(current, oldName);
  let next = environmentEngine.removeScopeVar(current, activeScope.value, oldName);
  next = environmentEngine.setScopeVar(next, activeScope.value, newName, value);
  if (wasSecret) {
    next = environmentEngine.setSecret(next, newName, true);
  }
  if (!variableExistsInAnyScope(next, oldName)) {
    next = environmentEngine.setSecret(next, oldName, false);
  }
  persistEnvStore(next);
}

function addScopeVariable() {
  const name = newVarName.value.trim();
  if (!name) {
    banner.value = 'Enter a variable name.';
    return;
  }
  const current = selectedEnvStore.value;
  if (Object.prototype.hasOwnProperty.call(environmentEngine.scopeVars(current, activeScope.value), name)) {
    banner.value = 'That variable already exists in this scope. Edit its existing row instead.';
    return;
  }
  let next = environmentEngine.setScopeVar(current, activeScope.value, name, newVarValue.value);
  if (newVarSecret.value) {
    next = environmentEngine.setSecret(next, name, true);
  }
  persistEnvStore(next);
  newVarName.value = '';
  newVarValue.value = '';
  newVarSecret.value = false;
  banner.value = `Added variable "${name}".`;
}

function removeScopeVariable(name: string) {
  let next = environmentEngine.removeScopeVar(selectedEnvStore.value, activeScope.value, name);
  if (!variableExistsInAnyScope(next, name)) {
    next = environmentEngine.setSecret(next, name, false);
  }
  persistEnvStore(next);
  banner.value = `Removed variable "${name}" from ${scopeLabel(activeScope.value)}.`;
}

function toggleScopeSecret(name: string) {
  const current = selectedEnvStore.value;
  const secret = !environmentEngine.isSecret(current, name);
  persistEnvStore(environmentEngine.setSecret(current, name, secret));
  banner.value = secret
    ? `Marked "${name}" as secret. This masks the value and blanks it in exports; it does not encrypt browser storage.`
    : `Removed the secret marker from "${name}".`;
}

function isVariableRevealed(name: string): boolean {
  return revealedVars.value.has(name);
}

function toggleVariableReveal(name: string) {
  const next = new Set(revealedVars.value);
  if (next.has(name)) {
    next.delete(name);
  }
  else {
    next.add(name);
  }
  revealedVars.value = next;
}

function exportEnvironmentVariables() {
  const current = selectedEnvStore.value;
  const content = JSON.stringify({
    environment: selectedEnv.value,
    precedence: 'Environment > Collection > Global',
    variables: environmentEngine.exportableVars(current),
  }, null, 2);
  const ok = downloadTextFile({
    content,
    filename: buildDownloadFilename('api-studio', 'environment_variables.json'),
    mimeType: 'application/json',
  });
  banner.value = ok
    ? 'Exported resolved variables. Secret-marked values were replaced with empty strings.'
    : 'Could not start the variables download. Check browser download permissions.';
}

// ── 运行 ────────────────────────────────────────────────────────────
function isRetryableHttpStatus(status: number): boolean {
  return [408, 425, 429].includes(status) || (status >= 500 && status < 600);
}

const runnerSend: SendFn = async (payload) => {
  let res: Response;
  try {
    res = await fetch('/api/apiproxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  catch (cause) {
    const error = new Error('Could not reach the API relay. Check your connection and try again.') as Error & { retryable?: boolean };
    error.name = 'RetryableNetworkError';
    error.retryable = true;
    throw error;
  }

  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error((j && j.error) || `Proxy returned HTTP ${res.status}.`) as Error & { retryable?: boolean };
    error.retryable = isRetryableHttpStatus(res.status);
    throw error;
  }
  if (!j || typeof j !== 'object') {
    throw new Error('The relay returned an unreadable response. Check the connection and try again.');
  }
  return j as RunnerResponse;
};

async function sendSelectedRequest() {
  const selected = selectedRequest.value;
  if (!selected || sendingSingle.value) {
    return;
  }

  const request = {
    method: edMethod.value,
    url: buildUrlWithQuery(edUrl.value, edQueryParams.value),
    headers: edHeaders.value.filter(h => h.name.trim()),
    body: edBody.value,
  };
  // Persist the exact request that will be sent; do not rely on a later blur/change event.
  edUrl.value = request.url;
  const saved = updateRequestNode(tree.value, selected.id, { name: edName.value, request, assertions: edAssertions.value });
  if (saved.error) {
    singleResponse.value = null;
    singleError.value = saved.error;
    singleCanRetry.value = false;
    return;
  }
  applyTree(saved.tree);
  const { payload, missing } = buildProxyPayload(request, env.value);
  if (missing.length) {
    singleResponse.value = null;
    singleError.value = `Missing variables: ${missing.join(', ')}. Define them in the selected environment.`;
    singleCanRetry.value = false;
    return;
  }

  singleCanRetry.value = false;
  sendingSingle.value = true;
  singleError.value = '';
  singleResponse.value = null;
  try {
    const response = await runnerSend(payload);
    singleResponse.value = response;
    // The relay wraps upstream HTTP statuses in a 200 JSON envelope; classify the
    // upstream status too so a returned 503 has a nearby manual retry action.
    singleCanRetry.value = isRetryableHttpStatus(response.status);
    singleAssertionReport.value = assertionEngine.runAssertions(edAssertions.value, {
      status: response.status,
      headers: response.headers,
      body: response.body,
      elapsedMs: response.elapsedMs,
    });
    banner.value = `Received HTTP ${response.status} in ${response.elapsedMs} ms.`;
  }
  catch (e) {
    singleError.value = e instanceof Error ? e.message : String(e);
    singleCanRetry.value = e instanceof Error
      && (e as Error & { retryable?: boolean }).retryable === true;
    banner.value = 'Request could not be completed. Review the error and try again.';
  }
  finally {
    sendingSingle.value = false;
  }
}

function redactRunText(value: string): string {
  return redactText(value, runSecretValues.value);
}

function cancelRun() {
  const signal = runSignal.value;
  if (!running.value || !signal || signal.aborted || cancelRequested.value) {
    return;
  }
  signal.aborted = true;
  cancelRequested.value = true;
  banner.value = 'Cancellation requested. The current request or script will finish or time out; no further requests will start.';
}

async function copyRunReport() {
  if (!runOutput.value) {
    return;
  }
  if (!navigator.clipboard?.writeText) {
    banner.value = 'Clipboard access is unavailable in this browser context. Use Download report instead.';
    return;
  }
  try {
    await navigator.clipboard.writeText(runOutput.value);
    banner.value = 'Redacted collection report copied.';
  }
  catch {
    banner.value = 'Could not copy the report. Check clipboard permissions or use Download report.';
  }
}

function downloadRunReport() {
  if (!runOutput.value) {
    banner.value = 'No report is available yet. Run the collection to generate one.';
    return;
  }
  const ok = downloadTextFile({
    content: runOutput.value,
    filename: buildDownloadFilename('api-studio', 'collection-run.txt'),
    mimeType: 'text/plain',
  });
  banner.value = ok ? 'Redacted collection report downloaded.' : 'Could not download the collection report.';
}

async function onRun() {
  if (running.value) {
    return;
  }
  if (countRequests(tree.value) === 0) {
    banner.value = 'Nothing to run yet — add a request first.';
    return;
  }
  const signal = { aborted: false };
  runSignal.value = signal;
  cancelRequested.value = false;
  runSecretValues.value = environmentEngine.collectSecretValues(envStore.value);
  runProgress.value = { completed: 0, total: countRequests(tree.value), current: null };
  running.value = true;
  runOutput.value = '';
  runSummary.value = null;
  try {
    const summary = await runCollectionTree(tree.value, env.value, runnerSend, {
      runScript: (code, snapshot) => runScriptIsolated(code, snapshot, runnerSend),
      signal,
      onRequestStart: (request, _index, total) => {
        runProgress.value = { ...runProgress.value, total, current: request };
      },
      onProgress: (_result, index, total) => {
        runProgress.value = { ...runProgress.value, total, completed: index + 1 };
      },
    });
    runSummary.value = summary;
    runOutput.value = formatCollectionReportText(summary, { secretValues: runSecretValues.value });
    if (summary.cancelled) {
      banner.value = `Run cancelled — ${summary.results.length} of ${summary.total} planned request(s) completed.`;
    }
    else if (summary.stoppedEarly) {
      banner.value = `Run stopped early — ${summary.results.length} of ${summary.total} planned request(s) completed.`;
    }
    else if (summary.allPassed) {
      banner.value = `Run finished — all ${summary.results.length} request(s) passed.`;
    }
    else {
      banner.value = `Run finished with failures — ${summary.failed} request(s) failed.`;
    }
  }
  catch (e) {
    banner.value = `Run could not start: ${e instanceof Error ? e.message : String(e)}`;
  }
  finally {
    running.value = false;
    runSignal.value = null;
  }
}

function dismissRun() {
  if (running.value) {
    return;
  }
  runSummary.value = null;
  runOutput.value = '';
  runProgress.value = { completed: 0, total: 0, current: null };
  cancelRequested.value = false;
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

      <details class="api-data-disclosure" data-test-id="data-tools-disclosure">
        <summary class="api-data-summary">
          <span class="api-data-summary-copy">
            <strong>Data tools</strong>
            <span>Backup · restore · Postman · OpenAPI import/export</span>
          </span>
          <span class="api-data-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="api-io-row" role="group" aria-label="Backup and collection transfer">
          <button class="api-tool-btn" type="button" title="Download a portable API Studio backup with marked secrets removed" data-test-id="backup-safe" @click="exportWorkspaceBackup(false)">
            Backup
          </button>
          <button class="api-tool-btn" type="button" title="Download a full backup with credentials after confirmation" data-test-id="backup-with-secrets" @click="exportWorkspaceBackup(true)">
            Backup with secrets
          </button>
          <button class="api-tool-btn" type="button" title="Restore a backup file from this device" data-test-id="restore-backup" @click="openBackupRestorePicker">
            Restore
          </button>
          <button class="api-tool-btn" type="button" title="Import a Postman v2.1 collection" data-test-id="import-collection" @click="openImportPicker">
            Import Postman
          </button>
          <button class="api-tool-btn" type="button" title="Export this collection as Postman v2.1" data-test-id="export-collection" @click="exportPostman">
            Export Postman
          </button>
          <button class="api-tool-btn" type="button" title="Import a supported OpenAPI 3.x JSON or YAML specification" data-test-id="import-openapi" @click="openOpenApiPicker">
            Import OpenAPI
          </button>
        </div>
      </details>
      <input
        ref="filePicker"
        type="file"
        accept=".json,application/json"
        class="api-file-input"
        data-test-id="import-file"
        @change="onImportFilePicked"
      >
      <input
        ref="openApiFilePicker"
        type="file"
        accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
        class="api-file-input"
        data-test-id="openapi-file"
        @change="onOpenApiFilePicked"
      >
      <input
        ref="backupFilePicker"
        type="file"
        accept=".json,application/json"
        class="api-file-input"
        data-test-id="backup-file"
        @change="onBackupRestoreFilePicked"
      >

      <section v-if="openApiPreview" class="api-import-notes api-backup-preview" data-test-id="openapi-preview" aria-label="OpenAPI import preview">
        <div class="api-import-notes-head">OpenAPI import preview</div>
        <p><strong>{{ openApiFileName }}</strong> · {{ openApiPreview.requests.length }} operation(s) · {{ openApiPreview.source.toUpperCase() }}</p>
        <p>This file was parsed in your browser. Import does not send requests, call the API relay or fetch remote references.</p>
        <div class="api-io-row" role="group" aria-label="OpenAPI import options">
          <label class="api-openapi-field">
            <span>Server</span>
            <select v-model="openApiServerUrl" data-test-id="openapi-server">
              <option value="">Relative paths</option>
              <option v-for="server in openApiPreview.servers" :key="server" :value="server">{{ server }}</option>
            </select>
          </label>
          <label class="api-openapi-field">
            <span>Destination</span>
            <select v-model="openApiTargetFolder" data-test-id="openapi-destination">
              <option value="">Collection root</option>
              <option v-for="folder in folderMoveOptions(tree)" :key="folder.value" :value="folder.value">{{ folder.label }}</option>
            </select>
          </label>
          <label v-if="openApiDuplicateCount > 0" class="api-openapi-field">
            <span>{{ openApiDuplicateCount }} duplicate(s)</span>
            <select v-model="openApiConflictMode" data-test-id="openapi-conflicts">
              <option value="skip">Skip duplicates</option>
              <option value="replace">Replace matching requests</option>
              <option value="append">Append copies with suffix</option>
            </select>
          </label>
        </div>
        <ul class="api-import-warning-list api-openapi-operation-list" data-test-id="openapi-operations">
          <li v-for="operation in openApiPreview.requests.slice(0, 20)" :key="`${operation.name}:${operation.request.method}:${operation.request.url}`">
            <code>{{ operation.request.method }}</code> <strong>{{ operation.name }}</strong> <span>{{ operation.request.url }}</span>
          </li>
          <li v-if="openApiPreview.requests.length > 20">And {{ openApiPreview.requests.length - 20 }} more operation(s).</li>
        </ul>
        <ul v-if="openApiPreview.warnings.length" class="api-import-warning-list" data-test-id="openapi-warnings">
          <li v-for="warning in openApiPreview.warnings" :key="warning">{{ warning }}</li>
        </ul>
        <p v-if="openApiDuplicateCount === 0">No matching method + URL requests currently exist.</p>
        <p v-else data-test-id="openapi-duplicate-count">{{ openApiDuplicateCount }} matching operation(s) already exist in this collection or import file.</p>
        <div class="api-io-row" role="group" aria-label="OpenAPI import confirmation">
          <button class="api-tool-btn" type="button" data-test-id="cancel-openapi-import" @click="cancelOpenApiImport">Cancel</button>
          <button class="api-tool-btn api-run-btn" type="button" data-test-id="confirm-openapi-import" @click="confirmOpenApiImport">
            Import {{ openApiPreview.requests.length }} request(s)
          </button>
        </div>
      </section>
      <section v-if="backupRestore" class="api-import-notes api-backup-preview" data-test-id="backup-restore-preview" aria-label="Backup restore preview">
        <div class="api-import-notes-head">Backup restore preview</div>
        <p><strong>{{ backupRestore.preview.collectionName }}</strong> · {{ backupRestore.preview.requestCount }} request(s) · {{ backupRestore.preview.folderCount }} folder(s)</p>
        <p>Environments: {{ backupRestore.preview.environmentNames.join(', ') || 'None' }}</p>
        <p>{{ backupRestore.preview.secretValuesIncluded ? 'This file includes secret values and request credentials.' : 'This file has secret-marked environment values removed.' }}</p>
        <p v-if="backupRestore.preview.existingNodeConflicts.length">Collection ID conflicts: {{ backupRestore.preview.existingNodeConflicts.length }}. Matching nodes will be replaced at their current position when merging.</p>
        <p v-if="backupRestore.preview.existingEnvironmentNames.length">Existing environments: {{ backupRestore.preview.existingEnvironmentNames.join(', ') }}. Existing variable values take priority in merge mode.</p>
        <ul class="api-import-notes-list">
          <li v-for="(note, i) in backupRestore.preview.notes" :key="i">{{ note }}</li>
        </ul>
        <fieldset class="api-backup-restore-modes">
          <legend>Restore mode</legend>
          <label><input v-model="backupRestoreStrategy" type="radio" value="replace" data-test-id="backup-mode-replace"> Replace current workspace</label>
          <label><input v-model="backupRestoreStrategy" type="radio" value="merge" data-test-id="backup-mode-merge"> Merge into current workspace</label>
        </fieldset>
        <p class="api-field-hint">The file is read locally. Its contents are not uploaded. Use the downloaded file to move data manually between website origins.</p>
        <div class="api-backup-restore-actions">
          <button class="api-tool-btn api-run-btn" type="button" data-test-id="apply-backup-restore" @click="applyBackupRestore">Restore backup</button>
          <button class="api-tool-btn" type="button" data-test-id="cancel-backup-restore" @click="cancelBackupRestore">Cancel</button>
        </div>
      </section>

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
        <span class="api-envbar-label" title="Environment">Env</span>
        <div
          class="api-env-select-wrap"
          :title="selectedEnv"
          data-test-id="env-select-wrap"
        >
          <n-select
            :value="selectedEnv"
            :options="envOptions"
            size="small"
            class="api-env-select"
            :aria-label="`Environment: ${selectedEnv}`"
            data-test-id="env-select"
            @update:value="onEnvChange"
          />
        </div>
        <button
          class="api-env-manage-toggle"
          type="button"
          data-test-id="manage-environments"
          :aria-expanded="envManagerOpen"
          @click="envManagerOpen = !envManagerOpen"
        >
          {{ envManagerOpen ? 'Close' : 'Manage' }}
        </button>
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

      <section v-if="envManagerOpen" class="api-env-manager" aria-label="Manage environments and variables" data-test-id="env-manager">
        <div class="api-env-manager-heading">
          <div>
            <h2>Environments &amp; variables</h2>
            <p>Keep request values organized by where they belong.</p>
          </div>
          <button class="api-mini-action" type="button" data-test-id="close-env-manager" @click="envManagerOpen = false">Close</button>
        </div>

        <div class="api-env-manager-section" data-test-id="environment-management">
          <div class="api-env-manager-section-title">
            <strong>Environments</strong>
            <span class="api-field-hint">Selected in API Studio only</span>
          </div>
          <div class="api-env-manager-actions">
            <input
              v-model="renameEnvDraft"
              class="api-env-manager-input"
              type="text"
              aria-label="Rename selected environment"
              data-test-id="env-rename-input"
              placeholder="Environment name"
            >
            <button class="api-mini-action" type="button" data-test-id="rename-environment" @click="renameEnvironment">Rename</button>
            <input
              v-model="newEnvName"
              class="api-env-manager-input"
              type="text"
              aria-label="New environment name"
              data-test-id="new-environment-name"
              placeholder="New environment"
              @keyup.enter="createEnvironment"
            >
            <button class="api-mini-action" type="button" data-test-id="create-environment" @click="createEnvironment">+ Create</button>
            <button class="api-mini-action api-env-delete" type="button" data-test-id="delete-environment" :disabled="envOptions.length <= 1" @click="deleteEnvironment">Delete selected</button>
          </div>
        </div>

        <div class="api-env-manager-section" data-test-id="variable-management">
          <div class="api-env-manager-section-title">
            <strong>Variables</strong>
            <span class="api-field-hint">Narrower scopes override broader ones</span>
          </div>
          <div class="api-env-scope-bar" role="group" aria-label="Variable scope">
            <button
              v-for="option in scopeOptions"
              :key="option.value"
              class="api-env-scope-button"
              :class="{ 'is-active': activeScope === option.value }"
              type="button"
              :data-test-id="`scope-${option.value}`"
              :aria-pressed="activeScope === option.value"
              @click="activeScope = option.value"
            >
              {{ option.label }}
            </button>
            <button
              class="api-mini-action api-env-export"
              type="button"
              data-test-id="export-variables"
              @click="exportEnvironmentVariables"
            >
              Export resolved variables
            </button>
          </div>

          <div v-if="scopeRows.length" class="api-env-variable-list" data-test-id="variable-list">
            <div
              v-for="row in scopeRows"
              :key="row.name"
              class="api-env-variable-row"
              data-test-id="var-row"
              :data-var-name="row.name"
            >
              <input
                class="api-env-manager-input api-env-variable-name"
                type="text"
                :value="row.name"
                :aria-label="`Variable name ${row.name}`"
                data-test-id="var-name"
                @change="(event: Event) => renameScopeVariable(row.name, (event.target as HTMLInputElement).value, row.value)"
              >
              <div class="api-env-variable-value">
                <input
                  class="api-env-manager-input"
                  :type="row.secret && !isVariableRevealed(row.name) ? 'password' : 'text'"
                  :value="row.value"
                  :aria-label="`Variable value ${row.name}`"
                  data-test-id="var-value"
                  @change="(event: Event) => updateScopeVariable(row.name, (event.target as HTMLInputElement).value)"
                >
                <button
                  v-if="row.secret"
                  class="api-mini-action"
                  type="button"
                  :data-test-id="isVariableRevealed(row.name) ? 'hide-variable' : 'show-variable'"
                  @click="toggleVariableReveal(row.name)"
                >
                  {{ isVariableRevealed(row.name) ? 'Hide' : 'Show' }}
                </button>
              </div>
              <span class="api-env-origin" data-test-id="scope-origin">
                {{ row.effectiveScope === activeScope ? 'Effective' : `Overridden by ${scopeLabel(row.effectiveScope)}` }}
              </span>
              <button
                class="api-mini-action"
                :class="{ 'is-secret': row.secret }"
                type="button"
                data-test-id="toggle-variable-secret"
                @click="toggleScopeSecret(row.name)"
              >
                {{ row.secret ? 'Secret ✓' : 'Make secret' }}
              </button>
              <button
                class="api-mini-action api-env-remove"
                type="button"
                data-test-id="remove-variable"
                :aria-label="`Remove ${row.name}`"
                @click="removeScopeVariable(row.name)"
              >
                Remove
              </button>
            </div>
          </div>
          <p v-else class="api-env-empty" data-test-id="empty-variable-scope">
            No variables in this scope yet. Add one below.
          </p>

          <div class="api-env-variable-add" data-test-id="add-variable-row">
            <input
              v-model="newVarName"
              class="api-env-manager-input"
              type="text"
              aria-label="New variable name"
              data-test-id="new-var-name"
              placeholder="Variable name"
            >
            <input
              v-model="newVarValue"
              class="api-env-manager-input"
              :type="newVarSecret ? 'password' : 'text'"
              aria-label="New variable value"
              data-test-id="new-var-value"
              placeholder="Value"
              @keyup.enter="addScopeVariable"
            >
            <label class="api-env-secret-new">
              <input v-model="newVarSecret" type="checkbox" data-test-id="new-var-secret">
              Secret
            </label>
            <button class="api-mini-action api-env-add" type="button" data-test-id="add-variable" @click="addScopeVariable">+ Add variable</button>
          </div>
        </div>

        <p class="api-env-disclosure" data-test-id="environment-disclosure">
          Saved in this browser's localStorage for this website's origin. Environment names and all three scopes share the legacy API Debugger store; the selection made here does not change its default environment. Secret marking applies to a variable name across scopes, masks its value here and blanks it in exports; it does not encrypt the value at rest. Variables are substituted into requests sent through the first-party API relay.
        </p>
      </section>

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

          <section class="api-request-section api-assertions" aria-label="Request assertions" data-test-id="request-assertions">
            <div class="api-request-section-head">
              <span>Assertions <span class="api-field-hint">Check the response after Send</span></span>
              <button class="api-mini-action" type="button" data-test-id="add-assertion" @click="addAssertion()">+ Add assertion</button>
            </div>
            <p v-if="edAssertions.length === 0" class="api-field-hint api-assertions-empty">
              No assertions yet. Add a status, JSON field, response header or response-time assertion.
            </p>
            <div v-for="(assertion, i) in edAssertions" :key="assertion.id" class="api-assertion-row" data-test-id="assertion-row">
              <label class="api-assertion-enabled">
                <input v-model="assertion.enabled" type="checkbox" :aria-label="`Enable test ${i + 1}`" @change="updateAssertion(assertion)">
                On
              </label>
              <n-select
                :value="assertion.type"
                :options="assertionTypeOptions"
                size="small"
                class="api-assertion-select"
                :aria-label="`Test ${i + 1} type`"
                data-test-id="assertion-type"
                @update:value="changeAssertionType(assertion, $event)"
              />
              <input
                v-if="assertionNeedsTarget(assertion)"
                v-model="assertion.target"
                class="api-kv-input api-assertion-target"
                :aria-label="`Test ${i + 1} target`"
                :placeholder="assertion.type === 'json' ? '$.data.id' : 'Header name'"
                data-test-id="assertion-target"
                @change="updateAssertion(assertion)"
              >
              <n-select
                :value="assertion.operator"
                :options="assertionOperatorOptions(assertion.type)"
                size="small"
                class="api-assertion-operator"
                :aria-label="`Test ${i + 1} operator`"
                data-test-id="assertion-operator"
                @update:value="changeAssertionOperator(assertion, $event)"
              />
              <input
                v-if="assertionNeedsExpected(assertion)"
                v-model="assertion.expected"
                class="api-kv-input api-assertion-expected"
                :aria-label="`Test ${i + 1} expected value`"
                placeholder="Expected value"
                data-test-id="assertion-expected"
                @change="updateAssertion(assertion)"
              >
              <button class="api-mini-action api-assertion-remove" type="button" :aria-label="`Remove test ${i + 1}`" @click="removeAssertion(i)">×</button>
              <p v-if="assertionEngine.assertionProblem(assertion)" class="api-assertion-warning">{{ assertionEngine.assertionProblem(assertion) }}</p>
            </div>
          </section>

          <div v-if="singleError" class="api-response-error" role="alert" data-test-id="single-send-error">
            <span>{{ singleError }}</span>
            <button
              v-if="singleCanRetry"
              class="api-mini-action api-error-retry"
              type="button"
              data-test-id="retry-send"
              :disabled="sendingSingle"
              @click="sendSelectedRequest"
            >
              Retry request
            </button>
          </div>
          <section v-if="singleResponse" class="api-response-panel" data-test-id="single-response" aria-label="Response">
            <div class="api-response-head">
              <div class="api-response-status">
                <span class="api-response-code" :data-ok="singleResponse.status >= 200 && singleResponse.status < 400">{{ singleResponse.status }} {{ singleResponse.statusText }}</span>
                <span class="api-field-hint">{{ singleResponse.elapsedMs }} ms · {{ singleResponse.url }}</span>
              </div>
              <div class="api-response-head-actions">
                <button
                  v-if="singleCanRetry"
                  class="api-mini-action api-error-retry"
                  type="button"
                  data-test-id="retry-send"
                  :disabled="sendingSingle"
                  @click="sendSelectedRequest"
                >
                  Retry request
                </button>
                <button class="api-mini-action" type="button" data-test-id="clear-response" @click="singleResponse = null; singleCanRetry = false">Clear</button>
              </div>
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
            <section v-if="singleAssertionReport" class="api-assertion-results" data-test-id="single-assertion-report" aria-label="Test results">
              <div class="api-assertion-results-head">
                <strong>{{ singleAssertionReport.total === 0 ? 'Request sent · no enabled assertions' : `${singleAssertionReport.passed}/${singleAssertionReport.total} assertions passed` }}</strong>
                <span v-if="singleAssertionReport.failed" class="api-assertion-failed-count">{{ singleAssertionReport.failed }} failed</span>
              </div>
              <ul v-if="singleAssertionReport.total" class="api-assertion-result-list">
                <li v-for="result in singleAssertionReport.results" :key="result.id" :data-passed="result.passed" data-test-id="assertion-result">
                  <span class="api-assertion-result-state">{{ result.passed ? 'PASS' : 'FAIL' }}</span>
                  <div class="api-assertion-result-copy">
                    <strong>{{ result.label }}</strong>
                    <span>{{ result.message }}</span>
                  </div>
                </li>
              </ul>
            </section>
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

      <div v-else-if="!running && !runSummary" class="api-editor-empty">
        <div class="api-editor-mark" aria-hidden="true">
          <span class="api-method-badge static" style="color: var(--api-method-get); border-color: var(--api-method-get)">GET</span>
          <span class="api-url-ghost">https://api.example.com/…</span>
        </div>
        <h2 class="api-editor-title">
          Start with your first request
        </h2>
        <p class="api-editor-sub">
          Create a blank request, add your endpoint URL, then select Send. New requests start as GET; you can change the method any time.
        </p>
        <button
          class="api-tool-btn api-run-btn api-first-request-btn"
          type="button"
          data-test-id="create-first-request"
          @click="addRequestTo(null)"
        >
          Create your first request
        </button>
        <p class="api-editor-tip">
          Group related calls into folders, then run the collection in order when you're ready.
        </p>
        <p class="api-editor-note">
          Saved collections and environment values stay in this browser. Requests pass through our first-party API relay.
        </p>
      </div>

      <!-- Collection run: show progress first, then safe per-request outcomes and the shareable report. -->
      <div v-if="running || runSummary" class="api-run-result" data-test-id="run-result">
        <div class="api-run-summary">
          <div class="api-run-summary-copy">
            <strong v-if="running">Collection run in progress</strong>
            <strong v-else data-test-id="run-result-status">
              {{ runResultStatus }}
            </strong>
            <span v-if="runSummary" class="api-run-line">
              {{ runSummary.results.length }}/{{ runSummary.total }} requests ·
              {{ runSummary.results.filter(result => result.passed).length }} passed ·
              {{ runSummary.results.filter(result => !result.passed).length }} failed ·
              {{ runSummary.assertionsPassed }}/{{ runSummary.assertionsTotal }} assertions ·
              {{ runSummary.scriptTestsPassed }}/{{ runSummary.scriptTestsTotal }} script tests
              <span v-if="runSummary.total > runSummary.results.length"> · {{ runSummary.total - runSummary.results.length }} not run</span>
            </span>
            <span v-else class="api-run-line">
              {{ runProgress.completed }}/{{ runProgress.total }} requests completed
            </span>
          </div>
          <div class="api-run-summary-actions">
            <button
              v-if="running"
              class="api-tool-btn"
              type="button"
              data-test-id="cancel-run"
              :disabled="cancelRequested"
              @click="cancelRun"
            >
              {{ cancelRequested ? 'Cancelling…' : 'Cancel run' }}
            </button>
            <button v-if="runSummary" class="api-tool-btn" type="button" data-test-id="run-again" @click="onRun">
              Run again
            </button>
            <button v-if="runSummary" class="api-tool-btn" type="button" data-test-id="dismiss-run" @click="dismissRun">
              Dismiss
            </button>
          </div>
        </div>

        <div v-if="running" class="api-run-progress">
          <div class="api-run-progress-copy" role="status" aria-live="polite">
            <span data-test-id="run-progress">{{ runProgress.completed }}/{{ runProgress.total }} completed</span>
            <span v-if="runProgress.current" class="api-run-current" data-test-id="run-current-request">
              Now processing: {{ runProgress.current.name }} · {{ runProgress.current.method }} {{ redactRunText(runProgress.current.url) }}
            </span>
            <span v-else>Preparing the first request…</span>
          </div>
          <progress
            class="api-run-progress-bar"
            :value="runProgress.completed"
            :max="runProgress.total || 1"
            :aria-label="`Collection run progress: ${runProgress.completed} of ${runProgress.total} requests completed`"
          />
          <p v-if="cancelRequested" class="api-run-cancel-note" data-test-id="run-cancel-note">
            Cancellation requested. The current request or script will finish or time out; no next request will start.
          </p>
        </div>

        <div v-if="runSummary" class="api-run-finished">
          <ol class="api-run-request-list" data-test-id="run-result-list">
            <li v-for="(result, index) in runSummary.results" :key="`${index}-${result.id}`">
              <details
                class="api-run-request"
                data-test-id="run-request-result"
                :data-outcome="!result.sent ? 'not-sent' : result.passed ? 'passed' : 'failed'"
              >
                <summary class="api-run-request-summary">
                  <span class="api-run-outcome" :data-outcome="!result.sent ? 'not-sent' : result.passed ? 'passed' : 'failed'">
                    {{ !result.sent ? 'NOT SENT' : result.passed ? 'PASS' : 'FAIL' }}
                  </span>
                  <strong>{{ result.name }}</strong>
                  <code>{{ result.method }} {{ redactRunText(result.url) }}</code>
                  <span v-if="result.sent" class="api-run-request-meta">
                    {{ result.status }} · {{ result.elapsedMs }} ms
                  </span>
                </summary>
                <div class="api-run-request-detail">
                  <p v-if="result.error" class="api-run-detail-error">{{ redactRunText(result.error) }}</p>
                  <p v-if="result.scriptError" class="api-run-detail-error">{{ redactRunText(result.scriptError) }}</p>
                  <section v-if="result.report?.results.length" class="api-run-checks" aria-label="Request assertions">
                    <h4>Assertions</h4>
                    <ul>
                      <li v-for="assertion in result.report.results" :key="assertion.id">
                        <span class="api-run-outcome" :data-outcome="assertion.passed ? 'passed' : 'failed'">
                          {{ assertion.passed ? 'PASS' : 'FAIL' }}
                        </span>
                        <span>{{ redactRunText(assertion.label) }} — {{ redactRunText(assertion.message) }}</span>
                      </li>
                    </ul>
                  </section>
                  <section v-if="result.scriptTests?.length" class="api-run-checks" aria-label="Script tests">
                    <h4>Script tests</h4>
                    <ul>
                      <li v-for="(scriptTest, testIndex) in result.scriptTests" :key="`${testIndex}-${scriptTest.name}`">
                        <span class="api-run-outcome" :data-outcome="scriptTest.passed ? 'passed' : 'failed'">
                          {{ scriptTest.passed ? 'PASS' : 'FAIL' }}
                        </span>
                        <span>{{ redactRunText(scriptTest.name) }}<span v-if="scriptTest.error"> — {{ redactRunText(scriptTest.error) }}</span></span>
                      </li>
                    </ul>
                  </section>
                  <p v-if="!result.error && !result.scriptError && !result.report?.results.length && !result.scriptTests?.length" class="api-run-detail-muted">
                    No assertion or script-test details for this request.
                  </p>
                </div>
              </details>
            </li>
          </ol>

          <details class="api-run-text-report">
            <summary>Text report · redacted</summary>
            <div class="api-run-report-actions">
              <button class="api-tool-btn" type="button" data-test-id="copy-run-report" @click="copyRunReport">Copy report</button>
              <button class="api-tool-btn" type="button" data-test-id="download-run-report" @click="downloadRunReport">Download report</button>
            </div>
            <pre class="api-run-output" data-test-id="run-text-report">{{ runOutput }}</pre>
          </details>
        </div>
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

.api-data-disclosure {
  flex: 0 0 auto;
  min-width: 0;
  border-bottom: 1px solid var(--api-border);
}

.api-data-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 6px var(--api-gap);
  color: var(--api-text-soft);
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.api-data-summary::-webkit-details-marker { display: none; }
.api-data-summary:focus-visible {
  outline: 2px solid var(--api-primary);
  outline-offset: -2px;
}
.api-data-summary-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.api-data-summary-copy strong {
  color: var(--api-text);
  font-size: var(--api-fs-sm);
  font-weight: 600;
}
.api-data-summary-copy span {
  overflow: hidden;
  color: var(--api-text-muted);
  font-size: var(--api-fs-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.api-data-chevron {
  flex: 0 0 auto;
  color: var(--api-text-muted);
  font-size: 18px;
  line-height: 1;
  transition: transform .15s ease;
}
.api-data-disclosure[open] .api-data-chevron {
  transform: rotate(180deg);
}

.api-io-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 0 var(--api-gap) var(--api-gap-sm);
}

.api-io-row > .api-tool-btn {
  min-width: 0;
  min-height: 36px;
  height: auto;
  padding: 6px 8px;
  line-height: 1.25;
  white-space: normal;
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

.api-openapi-field {
  display: flex;
  flex: 1 1 180px;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  color: var(--api-text-muted);
  font-size: var(--api-fs-xs);
}
.api-openapi-field select {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
  color: var(--api-text);
  font: inherit;
}
.api-import-warning-list {
  margin: 8px 0;
  padding-left: 20px;
  color: var(--api-text-soft);
  font-size: var(--api-fs-xs);
}
.api-openapi-operation-list {
  max-height: 180px;
  overflow: auto;
  overflow-wrap: anywhere;
}
.api-openapi-operation-list code {
  display: inline-block;
  min-width: 42px;
  margin-right: 4px;
}
.api-openapi-operation-list span {
  color: var(--api-text-muted);
  font-family: var(--api-font-mono);
}
.api-import-warning-list li + li {
  margin-top: 4px;
}
@media (max-width: 640px) {
  .api-openapi-field {
    flex-basis: 100%;
  }
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
  flex: 0 0 auto;
  min-width: 24px;
  font-size: var(--api-fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--api-text-muted);
  white-space: nowrap;
}

.api-env-select-wrap {
  flex: 1 1 112px;
  min-width: 96px;
  max-width: 100%;
}

.api-env-select {
  width: 100%;
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

/* Manual recovery is a high-consequence action; keep a comfortable mobile touch target. */
.api-error-retry {
  min-height: 44px;
  padding-inline: 12px;
}

.api-field-hint {
  color: var(--api-text-faint);
  font-size: var(--api-fs-xs);
  font-weight: 400;
}

.api-backup-preview {
  margin-top: 10px;
}

.api-backup-restore-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 10px 0;
  padding: 8px 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
}

.api-backup-restore-modes legend {
  padding: 0 4px;
  color: var(--api-text-soft);
  font-size: var(--api-fs-xs);
}

.api-backup-restore-modes label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--api-fs-sm);
}

.api-backup-restore-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.api-response-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--api-danger, #d45b5b);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-danger, #d45b5b);
  font-size: var(--api-fs-sm);
  overflow-wrap: anywhere;
}

.api-response-error > span {
  flex: 1 1 16rem;
  min-width: 0;
}

.api-error-retry {
  flex: 0 0 auto;
  white-space: nowrap;
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

.api-response-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
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
  /* Keep the report at its full intrinsic height inside the scrolling editor.
     A shrinking flex item clipped the disclosure summary on long request editors. */
  flex: 0 0 auto;
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

.api-run-summary-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.api-run-summary-copy strong {
  color: var(--api-text);
}

.api-run-summary-actions,
.api-run-report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 0 0 auto;
}

.api-run-progress,
.api-run-finished {
  padding: 10px 12px;
}

.api-run-progress {
  display: grid;
  gap: 8px;
  border-bottom: 1px solid var(--api-border);
}

.api-run-progress-copy {
  display: grid;
  gap: 4px;
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
}

.api-run-current {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--api-text);
}

.api-run-progress-bar {
  display: block;
  width: 100%;
  height: 8px;
  accent-color: var(--api-primary);
}

.api-run-cancel-note,
.api-run-detail-error,
.api-run-detail-muted {
  margin: 0;
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.api-run-cancel-note,
.api-run-detail-error {
  padding: 8px 10px;
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
}

.api-run-request-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.api-run-request {
  min-width: 0;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface);
}

.api-run-request-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  padding: 9px 10px;
  cursor: pointer;
}

.api-run-request-summary strong {
  color: var(--api-text);
}

.api-run-request-summary code {
  min-width: 0;
  flex: 1 1 220px;
  overflow-wrap: anywhere;
  color: var(--api-text-soft);
  font-size: var(--api-fs-xs);
}

.api-run-request-meta {
  color: var(--api-text-muted);
  font-size: var(--api-fs-xs);
  white-space: nowrap;
}

.api-run-outcome {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 58px;
  padding: 3px 6px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  color: var(--api-text);
  font-size: var(--api-fs-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.api-run-outcome[data-outcome="passed"] {
  border-color: var(--api-success);
}

.api-run-outcome[data-outcome="failed"],
.api-run-outcome[data-outcome="not-sent"] {
  border-color: var(--api-danger);
}

.api-run-request-detail {
  display: grid;
  gap: 9px;
  padding: 0 10px 10px;
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  overflow-wrap: anywhere;
}

.api-run-checks {
  display: grid;
  gap: 6px;
}

.api-run-checks h4 {
  margin: 0;
  color: var(--api-text);
  font-size: var(--api-fs-sm);
}

.api-run-checks ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.api-run-checks li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.api-run-text-report {
  margin-top: 10px;
  border-top: 1px solid var(--api-border);
  padding-top: 9px;
}

.api-run-text-report > summary {
  display: block;
  position: relative;
  z-index: 1;
  min-height: 28px;
  padding: 4px 0;
  pointer-events: auto;
  color: var(--api-text);
  font-size: var(--api-fs-sm);
  font-weight: 600;
  cursor: pointer;
}

.api-run-report-actions {
  margin: 9px 0;
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

.api-first-request-btn {
  min-height: 40px;
  padding: 0 16px;
  margin-bottom: var(--api-gap);
  font-weight: 650;
}

.api-editor-tip {
  margin: 0 0 var(--api-gap);
  font-size: var(--api-fs-sm);
  line-height: 1.6;
  color: var(--api-text-muted);
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

  /* Retry is a primary recovery action on touch devices, not a tiny utility chip. */
  .api-error-retry {
    min-height: 44px;
    padding: 8px 12px;
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

.api-assertions {
  margin-top: 12px;
}
.api-assertions-empty {
  margin: 2px 0 4px;
}
.api-assertion-row {
  display: grid;
  grid-template-columns: 48px minmax(112px, 0.9fr) minmax(120px, 1fr) minmax(120px, 1fr) 28px;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid var(--api-border);
}
.api-assertion-enabled {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--api-text-muted);
  font-size: var(--api-fs-xs);
}
.api-assertion-select,
.api-assertion-operator {
  min-width: 0;
}
.api-assertion-target,
.api-assertion-expected {
  width: 100%;
  min-width: 0;
  height: 32px;
}
.api-assertion-remove {
  justify-self: end;
}
.api-assertion-warning {
  grid-column: 2 / -1;
  margin: -2px 0 2px;
  color: var(--api-warning, #b7791f);
  font-size: var(--api-fs-xs);
}
.api-assertion-results {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--api-border);
}
.api-assertion-results-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  color: var(--api-text);
  font-size: var(--api-fs-sm);
}
.api-assertion-failed-count {
  color: var(--api-danger, #c44);
  font-size: var(--api-fs-xs);
}
.api-assertion-result-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.api-assertion-result-list li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 7px 9px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
}
.api-assertion-result-list li[data-passed="false"] {
  border-color: var(--api-danger-line, var(--api-border));
}
.api-assertion-result-state {
  flex: 0 0 36px;
  font-family: var(--api-font-mono);
  font-size: var(--api-fs-xs);
  font-weight: 700;
  color: var(--api-success, #27875d);
}
.api-assertion-result-list li[data-passed="false"] .api-assertion-result-state {
  color: var(--api-danger, #c44);
}
.api-assertion-result-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
  color: var(--api-text-soft);
  font-size: var(--api-fs-xs);
  overflow-wrap: anywhere;
}
.api-assertion-result-copy strong {
  color: var(--api-text);
  font-weight: 600;
}
@media (max-width: 760px) {
  .api-assertion-row {
    grid-template-columns: 42px minmax(0, 1fr) 28px;
    gap: 6px;
  }
  .api-assertion-select,
  .api-assertion-operator,
  .api-assertion-target,
  .api-assertion-expected,
  .api-assertion-warning {
    grid-column: 2 / 3;
  }
  .api-assertion-remove {
    grid-column: 3;
    grid-row: 1;
  }
}

.api-env-manage-toggle {
  flex: 0 0 auto;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--api-primary-line);
  border-radius: var(--api-radius-sm);
  background: var(--api-primary-soft);
  color: var(--api-primary);
  font-size: var(--api-fs-xs);
  font-weight: 600;
  cursor: pointer;
}
.api-env-manager {
  display: grid;
  gap: 14px;
  width: 100%;
  max-width: 900px;
  margin-bottom: var(--api-gap);
  padding: 14px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius);
  background: var(--api-surface);
}
.api-env-manager-heading,
.api-env-manager-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.api-env-manager-heading h2 {
  margin: 0;
  color: var(--api-text);
  font-size: var(--api-fs-md);
  font-weight: 650;
}
.api-env-manager-heading p {
  margin: 3px 0 0;
  color: var(--api-text-muted);
  font-size: var(--api-fs-sm);
}
.api-env-manager-section {
  display: grid;
  gap: 9px;
}
.api-env-manager-section-title {
  color: var(--api-text);
  font-size: var(--api-fs-sm);
}
.api-env-manager-actions {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) auto minmax(140px, 1fr) auto auto;
  align-items: center;
  gap: 7px;
}
.api-env-manager-input {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text);
  font: inherit;
  font-size: var(--api-fs-sm);
}
.api-env-manager-input:focus {
  outline: none;
  border-color: var(--api-primary);
  box-shadow: var(--api-focus-ring);
}
.api-env-scope-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.api-env-scope-button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  cursor: pointer;
}
.api-env-scope-button.is-active {
  border-color: var(--api-primary-line);
  background: var(--api-primary-soft);
  color: var(--api-primary);
  font-weight: 600;
}
.api-env-export {
  margin-left: auto;
}
.api-env-variable-list {
  display: grid;
  gap: 7px;
}
.api-env-variable-row {
  display: grid;
  grid-template-columns: minmax(115px, 0.85fr) minmax(180px, 1.35fr) minmax(110px, 0.8fr) auto auto;
  align-items: center;
  gap: 7px;
  padding: 8px;
  border: 1px solid var(--api-border);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
}
.api-env-variable-value {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.api-env-variable-value input {
  flex: 1 1 auto;
}
.api-env-origin {
  color: var(--api-text-faint);
  font-size: var(--api-fs-xs);
  overflow-wrap: anywhere;
}
.api-env-origin:not(:empty) {
  white-space: normal;
}
.api-env-variable-row [data-test-id="toggle-variable-secret"].is-secret {
  color: var(--api-warning);
  border-color: var(--api-warning-line, var(--api-border));
}
.api-env-remove {
  color: var(--api-text-muted);
}
.api-env-secret-new {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--api-text-soft);
  font-size: var(--api-fs-sm);
  white-space: nowrap;
}
.api-env-variable-add {
  display: grid;
  grid-template-columns: minmax(120px, 0.85fr) minmax(180px, 1.35fr) auto auto;
  align-items: center;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px solid var(--api-border);
}
.api-env-empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--api-border);
  border-radius: var(--api-radius-sm);
  color: var(--api-text-muted);
  font-size: var(--api-fs-sm);
}
.api-env-disclosure {
  margin: 0;
  padding: 9px 11px;
  border-left: 3px solid var(--api-warning, #b7791f);
  border-radius: var(--api-radius-sm);
  background: var(--api-surface-2);
  color: var(--api-text-soft);
  font-size: var(--api-fs-xs);
  line-height: 1.55;
}
.api-env-delete:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  .api-env-manager {
    padding: 10px;
  }
  .api-env-manager-actions {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .api-env-variable-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .api-env-variable-name,
  .api-env-variable-value,
  .api-env-origin {
    grid-column: 1 / -1;
  }
  .api-env-variable-value {
    grid-column: 1;
  }
  .api-env-variable-row .api-env-remove {
    grid-column: 2;
    grid-row: 2;
  }
  .api-env-variable-add {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .api-env-variable-add input,
  .api-env-secret-new {
    grid-column: 1 / -1;
  }
  .api-env-export {
    margin-left: 0;
  }
}

@media (max-width: 760px) {
  .api-run-summary {
    align-items: flex-start;
    flex-direction: column;
  }
  .api-run-summary-actions {
    width: 100%;
  }
  .api-run-request-summary {
    align-items: flex-start;
  }
  .api-run-request-summary code {
    flex-basis: 100%;
  }

  .api-workspace {
    flex-direction: column;
    min-width: 0;
  }

  .api-sidebar {
    flex: 0 0 auto;
    width: 100%;
    height: 32dvh;
    min-height: 180px;
    max-height: 280px;
    overflow: hidden;
    border-right: 0;
    border-bottom: 1px solid var(--api-border);
  }

  .api-sidebar:has(.api-data-disclosure[open]) {
    box-sizing: border-box;
    height: min(50dvh, 399px);
    max-height: 399px;
  }

  /* Keep high-frequency request/environment controls visible while the tree
     scrolls in its own region. Import/export actions expand only on demand. */
  .api-sidebar-head,
  .api-toolbar,
  .api-data-disclosure,
  .api-envbar {
    flex: 0 0 auto;
  }

  .api-tree {
    flex: 1 1 0;
    min-height: 0;
    overflow: auto;
  }

  .api-row-actions {
    display: inline-flex;
  }

  .api-toolbar .api-tool-btn,
  .api-io-row .api-tool-btn {
    min-width: 0;
    min-height: 44px;
    height: auto;
    padding: 6px 7px;
    white-space: nowrap;
  }

  .api-envbar {
    gap: 5px;
    padding: 6px 8px;
  }

  .api-editor {
    flex: 1 1 0;
    min-width: 0;
    min-height: 0;
    padding: 10px;
    overflow: auto;
  }

  .api-editor-form {
    width: 100%;
    min-width: 0;
  }
}
</style>
