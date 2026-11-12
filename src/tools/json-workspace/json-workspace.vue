<script setup lang="ts">
import JSON5 from 'json5';
import { useStorage } from '@vueuse/core';
import { HANDOFF_KEY } from '../api-debugger/engine';
import { type NodeParams, type NodeResult, OP_IDS, OP_LABELS, type OpId, PARSE_SOURCES, type PipelineNode, TRANSFORM_TARGETS, TYPE_LANGS, defaultPipeline, makeNode, outputExtension, outputLanguage, runOp } from './pipeline';
import { LINK_LIMIT, decodeLink, encodeLink, validateState } from './workspace-link';
import { detectInput } from './smart-detect';
import JsonTree from './JsonTree.vue';
import { buildDownloadFilename, downloadTextFile, mimeForLanguage } from '@/composable/downloadText';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

defineOptions({ name: 'JsonWorkspace' });

// ── 管线状态（本地持久化，无云同步）──────────────────────────────
const nodes = useStorage<PipelineNode[]>('json-workspace:pipeline-v1', defaultPipeline());
const banner = ref<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const stateFileInput = ref<HTMLInputElement | null>(null);
const dragOver = ref(false);

// 活链：node 0 与「钉住」的节点用 override，其余自动取上一步输出。
// 单趟 computed 同时算输入与结果，避免循环依赖；runOp 永不抛错（错误隔离）。
const chain = computed(() => {
  const inputs: string[] = [];
  const results: NodeResult[] = [];
  nodes.value.forEach((node, i) => {
    let input = '';
    if (node.inputOverride !== undefined) {
      input = node.inputOverride;
    }
    else if (i > 0) {
      const prev = results[i - 1];
      input = prev.ok ? prev.output : '';
    }
    inputs.push(input);
    results.push(runOp(node.op, input, node.params));
  });
  return { inputs, results };
});
const effectiveInputs = computed(() => chain.value.inputs);
const results = computed(() => chain.value.results);

const rootInput = computed({
  get: () => nodes.value[0]?.inputOverride ?? '',
  set: (v: string) => {
    if (nodes.value[0]) {
      nodes.value[0].inputOverride = v;
    }
  },
});

const detection = computed(() => detectInput(rootInput.value));

// ── 选项表 ──────────────────────────────────────────────────────
const OP_OPTIONS = OP_IDS.map(op => ({ label: OP_LABELS[op], value: op }));
const OP_DROPDOWN = OP_IDS.map(op => ({ label: OP_LABELS[op], key: op }));
const TARGET_OPTIONS = TRANSFORM_TARGETS.map(t => ({ label: t.toUpperCase(), value: t }));
const SOURCE_OPTIONS = PARSE_SOURCES.map(s => ({ label: s === 'env' ? '.env' : s.toUpperCase(), value: s }));
const LANG_LABELS: Record<string, string> = { ts: 'TypeScript', cs: 'C#', java: 'Java', go: 'Go' };
const LANG_OPTIONS = TYPE_LANGS.map(l => ({ label: LANG_LABELS[l], value: l }));

// ── 模板辅助（避免模板里做 TS 联合 narrowing）────────────────────
function isOk(i: number): boolean {
  return results.value[i]?.ok ?? false;
}
function errorOf(i: number): string {
  const r = results.value[i];
  return r && !r.ok ? r.error : '';
}
function outputOf(i: number): string {
  const r = results.value[i];
  return r && r.ok ? r.output : '';
}
function firstIndexOf(op: OpId): number {
  return nodes.value.findIndex(n => n.op === op);
}
function outputTestId(op: OpId, i: number): string {
  const legacy: Partial<Record<OpId, string>> = { format: 'format-output', query: 'query-output', transform: 'transform-output', schema: 'schema-output' };
  return firstIndexOf(op) === i && legacy[op] ? legacy[op] as string : `step-${i}-output`;
}
function treeValue(i: number): unknown {
  try {
    return JSON5.parse(effectiveInputs.value[i]);
  }
  catch {
    return null;
  }
}
function queryCount(i: number): number {
  try {
    const arr = JSON.parse(outputOf(i));
    return Array.isArray(arr) ? arr.length : 0;
  }
  catch {
    return 0;
  }
}

// ── 管线操作 ────────────────────────────────────────────────────
function addStep(after: number, op: OpId): void {
  nodes.value.splice(after + 1, 0, makeNode(op));
}
function removeStep(i: number): void {
  if (nodes.value.length > 1) {
    nodes.value.splice(i, 1);
  }
}
function changeOp(i: number, op: OpId): void {
  nodes.value[i].op = op;
}
function patchParams(i: number, patch: NodeParams): void {
  nodes.value[i].params = { ...nodes.value[i].params, ...patch };
}
function detach(i: number): void {
  nodes.value[i].inputOverride = effectiveInputs.value[i];
}
function reattach(i: number): void {
  delete nodes.value[i].inputOverride;
}
function resetAll(): void {
  nodes.value = defaultPipeline();
  banner.value = null;
}
function startDetectedChain(): void {
  const d = detection.value;
  const text = rootInput.value;
  if (d.kind === 'json') {
    nodes.value = [makeNode('format', text, { indent: 2, sort: false })];
  }
  else if (d.source) {
    nodes.value = [makeNode('parse', text, { source: d.source }), makeNode('format')];
  }
}

// ── 文件闭环：导入 ──────────────────────────────────────────────
const FILE_LIMIT = 5 * 1024 * 1024;

function applyImport(text: string): void {
  const d = detectInput(text);
  if (d.kind === 'json') {
    nodes.value = [makeNode('format', text, { indent: 2, sort: false })];
    banner.value = { type: 'success', text: 'JSON imported — chain reset to a Format step.' };
  }
  else if (d.action === 'chain' && d.source) {
    nodes.value = [makeNode('parse', text, { source: d.source }), makeNode('format')];
    banner.value = { type: 'success', text: `${d.label} imported — Parse → Format chain created.` };
  }
  else if (d.kind === 'unknown') {
    rootInput.value = text;
    banner.value = { type: 'info', text: 'Unrecognized format — loaded as raw input. Fix it or pick a step manually.' };
  }
  else {
    banner.value = { type: 'info', text: d.note };
  }
}
async function importFile(file: File): Promise<void> {
  if (file.size > FILE_LIMIT) {
    banner.value = { type: 'error', text: `File too large (${file.size} bytes). Limit is ${FILE_LIMIT} bytes.` };
    return;
  }
  applyImport(await file.text());
}
function onFilePick(e: Event): void {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (f) {
    importFile(f).catch((err: unknown) => {
      banner.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
    });
  }
  input.value = '';
}
function onDrop(e: DragEvent): void {
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0];
  if (f) {
    importFile(f).catch((err: unknown) => {
      banner.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
    });
  }
}

// ── 文件闭环：导出 / 状态文件 ───────────────────────────────────
function downloadStep(i: number): void {
  const r = results.value[i];
  if (!r.ok) {
    banner.value = { type: 'error', text: 'Cannot download a failed step — fix its error first.' };
    return;
  }
  const ext = outputExtension(nodes.value[i]);
  downloadTextFile({
    content: r.output,
    filename: buildDownloadFilename(`workspace-step-${i + 1}`, ext),
    mimeType: mimeForLanguage(ext),
  });
}
function exportState(): void {
  const state = {
    v: 1,
    nodes: nodes.value.map(n => ({ op: n.op, ...(n.inputOverride !== undefined ? { input: n.inputOverride } : {}), params: n.params })),
  };
  downloadTextFile({ content: JSON.stringify(state, null, 2), filename: 'workspace-state.json', mimeType: 'application/json' });
}
async function onStateFilePick(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) {
    return;
  }
  try {
    const state = validateState(JSON.parse(await f.text()));
    nodes.value = state.nodes.map(n => makeNode(n.op, n.input, n.params));
    banner.value = { type: 'success', text: 'State file imported.' };
  }
  catch (err) {
    banner.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
  }
}

// ── deep-link 分享与恢复 ────────────────────────────────────────
async function shareLink(): Promise<void> {
  try {
    const url = encodeLink(nodes.value, `${location.origin}/json-workspace`);
    await navigator.clipboard.writeText(url);
    banner.value = { type: 'success', text: `Link copied (${url.length} / ${LINK_LIMIT} bytes). Anyone with the link can see the data in it — do not share secrets.` };
  }
  catch (err) {
    banner.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
  }
}
onMounted(() => {
  if (location.hash.startsWith('#w=')) {
    try {
      const state = decodeLink(location.hash);
      nodes.value = state.nodes.map(n => makeNode(n.op, n.input, n.params));
      banner.value = { type: 'success', text: 'Workspace restored from link.' };
    }
    catch (err) {
      banner.value = { type: 'error', text: err instanceof Error ? err.message : String(err) };
    }
  }
  else {
    // WS-1 大响应 handoff（超 deep-link 8KB 上限时走 localStorage，消费一次即删）
    const stash = localStorage.getItem(HANDOFF_KEY);
    if (stash) {
      localStorage.removeItem(HANDOFF_KEY);
      try {
        const state = validateState(JSON.parse(stash));
        nodes.value = state.nodes.map(n => makeNode(n.op, n.input, n.params));
        banner.value = { type: 'success', text: 'Response received from API Debug.' };
      }
      catch {
        // 非法 stash 忽略，不污染工作台
      }
    }
  }
});
</script>

<template>
  <div
    class="json-workspace"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <div class="toolbar">
      <n-button size="small" data-test-id="import-file" @click="fileInput?.click()">
        Import file
      </n-button>
      <n-button size="small" @click="stateFileInput?.click()">
        Import state
      </n-button>
      <n-button size="small" data-test-id="export-state" @click="exportState">
        Export state
      </n-button>
      <n-button size="small" type="primary" data-test-id="share-link" @click="shareLink">
        Share link
      </n-button>
      <n-button size="small" quaternary data-test-id="reset" @click="resetAll">
        Reset
      </n-button>
      <input ref="fileInput" type="file" accept=".json,.json5,.yaml,.yml,.csv,.xml,.toml,.txt,.env" style="display: none" @change="onFilePick">
      <input ref="stateFileInput" type="file" accept=".json" style="display: none" @change="onStateFilePick">
    </div>

    <n-alert v-if="banner" :type="banner.type" closable style="margin: 10px 0" data-test-id="banner" @close="banner = null">
      {{ banner.text }}
    </n-alert>

    <n-alert v-if="detection.kind !== 'json' && rootInput.trim() !== ''" type="info" style="margin-bottom: 10px" data-test-id="detect-banner">
      <div class="detect-row">
        <span><strong>{{ detection.label }}</strong> — {{ detection.note }}</span>
        <n-button v-if="detection.action === 'chain'" size="tiny" type="primary" data-test-id="detect-start" @click="startDetectedChain">
          Start {{ detection.label }} → JSON chain
        </n-button>
        <router-link v-else-if="detection.action === 'route' && detection.route" :to="detection.route" class="detect-link">
          Open {{ detection.label }} tool
        </router-link>
      </div>
    </n-alert>

    <div class="input-zone" :class="{ dragging: dragOver }">
      <n-form-item label="Input (paste, or drop a file anywhere)" :show-feedback="false">
        <c-input-text
          v-model:value="rootInput"
          data-test-id="json-input"
          placeholder="Paste JSON, YAML, CSV, XML, TOML or .env here..."
          rows="10"
          multiline
          monospace
          spellcheck="false"
        />
      </n-form-item>
    </div>

    <div v-for="(node, i) in nodes" :key="node.uid" class="step-card" :data-test-id="`step-${i}`">
      <div class="step-head">
        <span class="step-num">Step {{ i + 1 }}</span>
        <n-select :value="node.op" :options="OP_OPTIONS" size="small" style="width: 200px" @update:value="(v: OpId) => changeOp(i, v)" />
        <n-tag v-if="i > 0 && node.inputOverride !== undefined" size="small" type="warning">
          pinned input
        </n-tag>
        <span class="spacer" />
        <n-button size="tiny" quaternary :disabled="nodes.length === 1" @click="removeStep(i)">
          Remove
        </n-button>
      </div>

      <div class="params">
        <template v-if="node.op === 'format'">
          <n-form-item label="Sort keys" label-placement="left" :show-feedback="false">
            <n-switch :value="node.params.sort ?? false" :data-test-id="firstIndexOf('format') === i ? 'sort-keys' : undefined" @update:value="(v: boolean) => patchParams(i, { sort: v })" />
          </n-form-item>
          <n-form-item label="Indent" label-placement="left" :show-feedback="false">
            <n-input-number :value="node.params.indent ?? 2" :min="0" :max="8" size="small" style="width: 90px" @update:value="(v: number | null) => patchParams(i, { indent: v ?? 2 })" />
          </n-form-item>
        </template>
        <template v-else-if="node.op === 'query'">
          <n-form-item label="JSONPath" label-placement="left" :show-feedback="false" style="flex: 1; min-width: 220px">
            <c-input-text :value="node.params.query ?? '$'" :data-test-id="firstIndexOf('query') === i ? 'query-input' : undefined" monospace placeholder="$.store.book[*].title" @update:value="(v: string) => patchParams(i, { query: v })" />
          </n-form-item>
        </template>
        <template v-else-if="node.op === 'transform'">
          <n-form-item label="Target" label-placement="left" :show-feedback="false">
            <n-select :value="node.params.target ?? 'yaml'" :options="TARGET_OPTIONS" :data-test-id="firstIndexOf('transform') === i ? 'transform-target' : undefined" size="small" style="width: 140px" @update:value="(v: 'yaml' | 'csv' | 'xml' | 'toml') => patchParams(i, { target: v })" />
          </n-form-item>
        </template>
        <template v-else-if="node.op === 'types'">
          <n-form-item label="Language" label-placement="left" :show-feedback="false">
            <n-select :value="node.params.lang ?? 'ts'" :options="LANG_OPTIONS" size="small" style="width: 150px" @update:value="(v: 'ts' | 'cs' | 'java' | 'go') => patchParams(i, { lang: v })" />
          </n-form-item>
          <n-form-item label="Root name" label-placement="left" :show-feedback="false">
            <c-input-text :value="node.params.rootName ?? 'Root'" size="small" style="width: 140px" @update:value="(v: string) => patchParams(i, { rootName: v })" />
          </n-form-item>
        </template>
        <template v-else-if="node.op === 'parse'">
          <n-form-item label="Source" label-placement="left" :show-feedback="false">
            <n-select :value="node.params.source ?? 'yaml'" :options="SOURCE_OPTIONS" size="small" style="width: 140px" @update:value="(v: 'yaml' | 'csv' | 'xml' | 'toml' | 'env') => patchParams(i, { source: v })" />
          </n-form-item>
        </template>
        <template v-else-if="node.op === 'diff'">
          <n-form-item label="Other JSON" :show-feedback="false" style="width: 100%">
            <c-input-text :value="node.params.other ?? ''" rows="4" multiline monospace placeholder="Paste the second JSON to compare against this step's input..." @update:value="(v: string) => patchParams(i, { other: v })" />
          </n-form-item>
        </template>
      </div>

      <details v-if="i > 0" class="input-details">
        <summary>Input {{ node.inputOverride !== undefined ? '(pinned)' : '(from previous step)' }}</summary>
        <pre class="input-preview">{{ effectiveInputs[i] }}</pre>
        <div class="mini-actions">
          <n-button v-if="node.inputOverride === undefined" size="tiny" @click="detach(i)">
            Pin / edit input
          </n-button>
          <template v-else>
            <c-input-text :value="node.inputOverride" rows="4" multiline monospace @update:value="(v: string) => (node.inputOverride = v)" />
            <n-button size="tiny" @click="reattach(i)">
              Re-attach to previous output
            </n-button>
          </template>
        </div>
      </details>

      <n-alert v-if="!isOk(i)" type="error" title="Step error" style="margin-top: 8px" :data-test-id="`step-${i}-error`">
        {{ errorOf(i) }}
      </n-alert>
      <template v-else>
        <div v-if="node.op === 'tree'" class="tree-box" :data-test-id="firstIndexOf('tree') === i ? 'tree-output' : `step-${i}-tree`">
          <JsonTree v-if="treeValue(i) !== null" :value="treeValue(i)" />
          <n-alert v-else type="warning">
            This step's input is not valid JSON.
          </n-alert>
        </div>
        <template v-else>
          <p v-if="node.op === 'query'" class="hint" :data-test-id="firstIndexOf('query') === i ? 'query-count' : undefined">
            {{ queryCount(i) }} match(es) · supports $ .key ['key'] [n] [a:b:c] .* [*] ..key ; filter ?() not supported
          </p>
          <p v-if="node.op === 'schema'" class="hint">
            Inferred from your sample — review before using as a contract.
          </p>
          <TextareaCopyable :value="outputOf(i)" :language="outputLanguage(node)" :data-test-id="outputTestId(node.op, i)" />
        </template>
      </template>

      <div class="step-actions">
        <n-button size="tiny" :disabled="!isOk(i)" :data-test-id="`step-${i}-download`" @click="downloadStep(i)">
          Download
        </n-button>
        <n-dropdown trigger="click" :options="OP_DROPDOWN" @select="(key: string | number) => addStep(i, String(key) as OpId)">
          <n-button size="tiny" type="primary" :data-test-id="`step-${i}-next`">
            → Add next step
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <p class="hint footer-hint">
      Everything runs in your browser — no upload, no account. Share links carry your data ({{ LINK_LIMIT }}-byte limit); do not share secrets.
    </p>
  </div>
</template>

<style lang="less" scoped>
.json-workspace { width: 100%; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.input-zone { margin-top: 12px; border-radius: 8px; &.dragging { outline: 2px dashed rgba(127, 127, 127, 0.6); outline-offset: 4px; } }
.step-card { margin-top: 12px; padding: 12px; border: 1px solid rgba(127, 127, 127, 0.25); border-radius: 8px; }
.step-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.step-num { font-weight: 600; font-size: 13px; }
.spacer { flex: 1; }
.params { display: flex; flex-wrap: wrap; gap: 12px; margin: 10px 0 4px; }
.input-details { margin: 6px 0; font-size: 12px; summary { cursor: pointer; opacity: 0.75; } }
.input-preview { max-height: 160px; overflow: auto; padding: 8px; margin: 6px 0; font-size: 12px; background: rgba(127, 127, 127, 0.08); border-radius: 4px; white-space: pre-wrap; word-break: break-all; }
.mini-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.tree-box { max-height: 480px; overflow: auto; padding: 12px; margin-top: 8px; border: 1px solid rgba(127, 127, 127, 0.25); border-radius: 8px; }
.step-actions { display: flex; gap: 8px; margin-top: 10px; }
.hint { font-size: 12px; opacity: 0.7; margin: 8px 0; }
.footer-hint { margin-top: 16px; }
.detect-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.detect-link { text-decoration: underline; white-space: nowrap; }
</style>
