<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RedirectFormat, RedirectIssue, RedirectStatus } from './redirect-generator.service';
import { analyzeRedirects, generateRedirectOutput } from './redirect-generator.service';
import { useCopy } from '@/composable/copy';
import { useDownloadTextFile } from '@/composable/downloadText';

const { t } = useI18n();

const sample = [
  'Source URL,Target URL',
  '/old-product,https://example.com/products/new-product',
  '/legacy-guide,/guides/current-guide',
  '/sale,/offers',
].join('\n');

const input = ref('');
const format = ref<RedirectFormat>('apache');
const status = ref<RedirectStatus>('301');
const origin = ref('');
const preserveQueryString = ref(false);
const importError = ref('');

const analysis = computed(() => {
  try {
    return input.value.trim() ? analyzeRedirects(input.value) : undefined;
  }
  catch (error) {
    return {
      rows: [],
      total: 0,
      valid: 0,
      errors: 1,
      warnings: 0,
      fatalError: error instanceof RangeError
        ? (error.message.includes('characters')
            ? t('tools.redirect-generator.errors.inputTooLarge')
            : t('tools.redirect-generator.errors.tooManyRows'))
        : t('tools.redirect-generator.errors.invalidInput'),
    };
  }
});

const outputError = computed(() => {
  if (!analysis.value || !analysis.value.valid) {
    return '';
  }
  try {
    generateRedirectOutput(analysis.value, format.value, status.value, {
      origin: origin.value,
      preserveQueryString: preserveQueryString.value,
    });
    return '';
  }
  catch (error) {
    return error instanceof Error && error.message.includes('site origin')
      ? t('tools.redirect-generator.errors.originRequired')
      : t('tools.redirect-generator.errors.outputFailed');
  }
});

const output = computed(() => {
  if (!analysis.value || analysis.value.valid === 0 || outputError.value) {
    return '';
  }
  try {
    return generateRedirectOutput(analysis.value, format.value, status.value, {
      origin: origin.value,
      preserveQueryString: preserveQueryString.value,
    });
  }
  catch {
    return '';
  }
});

const formatOptions = computed(() => [
  { label: t('tools.redirect-generator.formats.apache'), value: 'apache' },
  { label: t('tools.redirect-generator.formats.nginx'), value: 'nginx' },
  { label: t('tools.redirect-generator.formats.cloudflare'), value: 'cloudflare' },
]);

const statusOptions = computed(() => [
  { label: `301 — ${t('tools.redirect-generator.status.permanent')}`, value: '301' },
  { label: `302 — ${t('tools.redirect-generator.status.temporary')}`, value: '302' },
  { label: `307 — ${t('tools.redirect-generator.status.temporaryMethod')}`, value: '307' },
  { label: `308 — ${t('tools.redirect-generator.status.permanentMethod')}`, value: '308' },
]);

const outputLanguage = computed(() => format.value === 'cloudflare' ? 'csv' : 'txt');
const { copy } = useCopy({ source: output, text: t('tools.redirect-generator.copied') });
const { download } = useDownloadTextFile({
  source: output,
  filename: computed(() => `redirect-rules-${format.value}`),
  language: outputLanguage,
});

function issueMessage(issue: RedirectIssue): string {
  const messages: Record<RedirectIssue['code'], string> = {
    'parse-error': t('tools.redirect-generator.errors.parseRow'),
    'invalid-source': t('tools.redirect-generator.errors.invalidSource'),
    'invalid-target': t('tools.redirect-generator.errors.invalidTarget'),
    'duplicate-source': t('tools.redirect-generator.errors.duplicateSource'),
    'self-redirect': t('tools.redirect-generator.errors.selfRedirect'),
    'redirect-chain': t('tools.redirect-generator.errors.redirectChain'),
    'redirect-loop': t('tools.redirect-generator.errors.redirectLoop'),
  };
  return messages[issue.code];
}

function loadSample() {
  input.value = sample;
  importError.value = '';
}

function clearInput() {
  input.value = '';
  importError.value = '';
}

async function importFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  try {
    input.value = await file.text();
    importError.value = '';
  }
  catch {
    importError.value = t('tools.redirect-generator.errors.fileRead');
  }
  finally {
    target.value = '';
  }
}
</script>

<template>
  <div>
    <c-card data-test-id="redirect-generator" :title="t('tools.redirect-generator.cardTitle')" mb-5>
      <p mb-3 op-70>
        {{ t('tools.redirect-generator.intro') }}
      </p>

      <n-input
        v-model:value="input"
        type="textarea"
        :autosize="{ minRows: 9, maxRows: 22 }"
        :placeholder="t('tools.redirect-generator.inputPlaceholder')"
        data-test-id="redirect-mappings"
        spellcheck="false"
        font-mono
      />

      <div flex flex-wrap items-center gap-2 mt-3>
        <c-button size="small" @click="loadSample">
          {{ t('tools.redirect-generator.loadSample') }}
        </c-button>
        <c-button size="small" @click="clearInput">
          {{ t('tools.redirect-generator.clear') }}
        </c-button>
        <label class="file-import">
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            data-test-id="redirect-file-import"
            @change="importFile"
          >
          <span>{{ t('tools.redirect-generator.importCsv') }}</span>
        </label>
      </div>

      <c-alert v-if="importError" mt-3 type="error">
        {{ importError }}
      </c-alert>

      <div class="settings-grid" mt-5>
        <div>
          <div mb-1 text-sm font-medium>{{ t('tools.redirect-generator.outputFormat') }}</div>
          <n-select v-model:value="format" :options="formatOptions" data-test-id="redirect-format" />
        </div>
        <div>
          <div mb-1 text-sm font-medium>{{ t('tools.redirect-generator.statusCode') }}</div>
          <n-select v-model:value="status" :options="statusOptions" data-test-id="redirect-status" />
        </div>
      </div>

      <div v-if="format === 'cloudflare'" mt-4>
        <label for="redirect-origin" block text-sm font-medium mb-1>
          {{ t('tools.redirect-generator.siteOrigin') }}
        </label>
        <n-input
          id="redirect-origin"
          v-model:value="origin"
          placeholder="https://example.com"
          data-test-id="redirect-origin-input"
        />
        <n-checkbox v-model:checked="preserveQueryString" mt-3>
          {{ t('tools.redirect-generator.preserveQueryString') }}
        </n-checkbox>
        <p mt-1 text-xs op-60>
          {{ t('tools.redirect-generator.cloudflareNote') }}
        </p>
      </div>

      <div v-if="analysis" mt-5 data-test-id="redirect-analysis">
        <div class="summary-grid" mb-3>
          <div class="summary-item">
            <strong>{{ analysis.total }}</strong>
            <span>{{ t('tools.redirect-generator.summary.total') }}</span>
          </div>
          <div class="summary-item">
            <strong>{{ analysis.valid }}</strong>
            <span>{{ t('tools.redirect-generator.summary.ready') }}</span>
          </div>
          <div class="summary-item">
            <strong>{{ analysis.errors }}</strong>
            <span>{{ t('tools.redirect-generator.summary.errors') }}</span>
          </div>
          <div class="summary-item">
            <strong>{{ analysis.warnings }}</strong>
            <span>{{ t('tools.redirect-generator.summary.warnings') }}</span>
          </div>
        </div>

        <c-alert v-if="'fatalError' in analysis" type="error" data-test-id="redirect-fatal-error">
          {{ analysis.fatalError }}
        </c-alert>

        <div v-for="row of analysis.rows.filter(item => item.issues.length)" :key="row.line" class="issue-row">
          <div flex items-center justify-between gap-2>
            <strong>{{ t('tools.redirect-generator.line', { line: row.line }) }}</strong>
            <n-tag
              v-if="row.issues.some(issue => issue.severity === 'error')"
              type="error"
              size="small"
            >
              {{ t('tools.redirect-generator.invalid') }}
            </n-tag>
            <n-tag v-else type="warning" size="small">
              {{ t('tools.redirect-generator.review') }}
            </n-tag>
          </div>
          <div mt-1 class="issue-path">{{ row.source || '—' }} → {{ row.target || '—' }}</div>
          <p v-for="issue of row.issues" :key="issue.code" mt-1 text-sm op-75>
            {{ issueMessage(issue) }}
          </p>
        </div>
      </div>
    </c-card>

    <c-card v-if="output || outputError" :title="t('tools.redirect-generator.outputTitle')" data-test-id="redirect-output-card">
      <c-alert v-if="outputError" type="warning" mb-3>
        {{ outputError }}
      </c-alert>
      <n-input
        v-if="output"
        :value="output"
        type="textarea"
        readonly
        :autosize="{ minRows: 8, maxRows: 24 }"
        data-test-id="redirect-output"
        spellcheck="false"
        font-mono
      />
      <div flex flex-wrap gap-2 mt-3>
        <c-button :disabled="!output" @click="copy()">
          {{ t('tools.redirect-generator.copy') }}
        </c-button>
        <c-button :disabled="!output" @click="download()">
          {{ t('tools.redirect-generator.download') }}
        </c-button>
      </div>
    </c-card>

    <c-alert v-else-if="!analysis" type="info">
      {{ t('tools.redirect-generator.emptyState') }}
    </c-alert>

    <div v-if="analysis && analysis.valid > 0" mt-4 text-xs op-60>
      {{ t('tools.redirect-generator.safetyNote') }}
    </div>
  </div>
</template>

<style scoped lang="less">
.settings-grid,
.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);

  strong {
    font-size: 22px;
    line-height: 1.2;
  }

  span {
    color: var(--dd-text-soft);
    font-size: 12px;
  }
}

.issue-row {
  padding: 10px 12px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);

  & + .issue-row {
    margin-top: 8px;
  }
}

.issue-path {
  overflow-wrap: anywhere;
  font-family: var(--dd-font-mono);
  font-size: 12px;
}

.file-import {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
  cursor: pointer;
  font-size: 13px;

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }
}
</style>
