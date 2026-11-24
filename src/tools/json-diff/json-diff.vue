<script setup lang="ts">
import JSON5 from 'json5';

import DiffsViewer from './diff-viewer/diff-viewer.vue';
import { diff, flattenDifferences } from './json-diff.models';
import { withDefaultOnError } from '@/utils/defaults';
import { isNotThrowing } from '@/utils/boolean';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const rawLeftJson = ref('');
const rawRightJson = ref('');
const fileError = ref('');

const leftJson = computed(() => withDefaultOnError(() => JSON5.parse(rawLeftJson.value), undefined));
const rightJson = computed(() => withDefaultOnError(() => JSON5.parse(rawRightJson.value), undefined));

const jsonValidationRules = [
  {
    validator: (value: string) => value === '' || isNotThrowing(() => JSON5.parse(value)),
    message: 'Invalid JSON format',
  },
];

const differenceTree = computed(() => {
  if (leftJson.value === undefined || rightJson.value === undefined) {
    return null;
  }
  return diff(leftJson.value, rightJson.value, { onlyShowDifferences: true });
});
const differenceList = computed(() => differenceTree.value
  ? flattenDifferences(differenceTree.value)
  : []);

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

  <DiffsViewer :left-json="leftJson" :right-json="rightJson" />

  <c-card v-if="differenceTree" title="Change list" mt-3 data-test-id="change-list">
    <div flex flex-wrap items-center justify-between gap-2 mb-3>
      <span text-sm>{{ differenceList.length }} changed paths</span>
      <c-button v-if="differenceList.length > 0" @click="downloadReport">
        Download change report
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
          <tr v-for="item in differenceList" :key="item.path" border-t>
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
      File contents are read locally in this tab and are not uploaded. File size limit: 5 MB per input.
    </p>
  </c-card>
</template>
