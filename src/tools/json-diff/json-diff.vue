<script setup lang="ts">
import JSON5 from 'json5';
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue';

import DiffsViewer from './diff-viewer/diff-viewer.vue';
import { type ArrayComparisonMode, diff, flattenDifferences } from './json-diff.models';
import type { Difference } from './json-diff.types';
import type { JsonDiffWorkerResponse } from './json-diff.worker.types';
import { isNotThrowing } from '@/utils/boolean';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const WORKER_THRESHOLD = 150_000;
const WORKER_TIMEOUT_MS = 15_000;
const INPUT_DEBOUNCE_MS = 120;

const rawLeftJson = ref('');
const rawRightJson = ref('');
const fileError = ref('');
const comparisonError = ref('');
const isComparing = ref(false);
const showAllChanges = ref(false);
const arrayMode = ref<ArrayComparisonMode>('index');
const arrayIdKey = ref('id');
const leftJson = shallowRef<unknown>();
const rightJson = shallowRef<unknown>();
const differenceTree = shallowRef<Difference | null>(null);

let activeWorker: Worker | undefined;
let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
let debounceHandle: ReturnType<typeof setTimeout> | undefined;

const jsonValidationRules = [
  {
    validator: (value: string) => value === ''
      || value.length >= WORKER_THRESHOLD / 2
      || isNotThrowing(() => JSON5.parse(value)),
    message: 'Invalid JSON format',
  },
];

function stopActiveWorker() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = undefined;
  }
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = undefined;
  }
  isComparing.value = false;
}

function compareInputs() {
  stopActiveWorker();
  comparisonError.value = '';
  leftJson.value = undefined;
  rightJson.value = undefined;
  differenceTree.value = null;

  const leftText = rawLeftJson.value;
  const rightText = rawRightJson.value;
  if (!leftText.trim() || !rightText.trim()) {
    return;
  }

  const options = {
    onlyShowDifferences: false,
    arrayMode: arrayMode.value,
    arrayIdKey: arrayIdKey.value,
  };
  const totalCharacters = leftText.length + rightText.length;

  if (totalCharacters < WORKER_THRESHOLD) {
    try {
      const parsedLeft = JSON5.parse(leftText);
      const parsedRight = JSON5.parse(rightText);
      leftJson.value = parsedLeft;
      rightJson.value = parsedRight;
      differenceTree.value = diff(parsedLeft, parsedRight, options);
    }
    catch {
      comparisonError.value = 'Invalid JSON format. Check both inputs.';
    }
    return;
  }

  if (typeof Worker === 'undefined') {
    comparisonError.value = 'This browser does not support background comparison for large inputs. Use a smaller document.';
    return;
  }

  isComparing.value = true;
  try {
    const worker = new Worker(new URL('./json-diff.worker.ts', import.meta.url), { type: 'module' });
    activeWorker = worker;

    worker.onmessage = (event: MessageEvent<JsonDiffWorkerResponse>) => {
      if (activeWorker !== worker) {
        return;
      }
      stopActiveWorker();
      if (event.data.type === 'success') {
        leftJson.value = event.data.leftJson;
        rightJson.value = event.data.rightJson;
        differenceTree.value = event.data.difference;
      }
      else {
        comparisonError.value = event.data.message;
      }
    };

    worker.onerror = () => {
      if (activeWorker !== worker) {
        return;
      }
      stopActiveWorker();
      comparisonError.value = 'Background comparison failed. Try a smaller input or simplify the arrays.';
    };

    timeoutHandle = setTimeout(() => {
      if (activeWorker !== worker) {
        return;
      }
      stopActiveWorker();
      comparisonError.value = 'Background comparison timed out after 15 seconds. Reduce the input size or simplify the comparison.';
    }, WORKER_TIMEOUT_MS);

    worker.postMessage({ leftText, rightText, options });
  }
  catch {
    stopActiveWorker();
    comparisonError.value = 'Could not start background comparison. Try a smaller input or use a browser with Web Worker support.';
  }
}

watch([rawLeftJson, rawRightJson, arrayMode, arrayIdKey], () => {
  if (debounceHandle) {
    clearTimeout(debounceHandle);
  }
  stopActiveWorker();
  leftJson.value = undefined;
  rightJson.value = undefined;
  differenceTree.value = null;
  comparisonError.value = '';
  showAllChanges.value = false;
  debounceHandle = setTimeout(compareInputs, INPUT_DEBOUNCE_MS);
}, { flush: 'post' });

function cancelComparison() {
  if (!activeWorker) {
    return;
  }
  stopActiveWorker();
  comparisonError.value = 'Comparison cancelled. Your input is unchanged; edit the text or run the comparison again.';
}

onBeforeUnmount(() => {
  if (debounceHandle) {
    clearTimeout(debounceHandle);
  }
  stopActiveWorker();
});

const differenceList = computed(() => differenceTree.value
  ? flattenDifferences(differenceTree.value)
  : []);
const visibleDifferences = computed(() => showAllChanges.value
  ? differenceList.value
  : differenceList.value.slice(0, 500));
const changeCounts = computed(() => differenceList.value.reduce((counts, item) => {
  if (item.status === 'added') {
    counts.added++;
  }
  else if (item.status === 'removed') {
    counts.removed++;
  }
  else {
    counts.changed++;
  }
  return counts;
}, { added: 0, removed: 0, changed: 0 }));

function formatValue(value: unknown): string {
  if (value === undefined) {
    return '(missing)';
  }
  const formatted = JSON.stringify(value);
  return formatted === undefined ? String(value) : formatted;
}

async function loadJsonFile(event: Event, side: 'left' | 'right') {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  fileError.value = '';
  if (!file) {
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    fileError.value = 'File is larger than 5 MB. Paste a smaller JSON document instead.';
    return;
  }
  try {
    const contents = await file.text();
    if (side === 'left') {
      rawLeftJson.value = contents;
    }
    else {
      rawRightJson.value = contents;
    }
  }
  catch {
    fileError.value = 'The selected file could not be read. Try opening it locally and pasting its contents.';
  }
}

function downloadReport() {
  const report = {
    generatedAt: new Date().toISOString(),
    comparison: differenceList.value.map(item => ({
      path: item.path,
      status: item.status,
      oldValue: item.oldValue === undefined ? { missing: true } : item.oldValue,
      newValue: item.value === undefined ? { missing: true } : item.value,
    })),
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'json-diff-report.json';
  anchor.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div grid grid-cols-1 gap-3 lg:grid-cols-2>
    <div>
      <c-input-text
        v-model:value="rawLeftJson"
        :validation-rules="jsonValidationRules"
        label="Your first JSON"
        placeholder="Paste your first JSON here..."
        rows="20"
        multiline
        test-id="leftJson"
        raw-text
        monospace
      />
      <label block mt-2 text-sm>
        Open a local JSON file
        <input
          type="file"
          accept=".json,.json5,application/json,text/plain"
          aria-label="Open first JSON file"
          data-test-id="left-file"
          @change="loadJsonFile($event, 'left')"
          block
          mt-1
          w-full
        >
      </label>
    </div>
    <div>
      <c-input-text
        v-model:value="rawRightJson"
        :validation-rules="jsonValidationRules"
        label="Your JSON to compare"
        placeholder="Paste your JSON to compare here..."
        rows="20"
        multiline
        test-id="rightJson"
        raw-text
        monospace
      />
      <label block mt-2 text-sm>
        Open a local JSON file
        <input
          type="file"
          accept=".json,.json5,application/json,text/plain"
          aria-label="Open second JSON file"
          data-test-id="right-file"
          @change="loadJsonFile($event, 'right')"
          block
          mt-1
          w-full
        >
      </label>
    </div>
  </div>

  <c-alert v-if="fileError" type="warning" mt-2 data-test-id="file-error">
    {{ fileError }}
  </c-alert>
  <c-alert v-if="comparisonError" type="warning" mt-2 data-test-id="comparison-error">
    {{ comparisonError }}
  </c-alert>

  <div
    v-if="isComparing"
    flex flex-wrap items-center justify-between gap-3
    mt-3 p-3 rounded
    bg-gray-500:5
    data-test-id="comparison-status"
    aria-live="polite"
  >
    <span>Comparing large JSON in a background worker…</span>
    <c-button data-test-id="cancel-comparison" @click="cancelComparison">
      Cancel comparison
    </c-button>
  </div>

  <c-card title="Array comparison" mt-3 data-test-id="array-comparison-controls">
    <div flex flex-wrap gap-4>
      <label flex items-center gap-2>
        <input v-model="arrayMode" type="radio" value="index" data-test-id="array-mode-index">
        Compare by index (default)
      </label>
      <label flex items-center gap-2>
        <input v-model="arrayMode" type="radio" value="ignore-order" data-test-id="array-mode-ignore-order">
        Ignore order (preserve duplicates)
      </label>
      <label flex items-center gap-2>
        <input v-model="arrayMode" type="radio" value="id" data-test-id="array-mode-id">
        Match objects by ID
      </label>
    </div>
    <div v-if="arrayMode === 'id'" mt-3>
      <label flex items-center gap-2 text-sm>
        ID property
        <input v-model="arrayIdKey" type="text" aria-label="Array object ID key" border rounded px-2 py-1>
      </label>
      <p mt-2 text-xs opacity-70>
        ID matching is used only when every array item has a unique, non-empty string or finite numeric ID. Invalid or duplicate IDs fall back to index comparison.
      </p>
    </div>
    <p mt-2 text-xs opacity-70>
      Ignore-order compares exact values as a multiset: duplicate items still count. ID mode matches objects by the selected key and shows field changes without treating reordering as a change.
    </p>
  </c-card>

  <DiffsViewer
    v-if="differenceTree && leftJson !== undefined && rightJson !== undefined"
    :left-json="leftJson"
    :right-json="rightJson"
    :precomputed-result="differenceTree"
    :large-input="rawLeftJson.length + rawRightJson.length >= WORKER_THRESHOLD"
  />

  <c-card v-if="differenceTree" title="Change list" mt-3 data-test-id="change-list">
    <div flex flex-wrap items-center justify-between gap-2 mb-3>
      <div flex flex-wrap gap-3 text-sm>
        <span>{{ differenceList.length }} changed paths</span>
        <span>Added: {{ changeCounts.added }}</span>
        <span>Removed: {{ changeCounts.removed }}</span>
        <span>Changed: {{ changeCounts.changed }}</span>
      </div>
      <c-button v-if="differenceList.length > 0" @click="downloadReport">
        Download change report
      </c-button>
    </div>
    <div v-if="differenceList.length > 500" flex items-center justify-between gap-2 mb-2 text-sm>
      <span>Showing {{ visibleDifferences.length }} of {{ differenceList.length }} changed paths</span>
      <c-button size="small" @click="showAllChanges = !showAllChanges">
        {{ showAllChanges ? 'Show first 500' : 'Show all changes' }}
      </c-button>
    </div>
    <div v-if="differenceList.length > 0" class="max-w-full overflow-x-auto">
      <table w-full text-sm>
        <thead>
          <tr text-left>
            <th p-2>JSON path</th>
            <th p-2>Status</th>
            <th p-2>Before</th>
            <th p-2>After</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in visibleDifferences" :key="item.path" border-t>
            <td p-2 font-mono data-test-id="change-path">{{ item.path }}</td>
            <td p-2>{{ item.status }}</td>
            <td p-2 font-mono>{{ formatValue(item.oldValue) }}</td>
            <td p-2 font-mono>{{ formatValue(item.value) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else text-sm opacity-70>
      No changed paths. The two parsed JSON values are equivalent.
    </p>
    <p mt-3 text-xs opacity-70>
      File contents are read locally in this tab and are not uploaded. File size limit: 5 MB per input. Large comparisons run in a cancellable background worker with a 15-second timeout.
    </p>
  </c-card>
</template>
