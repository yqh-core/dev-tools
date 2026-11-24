<script setup lang="ts">
import { httpHeaderEntries, httpMethodEntries } from './http-headers.constants';
import { analyzeResponseHeaders } from './http-headers-analyzer.models';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const search = ref('');
const rawResponseHeaders = ref('');

const sampleResponseHeaders = [
  'HTTP/2 200',
  'Strict-Transport-Security: max-age=31536000; includeSubDomains',
  "Content-Security-Policy: default-src 'self'; script-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: DENY',
  'Referrer-Policy: strict-origin-when-cross-origin',
  'Permissions-Policy: camera=(), microphone=(), geolocation=()',
].join('\n');

const responseHeaderAnalysis = computed(() => {
  if (!rawResponseHeaders.value.trim()) return undefined;
  return analyzeResponseHeaders(rawResponseHeaders.value);
});

const analysisError = computed(() => {
  const result = responseHeaderAnalysis.value;
  return result && 'error' in result ? result.error : undefined;
});

const analysis = computed(() => {
  const result = responseHeaderAnalysis.value;
  return result && !('error' in result) ? result : undefined;
});

function loadSampleHeaders() {
  rawResponseHeaders.value = sampleResponseHeaders;
}

function clearResponseHeaders() {
  rawResponseHeaders.value = '';
}

const { searchResult } = useFuzzySearch({
  search,
  data: httpHeaderEntries,
  options: { keys: [{ name: 'name', weight: 3 }, { name: 'zh', weight: 2 }, 'dir'] },
});

const rows = computed(() => (search.value ? searchResult.value : httpHeaderEntries));
</script>

<template>
  <div>
    <c-card title="Analyze HTTP response security headers" mb-6 data-test-id="response-header-analyzer">
      <p mb-2 text-sm op-70>
        Paste a raw response header block or curl -I output. The analysis runs locally in this browser; it does not fetch a URL or send the pasted header values anywhere.
      </p>
      <c-input-text
        v-model:value="rawResponseHeaders"
        label="Raw HTTP response headers"
        placeholder="HTTP/2 200&#10;Strict-Transport-Security: max-age=31536000&#10;Content-Security-Policy: default-src 'self'"
        rows="8"
        multiline
        raw-text
        test-id="http-response-headers-input"
      />
      <div flex flex-wrap gap-2 mt-3>
        <c-button size="small" @click="loadSampleHeaders">
          Load secure example
        </c-button>
        <c-button size="small" @click="clearResponseHeaders">
          Clear
        </c-button>
      </div>
      <p mt-3 text-xs op-60>
        This is a static best-practice check, not a full penetration test, browser policy evaluator or remote website scan. Review recommendations against your application and current OWASP guidance.
      </p>
      <c-alert v-if="analysisError" type="warning" mt-3 data-test-id="header-analysis-error">
        {{ analysisError }}
      </c-alert>
      <div v-else-if="analysis" mt-4 data-test-id="header-analysis">
        <div flex flex-wrap items-center justify-between gap-2 mb-3>
          <strong>Baseline coverage</strong>
          <span data-test-id="header-coverage" font-semibold>
            {{ analysis.baselinePresent }} / {{ analysis.baselineTotal }} checks present
          </span>
        </div>
        <div v-if="analysis.statusLine" mb-2 text-sm op-70>
          Response: <code>{{ analysis.statusLine }}</code>
        </div>
        <div mb-3 text-xs op-60>
          {{ analysis.headerCount }} header fields parsed
          <span v-if="analysis.malformedLines"> · {{ analysis.malformedLines }} unparsed lines</span>
        </div>
        <div v-for="check in analysis.baselineChecks" :key="check.id" border-t py-3 data-test-id="baseline-header-check">
          <div flex flex-wrap items-center justify-between gap-2>
            <strong>{{ check.label }}</strong>
            <span class="text-xs font-bold uppercase" :class="check.status === 'present' ? 'text-green-700' : check.status === 'missing' ? 'text-red-700' : 'text-amber-700'">
              {{ check.status }}
            </span>
          </div>
          <div v-if="check.value" mt-1 text-xs font-mono break-all op-80>{{ check.value }}</div>
          <p mt-1 text-sm>{{ check.detail }}</p>
          <p mt-1 text-xs op-70>Recommendation: {{ check.recommendation }}</p>
        </div>
        <div v-if="analysis.additionalFindings.length" mt-3>
          <strong block mb-2>Additional findings</strong>
          <div v-for="finding in analysis.additionalFindings" :key="finding.id" border-t py-3 data-test-id="additional-header-finding">
            <div flex flex-wrap items-center justify-between gap-2>
              <strong>{{ finding.label }}</strong>
              <span class="text-xs font-bold uppercase" :class="finding.status === 'warning' ? 'text-amber-700' : 'text-slate-500'">
                {{ finding.status }}
              </span>
            </div>
            <div v-if="finding.value" mt-1 text-xs font-mono break-all op-80>{{ finding.value }}</div>
            <p mt-1 text-sm>{{ finding.detail }}</p>
            <p mt-1 text-xs op-70>Recommendation: {{ finding.recommendation }}</p>
          </div>
        </div>
      </div>
    </c-card>

    <c-input-text
      v-model:value="search"
      placeholder="Search by header name, e.g. Cookie / CORS / cache…"

      autofocus raw-text clearable mb-6
    />

    <div mb-2 text-13px op-60>
      {{ rows.length }} entries
    </div>

    <c-card v-for="item of rows" :key="item.name" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.name }}</span>
        <span b-rd-3px bg-gray-2 px-1 text-13px op-60>{{ item.dir }}</span>
      </div>
      <div mt-1 op-70>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      No matching header. Try another keyword.
    </c-alert>

    <n-h3 mb-2 mt-8>
      HTTP request methods
    </n-h3>
    <div mb-2 text-13px op-60>
      The nine standard verbs, with whether each is safe and idempotent.
    </div>
    <div class="methods-table" mb-2>
      <div class="methods-row methods-head">
        <span>Method</span>
        <span>Safe</span>
        <span>Idempotent</span>
        <span>Description</span>
      </div>
      <div v-for="m of httpMethodEntries" :key="m.name" class="methods-row">
        <span class="methods-name">{{ m.name }}</span>
        <span>{{ m.safe }}</span>
        <span>{{ m.idempotent }}</span>
        <span class="methods-desc">{{ m.zh }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
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
</style>
