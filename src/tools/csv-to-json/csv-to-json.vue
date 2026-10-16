<script setup lang="ts">
import { convertCsvToJson } from './csv-to-json.service';

const input = useStorage('csv-to-json:input', '');
const header = ref(true);

const result = computed(() => convertCsvToJson(input.value, { header: header.value }));
</script>

<template>
  <div flex flex-col gap-3>
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

      <div>
        <div mb-1 text-13px op-70>
          JSON version of your CSV
          <span op-50>({{ result.rowCount }} rows × {{ result.columnCount }} columns)</span>
        </div>
        <TextareaCopyable :value="result.json" />
      </div>
    </template>
  </div>
</template>
