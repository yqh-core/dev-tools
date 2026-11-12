<script setup lang="ts">
import JSON5 from 'json5';
import { stringify as yamlStringify } from 'yaml';
import { useStorage } from '@vueuse/core';
import { formatJson } from '../json-viewer/json.models';
import { JsonPathError, jsonPath } from './jsonpath';
import { inferSchemaDocument } from './schema';
import { TransformError, toCsv } from './transform';
import JsonTree from './JsonTree.vue';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

const rawJson = useStorage('json-workspace:raw-json', '{\n  "store": {\n    "book": [\n      { "title": "Sayings of the Century", "price": 8.95 },\n      { "title": "Moby Dick", "price": 8.99 }\n    ],\n    "bicycle": { "color": "red", "price": 19.95 }\n  }\n}');
const indentSize = useStorage('json-workspace:indent', 2);
const sortKeys = useStorage('json-workspace:sort', false);
const query = ref('$.store.book[*].title');
const transformTarget = ref<'yaml' | 'csv'>('yaml');
const activeTab = ref('format');

const parsed = computed(() => {
  try {
    return { ok: true as const, value: JSON5.parse(rawJson.value), error: '' };
  }
  catch (e) {
    return { ok: false as const, value: null, error: e instanceof Error ? e.message : String(e) };
  }
});

const formatted = computed(() => {
  if (!parsed.value.ok) {
    return '';
  }
  try {
    return formatJson({ rawJson, indentSize, sortKeys });
  }
  catch {
    return '';
  }
});

const queryResult = computed(() => {
  if (!parsed.value.ok) {
    return { ok: false, text: 'Fix the JSON input first.', count: 0 };
  }
  try {
    const matches = jsonPath(parsed.value.value, query.value);
    return { ok: true, text: JSON.stringify(matches, null, 2), count: matches.length };
  }
  catch (e) {
    return { ok: false, text: e instanceof JsonPathError ? `JSONPath error: ${e.message}` : String(e), count: 0 };
  }
});

const transformed = computed(() => {
  if (!parsed.value.ok) {
    return { ok: false, text: 'Fix the JSON input first.' };
  }
  try {
    const text = transformTarget.value === 'yaml' ? yamlStringify(parsed.value.value) : toCsv(parsed.value.value);
    return { ok: true, text };
  }
  catch (e) {
    return { ok: false, text: e instanceof TransformError ? e.message : String(e) };
  }
});

const schema = computed(() => {
  if (!parsed.value.ok) {
    return '';
  }
  return JSON.stringify(inferSchemaDocument(parsed.value.value, 'Inferred from sample'), null, 2);
});
</script>

<template>
  <div class="json-workspace">
    <n-alert v-if="!parsed.ok" type="error" title="Invalid JSON" style="margin-bottom: 12px">
      {{ parsed.error }}
    </n-alert>

    <n-form-item label="JSON input" :show-feedback="false">
      <c-input-text
        v-model:value="rawJson"
        data-test-id="json-input"
        placeholder="Paste JSON here..."
        rows="12"
        multiline
        monospace
        spellcheck="false"
      />
    </n-form-item>

    <n-tabs v-model:value="activeTab" type="line" animated style="margin-top: 12px">
      <n-tab-pane name="format" tab="Format / Validate">
        <div flex items-center gap-3 style="margin-bottom: 10px">
          <n-form-item label="Sort keys" label-placement="left" :show-feedback="false">
            <n-switch v-model:value="sortKeys" data-test-id="sort-keys" />
          </n-form-item>
          <n-form-item label="Indent" label-placement="left" :show-feedback="false">
            <n-input-number v-model:value="indentSize" :min="0" :max="8" style="width: 90px" />
          </n-form-item>
        </div>
        <TextareaCopyable :value="formatted" language="json" data-test-id="format-output" />
      </n-tab-pane>

      <n-tab-pane name="tree" tab="Tree">
        <div v-if="parsed.ok" class="tree-box" data-test-id="tree-output">
          <JsonTree :value="parsed.value" />
        </div>
        <n-alert v-else type="warning">
          Fix the JSON input to see the tree.
        </n-alert>
      </n-tab-pane>

      <n-tab-pane name="query" tab="Query (JSONPath)">
        <n-form-item label="JSONPath" :show-feedback="false">
          <c-input-text v-model:value="query" data-test-id="query-input" placeholder="$.store.book[*].title" monospace />
        </n-form-item>
        <p class="hint" data-test-id="query-count">
          {{ queryResult.ok ? `${queryResult.count} match(es)` : 'Query error' }} ·
          supports $ .key ['key'] [n] [a:b:c] .* [*] ..key ; filter ?() not supported
        </p>
        <TextareaCopyable :value="queryResult.text" language="json" data-test-id="query-output" />
      </n-tab-pane>

      <n-tab-pane name="transform" tab="Transform">
        <n-form-item label="Target" label-placement="left" :show-feedback="false">
          <n-select v-model:value="transformTarget" data-test-id="transform-target" :options="[{ label: 'YAML', value: 'yaml' }, { label: 'CSV (array of objects)', value: 'csv' }]" style="width: 240px" />
        </n-form-item>
        <TextareaCopyable :value="transformed.text" :language="transformTarget === 'yaml' ? 'yaml' : 'text'" data-test-id="transform-output" />
      </n-tab-pane>

      <n-tab-pane name="schema" tab="Schema">
        <p class="hint">
          Inferred from your sample — review before using as a contract.
        </p>
        <TextareaCopyable :value="schema" language="json" data-test-id="schema-output" />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<style lang="less" scoped>
.json-workspace { width: 100%; }
.tree-box { max-height: 480px; overflow: auto; padding: 12px; border: 1px solid rgba(127, 127, 127, 0.25); border-radius: 8px; }
.hint { font-size: 12px; opacity: 0.7; margin: 8px 0; }
</style>
