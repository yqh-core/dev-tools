<script setup lang="ts">
import JSON5 from 'json5';
import { useStorage } from '@vueuse/core';
import { JsonPathError, jsonPath } from '../json-workspace/jsonpath';
import { parseCurl, toCurl } from './curl';
import { AUTH_HEADER_NAMES, type KV, buildProxyPayload, responseToWorkspaceLink, sanitizeForShare, stashHandoff } from './engine';
import { type HistoryEntry, type SavedRequest, exportSavedRequest, parseHistory, parseSaved, pushHistory, removeHistory, removeSaved, renameSaved, saveRequest } from './store';
import { formatBytes, searchBody, utf8Bytes } from './response';
import { authHeaderPreset, buildUrlWithQuery, parseQueryParams } from './query';
import { importOpenApi } from './openapi';
import { type EnvStore, activeVars, addEnv, deleteEnv, migrateEnv, removeEnvVar, renameEnv, setEnvVar } from './environments';
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
const envRows = computed(() => Object.entries(env.value).map(([name, value]) => ({ name, value })));
const varPlaceholder = '{{name}}';
const currentRequest = computed(() => ({ method: method.value, url: url.value, headers: headers.value, body: body.value }));
const hasAuth = computed(() => headers.value.some(h => AUTH_HEADER_NAMES.includes(h.name.trim().toLowerCase())));

// ── API-006 历史与集合（只存本机；导出/分享默认剔除凭据）────────────
const history = useStorage<HistoryEntry[]>('api-debugger:history', [], undefined, { serializer: { read: (v: string) => parseHistory(v ? JSON.parse(v) : null), write: (v: HistoryEntry[]) => JSON.stringify(v) } });
const saved = useStorage<SavedRequest[]>('api-debugger:saved', [], undefined, { serializer: { read: (v: string) => parseSaved(v ? JSON.parse(v) : null), write: (v: SavedRequest[]) => JSON.stringify(v) } });
const saveName = ref('');
const saveError = ref('');
const bodyQuery = ref('');

const respBytes = computed(() => resp.value ? utf8Bytes(resp.value.body) : 0);
const bodyView = computed(() => resp.value ? searchBody(resp.value.body, bodyQuery.value) : null);
const bodyShown = computed(() => bodyView.value ? bodyView.value.lines.join('\n') : '');

function loadRequest(r: { method: string; url: string; headers: KV[]; body: string }): void {
  method.value = r.method;
  url.value = r.url;
  headers.value = r.headers.map(h => ({ ...h }));
  body.value = r.body;
  banner.value = 'Request loaded into the builder.';
}
function recordHistory(request: { method: string; url: string; headers: KV[]; body: string }, status: number | null, elapsedMs: number | null, error?: string): void {
  history.value = pushHistory(history.value, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    request,
    status,
    elapsedMs,
    error,
  });
}
function saveCurrent(): void {
  saveError.value = '';
  const r = saveRequest(saved.value, saveName.value, currentRequest.value, Date.now(), `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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
function removeVar(name: string): void {
  envStore.value = removeEnvVar(envStore.value, name);
}
function renameVar(oldName: string, newName: string, value: string): void {
  removeVar(oldName);
  setVar(newName, value);
}
function addVar(): void {
  setVar(newVarName.value, newVarValue.value);
  newVarName.value = '';
  newVarValue.value = '';
}

// ── 发送（经 apiproxy 瞬时转发；不记录不存储）─────────────────────
async function send(): Promise<void> {
  sending.value = true;
  sendError.value = '';
  extractError.value = '';
  resp.value = null;
  banner.value = '';
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
    }
    else {
      resp.value = j as ProxyResponse;
      recordHistory(snapshot, resp.value.status, resp.value.elapsedMs);
    }
  }
  catch (e) {
    sendError.value = `Proxy unavailable in this environment (Cloudflare Pages Functions required): ${e instanceof Error ? e.message : String(e)}`;
    recordHistory(snapshot, null, null, sendError.value);
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

    <!-- 变量 -->
    <div class="section">
      <h3 class="section-title">
        Variables <span class="hint">use {{ varPlaceholder }} in URL, headers and body; extract from responses below</span>
      </h3>
      <div class="row" style="margin-bottom: 8px" data-test-id="env-bar">
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
      <div class="kv-list">
        <div v-for="row in envRows" :key="row.name" class="row">
          <c-input-text :value="row.name" size="small" monospace style="width: 160px" @update:value="(v: string) => renameVar(row.name, v, row.value)" />
          <c-input-text :value="row.value" size="small" monospace style="flex: 1; min-width: 160px" @update:value="(v: string) => setVar(row.name, v)" />
          <n-button size="tiny" quaternary @click="removeVar(row.name)">
            Remove
          </n-button>
        </div>
        <div class="row">
          <c-input-text v-model:value="newVarName" size="small" monospace placeholder="name" style="width: 160px" />
          <c-input-text v-model:value="newVarValue" size="small" monospace placeholder="value" style="flex: 1; min-width: 160px" />
          <n-button size="tiny" data-test-id="add-var" @click="addVar">
            + Add
          </n-button>
        </div>
      </div>
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
      </div>
      <n-alert v-if="saveError" type="error" style="margin-top: 6px" data-test-id="save-error">
        {{ saveError }}
      </n-alert>
      <div v-if="saved.length" class="kv-list" style="margin-top: 8px" data-test-id="saved-list">
        <div v-for="s in saved" :key="s.id" class="row" data-test-id="saved-item">
          <c-input-text :value="s.name" size="small" style="width: 180px" @update:value="(v: string) => renameSavedInline(s, v)" />
          <span class="hint" style="flex: 1; min-width: 160px">{{ s.request.method }} {{ s.request.url }}</span>
          <n-button size="tiny" data-test-id="saved-load" @click="loadRequest(s.request)">
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
.footer-hint { margin-top: 16px; }
</style>
