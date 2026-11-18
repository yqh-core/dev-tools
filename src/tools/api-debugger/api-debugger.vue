<script setup lang="ts">
import JSON5 from 'json5';
import { useStorage } from '@vueuse/core';
import { JsonPathError, jsonPath } from '../json-workspace/jsonpath';
import { parseCurl, toCurl } from './curl';
import { AUTH_HEADER_NAMES, type KV, buildProxyPayload, responseToWorkspaceLink, sanitizeForShare, stashHandoff } from './engine';
import { SAVED_CAP, type HistoryEntry, type SavedRequest, exportSavedRequest, parseHistory, parseSaved, pushHistory, removeHistory, removeSaved, renameSaved, saveRequest } from './store';
import { type Assertion, type AssertionReport, type AssertionType, OPS_BY_TYPE, OP_LABELS, formatReportText, makeAssertion, parseAssertions, runAssertions } from './assertions';
import { type CollectionRunSummary, type IterationSummary, type RequestRunResult, type RunnerResponse, type SendFn, formatCollectionReportText, runCollection } from './runner';
import { type DataFile, parseDataFile, previewRows } from './datafiles';
import { buildRunReport, toJUnitXml, type RunReportMeta } from './report';
import { formatBytes, searchBody, utf8Bytes } from './response';
import { authHeaderPreset, buildUrlWithQuery, parseQueryParams } from './query';
import { importOpenApi } from './openapi';
import { type EnvStore, VAR_SCOPES, type VarScope, activeVars, addEnv, deleteEnv, exportableVars, isSecret, migrateEnv, removeScopeVar, renameEnv, scopeOf, scopeVars, setEnvVar, setScopeVar, setSecret } from './environments';
import { exportCollection, importCollection } from './collection';
import { runScriptIsolated } from './script-sandbox';
import { buildDownloadFilename, downloadTextFile, mimeForLanguage } from '@/composable/downloadText';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

defineOptions({ name: 'ApiDebugger' });

// ── 请求状态（本地持久化；凭据只留在本机，分享默认剔除）──────────────
const method = useStorage('api-debugger:method', 'GET');
const url = useStorage('api-debugger:url', 'https://httpbin.org/get');
const headers = useStorage<KV[]>('api-debugger:headers', [{ name: 'Accept', value: 'application/json' }]);
const body = useStorage('api-debugger:body', '');
// API-005 环境作用域：旧扁平 Record 经 migrateEnv 幂等迁移为 EnvStore，不丢变量。
const envStore = useStorage<EnvStore>('api-debugger:env', { active: 'Default', envs: { Default: {} } }, undefined, {
  serializer: { read: (v: string) => migrateEnv(v ? JSON.parse(v) : null), write: (v: EnvStore) => JSON.stringify(v) },
});
const env = computed(() => activeVars(envStore.value));
const envOptions = computed(() => Object.keys(envStore.value.envs).map(n => ({ label: n, value: n })));
const activeEnv = computed({
  get: () => envStore.value.active,
  set: (n: string) => {
    envStore.value = { ...envStore.value, active: n };
  },
});
const newEnvName = ref('');
const envRenameDraft = ref(envStore.value.active);
watch(activeEnv, (n) => {
  envRenameDraft.value = n;
});
function createEnv() {
  envStore.value = addEnv(envStore.value, newEnvName.value);
  newEnvName.value = '';
}
function removeActiveEnv() {
  envStore.value = deleteEnv(envStore.value, envStore.value.active);
}
function applyRenameEnv() {
  envStore.value = renameEnv(envStore.value, envStore.value.active, envRenameDraft.value);
  envRenameDraft.value = envStore.value.active;
}

// ── API-005 作用域分层（environment > collection > global）+ 敏感值保护 ──────
const activeScope = ref<VarScope>('environment');
const scopeOptions = VAR_SCOPES.map(s => ({ label: s === 'environment' ? 'Environment' : s === 'collection' ? 'Collection' : 'Global', value: s }));
const scopeRows = computed(() => Object.entries(scopeVars(envStore.value, activeScope.value)).map(([name, value]) => ({
  name,
  value,
  secret: isSecret(envStore.value, name),
  origin: scopeOf(envStore.value, name),
})));
const revealed = ref<Set<string>>(new Set());
function isRevealed(name: string): boolean {
  return revealed.value.has(name);
}
function toggleReveal(name: string): void {
  const next = new Set(revealed.value);
  if (next.has(name)) {
    next.delete(name);
  }
  else {
    next.add(name);
  }
  revealed.value = next;
}
function setScopeVarUI(name: string, value: string): void {
  envStore.value = setScopeVar(envStore.value, activeScope.value, name, value);
}
function removeScopeVarUI(name: string): void {
  envStore.value = removeScopeVar(envStore.value, activeScope.value, name);
}
function renameScopeVarUI(oldName: string, newName: string, value: string): void {
  const wasSecret = isSecret(envStore.value, oldName);
  envStore.value = removeScopeVar(envStore.value, activeScope.value, oldName);
  envStore.value = setScopeVar(envStore.value, activeScope.value, newName, value);
  if (wasSecret && newName.trim()) {
    envStore.value = setSecret(envStore.value, newName.trim(), true);
  }
}
function toggleSecret(name: string): void {
  envStore.value = setSecret(envStore.value, name, !isSecret(envStore.value, name));
}

const curlText = ref('');
const curlWarnings = ref<string[]>([]);
const importError = ref('');
const sending = ref(false);
const sendError = ref('');
const extractError = ref('');
const banner = ref('');
const bearer = ref('');
const basicUser = ref('');
const basicPass = ref('');
const apiKey = ref('');

// ── API-004 请求参数表（URL↔rows 双向；显式 Apply 避免响应式回环）──────
const queryParams = ref<KV[]>(parseQueryParams(url.value));
let applyingParams = false;
function syncParamsFromUrl() {
  queryParams.value = parseQueryParams(url.value);
}
function applyParamsToUrl() {
  applyingParams = true;
  url.value = buildUrlWithQuery(url.value, queryParams.value);
  nextTick(() => {
    applyingParams = false;
  });
}
watch(url, () => {
  if (!applyingParams) {
    syncParamsFromUrl();
  }
});
function setApiKey() {
  const h = authHeaderPreset('api-key', apiKey.value);
  if (h) {
    upsertHeader(h.name, h.value);
    banner.value = 'X-API-Key header added.';
  }
}
const extractPath = ref('$.');
const extractName = ref('token');
const newVarName = ref('');
const newVarValue = ref('');

interface ProxyResponse { url: string; status: number; statusText: string; headers: Record<string, string>; body: string; elapsedMs: number; redirect?: string; followed?: boolean; note?: string }
const resp = ref<ProxyResponse | null>(null);

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const varPlaceholder = '{{name}}';
const currentRequest = computed(() => ({ method: method.value, url: url.value, headers: headers.value, body: body.value }));
const hasAuth = computed(() => headers.value.some(h => AUTH_HEADER_NAMES.includes(h.name.trim().toLowerCase())));

// ── API-006 历史与集合（只存本机；导出/分享默认剔除凭据）────────────
const history = useStorage<HistoryEntry[]>('api-debugger:history', [], undefined, { serializer: { read: (v: string) => parseHistory(v ? JSON.parse(v) : null), write: (v: HistoryEntry[]) => JSON.stringify(v) } });
const saved = useStorage<SavedRequest[]>('api-debugger:saved', [], undefined, { serializer: { read: (v: string) => parseSaved(v ? JSON.parse(v) : null), write: (v: SavedRequest[]) => JSON.stringify(v) } });
const saveName = ref('');
const saveError = ref('');
const bodyQuery = ref('');

// ── API-009 测试断言（结构化 Runner，对标 Postman Tests；不执行任意脚本）──
const assertions = useStorage<Assertion[]>('api-debugger:assertions', [], undefined, { serializer: { read: (v: string) => parseAssertions(v ? JSON.parse(v) : null), write: (v: Assertion[]) => JSON.stringify(v) } });
// API-011：当前请求的 pm.* 脚本文本（保存进 SavedRequest.scriptEvents；执行走隔离 Worker 沙箱）
const preScript = ref('');
const testScript = ref('');
// A-002/A-003：集合级脚本（独立一层事件；运行叠加进每请求链——pre 最外先执行/test 最后执行；
// 导出为 Postman doc 级事件；导入集合的 doc 级脚本已合并进各请求链，本区为手动管理层）
const collectionScripts = useStorage<{ prerequest: string; test: string }>('api-debugger:collection-scripts', { prerequest: '', test: '' });
const testReport = ref<AssertionReport | null>(null);
const testMeta = ref<{ method: string; url: string } | null>(null);
const testsNote = ref('');
const ASSERTION_TYPES: { label: string; value: AssertionType }[] = [
  { label: 'Status code', value: 'status' },
  { label: 'JSON field', value: 'json' },
  { label: 'Header', value: 'header' },
  { label: 'Response time', value: 'time' },
];
function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function addAssertion(type: AssertionType = 'status'): void {
  assertions.value.push(makeAssertion(newId(), type));
}
function onAssertionTypeChange(a: Assertion): void {
  a.operator = OPS_BY_TYPE[a.type][0];
}
function opOptions(type: AssertionType): { label: string; value: string }[] {
  return OPS_BY_TYPE[type].map(op => ({ label: OP_LABELS[op] ?? op, value: op }));
}
function needsTarget(a: Assertion): boolean {
  return a.type === 'json' || a.type === 'header';
}
function needsExpected(a: Assertion): boolean {
  return a.operator !== 'exists' && a.operator !== 'not_exists';
}
function reportText(): string {
  return testReport.value
    ? formatReportText(testReport.value, { method: testMeta.value?.method, url: testMeta.value?.url, status: resp.value?.status, elapsedMs: resp.value?.elapsedMs })
    : '';
}
async function copyReport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(reportText());
    banner.value = 'Test report copied to clipboard.';
  }
  catch (e) {
    banner.value = `Could not copy: ${e instanceof Error ? e.message : String(e)}`;
  }
}
function downloadReport(): void {
  const ok = downloadTextFile({ content: reportText(), filename: buildDownloadFilename('api-test-report', 'txt'), mimeType: 'text/plain' });
  banner.value = ok ? 'Test report downloaded (assertion results only; no credential headers included).' : 'Download failed: report content was empty (no file written).';
}

// ── API-010 集合级批量 Runner（对标 Postman Collection Runner；顺序执行+逐请求断言）──
const runnerRunning = ref(false);
const runnerSummary = ref<CollectionRunSummary | null>(null);
const runnerResults = ref<RequestRunResult[]>([]);
const runnerError = ref('');
const stopOnError = ref(true);
const stopOnFailure = ref(false);
const runnerDelay = ref('0');
let runnerSignal: { aborted: boolean } | null = null;

const runnerSend: SendFn = async (payload) => {
  const r = await fetch('/api/apiproxy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((j && j.error) || `Proxy returned HTTP ${r.status}.`);
  }
  return j as RunnerResponse;
};
async function runCollectionNow(): Promise<void> {
  if (!saved.value.length) {
    banner.value = 'Collection is empty; save a request first.';
    return;
  }
  const rounds = resolveIterations();
  if (rounds === null) {
    return;
  }
  runnerRunning.value = true;
  runnerError.value = '';
  runnerSummary.value = null;
  runnerResults.value = [];
  lastRunId.value = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const signal = { aborted: false };
  runnerSignal = signal;
  try {
    runnerSummary.value = await runCollection(saved.value, env.value, runnerSend, {
      stopOnError: stopOnError.value,
      stopOnFailure: stopOnFailure.value,
      delayMs: Number(runnerDelay.value) || 0,
      signal,
      dataFile: dataFile.value ?? undefined,
      dataFileType: dataFile.value ? dataFileType.value : undefined,
      iterations: rounds,
      collectionScripts: { prerequest: collectionScripts.value.prerequest, test: collectionScripts.value.test },
      onProgress: (r) => { runnerResults.value = [...runnerResults.value, r]; },
      // API-011：pm.* 脚本在隔离 Worker 沙箱执行；网络只走宿主 apiproxy（outbox）
      runScript: (code, snapshot) => runScriptIsolated(code, snapshot, runnerSend),
    });
  }
  catch (e) {
    runnerError.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    runnerRunning.value = false;
    runnerSignal = null;
  }
}
function cancelRun(): void {
  if (runnerSignal) {
    runnerSignal.aborted = true;
  }
}
function runnerReportText(): string {
  return runnerSummary.value ? formatCollectionReportText(runnerSummary.value) : '';
}
async function copyRunnerReport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(runnerReportText());
    banner.value = 'Collection run report copied to clipboard.';
  }
  catch (e) {
    banner.value = `Could not copy: ${e instanceof Error ? e.message : String(e)}`;
  }
}
function downloadRunnerReport(): void {
  const ok = downloadTextFile({ content: runnerReportText(), filename: buildDownloadFilename('collection-run-report', 'txt'), mimeType: 'text/plain' });
  banner.value = ok ? 'Collection run report downloaded (no credential headers included).' : 'Download failed: report content was empty (no file written).';
}

// ── API-012/B 数据驱动运行（B1 数据文件 / B2 迭代 / B3+B4 报告下载）────────
// 数据文件只在本机用 FileReader 读取、内存解析（永不上传）；报告、日志与迭代显示
// 默认不含数据行值——只有列名与行计数（脱敏口径见 report.ts / datafiles.ts）。
const dataFilePicker = ref<HTMLInputElement | null>(null);
const dataFile = ref<DataFile | null>(null);
const dataFileType = ref<'csv' | 'json'>('csv');
const dataFileName = ref('');
const dataFileError = ref('');
const iterationsInput = ref('');
const iterationsError = ref('');
const lastRunId = ref('');

const dataFilePreview = computed(() => (dataFile.value ? previewRows(dataFile.value) : null));

/** 迭代计划（输入即校验；非法输入 fail-closed，不静默回退默认值）。 */
const iterationPlan = computed(() => {
  const rows = dataFile.value?.rows.length ?? 0;
  if (!rows) {
    return { rounds: 1, note: iterationsInput.value.trim() ? 'iterations require a data file — running a single round' : 'no data file — single round' };
  }
  const raw = iterationsInput.value.trim();
  if (!raw) {
    return { rounds: rows, note: `default: one round per data row (${rows})` };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    return { rounds: -1, note: 'must be a positive integer (empty = one round per data row)' };
  }
  if (n > rows) {
    return { rounds: n, note: `${n} rounds > ${rows} rows — rows are reused in cycle (round % rows)` };
  }
  return { rounds: n, note: n > 1 ? `${n} explicit rounds` : 'single round' };
});

function onDataFilePicked(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 允许重新选择同名文件
  dataFileError.value = '';
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const r = parseDataFile(file.name, String(reader.result ?? ''));
    if (!r.ok) {
      dataFileError.value = r.error;
      dataFile.value = null;
      dataFileName.value = '';
      return;
    }
    dataFile.value = r.data;
    dataFileType.value = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv';
    dataFileName.value = file.name;
    iterationsInput.value = ''; // 行数变了，默认轮数（=行数）随之重置
    iterationsError.value = '';
    banner.value = `Data file loaded: ${r.data.rows.length} rows × ${r.data.columns.length} columns (parsed locally, never uploaded; values are redacted from reports and logs).`;
  };
  reader.onerror = () => { dataFileError.value = 'Could not read the file (local read failed).'; };
  reader.readAsText(file);
}
function clearDataFile(): void {
  dataFile.value = null;
  dataFileName.value = '';
  dataFileError.value = '';
  iterationsInput.value = '';
  iterationsError.value = '';
}
/** @returns 计划轮数；非法输入返回 null（调用方中止运行并展示错误）。 */
function resolveIterations(): number | null {
  if (iterationPlan.value.rounds < 0) {
    iterationsError.value = 'Iterations must be a positive integer (empty = one round per data row).';
    return null;
  }
  iterationsError.value = '';
  return iterationPlan.value.rounds;
}

/** 与 package.json version 同步（报告 meta 的信息性字段）。 */
const API_STUDIO_VERSION = '2026.01.22-v2';
function runnerReportMeta(): RunReportMeta {
  return {
    runId: lastRunId.value,
    apiStudioVersion: API_STUDIO_VERSION,
    collectionName: `API Studio saved collection (${saved.value.length} requests)`,
    environmentName: envStore.value.active,
    startedAt: runnerSummary.value ? new Date(runnerSummary.value.startedAt).toISOString() : '',
    finishedAt: runnerSummary.value ? new Date(runnerSummary.value.finishedAt).toISOString() : '',
  };
}
function downloadRunnerJsonReport(): void {
  if (!runnerSummary.value) {
    return;
  }
  const ok = downloadTextFile({
    content: JSON.stringify(buildRunReport(runnerSummary.value, runnerReportMeta()), null, 2),
    filename: buildDownloadFilename('api-studio-run', 'json'),
    mimeType: 'application/json',
  });
  banner.value = ok ? 'JSON run report downloaded (secrets, env values, data row values, bodies and header values excluded by default).' : 'Download failed: report content was empty (no file written).';
}
function downloadRunnerJunitReport(): void {
  if (!runnerSummary.value) {
    return;
  }
  const ok = downloadTextFile({
    content: toJUnitXml(buildRunReport(runnerSummary.value, runnerReportMeta())),
    filename: buildDownloadFilename('api-studio-run', 'xml'),
    mimeType: 'application/xml',
  });
  banner.value = ok ? 'JUnit XML report downloaded (CI-parseable; HTTP 4xx/5xx with passing assertions is not a failure).' : 'Download failed: report content was empty (no file written).';
}

/** 结果显示：运行中=扁平行（实时追加）；完成后按迭代分组（B2：每轮隔离可见，列名级脱敏）。 */
const runnerGroups = computed<IterationSummary[]>(() => {
  if (runnerSummary.value) {
    return runnerSummary.value.iterations;
  }
  return runnerResults.value.length ? [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: runnerResults.value }] : [];
});
/** 运行中的实时轮次指示（已完成数 ÷ 每轮请求数）。 */
const liveIteration = computed(() => {
  if (!runnerRunning.value || !saved.value.length) {
    return null;
  }
  return Math.floor(runnerResults.value.length / saved.value.length) + 1;
});

const respBytes = computed(() => resp.value ? utf8Bytes(resp.value.body) : 0);
const bodyView = computed(() => resp.value ? searchBody(resp.value.body, bodyQuery.value) : null);
const bodyShown = computed(() => bodyView.value ? bodyView.value.lines.join('\n') : '');

function loadRequest(r: { method: string; url: string; headers: KV[]; body: string }, loadAssertions?: Assertion[], loadScripts?: { prerequest?: string; test?: string }): void {
  method.value = r.method;
  url.value = r.url;
  headers.value = r.headers.map(h => ({ ...h }));
  body.value = r.body;
  if (loadAssertions !== undefined) {
    assertions.value = loadAssertions.map(a => ({ ...a }));
  }
  preScript.value = loadScripts?.prerequest ?? '';
  testScript.value = loadScripts?.test ?? '';
  banner.value = 'Request loaded into the builder.';
}
function recordHistory(request: { method: string; url: string; headers: KV[]; body: string }, status: number | null, elapsedMs: number | null, error?: string, tests?: { passed: number; failed: number }): void {
  history.value = pushHistory(history.value, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    request,
    status,
    elapsedMs,
    error,
    ...(tests === undefined ? {} : { tests }),
  });
}
function saveCurrent(): void {
  saveError.value = '';
  const scriptEvents: { prerequest?: string; test?: string } = {};
  if (preScript.value.trim()) scriptEvents.prerequest = preScript.value;
  if (testScript.value.trim()) scriptEvents.test = testScript.value;
  const r = saveRequest(saved.value, saveName.value, currentRequest.value, Date.now(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, assertions.value, SAVED_CAP, Object.keys(scriptEvents).length ? scriptEvents : undefined);
  if (r.error) {
    saveError.value = r.error;
    return;
  }
  saved.value = r.list;
  saveName.value = '';
  banner.value = `Saved "${r.saved?.name}" to your collection (local only).`;
}
function exportSaved(s: SavedRequest): void {
  downloadTextFile({ content: toCurl(exportSavedRequest(s)), filename: buildDownloadFilename(s.name.replace(/[^\w.-]+/g, '-'), 'sh'), mimeType: 'text/plain' });
  banner.value = 'Exported cURL: auth headers and URL userinfo stripped. Request body is NOT sanitized — review it before sharing.';
}
function renameSavedInline(s: SavedRequest, name: string): void {
  const r = renameSaved(saved.value, s.id, name, Date.now());
  if (r.error) {
    saveError.value = r.error;
    return;
  }
  saveError.value = '';
  saved.value = r.list;
}
function fmtTime(at: number): string {
  return new Date(at).toLocaleString();
}

// ── cURL 导入 / 导出 ─────────────────────────────────────────────
function importCurl(): void {
  importError.value = '';
  curlWarnings.value = [];
  const r = parseCurl(curlText.value);
  if (!r.ok) {
    importError.value = r.error;
    return;
  }
  method.value = r.request.method;
  url.value = r.request.url;
  headers.value = r.request.headers;
  body.value = r.request.body;
  curlWarnings.value = r.warnings;
  banner.value = 'cURL imported into the request builder.';
}
const openapiText = ref('');
const openapiWarnings = ref<string[]>([]);
function importOpenApiSpec(): void {
  importError.value = '';
  openapiWarnings.value = [];
  const r = importOpenApi(openapiText.value);
  openapiWarnings.value = r.warnings;
  if (r.requests.length === 0) {
    importError.value = r.warnings[0] ?? 'No requests could be imported from this spec.';
    return;
  }
  let list = saved.value;
  for (const imp of r.requests) {
    const res = saveRequest(list, imp.name, imp.request, Date.now(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    if (!res.error) {
      list = res.list;
    }
  }
  saved.value = list;
  loadRequest(r.requests[0].request);
  banner.value = `Imported ${r.requests.length} request(s) from OpenAPI into the collection; first one loaded.`;
}
function exportPostman(): void {
  if (saved.value.length === 0) {
    banner.value = 'Collection is empty; save a request first.';
    return;
  }
  downloadTextFile({
    content: JSON.stringify(exportCollection(saved.value, 'DigDevBox Collection', true, { prerequest: collectionScripts.value.prerequest, test: collectionScripts.value.test }), null, 2),
    filename: buildDownloadFilename('digdevbox', 'postman_collection.json'),
    mimeType: 'application/json',
  });
  banner.value = 'Exported Postman v2.1 collection (auth headers stripped; re-add them in Postman). pm.* pre-request/test scripts round-trip as v2.1 events; structured assertions stay local.';
}
const postmanText = ref('');
const postmanWarnings = ref<string[]>([]);
function importPostman(): void {
  importError.value = '';
  postmanWarnings.value = [];
  const r = importCollection(postmanText.value);
  postmanWarnings.value = r.warnings;
  if (r.requests.length === 0) {
    importError.value = r.warnings[0] ?? 'No requests could be imported.';
    return;
  }
  let list = saved.value;
  for (const imp of r.requests) {
    const res = saveRequest(list, imp.name, imp.request, Date.now(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, undefined, SAVED_CAP, imp.scriptEvents);
    if (!res.error) {
      list = res.list;
    }
  }
  saved.value = list;
  loadRequest(r.requests[0].request, [], r.requests[0].scriptEvents);
  banner.value = `Imported ${r.requests.length} request(s) from Postman collection; first one loaded.`;
}
function exportCurl(): void {
  downloadTextFile({ content: toCurl(currentRequest.value), filename: buildDownloadFilename('request', 'sh'), mimeType: 'text/plain' });
  banner.value = 'Exported the FULL current request, including auth headers and body verbatim. Treat the file as a secret; nothing was stripped.';
}
async function shareCurl(): Promise<void> {
  const text = toCurl(sanitizeForShare(currentRequest.value));
  try {
    await navigator.clipboard.writeText(text);
    banner.value = 'cURL copied: authorization/cookie/api-key headers and URL passwords stripped. Request body is NOT sanitized — review before sharing.';
  }
  catch (e) {
    banner.value = `Could not copy: ${e instanceof Error ? e.message : String(e)}`;
  }
}

// ── 头 / 变量编辑 ────────────────────────────────────────────────
function upsertHeader(name: string, value: string): void {
  const i = headers.value.findIndex(h => h.name.trim().toLowerCase() === name.toLowerCase());
  if (i >= 0) {
    headers.value[i].value = value;
  }
  else {
    headers.value.push({ name, value });
  }
}
function setBearer(): void {
  if (bearer.value.trim()) {
    upsertHeader('Authorization', `Bearer ${bearer.value.trim()}`);
  }
}
function setBasic(): void {
  if (basicUser.value) {
    upsertHeader('Authorization', `Basic ${btoa(`${basicUser.value}:${basicPass.value}`)}`);
  }
}
function setVar(name: string, value: string): void {
  envStore.value = setEnvVar(envStore.value, name, value);
}
function addScopeVar(): void {
  setScopeVarUI(newVarName.value, newVarValue.value);
  newVarName.value = '';
  newVarValue.value = '';
}
function exportVars(): void {
  downloadTextFile({
    content: JSON.stringify(exportableVars(envStore.value), null, 2),
    filename: buildDownloadFilename('api-variables', 'json'),
    mimeType: 'application/json',
  });
  banner.value = 'Variables exported (resolved Environment > Collection > Global). Secret values were stripped to empty strings.';
}

// ── 发送（经 apiproxy 瞬时转发；不记录不存储）─────────────────────
async function send(): Promise<void> {
  sending.value = true;
  sendError.value = '';
  extractError.value = '';
  resp.value = null;
  banner.value = '';
  testReport.value = null;
  testMeta.value = null;
  testsNote.value = '';
  const { payload, missing } = buildProxyPayload(
    { ...currentRequest.value, headers: headers.value.filter(h => h.name.trim()) },
    env.value,
  );
  if (missing.length) {
    sendError.value = `Missing variables: ${missing.join(', ')}. Define them in the Variables panel.`;
    sending.value = false;
    return;
  }
  const snapshot = { ...currentRequest.value, headers: headers.value.filter(h => h.name.trim()).map(h => ({ ...h })) };
  try {
    const r = await fetch('/api/apiproxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      sendError.value = (j && j.error) || `Proxy returned HTTP ${r.status}.`;
      recordHistory(snapshot, r.status, null, sendError.value);
      if (assertions.value.some(a => a.enabled)) {
        testsNote.value = 'Assertions were not run because the request failed.';
      }
    }
    else {
      resp.value = j as ProxyResponse;
      // API-009：响应到达后立即顺序执行全部启用断言（真实执行链路，不是独立演示）。
      const report = runAssertions(assertions.value, resp.value);
      testReport.value = report;
      testMeta.value = { method: snapshot.method, url: snapshot.url };
      recordHistory(snapshot, resp.value.status, resp.value.elapsedMs, undefined, report.total ? { passed: report.passed, failed: report.failed } : undefined);
    }
  }
  catch (e) {
    sendError.value = `Proxy unavailable in this environment (Cloudflare Pages Functions required): ${e instanceof Error ? e.message : String(e)}`;
    recordHistory(snapshot, null, null, sendError.value);
    if (assertions.value.some(a => a.enabled)) {
      testsNote.value = 'Assertions were not run because the request failed.';
    }
  }
  finally {
    sending.value = false;
  }
}

// ── 响应 → WS-2 直传 / 提取 → 变量 ───────────────────────────────
function openInWorkspace(): void {
  if (!resp.value) {
    return;
  }
  const link = responseToWorkspaceLink(resp.value.body, location.origin);
  if (link) {
    window.open(link, '_blank');
  }
  else {
    stashHandoff(resp.value.body);
    window.open(`${location.origin}/json-workspace`, '_blank');
  }
  banner.value = 'Response handed to Work with Data (no copy-paste needed).';
}
function extractToVar(): void {
  extractError.value = '';
  if (!resp.value) {
    return;
  }
  try {
    const matches = jsonPath(JSON5.parse(resp.value.body), extractPath.value);
    if (!matches.length) {
      extractError.value = 'JSONPath matched nothing.';
      return;
    }
    const v = matches.length === 1 && typeof matches[0] === 'string' ? matches[0] : JSON.stringify(matches.length === 1 ? matches[0] : matches);
    setVar(extractName.value, v);
    banner.value = `Variable "${extractName.value}" set from the response — use {{${extractName.value}}} in the next request.`;
  }
  catch (e) {
    extractError.value = e instanceof JsonPathError ? `JSONPath error: ${e.message}` : (e instanceof Error ? e.message : String(e));
  }
}
function downloadBody(): void {
  if (!resp.value) {
    return;
  }
  let lang = 'txt';
  try {
    JSON5.parse(resp.value.body);
    lang = 'json';
  }
  catch {
    // 非 JSON 响应按纯文本下载
  }
  downloadTextFile({ content: resp.value.body, filename: buildDownloadFilename('response', lang), mimeType: mimeForLanguage(lang) });
}
function statusType(s: number): 'success' | 'warning' | 'error' | 'info' {
  if (s >= 200 && s < 300) {
    return 'success';
  }
  if (s >= 300 && s < 400) {
    return 'info';
  }
  if (s >= 400 && s < 500) {
    return 'warning';
  }
  return 'error';
}
</script>

<template>
  <div class="api-debugger">
    <n-alert v-if="banner" type="success" closable style="margin-bottom: 10px" data-test-id="banner" @close="banner = ''">
      {{ banner }}
    </n-alert>

    <!-- cURL 导入 -->
    <n-form-item label="Import cURL command" :show-feedback="false">
      <c-input-text v-model:value="curlText" data-test-id="curl-input" rows="3" multiline monospace spellcheck="false" placeholder="curl -X POST https://api.example.com/login -H 'Content-Type: application/json' -d '{&quot;u&quot;:&quot;a&quot;}'" />
    </n-form-item>
    <div class="row">
      <n-button size="small" type="primary" data-test-id="curl-import" @click="importCurl">
        Parse cURL
      </n-button>
      <n-button size="small" data-test-id="export-curl" @click="exportCurl">
        Export cURL
      </n-button>
      <n-button size="small" data-test-id="share-curl" @click="shareCurl">
        Share cURL (auth headers stripped)
      </n-button>
    </div>
    <n-alert v-if="importError" type="error" style="margin-top: 8px" data-test-id="curl-error">
      {{ importError }}
    </n-alert>
    <n-alert v-for="(w, i) in curlWarnings" :key="i" type="warning" style="margin-top: 6px">
      {{ w }}
    </n-alert>

    <!-- OpenAPI 导入（API-008） -->
    <n-form-item label="Import OpenAPI 3.x spec (JSON / YAML)" :show-feedback="false" style="margin-top: 10px">
      <c-input-text v-model:value="openapiText" data-test-id="openapi-input" rows="3" multiline monospace spellcheck="false" placeholder="{&quot;openapi&quot;:&quot;3.0.0&quot;,&quot;servers&quot;:[{&quot;url&quot;:&quot;https://api.example.com&quot;}],&quot;paths&quot;:{...}}" />
    </n-form-item>
    <div class="row">
      <n-button size="small" type="primary" data-test-id="openapi-import" @click="importOpenApiSpec">
        Import to collection
      </n-button>
    </div>
    <n-alert v-for="(w, i) in openapiWarnings" :key="`oa-${i}`" type="warning" style="margin-top: 6px">
      {{ w }}
    </n-alert>

    <!-- Postman 集合导入（API-010） -->
    <n-form-item label="Import Postman collection (v2.1 JSON)" :show-feedback="false" style="margin-top: 10px">
      <c-input-text v-model:value="postmanText" data-test-id="postman-input" rows="3" multiline monospace spellcheck="false" placeholder="{&quot;info&quot;:{&quot;schema&quot;:&quot;...v2.1.0...&quot;},&quot;item&quot;:[...]}" />
    </n-form-item>
    <div class="row">
      <n-button size="small" type="primary" data-test-id="postman-import" @click="importPostman">
        Import Postman collection
      </n-button>
    </div>
    <n-alert v-for="(w, i) in postmanWarnings" :key="`pm-${i}`" type="warning" style="margin-top: 6px">
      {{ w }}
    </n-alert>

    <!-- 请求构建器 -->
    <div class="section">
      <div class="row">
        <n-select v-model:value="method" :options="METHODS.map(m => ({ label: m, value: m }))" size="small" style="width: 110px" data-test-id="method-select" />
        <c-input-text v-model:value="url" data-test-id="url-input" monospace placeholder="https://api.example.com/v1/users" style="flex: 1; min-width: 220px" />
        <n-button type="primary" :loading="sending" data-test-id="send-btn" @click="send">
          Send
        </n-button>
      </div>

      <n-form-item label="Query params" :show-feedback="false" style="margin-top: 10px">
        <div class="kv-list" data-test-id="query-params">
          <div v-for="(p, i) in queryParams" :key="i" class="row">
            <c-input-text v-model:value="p.name" size="small" monospace placeholder="Name" style="width: 200px" />
            <c-input-text v-model:value="p.value" size="small" monospace placeholder="Value ({{var}} allowed)" style="flex: 1; min-width: 160px" />
            <n-button size="tiny" quaternary @click="queryParams.splice(i, 1)">
              Remove
            </n-button>
          </div>
          <div class="row">
            <n-button size="tiny" data-test-id="add-param" @click="queryParams.push({ name: '', value: '' })">
              + Add param
            </n-button>
            <n-button size="tiny" data-test-id="params-from-url" @click="syncParamsFromUrl">
              Load from URL
            </n-button>
            <n-button size="tiny" type="primary" data-test-id="params-to-url" @click="applyParamsToUrl">
              Apply to URL
            </n-button>
          </div>
        </div>
      </n-form-item>

      <n-form-item label="Headers" :show-feedback="false" style="margin-top: 10px">
        <div class="kv-list">
          <div v-for="(h, i) in headers" :key="i" class="row">
            <c-input-text v-model:value="h.name" size="small" monospace placeholder="Name" style="width: 200px" />
            <c-input-text v-model:value="h.value" size="small" monospace placeholder="Value ({{var}} allowed)" style="flex: 1; min-width: 160px" />
            <n-button size="tiny" quaternary @click="headers.splice(i, 1)">
              Remove
            </n-button>
          </div>
          <n-button size="tiny" data-test-id="add-header" @click="headers.push({ name: '', value: '' })">
            + Add header
          </n-button>
        </div>
      </n-form-item>

      <div class="row" style="margin-top: 8px">
        <c-input-text v-model:value="bearer" size="small" monospace placeholder="Bearer token" style="width: 220px" />
        <n-button size="tiny" @click="setBearer">
          Set Bearer
        </n-button>
        <c-input-text v-model:value="basicUser" size="small" placeholder="user" style="width: 100px" />
        <c-input-text v-model:value="basicPass" size="small" type="password" placeholder="pass" style="width: 100px" />
        <n-button size="tiny" @click="setBasic">
          Set Basic
        </n-button>
        <c-input-text v-model:value="apiKey" size="small" monospace placeholder="API key" style="width: 160px" />
        <n-button size="tiny" data-test-id="set-api-key" @click="setApiKey">
          Set API-Key
        </n-button>
      </div>

      <n-form-item label="Body" :show-feedback="false" style="margin-top: 10px">
        <c-input-text v-model:value="body" data-test-id="body-input" rows="5" multiline monospace spellcheck="false" placeholder="Request body ({{var}} allowed)" />
      </n-form-item>
    </div>

    <!-- API-009 测试断言（对标 Postman Tests；结构化断言，不执行任意脚本） -->
    <div class="section">
      <h3 class="section-title">
        Tests <span class="hint">assertions run automatically after each successful send; saved with the request in this browser</span>
      </h3>
      <div class="kv-list" data-test-id="assertion-list">
        <div v-for="(a, i) in assertions" :key="a.id" class="row" data-test-id="assertion-row">
          <n-checkbox v-model:checked="a.enabled" size="small" data-test-id="assertion-enabled" />
          <n-select v-model:value="a.type" :options="ASSERTION_TYPES" size="small" style="width: 150px" data-test-id="assertion-type" @update:value="onAssertionTypeChange(a)" />
          <c-input-text v-if="needsTarget(a)" v-model:value="a.target" size="small" monospace :placeholder="a.type === 'json' ? '$.data.id' : 'header name'" style="width: 180px" data-test-id="assertion-target" />
          <n-select v-model:value="a.operator" :options="opOptions(a.type)" size="small" style="width: 160px" data-test-id="assertion-operator" />
          <c-input-text v-if="needsExpected(a)" v-model:value="a.expected" size="small" monospace :placeholder="a.type === 'time' ? 'milliseconds' : 'expected value'" style="width: 170px" data-test-id="assertion-expected" />
          <n-button size="tiny" quaternary data-test-id="assertion-remove" @click="assertions.splice(i, 1)">
            Remove
          </n-button>
        </div>
      </div>
      <div class="row" style="margin-top: 8px">
        <n-button size="tiny" data-test-id="add-assertion" @click="addAssertion('status')">
          + Assertion
        </n-button>
        <n-button size="tiny" data-test-id="snippet-status" @click="addAssertion('status')">
          Status = 200
        </n-button>
        <n-button size="tiny" data-test-id="snippet-content-type" @click="addAssertion('header')">
          Content-Type is JSON
        </n-button>
        <n-button size="tiny" data-test-id="snippet-time" @click="addAssertion('time')">
          Time &lt; 1s
        </n-button>
        <n-button v-if="assertions.length" size="tiny" quaternary data-test-id="clear-assertions" @click="assertions = []">
          Clear all
        </n-button>
      </div>
      <p class="hint" style="margin-top: 6px">
        JSON assertions use JSONPath ($.key, [0], ..recursive). "contains" is a case-sensitive substring match, or element membership on arrays. Expected values accept JSON literals (42, true, null, "text"). Single sends use these structured assertions; pm.* scripts run in the Collection Runner below.
      </p>
    </div>

    <!-- API-011 脚本（pm.*）：保存在请求上，由 Collection Runner 在隔离 Worker 沙箱内执行 -->
    <div class="section" data-test-id="scripts-section">
      <h3 class="section-title">
        Scripts <span class="hint">pm.* pre-request / test — run by the Collection Runner in an isolated Worker (no DOM, 5 s timeout, network only via controlled pm.sendRequest outbox)</span>
      </h3>
      <div class="row" style="margin-bottom: 4px" data-test-id="collection-scripts-bar">
        <n-tag size="small" type="info">Collection</n-tag>
        <span class="hint">集合级脚本（独立一层：pre-request 先于各请求链执行，test 后于各请求链执行；导出为 Postman doc 级事件。导入集合的 doc 级脚本已按契约合并进各请求链——见各请求面板）</span>
      </div>
      <n-input v-model:value="collectionScripts.prerequest" type="textarea" :rows="3" monospace placeholder='pm.variables.set("fixtureRun", "api-studio-smoke");' data-test-id="collection-script-prerequest" />
      <n-input v-model:value="collectionScripts.test" type="textarea" :rows="3" monospace placeholder='pm.test("collection-level", () => {});' data-test-id="collection-script-test" style="margin-top: 6px" />
      <div class="row" style="margin: 8px 0 4px"><strong>Pre-request</strong> <span class="hint">before send; set variables or mutate this request</span></div>
      <n-input v-model:value="preScript" type="textarea" :rows="5" monospace placeholder='pm.environment.set("token", "abc");' data-test-id="script-prerequest" />
      <div class="row" style="margin: 8px 0 4px"><strong>Test</strong> <span class="hint">after response — also when the request failed (pm.response is null)</span></div>
      <n-input v-model:value="testScript" type="textarea" :rows="5" monospace placeholder='pm.test("status 200", () => pm.expect(pm.response.code).to.equal(200));' data-test-id="script-test" />
      <p class="hint" style="margin-top: 6px">
        Supported: pm.environment / collectionVariables / globals / variables / iterationData / request / response / info / test / expect subset / sendRequest. Unsupported pm.* APIs fail closed (throw) — never silently no-op. Saved with the request; exported to Postman v2.1 events.
      </p>
    </div>

    <!-- 变量（API-005 作用域分层 + 敏感值保护） -->
    <div class="section">
      <h3 class="section-title">
        Variables <span class="hint">use {{ varPlaceholder }} in URL, headers and body; resolved Environment &gt; Collection &gt; Global</span>
      </h3>
      <div class="row" style="margin-bottom: 8px" data-test-id="scope-bar">
        <n-button v-for="opt in scopeOptions" :key="opt.value" size="tiny" :type="activeScope === opt.value ? 'primary' : 'default'" :data-test-id="`scope-${opt.value}`" @click="activeScope = opt.value">
          {{ opt.label }}
        </n-button>
        <n-button size="tiny" data-test-id="export-vars" @click="exportVars">
          Export variables
        </n-button>
        <span class="hint">secrets are masked &amp; stripped from export</span>
      </div>
      <div v-if="activeScope === 'environment'" class="row" style="margin-bottom: 8px" data-test-id="env-bar">
        <n-select v-model:value="activeEnv" :options="envOptions" size="small" style="width: 160px" data-test-id="env-select" />
        <c-input-text v-model:value="envRenameDraft" size="small" style="width: 140px" data-test-id="env-rename" />
        <n-button size="tiny" data-test-id="env-rename-btn" @click="applyRenameEnv">
          Rename
        </n-button>
        <c-input-text v-model:value="newEnvName" size="small" placeholder="new env" style="width: 120px" data-test-id="env-new-name" />
        <n-button size="tiny" data-test-id="env-add" @click="createEnv">
          + Env
        </n-button>
        <n-button size="tiny" quaternary data-test-id="env-delete" @click="removeActiveEnv">
          Delete env
        </n-button>
      </div>
      <div class="kv-list" data-test-id="var-list">
        <div v-for="row in scopeRows" :key="row.name" class="row" data-test-id="var-row">
          <c-input-text :value="row.name" size="small" monospace style="width: 160px" data-test-id="var-name" @update:value="(v: string) => renameScopeVarUI(row.name, v, row.value)" />
          <template v-if="row.secret && !isRevealed(row.name)">
            <c-input-text value="••••••••" size="small" monospace readonly style="flex: 1; min-width: 160px" data-test-id="var-value-masked" />
            <n-button size="tiny" data-test-id="var-reveal" @click="toggleReveal(row.name)">
              Show
            </n-button>
          </template>
          <template v-else>
            <c-input-text :value="row.value" size="small" monospace style="flex: 1; min-width: 160px" data-test-id="var-value" @update:value="(v: string) => setScopeVarUI(row.name, v)" />
            <n-button v-if="row.secret" size="tiny" data-test-id="var-hide" @click="toggleReveal(row.name)">
              Hide
            </n-button>
          </template>
          <n-button size="tiny" :type="row.secret ? 'warning' : 'default'" data-test-id="var-secret-toggle" @click="toggleSecret(row.name)">
            {{ row.secret ? 'Secret ✓' : 'Make secret' }}
          </n-button>
          <n-button size="tiny" quaternary data-test-id="var-remove" @click="removeScopeVarUI(row.name)">
            Remove
          </n-button>
        </div>
        <div class="row">
          <c-input-text v-model:value="newVarName" size="small" monospace placeholder="name" style="width: 160px" data-test-id="new-var-name" />
          <c-input-text v-model:value="newVarValue" size="small" monospace placeholder="value" style="flex: 1; min-width: 160px" data-test-id="new-var-value" />
          <n-button size="tiny" data-test-id="add-var" @click="addScopeVar">
            + Add
          </n-button>
        </div>
      </div>
      <p class="hint" style="margin-top: 6px">
        {{ activeScope === 'environment' ? `Environment "${activeEnv}" overrides Collection and Global for the same name.` : activeScope === 'collection' ? 'Collection variables are shared across all environments; an environment variable of the same name overrides them.' : 'Global variables apply everywhere unless overridden by Collection or Environment.' }}
        Secret values stay in this browser, are masked here, and export as empty strings — they are still substituted into requests you send.
      </p>
    </div>

    <!-- API-006 集合（保存的请求） -->
    <div class="section">
      <h3 class="section-title">
        Collection <span class="hint">saved in this browser only, headers stored as entered; exports strip auth headers &amp; URL userinfo, not the body</span>
      </h3>
      <div class="row">
        <c-input-text v-model:value="saveName" size="small" placeholder="Name this request" style="width: 220px" data-test-id="save-name" />
        <n-button size="small" data-test-id="save-request" @click="saveCurrent">
          Save current request
        </n-button>
        <n-button size="small" data-test-id="export-postman" @click="exportPostman">
          Export Postman collection
        </n-button>
      </div>
      <n-alert v-if="saveError" type="error" style="margin-top: 6px" data-test-id="save-error">
        {{ saveError }}
      </n-alert>
      <div v-if="saved.length" class="kv-list" style="margin-top: 8px" data-test-id="saved-list">
        <div v-for="s in saved" :key="s.id" class="row" data-test-id="saved-item">
          <c-input-text :value="s.name" size="small" style="width: 180px" @update:value="(v: string) => renameSavedInline(s, v)" />
          <span class="hint" style="flex: 1; min-width: 160px">{{ s.request.method }} {{ s.request.url }}</span>
          <n-button size="tiny" data-test-id="saved-load" @click="loadRequest(s.request, s.assertions ?? [], s.scriptEvents)">
            Load
          </n-button>
          <n-button size="tiny" data-test-id="saved-export" @click="exportSaved(s)">
            Export cURL
          </n-button>
          <n-button size="tiny" quaternary data-test-id="saved-delete" @click="saved = removeSaved(saved, s.id)">
            Delete
          </n-button>
        </div>
      </div>
      <p v-else class="hint">
        Nothing saved yet. Build a request above, then save it here for reuse.
      </p>

      <!-- API-012/B1 数据文件 + B2 迭代（本地 FileReader 解析，不上传；值不进报告/日志） -->
      <div class="row" style="margin-top: 10px" data-test-id="datafile-bar">
        <input ref="dataFilePicker" type="file" accept=".csv,.json" class="visually-hidden-file" data-test-id="datafile-input" @change="onDataFilePicked" />
        <n-button size="tiny" data-test-id="datafile-pick" @click="dataFilePicker?.click()">
          Choose data file (.csv/.json)
        </n-button>
        <n-button v-if="dataFile" size="tiny" quaternary data-test-id="datafile-clear" @click="clearDataFile">
          Remove data file
        </n-button>
        <span v-if="dataFile" class="hint" data-test-id="datafile-summary">{{ dataFileName }} · {{ dataFile.rows.length }} rows × {{ dataFile.columns.length }} columns → iterationData layer</span>
        <span class="hint">Iterations</span>
        <c-input-text v-model:value="iterationsInput" size="small" monospace placeholder="default = rows" style="width: 110px" data-test-id="runner-iterations" :disabled="!dataFile" />
        <span class="hint" data-test-id="iteration-plan">{{ iterationPlan.note }}</span>
      </div>
      <n-alert v-if="dataFileError" type="error" style="margin-top: 6px" data-test-id="datafile-error">
        {{ dataFileError }}
      </n-alert>
      <n-alert v-if="iterationsError" type="error" style="margin-top: 6px" data-test-id="iterations-error">
        {{ iterationsError }}
      </n-alert>
      <div v-if="dataFilePreview" class="datafile-preview" style="margin-top: 6px" data-test-id="datafile-preview">
        <table>
          <thead>
            <tr><th v-for="c in dataFilePreview.columns" :key="c">{{ c }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in dataFilePreview.rows" :key="ri">
              <td v-for="(v, ci) in row" :key="ci">{{ v }}</td>
            </tr>
          </tbody>
        </table>
        <p class="hint" style="margin: 4px 0 0">
          Preview shows your local file content (values truncated at 40 chars). The file never leaves this browser; row values are excluded from iteration displays, logs and reports — only column names and row counts appear there.
        </p>
      </div>
      <!-- API-010 集合批量 Runner -->
      <div class="row runner-bar" style="margin-top: 10px">
        <n-button size="small" type="primary" :loading="runnerRunning" :disabled="!saved.length" data-test-id="run-collection" @click="runCollectionNow">
          Run collection ({{ saved.length }})
        </n-button>
        <n-button v-if="runnerRunning" size="small" data-test-id="cancel-run" @click="cancelRun">
          Cancel
        </n-button>
        <span v-if="liveIteration" class="hint" data-test-id="runner-live-iteration">Running iteration {{ liveIteration }}…</span>
        <n-checkbox v-model:checked="stopOnError" size="small" data-test-id="runner-stop-on-error">
          Stop on send error
        </n-checkbox>
        <n-checkbox v-model:checked="stopOnFailure" size="small" data-test-id="runner-stop-on-failure">
          Stop on failed assertion
        </n-checkbox>
        <span class="hint">Delay</span>
        <c-input-text v-model:value="runnerDelay" size="small" monospace placeholder="0" style="width: 80px" data-test-id="runner-delay" />
        <span class="hint">ms</span>
      </div>
      <p class="hint" style="margin-top: 4px">
        Runs every saved request in order through the edge relay, applying each request's saved assertions. With a data file, each row drives one iteration (an explicit round count overrides; more rounds than rows cycles them). pm.* scripts run in the isolated Worker sandbox; network only via the apiproxy outbox.
      </p>
      <n-alert v-if="runnerError" type="error" style="margin-top: 6px" data-test-id="runner-error">
        {{ runnerError }}
      </n-alert>
      <div v-if="runnerResults.length || runnerSummary" class="test-results" style="margin-top: 8px" data-test-id="runner-results">
        <div v-if="runnerSummary" class="row" style="margin-bottom: 6px">
          <n-tag size="small" :type="runnerSummary.allPassed ? 'success' : 'error'" data-test-id="runner-summary">
            {{ runnerSummary.sent }}/{{ runnerSummary.total }} sent · {{ runnerSummary.failed }} failed · Tests {{ runnerSummary.assertionsPassed }}/{{ runnerSummary.assertionsTotal }}{{ runnerSummary.scriptTestsTotal ? ` · pm.test ${runnerSummary.scriptTestsPassed}/${runnerSummary.scriptTestsTotal}` : '' }} · Iterations {{ runnerSummary.iterationCount }}{{ runnerSummary.dataFile ? ` · Data ${runnerSummary.dataFile.type} ${runnerSummary.dataFile.rows}r/${runnerSummary.dataFile.columnsCount}c` : '' }}
          </n-tag>
          <span class="hint" data-test-id="runner-meta">{{ runnerSummary.totalDurationMs }} ms{{ runnerSummary.avgResponseMs !== null ? ` · avg ${runnerSummary.avgResponseMs} ms` : '' }}{{ runnerSummary.cancelled ? ' · cancelled' : runnerSummary.stoppedEarly ? ' · stopped early' : '' }}{{ runnerSummary.dataFile ? ` · data file: ${runnerSummary.dataFile.type} ${runnerSummary.dataFile.rows} rows × ${runnerSummary.dataFile.columnsCount} columns` : '' }}</span>
          <n-button size="tiny" data-test-id="runner-copy-report" @click="copyRunnerReport">
            Copy report
          </n-button>
          <n-button size="tiny" data-test-id="runner-download-report" @click="downloadRunnerReport">
            Download report
          </n-button>
          <n-button size="tiny" data-test-id="runner-download-json" @click="downloadRunnerJsonReport">
            JSON report
          </n-button>
          <n-button size="tiny" data-test-id="runner-download-junit" @click="downloadRunnerJunitReport">
            JUnit XML
          </n-button>
        </div>
        <template v-for="g in runnerGroups" :key="g.iteration">
          <div class="runner-iteration-head" data-test-id="runner-iteration-head">
            Iteration {{ runnerSummary ? g.iteration : (liveIteration ?? g.iteration) }}<span class="hint">{{ g.dataRowIndex !== null ? ` · data row ${g.dataRowIndex + 1}` : '' }}{{ g.dataRowColumns ? ` · columns: ${g.dataRowColumns.join(', ')}` : (dataFile ? ` · columns: ${dataFile.columns.join(', ')}` : '') }}</span>
          </div>
          <div v-for="(r, ri) in g.results" :key="r.id" class="runner-item" data-test-id="runner-result-row">
          <div class="row">
            <n-tag size="small" :type="r.passed ? 'success' : 'error'">
              {{ r.passed ? 'PASS' : 'FAIL' }}
            </n-tag>
            <span class="hint" style="flex: 1; min-width: 180px"><strong>{{ ri + 1 }}. {{ r.name }}</strong> · {{ r.method }} {{ r.url }}</span>
            <n-tag v-if="r.sent" size="small" :type="statusType(r.status ?? 0)">
              {{ r.status }}
            </n-tag>
            <span v-if="r.sent" class="hint">{{ r.elapsedMs }} ms</span>
            <n-tag v-if="r.report && r.report.total" size="small" :type="r.report.allPassed ? 'success' : 'error'">
              Tests {{ r.report.passed }}/{{ r.report.total }}
            </n-tag>
            <n-tag v-if="r.scriptTests && r.scriptTests.length" size="small" :type="r.scriptTests.every(t => t.passed) ? 'success' : 'error'">
              pm.test {{ r.scriptTests.filter(t => t.passed).length }}/{{ r.scriptTests.length }}
            </n-tag>
          </div>
          <p v-if="r.error" class="hint" style="margin: 2px 0 0; color: var(--n-error-color, #d03050)">
            {{ r.error }}
          </p>
          <p v-if="r.scriptError" class="hint" style="margin: 2px 0 0; color: var(--n-error-color, #d03050)" data-test-id="runner-script-error">
            Script: {{ r.scriptError }}
          </p>
          <details v-if="r.report && r.report.total" style="margin-top: 2px">
            <summary class="hint">
              Assertions
            </summary>
            <div v-for="a in r.report.results" :key="a.id" class="row test-result">
              <n-tag size="small" :type="a.passed ? 'success' : 'error'">
                {{ a.passed ? 'PASS' : 'FAIL' }}
              </n-tag>
              <span class="hint" style="flex: 1; min-width: 180px">{{ a.label }} — {{ a.message }}</span>
            </div>
          </details>
        </div>
        </template>
      </div>
    </div>

    <!-- API-006 历史 -->
    <div class="section">
      <div class="row" style="justify-content: space-between">
        <h3 class="section-title" style="margin: 0">
          History <span class="hint">last {{ history.length }} sends, this browser only (headers stored as sent)</span>
        </h3>
        <n-button v-if="history.length" size="tiny" quaternary data-test-id="clear-history" @click="history = []">
          Clear
        </n-button>
      </div>
      <div v-if="history.length" class="kv-list" style="margin-top: 8px" data-test-id="history-list">
        <div v-for="h in history" :key="h.id" class="row" data-test-id="history-item">
          <n-tag size="small" :type="h.status === null ? 'error' : statusType(h.status)">
            {{ h.status ?? 'ERR' }}
          </n-tag>
          <n-tag v-if="h.tests" size="small" :type="h.tests.failed ? 'error' : 'success'" data-test-id="history-tests">
            Tests {{ h.tests.passed }}/{{ h.tests.passed + h.tests.failed }}
          </n-tag>
          <span class="hint" style="flex: 1; min-width: 180px">{{ h.request.method }} {{ h.request.url }} · {{ fmtTime(h.at) }}{{ h.elapsedMs !== null ? ` · ${h.elapsedMs} ms` : '' }}</span>
          <n-button size="tiny" data-test-id="history-load" @click="loadRequest(h.request)">
            Load
          </n-button>
          <n-button size="tiny" quaternary @click="history = removeHistory(history, h.id)">
            Remove
          </n-button>
        </div>
      </div>
      <p v-else class="hint">
        Sent requests will appear here for one-click replay.
      </p>
    </div>

    <!-- 响应 -->
    <div class="section">
      <h3 class="section-title">
        Response
      </h3>
      <n-alert v-if="sendError" type="error" data-test-id="send-error">
        {{ sendError }}
      </n-alert>
      <n-alert v-if="testsNote" type="warning" style="margin-top: 6px" data-test-id="tests-note">
        {{ testsNote }}
      </n-alert>
      <template v-if="resp">
        <n-alert v-if="resp.followed === false" type="warning" style="margin-bottom: 8px" data-test-id="redirect-notice">
          {{ resp.note }}
          <div class="row" style="margin-top: 6px">
            <code>{{ resp.redirect }}</code>
            <n-button size="tiny" data-test-id="use-redirect-target" @click="url = resp.redirect ?? ''">
              Use redirect target (explicit re-send)
            </n-button>
          </div>
        </n-alert>
        <div class="row" style="margin-bottom: 8px">
          <n-tag :type="statusType(resp.status)" data-test-id="resp-status">
            {{ resp.status }} {{ resp.statusText }}
          </n-tag>
          <span class="hint" data-test-id="resp-meta">{{ resp.elapsedMs }} ms · {{ formatBytes(respBytes) }} · {{ resp.url }}</span>
        </div>
        <!-- API-009 断言结果：汇总 + 逐条定位 + 可读报告 -->
        <div v-if="testReport && testReport.total" class="test-results" data-test-id="test-results">
          <div class="row" style="margin-bottom: 6px">
            <n-tag size="small" :type="testReport.allPassed ? 'success' : 'error'" data-test-id="test-summary">
              Tests: {{ testReport.passed }}/{{ testReport.total }} passed
            </n-tag>
            <n-button size="tiny" data-test-id="copy-report" @click="copyReport">
              Copy report
            </n-button>
            <n-button size="tiny" data-test-id="download-report" @click="downloadReport">
              Download report
            </n-button>
          </div>
          <div v-for="r in testReport.results" :key="r.id" class="row test-result" data-test-id="test-result-row">
            <n-tag size="small" :type="r.passed ? 'success' : 'error'">
              {{ r.passed ? 'PASS' : 'FAIL' }}
            </n-tag>
            <span class="hint" style="flex: 1; min-width: 200px"><strong>{{ r.label }}</strong> — {{ r.message }}</span>
          </div>
        </div>
        <details class="resp-headers">
          <summary>Response headers ({{ Object.keys(resp.headers).length }})</summary>
          <pre>{{ JSON.stringify(resp.headers, null, 2) }}</pre>
        </details>
        <div class="row" style="margin: 8px 0">
          <c-input-text v-model:value="bodyQuery" size="small" placeholder="Search body (case-insensitive)" style="width: 260px" data-test-id="body-search" />
          <span v-if="bodyView && bodyQuery.trim()" class="hint" data-test-id="body-search-count">{{ bodyView.matchedLines }} / {{ bodyView.totalLines }} lines · {{ bodyView.occurrences }} matches</span>
        </div>
        <TextareaCopyable :value="bodyShown" language="json" data-test-id="resp-body" />
        <div class="row" style="margin-top: 8px">
          <n-button size="small" type="primary" data-test-id="open-ws2" @click="openInWorkspace">
            Open in Work with Data →
          </n-button>
          <n-button size="small" data-test-id="download-body" @click="downloadBody">
            Download body
          </n-button>
        </div>
        <div class="row" style="margin-top: 8px">
          <c-input-text v-model:value="extractPath" size="small" monospace placeholder="$.token" style="width: 200px" data-test-id="extract-path" />
          <c-input-text v-model:value="extractName" size="small" monospace placeholder="variable name" style="width: 140px" data-test-id="extract-name" />
          <n-button size="small" data-test-id="extract-btn" @click="extractToVar">
            Extract → variable
          </n-button>
        </div>
        <n-alert v-if="extractError" type="error" style="margin-top: 6px" data-test-id="extract-error">
          {{ extractError }}
        </n-alert>
      </template>
      <p v-else-if="!sendError" class="hint">
        Send a request to see status, timing, headers and body here.
      </p>
    </div>

    <p class="hint footer-hint">
      Requests are relayed transiently via the Cloudflare edge (no logging, no storage). Credentials stay in your browser and are stripped from shared cURL by default{{ hasAuth ? ' — this request currently carries auth headers' : '' }}. No analytics on this page.
    </p>
  </div>
</template>

<style lang="less" scoped>
.api-debugger { width: 100%; }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.section { margin-top: 16px; padding: 12px; border: 1px solid rgba(127, 127, 127, 0.25); border-radius: 8px; }
.section-title { font-size: 14px; font-weight: 600; margin: 0 0 8px; }
.kv-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.hint { font-size: 12px; opacity: 0.7; }
.resp-headers { margin: 8px 0; font-size: 12px; summary { cursor: pointer; opacity: 0.75; } pre { max-height: 200px; overflow: auto; padding: 8px; background: rgba(127, 127, 127, 0.08); border-radius: 4px; } }
.test-results { margin: 8px 0; padding: 8px; border: 1px solid rgba(127, 127, 127, 0.2); border-radius: 6px; }
.test-result { margin-top: 4px; }
.runner-bar { align-items: center; }
.runner-item { padding: 6px 0; border-top: 1px solid rgba(127, 127, 127, 0.15); &:first-of-type { border-top: none; } }
.runner-iteration-head { padding: 8px 0 2px; font-size: 12px; font-weight: 600; }
.visually-hidden-file { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }
.datafile-preview { max-height: 180px; overflow: auto; border: 1px solid rgba(127, 127, 127, 0.2); border-radius: 6px; }
.datafile-preview table { border-collapse: collapse; width: 100%; font-size: 12px; }
.datafile-preview th, .datafile-preview td { border: 1px solid rgba(127, 127, 127, 0.2); padding: 3px 8px; text-align: left; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.datafile-preview th { background: rgba(127, 127, 127, 0.08); }
.footer-hint { margin-top: 16px; }
</style>
