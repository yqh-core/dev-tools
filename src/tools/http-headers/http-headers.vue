<script setup lang="ts">
import { type HeaderAnalysis, analyzeResponseHeaders } from './http-headers.models';
import { httpHeaderEntries, httpMethodEntries } from './http-headers.constants';
import { useFuzzySearch } from '@/composable/fuzzySearch';

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

const rawHeaders = ref('');
const analysis = computed<HeaderAnalysis | undefined>(() => (
  rawHeaders.value.trim() ? analyzeResponseHeaders(rawHeaders.value) : undefined
));
const hasParsedHeaders = computed(() => Boolean(
  analysis.value && Object.keys(analysis.value.parsed.headers).length > 0,
));

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
</script>

<template>
  <div>
    <c-card title="HTTP response header analyzer" data-test-id="header-analyzer" mb-6>
      <p mb-3 op-70>
        Paste response headers from curl or browser DevTools. Parsing and checks run locally in this tab;
        the pasted headers are not uploaded.
      </p>

      <n-input
        v-model:value="rawHeaders"
        type="textarea"
        :autosize="{ minRows: 10, maxRows: 24 }"
        placeholder="Paste curl -I / -i output or raw Response Headers here…"
        data-test-id="raw-response-headers"
        spellcheck="false"
        font-mono
      />

      <div flex flex-wrap items-center gap-2 mt-3>
        <c-button size="small" @click="loadSample">
          Load sample
        </c-button>
        <c-button size="small" @click="rawHeaders = ''">
          Clear
        </c-button>
        <span text-xs op-60>
          Supports repeated headers, curl -v response lines and redirect chains from curl -L.
        </span>
      </div>

      <div v-if="analysis && hasParsedHeaders" mt-5 data-test-id="analysis-results">
        <div class="score-panel" mb-4>
          <div>
            <div text-xs op-65>
              Header coverage score
            </div>
            <div class="score-value" data-test-id="coverage-score">
              {{ analysis.score }}<span class="score-total">/100</span>
              <n-tag :type="analysis.grade === 'A' ? 'success' : analysis.grade === 'B' ? 'info' : analysis.grade === 'C' ? 'warning' : 'error'" round>
                {{ analysis.grade }}
              </n-tag>
            </div>
            <div text-xs op-65>
              {{ analysis.parsed.statusLine || 'Status line not included' }}
              <span v-if="analysis.parsed.responseCount > 1">
                · {{ analysis.parsed.responseCount }} response blocks; final block scored
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
            This is a transparent header-coverage checklist, not an OWASP rating, penetration test or guarantee that an application is secure.
            Some policies are optional or can break embeds and third-party resources.
          </p>
        </div>

        <n-h3 mb-2>
          Security header checks
        </n-h3>
        <div class="checks-grid" data-test-id="header-checks">
          <div v-for="item of analysis.checks" :key="item.id" class="check-row">
            <div flex items-center justify-between gap-2>
              <strong>{{ item.title }}</strong>
              <n-tag :type="statusType(item.status)" size="small">
                {{ item.earned }}/{{ item.points }}
              </n-tag>
            </div>
            <div text-sm op-75 mt-1>
              {{ item.detail }}
            </div>
            <div text-sm mt-1>
              <strong>Next step:</strong> {{ item.recommendation }}
            </div>
          </div>
        </div>

        <div v-if="analysis.findings.length" mt-5 data-test-id="header-findings">
          <n-h3 mb-2>
            Other findings
          </n-h3>
          <div v-for="(finding, index) of analysis.findings" :key="index" class="finding-row">
            <n-tag :type="finding.severity === 'high' ? 'error' : finding.severity === 'medium' ? 'warning' : 'info'" size="small">
              {{ finding.severity }}
            </n-tag>
            <strong ml-2>{{ finding.title }}</strong>
            <p text-sm op-75 mt-1>
              {{ finding.detail }}
            </p>
          </div>
        </div>

        <div v-if="analysis.cspDirectives.length" mt-5 data-test-id="csp-directives">
          <n-h3 mb-2>
            Parsed Content-Security-Policy
          </n-h3>
          <div v-for="item of analysis.cspDirectives" :key="item.name" class="directive-row">
            <code>{{ item.name }}</code>
            <span>{{ item.value || '(no value)' }}</span>
          </div>
        </div>
      </div>

      <c-alert v-else-if="rawHeaders.trim()" mt-4 type="warning" data-test-id="parse-empty">
        No response headers could be parsed. Paste the response header block, including lines in the form
        <code>Header-Name: value</code>.
      </c-alert>
    </c-card>

    <n-h3 mb-2>
      HTTP header reference
    </n-h3>
    <c-input-text
      v-model:value="search"
      placeholder="Search by header name, e.g. Cookie / CORS / cache…"
      autofocus
      raw-text
      clearable
      mb-4
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
</style>
