<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCopy } from '@/composable/copy';
import { useDownloadTextFile } from '@/composable/downloadText';
import {
  MAX_SLUG_BATCH_ROWS,
  MAX_SLUG_INPUT_LENGTH,
  runSlugifyBatch,
  slugifyBatchToCsv,
  slugifyBatchToText,
  type SlugSeparator,
} from './slugify-string.batch';

const { t } = useI18n();

const input = ref('');
const baseUrl = ref('');
const settings = reactive({
  separator: '-' as SlugSeparator,
  lowercase: true,
  decamelize: true,
  removeEnglishStopWords: false,
  unique: true,
  maxLength: 0,
});

const inputError = computed(() => {
  if (input.value.length > MAX_SLUG_INPUT_LENGTH) {
    return t('tools.slugify-string.batch.inputTooLarge', { count: MAX_SLUG_INPUT_LENGTH.toLocaleString() });
  }

  const rows = input.value.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rows.length > MAX_SLUG_BATCH_ROWS) {
    return t('tools.slugify-string.batch.tooManyRows', { actual: rows.length.toLocaleString(), limit: MAX_SLUG_BATCH_ROWS.toLocaleString() });
  }

  return '';
});

const rows = computed(() => {
  if (!input.value.trim() || inputError.value) {
    return [];
  }

  return runSlugifyBatch(input.value, settings);
});

const allSlugs = computed(() => rows.value.filter(row => !row.error).map(row => row.slug).join('\n'));
const textOutput = computed(() => slugifyBatchToText(rows.value));
const csvOutput = computed(() => slugifyBatchToCsv(rows.value));
const truncatedCount = computed(() => rows.value.filter(row => row.truncated).length);
const errorCount = computed(() => rows.value.filter(row => row.error.length > 0).length);
const validBaseUrl = computed(() => {
  const raw = baseUrl.value.trim();
  if (!raw) {
    return '';
  }

  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol)
      ? parsed.toString().replace(/\/+$/, '')
      : '';
  }
  catch {
    return '';
  }
});

const previewUrl = (slug: string) => (
  validBaseUrl.value && slug ? `${validBaseUrl.value}/${slug}` : ''
);

const { copy } = useCopy({ source: allSlugs, text: t('tools.slugify-string.batch.copied') });
const { download: downloadCsv } = useDownloadTextFile({
  source: csvOutput,
  filename: 'slug-results',
  language: 'csv',
});
const { download: downloadTxt } = useDownloadTextFile({
  source: textOutput,
  filename: 'slug-results',
  language: 'txt',
});

const separatorOptions = computed(() => [
  { label: t('tools.slugify-string.batch.hyphen'), value: '-' },
  { label: t('tools.slugify-string.batch.underscore'), value: '_' },
  { label: t('tools.slugify-string.batch.dot'), value: '.' },
]);

const maxLengthOptions = computed(() => [
  { label: t('tools.slugify-string.batch.noLimit'), value: 0 },
  ...[30, 50, 60, 80, 100, 120].map(count => ({
    label: t('tools.slugify-string.batch.characters', { count }),
    value: count,
  })),
]);

function displayRowError(error: string): string {
  return error.startsWith('No URL-safe characters')
    ? t('tools.slugify-string.batch.noCharacters')
    : t('tools.slugify-string.batch.rowTooLong');
}
</script>

<template>
  <div>
    <c-card :title="t('tools.slugify-string.batch.title')" mb-5>
      <p mb-3 op-70>
        {{ t('tools.slugify-string.batch.intro') }}
      </p>

      <c-input-text
        data-test-id="slug-titles-input"
        v-model:value="input"
        multiline
        rows="8"
        :placeholder="t('tools.slugify-string.batch.inputPlaceholder')"
        :label="t('tools.slugify-string.batch.inputLabel')"
        autofocus
        raw-text
        mb-4
      />

      <c-alert v-if="inputError" type="warning" mb-4>
        {{ inputError }}
      </c-alert>

      <div class="settings-grid" mb-4>
        <div>
          <div mb-1 text-sm font-medium>
            {{ t('tools.slugify-string.batch.separator') }}
          </div>
          <n-select v-model:value="settings.separator" :options="separatorOptions" />
        </div>
        <div>
          <div mb-1 text-sm font-medium>
            {{ t('tools.slugify-string.batch.maximumLength') }}
          </div>
          <n-select v-model:value="settings.maxLength" :options="maxLengthOptions" />
        </div>
      </div>

      <div flex flex-wrap gap-x-5 gap-y-2 mb-4>
        <n-checkbox v-model:checked="settings.lowercase">
          {{ t('tools.slugify-string.batch.lowercase') }}
        </n-checkbox>
        <n-checkbox v-model:checked="settings.decamelize">
          {{ t('tools.slugify-string.batch.decamelize') }}
        </n-checkbox>
        <n-checkbox v-model:checked="settings.removeEnglishStopWords">
          {{ t('tools.slugify-string.batch.stopWords') }}
        </n-checkbox>
        <n-checkbox v-model:checked="settings.unique">
          {{ t('tools.slugify-string.batch.unique') }}
        </n-checkbox>
      </div>

      <div mb-4>
        <label block text-sm font-medium mb-1 for="slug-base-url">
          {{ t('tools.slugify-string.batch.baseUrl') }}
        </label>
        <n-input
          id="slug-base-url"
          v-model:value="baseUrl"
          :placeholder="'https://example.com/blog'"
          clearable
        />
        <p v-if="baseUrl.trim() && !validBaseUrl" mt-1 text-xs text-red-600>
          {{ t('tools.slugify-string.batch.invalidBaseUrl') }}
        </p>
      </div>

      <div flex flex-wrap items-center gap-2>
        <c-button :disabled="allSlugs.length === 0" @click="copy()">
          {{ t('tools.slugify-string.batch.copyAll') }}
        </c-button>
        <c-button :disabled="textOutput.length === 0" @click="downloadTxt()">
          {{ t('tools.slugify-string.batch.downloadTxt') }}
        </c-button>
        <c-button :disabled="rows.length === 0" @click="downloadCsv()">
          {{ t('tools.slugify-string.batch.downloadCsv') }}
        </c-button>
      </div>
    </c-card>

    <div v-if="rows.length" data-test-id="slug-results">
      <div flex flex-wrap items-center justify-between gap-2 mb-3>
        <strong>{{ t('tools.slugify-string.batch.generated', { count: rows.length }) }}</strong>
        <span text-sm op-65>
          {{ t('tools.slugify-string.batch.shortened', { count: truncatedCount }) }} · {{ t('tools.slugify-string.batch.warnings', { count: errorCount }) }}
        </span>
      </div>

      <div class="results-list">
        <div v-for="row of rows" :key="row.lineNumber" class="result-row">
          <div class="result-source">
            <span text-xs op-55>{{ t('tools.slugify-string.batch.line', { number: row.lineNumber }) }}</span>
            <span>{{ row.source }}</span>
          </div>
          <div class="result-slug">
            <code>{{ row.slug || '—' }}</code>
            <span text-xs op-55>{{ t('tools.slugify-string.batch.chars', { count: row.outputLength }) }}</span>
          </div>
          <div v-if="row.error" class="result-error">
            {{ displayRowError(row.error) }}
          </div>
          <div v-else-if="row.truncated" class="result-hint">
            {{ t('tools.slugify-string.batch.truncated') }}
          </div>
          <div v-if="previewUrl(row.slug)" class="result-preview">
            {{ previewUrl(row.slug) }}
          </div>
        </div>
      </div>
    </div>

    <c-alert v-else type="info">
      {{ t('tools.slugify-string.batch.emptyState') }}
    </c-alert>
  </div>
</template>

<style scoped lang="less">
.settings-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
}

.results-list {
  display: grid;
  gap: 10px;
}

.result-row {
  display: grid;
  gap: 7px;
  padding: 12px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
}

.result-source {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  overflow-wrap: anywhere;
}

.result-slug {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;

  code {
    overflow-wrap: anywhere;
    font-weight: 650;
  }
}

.result-error {
  color: var(--dd-color-danger, #dc2626);
  font-size: 13px;
}

.result-hint,
.result-preview {
  color: var(--dd-text-soft);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.result-preview {
  padding-top: 4px;
  border-top: 1px dashed var(--dd-border);
}
</style>
