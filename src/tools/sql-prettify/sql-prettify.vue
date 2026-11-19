<script setup lang="ts">
import { type FormatOptionsWithLanguage, format as formatSQL } from 'sql-formatter';
import { minifySQL } from './sql-prettify.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useStyleStore } from '@/stores/style.store';

const inputElement = ref<HTMLElement>();
const styleStore = useStyleStore();
const config = reactive<FormatOptionsWithLanguage>({
  keywordCase: 'upper',
  useTabs: false,
  language: 'sql',
  indentStyle: 'standard',
  tabulateAlias: true,
});

const rawSQL = ref('select field1,field2,field3 from my_table where my_condition;');
const formatted = computed(() => {
  try {
    return {
      pretty: formatSQL(rawSQL.value, config),
      mini: minifySQL(rawSQL.value, config),
      error: '',
    };
  }
  catch (error) {
    return {
      pretty: '',
      mini: '',
      error: error instanceof Error ? error.message : 'Could not format that SQL.',
    };
  }
});
const prettySQL = computed(() => formatted.value.pretty);
const miniSQL = computed(() => formatted.value.mini);
</script>

<template>
  <div style="flex: 0 0 100%">
    <div style="max-width: 600px" :class="{ 'flex-col': styleStore.isSmallScreen }" mx-auto mb-5 flex gap-2>
      <c-select
        v-model:value="config.language"
        flex-1
        label="Dialect"
        :options="[
          { label: 'GCP BigQuery', value: 'bigquery' },
          { label: 'IBM DB2', value: 'db2' },
          { label: 'Apache Hive', value: 'hive' },
          { label: 'MariaDB', value: 'mariadb' },
          { label: 'MySQL', value: 'mysql' },
          { label: 'Couchbase N1QL', value: 'n1ql' },
          { label: 'Oracle PL/SQL', value: 'plsql' },
          { label: 'PostgreSQL', value: 'postgresql' },
          { label: 'Amazon Redshift', value: 'redshift' },
          { label: 'Spark', value: 'spark' },
          { label: 'Standard SQL', value: 'sql' },
          { label: 'sqlite', value: 'sqlite' },
          { label: 'SQL Server Transact-SQL', value: 'tsql' },
        ]"
      />
      <c-select
        v-model:value="config.keywordCase" label="Keyword case"
        flex-1
        :options="[
          { label: 'UPPERCASE', value: 'upper' },
          { label: 'lowercase', value: 'lower' },
          { label: 'Preserve', value: 'preserve' },
        ]"
      />
      <c-select
        v-model:value="config.indentStyle" label="Indent style"
        flex-1
        :options="[
          { label: 'Standard', value: 'standard' },
          { label: 'Tabular left', value: 'tabularLeft' },
          { label: 'Tabular right', value: 'tabularRight' },
        ]"
      />
    </div>
  </div>

  <n-form-item label="SQL">
    <c-input-text
      ref="inputElement"
      v-model:value="rawSQL"
      placeholder="Paste a query"
      rows="20"
      multiline
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      monospace
    />
    <p v-if="formatted.error" class="sql-error">
      {{ formatted.error }}
    </p>
  </n-form-item>
  <n-form-item label="Formatted">
    <TextareaCopyable :value="prettySQL" language="sql" :follow-height-of="inputElement" />
  </n-form-item>

  <n-form-item label="One line">
    <TextareaCopyable :value="miniSQL" language="sql" :follow-height-of="inputElement" test-id="sql-prettify-minified" />
  </n-form-item>
</template>

<style lang="less" scoped>
.sql-error {
  margin: 8px 0 0;
  color: var(--dd-danger, #dc2626);
  font-size: 13px;
}

.result-card {
  position: relative;
  .copy-button {
    position: absolute;
    top: 10px;
    right: 10px;
  }
}
</style>
