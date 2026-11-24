<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
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
    return `Input is too large. Please use ${MAX_SLUG_INPUT_LENGTH.toLocaleString()} characters or fewer.`;
  }

  const rows = input.value.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rows.length > MAX_SLUG_BATCH_ROWS) {
    return `This batch has ${rows.length.toLocaleString()} lines. The limit is ${MAX_SLUG_BATCH_ROWS.toLocaleString()}.`;
  }

  return '';
});

const rows = computed(() => {
  if (!input.value.trim() || inputError.value) {
    return [];
  }

  return runSlugifyBatch(input.value, settings);
});

const output = computed(() => slugifyBatchToText(rows.value));
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

const { copy } = useCopy({ source: output, text: 'All slugs copied to clipboard' });
const { download: downloadCsv } = useDownloadTextFile({
  source: csvOutput,
  filename: 'slug-results',
  language: 'csv',
});
const { download: downloadTxt } = useDownloadTextFile({
  source: output,
  filename: 'slug-results',
  language: 'txt',
});

const separatorOptions = [
  { label: 'Hyphen (-)', value: '-' },
  { label: 'Underscore (_)', value: '_' },
  { label: 'Dot (.)', value: '.' },
];

const maxLengthOptions = [
  { label: 'No limit', value: 0 },
  { label: '30 characters', value: 30 },
  { label: '50 characters', value: 50 },
  { label: '60 characters', value: 60 },
  { label: '80 characters', value: 80 },
  { label: '100 characters', value: 100 },
  { label: '120 characters', value: 120 },
];
</script>

<template>
  <div>
    <c-card title="URL slug generator" mb-5>
      <p mb-3 op-70>
        Convert one title or a batch of titles into URL-friendly slugs. Options update the results immediately.
      </p>

      <c-input-text
        v-model:value="input"
        multiline
        rows="8"
        placeholder="One title per line, e.g.:
How to Build a Better API
The Complete Guide to URL Slugs
Déjà Vu and Unicode"
        label="Titles or phrases"
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
            Word separator
          </div>
          <n-select v-model:value="settings.separator" :options="separatorOptions" />
        </div>
        <div>
          <div mb-1 text-sm font-medium>
            Maximum length
          </div>
          <n-select v-model:value="settings.maxLength" :options="maxLengthOptions" />
        </div>
      </div>

      <div flex flex-wrap gap-x-5 gap-y-2 mb-4>
        <n-checkbox v-model:checked="settings.lowercase">
          Lowercase
        </n-checkbox>
        <n-checkbox v-model:checked="settings.decamelize">
          Split camelCase words
        </n-checkbox>
        <n-checkbox v-model:checked="settings.removeEnglishStopWords">
          Remove common English stop words
        </n-checkbox>
        <n-checkbox v-model:checked="settings.unique">
          Make duplicate slugs unique
        </n-checkbox>
      </div>

      <div mb-4>
        <label block text-sm font-medium mb-1 for="slug-base-url">
          Optional base URL preview
        </label>
        <n-input
          id="slug-base-url"
          v-model:value="baseUrl"
          placeholder="https://example.com/blog"
          clearable
        />
        <p v-if="baseUrl.trim() && !validBaseUrl" mt-1 text-xs text-red-600>
          Enter a valid http:// or https:// base URL.
        </p>
      </div>

      <div flex flex-wrap items-center gap-2>
        <c-button :disabled="rows.length === 0" @click="copy()">
          Copy all slugs
        </c-button>
        <c-button :disabled="rows.length === 0" @click="downloadTxt()">
          Download TXT
        </c-button>
        <c-button :disabled="rows.length === 0" @click="downloadCsv()">
          Download CSV
        </c-button>
      </div>
    </c-card>

    <div v-if="rows.length" data-test-id="slug-results">
      <div flex flex-wrap items-center justify-between gap-2 mb-3>
        <strong>{{ rows.length }} slugs generated</strong>
        <span text-sm op-65>
          {{ truncatedCount }} shortened · {{ errorCount }} warnings
        </span>
      </div>

      <div class="results-list">
        <div v-for="row of rows" :key="row.lineNumber" class="result-row">
          <div class="result-source">
            <span text-xs op-55>Line {{ row.lineNumber }}</span>
            <span>{{ row.source }}</span>
          </div>
          <div class="result-slug">
            <code>{{ row.slug || '—' }}</code>
            <span text-xs op-55>{{ row.outputLength }} chars</span>
          </div>
          <div v-if="row.error" class="result-error">
            {{ row.error }}
          </div>
          <div v-else-if="row.truncated" class="result-hint">
            Shortened at a word boundary to fit the selected limit.
          </div>
          <div v-if="previewUrl(row.slug)" class="result-preview">
            {{ previewUrl(row.slug) }}
          </div>
        </div>
      </div>
    </div>

    <c-alert v-else type="info">
      Enter one title per line. Blank lines are ignored; results stay in this browser.
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
