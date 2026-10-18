<script setup lang="ts">
import { convertCsvToJson } from './csv-to-json.service';

const input = useStorage('csv-to-json:input', '');
const header = ref(true);

const result = computed(() => convertCsvToJson(input.value, { header: header.value }));

// 预览上限：再多也不在页面上全铺，避免宽表把手机屏幕撑爆；完整数据始终在下方 JSON 里
const PREVIEW_ROWS = 5;
const PREVIEW_COLS = 8;

const preview = computed(() => {
  const { headers, rows } = result.value;
  if (result.value.error || rows.length === 0) {
    return null;
  }
  const cols = headers.slice(0, PREVIEW_COLS);
  return {
    cols,
    body: rows.slice(0, PREVIEW_ROWS).map(row => cols.map(col => row[col] ?? '')),
    hiddenCols: Math.max(0, headers.length - cols.length),
    hiddenRows: Math.max(0, rows.length - PREVIEW_ROWS),
  };
});
</script>

<template>
  <div flex flex-col gap-3 min-w-0>
    <c-input-text
      v-model:value="input"
      label="Your raw CSV"
      placeholder="Paste your raw CSV here..."
      multiline
      :rows="8"
      raw-text
      label-position="left"
      label-width="110px"
      label-align="right"
    />

    <div flex items-center gap-3 pl-110px>
      <n-switch v-model:value="header" size="small" />
      <span text-13px op-70>First row holds the column names</span>
    </div>

    <c-alert v-if="result.error" type="error" title="Could not parse this CSV">
      {{ result.error }}
    </c-alert>

    <template v-else-if="result.json">
      <c-alert v-if="result.warnings.length > 0" type="warning" title="Heads up">
        <div v-for="w in result.warnings" :key="w" mb-1 last:mb-0>
          {{ w }}
        </div>
      </c-alert>

      <div v-if="preview" min-w-0 max-w-full>
        <div mb-1 text-13px op-70>
          Data preview
          <span op-50>({{ result.rowCount }} rows × {{ result.columnCount }} cols)</span>
        </div>
        <c-card max-w-full min-w-0>
          <div overflow-x-auto min-w-0 style="max-width: 100%">
            <table text-13px w-full style="border-collapse: collapse">
              <thead>
                <tr>
                  <th
                    v-for="col in preview.cols"
                    :key="col"
                    text-left
                    font-600
                    whitespace-nowrap
                    px-3
                    py-2
                    border-b="~ solid #0002"
                  >
                    {{ col }}
                  </th>
                  <th
                    v-if="preview.hiddenCols > 0"
                    px-3
                    py-2
                    op-50
                    border-b="~ solid #0002"
                  >
                    …
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in preview.body" :key="ri">
                  <td
                    v-for="(cell, ci) in row"
                    :key="ci"
                    px-3
                    py-2
                    max-w-220px
                    truncate
                    border-b="~ solid #0001"
                  >
                    {{ cell === '' ? '—' : cell }}
                  </td>
                  <td v-if="preview.hiddenCols > 0" px-3 py-2 op-40>
                    …
                  </td>
                </tr>
                <tr v-if="preview.hiddenRows > 0">
                  <td :colspan="preview.cols.length + (preview.hiddenCols > 0 ? 1 : 0)" px-3 py-2 op-50>
                    +{{ preview.hiddenRows }} more row(s) — see the JSON below
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </c-card>
      </div>

      <div min-w-0>
        <div mb-1 text-13px op-70>
          JSON version of your CSV
          <span op-50>({{ result.rowCount }} rows × {{ result.columnCount }} columns)</span>
        </div>
        <TextareaCopyable
          :value="result.json"
          language="json"
          downloadable
          download-filename="converted"
        />
      </div>
    </template>
  </div>
</template>
