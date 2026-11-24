<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { type HeaderAnalysis, analyzeResponseHeaders } from './http-headers.models';
import { httpHeaderEntries, httpMethodEntries } from './http-headers.constants';
import {
  type HarResponseEntry,
  formatHarResponseHeaders,
  parseHarResponseEntries,
} from './http-headers.har';
import { type HeaderRemediationPlatform, buildHeaderRemediation } from './http-headers.remediation';
import { useCopy } from '@/composable/copy';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const { t } = useI18n();

const SAMPLE_HEADERS = [
  'HTTP/2 200 OK',
  'content-type: text/html; charset=utf-8',
  'cache-control: public, max-age=3600',
  'content-security-policy: default-src \'self\'; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'',
  'strict-transport-security: max-age=31536000; includeSubDomains',
  'x-content-type-options: nosniff',
  'referrer-policy: strict-origin-when-cross-origin',
  'permissions-policy: camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy: same-origin',
  'cross-origin-embedder-policy: require-corp',
  'cross-origin-resource-policy: same-origin',
  'set-cookie: session=example; Secure; HttpOnly; SameSite=Lax',
].join('\n');

const harEntries = ref<HarResponseEntry[]>([]);
const selectedHarEntry = ref('');
const harImportError = ref('');
const harEntryOptions = computed(() => harEntries.value.map(entry => ({
  label: `${entry.method} ${entry.url} — ${entry.status} ${entry.statusText}`.trim(),
  value: entry.id,
})));

function applyHarEntry(id: string) {
  const entry = harEntries.value.find(item => item.id === id);
  if (entry) {
    selectedHarEntry.value = id;
    rawHeaders.value = formatHarResponseHeaders(entry);
  }
}

function selectHarEntry(id: string) {
  applyHarEntry(id);
}

async function importLocalFile(file: File) {
  harImportError.value = '';
  if (file.size > 10 * 1024 * 1024) {
    harImportError.value = t('tools.http-headers.analyzer.harTooLarge');
    return;
  }

  const content = await file.text();
  if (file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain') {
    harEntries.value = [];
    selectedHarEntry.value = '';
    rawHeaders.value = content;
    return;
  }

  try {
    const entries = parseHarResponseEntries(content);
    if (entries.length === 0) {
      harEntries.value = [];
      selectedHarEntry.value = '';
      harImportError.value = t('tools.http-headers.analyzer.harNoResponses');
      return;
    }

    harEntries.value = entries;
    applyHarEntry(entries[0].id);
  }
  catch {
    harEntries.value = [];
    selectedHarEntry.value = '';
    harImportError.value = t('tools.http-headers.analyzer.harInvalid');
  }
}

async function handleHarFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    await importLocalFile(file);
  }
  input.value = '';
}

async function handleHarDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    await importLocalFile(file);
  }
}

const rawHeaders = ref('');
const analysis = computed<HeaderAnalysis | undefined>(() => (
  rawHeaders.value.trim() ? analyzeResponseHeaders(rawHeaders.value) : undefined
));
const hasParsedHeaders = computed(() => Boolean(
  analysis.value && (
    analysis.value.parsed.statusLine
    || Object.keys(analysis.value.parsed.headers).length > 0
  ),
));
const { copy } = useCopy({ text: t('tools.http-headers.analyzer.remediation.copied') });
const remediationPlatform = ref<HeaderRemediationPlatform>('nginx');
const remediationOptions = computed(() => [
  { label: t('tools.http-headers.analyzer.remediation.platforms.nginx'), value: 'nginx' },
  { label: t('tools.http-headers.analyzer.remediation.platforms.apache'), value: 'apache' },
  { label: t('tools.http-headers.analyzer.remediation.platforms.caddy'), value: 'caddy' },
  { label: t('tools.http-headers.analyzer.remediation.platforms.vercel'), value: 'vercel' },
  { label: t('tools.http-headers.analyzer.remediation.platforms.cloudflare'), value: 'cloudflare-pages' },
]);
const remediationSnippet = computed(() => analysis.value
  ? buildHeaderRemediation(analysis.value, remediationPlatform.value)
  : '');
function copyRemediation() {
  if (remediationSnippet.value) {
    copy(remediationSnippet.value);
  }
}

function loadSample() {
  rawHeaders.value = SAMPLE_HEADERS;
}

const search = ref('');
const { searchResult } = useFuzzySearch({
  search,
  data: httpHeaderEntries,
  options: { keys: [{ name: 'name', weight: 3 }, { name: 'zh', weight: 2 }, 'dir'] },
});
const rows = computed(() => (search.value ? searchResult.value : httpHeaderEntries));

function statusType(status: string): 'success' | 'warning' | 'error' {
  if (status === 'pass') {
    return 'success';
  }
  return status === 'warn' ? 'warning' : 'error';
}

function checkTitle(id: string): string {
  const labels: Record<string, string> = {
    csp: t('tools.http-headers.analyzer.checks.csp'),
    hsts: t('tools.http-headers.analyzer.checks.hsts'),
    frame: t('tools.http-headers.analyzer.checks.frame'),
    nosniff: t('tools.http-headers.analyzer.checks.nosniff'),
    referrer: t('tools.http-headers.analyzer.checks.referrer'),
    permissions: t('tools.http-headers.analyzer.checks.permissions'),
    isolation: t('tools.http-headers.analyzer.checks.isolation'),
  };
  return labels[id] ?? id;
}

function findingTitle(title: string): string {
  if (title.startsWith('Cookie ')) {
    return t('tools.http-headers.analyzer.findings.cookie', { name: title.slice(7) });
  }
  const labels: Record<string, string> = {
    'Server information disclosure': t('tools.http-headers.analyzer.findings.serverDisclosure'),
    'Conflicting CORS credentials configuration': t('tools.http-headers.analyzer.findings.corsCredentials'),
    'Weak CSP source expressions': t('tools.http-headers.analyzer.findings.weakCsp'),
    'Broad CSP wildcard source': t('tools.http-headers.analyzer.findings.broadCsp'),
    'X-Robots-Tag prevents indexing': t('tools.http-headers.analyzer.findings.noindex'),
    'No Cache-Control response policy': t('tools.http-headers.analyzer.findings.noCacheControl'),
    'Redirect response': t('tools.http-headers.analyzer.findings.redirect'),
    'HTTP error response': t('tools.http-headers.analyzer.findings.httpError'),
    'Multiple response blocks detected': t('tools.http-headers.analyzer.findings.multipleBlocks'),
  };
  return labels[title] ?? title;
}

function severityLabel(severity: string): string {
  const labels: Record<string, string> = {
    high: t('tools.http-headers.analyzer.severity.high'),
    medium: t('tools.http-headers.analyzer.severity.medium'),
    info: t('tools.http-headers.analyzer.severity.info'),
  };
  return labels[severity] ?? severity;
}

function directionLabel(direction: string): string {
  const labels: Record<string, string> = {
    'Request': t('tools.http-headers.analyzer.direction.request'),
    'Response': t('tools.http-headers.analyzer.direction.response'),
    'Request and response': t('tools.http-headers.analyzer.direction.both'),
  };
  return labels[direction] ?? direction;
}
</script>

<template>
  <div>
    <c-card :title="t('tools.http-headers.analyzer.cardTitle')" data-test-id="header-analyzer" mb-6>
      <p mb-3 op-70>
        {{ t('tools.http-headers.analyzer.intro') }}
      </p>

      <div mt-3 flex flex-wrap items-center gap-2>
        <label class="har-upload-label">
          {{ t('tools.http-headers.analyzer.harImportLabel') }}
          <input
            type="file"
            accept=".har,.txt,application/json,text/plain"
            data-test-id="har-file-input"
            :aria-label="t('tools.http-headers.analyzer.harImportLabel')"
            @change="handleHarFileChange"
          >
        </label>
        <span text-xs op-60>
          {{ t('tools.http-headers.analyzer.harPrivacyNote') }}
        </span>
      </div>
      <div
        class="har-drop-zone"
        data-test-id="har-drop-zone"
        @dragover.prevent
        @drop.prevent="handleHarDrop"
      >
        {{ t('tools.http-headers.analyzer.harDropNote') }}
      </div>
      <c-alert v-if="harImportError" mt-3 type="warning" data-test-id="har-import-error">
        {{ harImportError }}
      </c-alert>
      <n-select
        v-if="harEntries.length > 1"
        :value="selectedHarEntry"
        :options="harEntryOptions"
        data-test-id="har-entry-select"
        mt-3
        @update:value="selectHarEntry"
      />

      <n-input
        v-model:value="rawHeaders"
        type="textarea"
        :autosize="{ minRows: 10, maxRows: 24 }"
        :placeholder="t('tools.http-headers.analyzer.inputPlaceholder')"
        data-test-id="raw-response-headers"
        spellcheck="false"
        font-mono
      />

      <div flex flex-wrap items-center gap-2 mt-3>
        <c-button size="small" @click="loadSample">
          {{ t('tools.http-headers.analyzer.loadSample') }}
        </c-button>
        <c-button size="small" @click="rawHeaders = ''">
          {{ t('tools.http-headers.analyzer.clear') }}
        </c-button>
        <span text-xs op-60>
          {{ t('tools.http-headers.analyzer.supportsFormats') }}
        </span>
      </div>

      <div v-if="analysis && hasParsedHeaders" mt-5 data-test-id="analysis-results">
        <div class="score-panel" mb-4>
          <div>
            <div text-xs op-65>
              {{ t('tools.http-headers.analyzer.scoreLabel') }}
            </div>
            <div class="score-value" data-test-id="coverage-score">
              {{ analysis.score }}<span class="score-total">/100</span>
              <n-tag :type="analysis.grade === 'A' ? 'success' : analysis.grade === 'B' ? 'info' : analysis.grade === 'C' ? 'warning' : 'error'" round>
                {{ analysis.grade }}
              </n-tag>
            </div>
            <div text-xs op-65>
              {{ analysis.parsed.statusLine || t('tools.http-headers.analyzer.statusLineMissing') }}
              <span v-if="analysis.parsed.responseCount > 1">
                · {{ t('tools.http-headers.analyzer.responseBlocks', { count: analysis.parsed.responseCount }) }}
              </span>
            </div>
          </div>
          <n-progress
            type="line"
            :percentage="analysis.score"
            :show-indicator="false"
            :height="8"
            mt-2
          />
          <p text-xs op-65 mt-2>
            {{ t('tools.http-headers.analyzer.scoreDisclaimer') }}
          </p>
        </div>

        <n-h3 mb-2>
          {{ t('tools.http-headers.analyzer.checksTitle') }}
        </n-h3>
        <div class="checks-grid" data-test-id="header-checks">
          <div v-for="item of analysis.checks" :key="item.id" class="check-row">
            <div flex items-center justify-between gap-2>
              <strong>{{ checkTitle(item.id) }}</strong>
              <n-tag :type="statusType(item.status)" size="small">
                {{ item.earned }}/{{ item.points }}
              </n-tag>
            </div>
            <div text-sm op-75 mt-1>
              {{ item.detail }}
            </div>
            <div text-sm mt-1>
              <strong>{{ t('tools.http-headers.analyzer.nextStep') }}:</strong> {{ item.recommendation }}
            </div>
          </div>
        </div>

        <div v-if="analysis.findings.length" mt-5 data-test-id="header-findings">
          <n-h3 mb-2>
            {{ t('tools.http-headers.analyzer.otherFindings') }}
          </n-h3>
          <div v-for="(finding, index) of analysis.findings" :key="index" class="finding-row">
            <n-tag :type="finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'info'" size="small">
              {{ severityLabel(finding.severity) }}
            </n-tag>
            <strong ml-2>{{ findingTitle(finding.title) }}</strong>
            <p text-sm op-75 mt-1>
              {{ finding.detail }}
            </p>
          </div>
        </div>

        <div mt-5 data-test-id="header-remediation">
          <n-h3 mb-2>
            {{ t('tools.http-headers.analyzer.remediation.title') }}
          </n-h3>
          <p text-sm op-70 mb-3>
            {{ t('tools.http-headers.analyzer.remediation.intro') }}
          </p>
          <div flex flex-wrap items-center gap-2 mb-3>
            <n-select
              v-model:value="remediationPlatform"
              data-test-id="remediation-platform"
              :options="remediationOptions"
              w-full
              max-w-260px
            />
            <c-button size="small" @click="copyRemediation">
              {{ t('tools.http-headers.analyzer.remediation.copy') }}
            </c-button>
          </div>
          <pre class="remediation-code" data-test-id="remediation-snippet"><code>{{ remediationSnippet }}</code></pre>
          <c-alert mt-3 type="warning">
            {{ t('tools.http-headers.analyzer.remediation.caution') }}
          </c-alert>
        </div>

        <div v-if="analysis.cspDirectives.length" mt-5 data-test-id="csp-directives">
          <n-h3 mb-2>
            {{ t('tools.http-headers.analyzer.parsedCsp') }}
          </n-h3>
          <div v-for="item of analysis.cspDirectives" :key="item.name" class="directive-row">
            <code>{{ item.name }}</code>
            <span>{{ item.value || t('tools.http-headers.analyzer.noValue') }}</span>
          </div>
        </div>
      </div>

      <c-alert v-else-if="rawHeaders.trim()" mt-4 type="warning" data-test-id="parse-empty">
        {{ t('tools.http-headers.analyzer.parseEmpty') }}
        <code>Header-Name: value</code>.
      </c-alert>
    </c-card>

    <n-h3 mb-2>
      {{ t('tools.http-headers.analyzer.referenceTitle') }}
    </n-h3>
    <c-input-text
      v-model:value="search"
      :placeholder="t('tools.http-headers.analyzer.searchPlaceholder')"
      autofocus
      raw-text
      clearable
      mb-4
    />

    <div mb-2 text-13px op-60>
      {{ t('tools.http-headers.analyzer.entriesCount', { count: rows.length }) }}
    </div>

    <c-card v-for="item of rows" :key="item.name" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.name }}</span>
        <span b-rd-3px bg-gray-2 px-1 text-13px op-60>{{ directionLabel(item.dir) }}</span>
      </div>
      <div mt-1 op-70>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      {{ t('tools.http-headers.analyzer.noMatches') }}
    </c-alert>

    <n-h3 mb-2 mt-8>
      {{ t('tools.http-headers.analyzer.methodsTitle') }}
    </n-h3>
    <div mb-2 text-13px op-60>
      {{ t('tools.http-headers.analyzer.methodsIntro') }}
    </div>
    <div class="methods-table" mb-2>
      <div class="methods-row methods-head">
        <span>{{ t('tools.http-headers.analyzer.method') }}</span>
        <span>{{ t('tools.http-headers.analyzer.safe') }}</span>
        <span>{{ t('tools.http-headers.analyzer.idempotent') }}</span>
        <span>{{ t('tools.http-headers.analyzer.description') }}</span>
      </div>
      <div v-for="m of httpMethodEntries" :key="m.name" class="methods-row">
        <span class="methods-name">{{ m.name }}</span>
        <span>{{ m.safe === 'Yes' ? t('tools.http-headers.analyzer.yes') : t('tools.http-headers.analyzer.no') }}</span>
        <span>{{ m.idempotent === 'Yes' ? t('tools.http-headers.analyzer.yes') : t('tools.http-headers.analyzer.no') }}</span>
        <span class="methods-desc">{{ m.zh }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.score-panel {
  padding: 14px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
  background: var(--dd-surface-2);
}

.score-value {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 3px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

.score-total {
  margin-left: -8px;
  color: var(--dd-text-soft);
  font-size: 15px;
  font-weight: 500;
}

.checks-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr));
}

.check-row,
.finding-row {
  padding: 12px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
}

.directive-row {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--dd-border);
  font-size: 13px;
  grid-template-columns: 170px minmax(0, 1fr);
  overflow-wrap: anywhere;
}

.methods-table {
  overflow-x: auto;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
}

.methods-row {
  display: grid;
  gap: 10px;
  align-items: baseline;
  padding: 9px 12px;
  border-bottom: 1px solid var(--dd-border);
  font-size: 13px;
  line-height: 1.55;
  grid-template-columns: 78px 52px 92px minmax(220px, 1fr);

  &:last-child {
    border-bottom: none;
  }
}

.methods-head {
  background: var(--dd-surface-2);
  color: var(--dd-text-soft);
  font-weight: 600;
}

.methods-name {
  font-family: var(--dd-font-mono);
  font-weight: 700;
}

.methods-desc {
  color: var(--dd-text-soft);
}

.har-drop-zone {
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--dd-border);
  border-radius: var(--dd-radius);
  color: var(--dd-text-soft);
  font-size: 12px;
  text-align: center;
}

.har-upload-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.har-upload-label input {
  max-width: 100%;
  font-size: 12px;
  font-weight: 400;
}

.remediation-code {
  max-height: 280px;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
  background: var(--dd-surface-2);
  font-family: var(--dd-font-mono);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
}
</style>
