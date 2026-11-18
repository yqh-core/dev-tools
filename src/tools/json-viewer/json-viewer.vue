<script setup lang="ts">
import JSON5 from 'json5';
import { useStorage } from '@vueuse/core';
import { formatJson } from './json.models';
import { withDefaultOnError } from '@/utils/defaults';
import { useValidation } from '@/composable/validation';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import JsonTreeView from '@/components/JsonTreeView.vue';
import { describeJsonProblem } from '@/utils/text-error';

const inputElement = ref<HTMLElement>();

const rawJson = useStorage('json-prettify:raw-json', '{"hello": "world", "foo": "bar"}');
const indentSize = useStorage('json-prettify:indent-size', 3);
const sortKeys = useStorage('json-prettify:sort-keys', true);
const cleanJson = computed(() => withDefaultOnError(() => formatJson({ rawJson, indentSize, sortKeys }), ''));

const viewMode = useStorage<'pretty' | 'tree' | 'minify'>('json-prettify:view', 'pretty');
const parsed = computed(() => {
  try {
    return rawJson.value.trim() === '' ? undefined : JSON5.parse(rawJson.value);
  }
  catch {
    return undefined;
  }
});

const minified = computed(() => (parsed.value === undefined ? '' : JSON.stringify(parsed.value)));

const jsonProblem = computed(() => {
  if (rawJson.value.trim() === '') {
    return null;
  }
  try {
    JSON5.parse(rawJson.value);
    return null;
  }
  catch (error) {
    return describeJsonProblem(rawJson.value, error);
  }
});

watch(parsed, (value) => {
  if (value === undefined && viewMode.value !== 'pretty') {
    viewMode.value = 'pretty';
  }
});

function jumpToError() {
  const problem = jsonProblem.value;
  const input = inputElement.value as { selectRange?: (start: number, end: number) => void } | null;
  if (!problem || !input?.selectRange) {
    return;
  }
  input.selectRange(problem.start, problem.end);
}

const rawJsonValidation = useValidation({
  source: rawJson,
  rules: [
    {
      validator: v => v === '' || JSON5.parse(v),
      message: 'Invalid JSON: {0}',
      getErrorMessage: (value) => {
        try {
          JSON5.parse(value);
          return '';
        }
        catch (error) {
          return describeJsonProblem(value, error).message;
        }
      },
    },
  ],
});
</script>

<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 600px" flex justify-center gap-3>
      <n-form-item label="Sort keys :" label-placement="left" label-width="100">
        <n-switch v-model:value="sortKeys" />
      </n-form-item>
      <n-form-item label="Indent size :" label-placement="left" label-width="100" :show-feedback="false">
        <n-input-number v-model:value="indentSize" min="0" max="10" style="width: 100px" />
      </n-form-item>
    </div>
  </div>

  <n-form-item
    label="JSON"
    :feedback="rawJsonValidation.message"
    :validation-status="rawJsonValidation.status"
  >
    <c-input-text
      ref="inputElement"
      v-model:value="rawJson"
      placeholder="Paste JSON. A file drop works too."
      rows="20"
      multiline
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      monospace
    />
    <button v-if="jsonProblem" class="json-jump" type="button" @click="jumpToError">
      Show the error
    </button>
  </n-form-item>
  <n-form-item label="Result">
    <div class="json-views">
      <div class="json-view-switch" role="tablist" aria-label="JSON view">
        <button type="button" role="tab" :aria-selected="viewMode === 'pretty'" :class="{ on: viewMode === 'pretty' }" @click="viewMode = 'pretty'">
          Pretty
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="viewMode === 'tree'"
          :class="{ on: viewMode === 'tree' }"
          :disabled="parsed === undefined"
          @click="viewMode = 'tree'"
        >
          Tree
        </button>
        <button type="button" role="tab" :aria-selected="viewMode === 'minify'" :class="{ on: viewMode === 'minify' }" :disabled="parsed === undefined" @click="viewMode = 'minify'">
          Minify
        </button>
      </div>
      <TextareaCopyable
        v-show="viewMode === 'pretty'"
        :value="cleanJson"
        language="json"
        downloadable
        download-filename="formatted"
        :follow-height-of="inputElement"
      />
      <JsonTreeView v-if="viewMode === 'tree' && parsed !== undefined" :data="parsed" />
      <TextareaCopyable
        v-if="viewMode === 'minify'"
        :value="minified"
        language="json"
        downloadable
        download-filename="minified"
      />
    </div>
  </n-form-item>
</template>

<style lang="less" scoped>
.result-card {
  position: relative;
  .copy-button {
    position: absolute;
    top: 10px;
    right: 10px;
  }
}

.json-views {
  width: 100%;
}

.json-view-switch {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;

  button {
    padding: 4px 10px;
    border: 1px solid var(--dd-border);
    border-radius: 999px;
    background: var(--dd-surface);
    color: var(--dd-text-soft);
    cursor: pointer;
    font: inherit;
    font-size: 12px;

    &.on {
      border-color: var(--dd-primary);
      color: var(--dd-primary);
      background: color-mix(in srgb, var(--dd-primary) 10%, transparent);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }
}

.json-jump {
  margin-top: 8px;
  padding: 4px 10px;
  border: 1px solid var(--dd-danger, #dc2626);
  border-radius: 999px;
  background: transparent;
  color: var(--dd-danger, #dc2626);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
</style>
