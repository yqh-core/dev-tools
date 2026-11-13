<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { assessProject, toMarkdown } from './prepare-deployment.service';
import type { DeploymentReport, Gate, Severity } from './prepare-deployment.service';
import { buildDownloadFilename, downloadTextFile } from '@/composable/downloadText';
import { useCopy } from '@/composable/copy';

const message = useMessage();

const packageJson = ref('');
const lockfile = ref('');
const lockfileName = ref('');
const dockerfile = ref('');
const ciYaml = ref('');
const scannerResults = ref('');

const report = ref<DeploymentReport | null>(null);

const gateTagType: Record<Gate, 'success' | 'warning' | 'error' | 'default'> = {
  READY: 'success',
  READY_WITH_WARNINGS: 'warning',
  BLOCKED: 'error',
  NOT_ASSESSED: 'default',
};
const severityTagType: Record<Severity, 'error' | 'warning' | 'info'> = {
  blocked: 'error',
  warning: 'warning',
  info: 'info',
};

function runAssessment() {
  report.value = assessProject({
    packageJson: packageJson.value,
    lockfile: lockfile.value,
    lockfileName: lockfileName.value,
    dockerfile: dockerfile.value,
    ciYaml: ciYaml.value,
    scannerResults: scannerResults.value,
  });
}

const markdown = computed(() => report.value ? toMarkdown(report.value) : '');
const { copy } = useCopy({ source: markdown, text: 'Markdown report copied to the clipboard' });

function exportJson() {
  if (!report.value) {
    return;
  }
  const ok = downloadTextFile({
    content: JSON.stringify(report.value, null, 2),
    filename: buildDownloadFilename('prepare-deployment-report', 'json'),
    mimeType: 'application/json',
  });
  if (!ok) {
    message.warning('Nothing to export yet.');
  }
}

function exportMarkdown() {
  if (!report.value) {
    return;
  }
  const ok = downloadTextFile({
    content: markdown.value,
    filename: buildDownloadFilename('prepare-deployment-report', 'md'),
    mimeType: 'text/markdown',
  });
  if (!ok) {
    message.warning('Nothing to export yet.');
  }
}

function loadSample() {
  packageJson.value = JSON.stringify({
    name: 'demo-service',
    version: '1.0.0',
    engines: { node: '>=20' },
    scripts: { build: 'vite build', test: 'vitest run' },
  }, null, 2);
  lockfileName.value = 'package-lock.json';
  lockfile.value = '{\n  "lockfileVersion": 3,\n  "packages": {}\n}';
  dockerfile.value = 'FROM node:20.11.1-alpine\nUSER node\nHEALTHCHECK CMD wget -qO- http://localhost:3000/ || exit 1\nCMD ["node", "server.js"]';
  ciYaml.value = 'name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test';
  runAssessment();
}
</script>

<template>
  <c-card title="Project files" mb-4>
    <p class="hint" mb-3>
      Paste the text of each file (all local, nothing is uploaded). Optionally paste Trivy / Checkov / Hadolint
      JSON to feed real scanner findings into the same gate. The gate is derived from the findings:
      BLOCKED &gt; READY_WITH_WARNINGS &gt; READY; no input means NOT_ASSESSED.
    </p>
    <c-input-text
      v-model:value="packageJson"
      label="package.json"
      label-position="left"
      label-width="130px"
      raw-text
      multiline
      :rows="5"
      monospace
      placeholder="{ &quot;name&quot;: &quot;...&quot;, &quot;version&quot;: &quot;...&quot; }"
      mb-2
    />
    <div mb-2 flex gap-2>
      <c-input-text
        v-model:value="lockfileName"
        label="Lockfile name"
        label-position="left"
        label-width="130px"
        placeholder="package-lock.json / pnpm-lock.yaml / yarn.lock"
        style="flex: 0 0 320px"
      />
    </div>
    <c-input-text
      v-model:value="lockfile"
      label="Lockfile content"
      label-position="left"
      label-width="130px"
      raw-text
      multiline
      :rows="3"
      monospace
      placeholder="Paste any lockfile; presence matters more than format"
      mb-2
    />
    <c-input-text
      v-model:value="dockerfile"
      label="Dockerfile"
      label-position="left"
      label-width="130px"
      raw-text
      multiline
      :rows="4"
      monospace
      placeholder="FROM node:20-alpine ..."
      mb-2
    />
    <c-input-text
      v-model:value="ciYaml"
      label="CI workflow"
      label-position="left"
      label-width="130px"
      raw-text
      multiline
      :rows="4"
      monospace
      placeholder="GitHub Actions / GitLab CI YAML"
      mb-2
    />
    <c-input-text
      v-model:value="scannerResults"
      label="Scanner results"
      label-position="left"
      label-width="130px"
      raw-text
      multiline
      :rows="4"
      monospace
      placeholder="Optional: paste Trivy / Checkov / Hadolint JSON output — real scanner findings feed the same gate"
      mb-3
    />
    <div flex gap-2>
      <c-button data-test-id="pd-assess" @click="runAssessment">
        Assess deployment readiness
      </c-button>
      <c-button quaternary data-test-id="pd-sample" @click="loadSample">
        Load healthy sample
      </c-button>
    </div>
  </c-card>

  <c-card v-if="report" title="Release gate" data-test-id="pd-report">
    <div mb-3 flex items-center gap-3>
      <n-tag :type="gateTagType[report.gate]" size="large" data-test-id="pd-gate">
        {{ report.gate }}
      </n-tag>
      <span class="hint">
        Blocked: {{ report.summary.blocked }} · Warnings: {{ report.summary.warning }} · Info: {{ report.summary.info }}
        <template v-if="report.assessedFiles.length">
          · Assessed: {{ report.assessedFiles.join(', ') }}
        </template>
      </span>
    </div>

    <n-alert v-if="report.gate === 'NOT_ASSESSED'" type="default" mb-3>
      Provide at least one project file to assess.
    </n-alert>
    <n-alert v-else-if="report.gate === 'BLOCKED'" type="error" mb-3>
      Do not deploy: fix the blocked findings first. Each finding lists evidence and a concrete fix.
    </n-alert>
    <n-alert v-else-if="report.gate === 'READY_WITH_WARNINGS'" type="warning" mb-3>
      Deployable, but address the warnings to reach commercial-grade reproducibility and least privilege.
    </n-alert>
    <n-alert v-else type="success" mb-3>
      No blocking or warning findings in the provided files. Keep the report with the release record.
    </n-alert>

    <div v-if="report.issues.length" class="issues">
      <div v-for="i in report.issues" :key="i.id" class="issue" :data-test-id="`pd-issue-${i.id}`" mb-2>
        <div flex items-center gap-2>
          <n-tag :type="severityTagType[i.severity]" size="small">
            {{ i.severity }}
          </n-tag>
          <strong>{{ i.id }}</strong>
          <span>{{ i.title }}</span>
          <n-tag size="small" quaternary>
            {{ i.dimension }}
          </n-tag>
        </div>
        <div class="hint" mt-1>
          Evidence: <code>{{ i.evidence }}</code>
        </div>
        <div class="hint">
          Fix: {{ i.suggestion }}
        </div>
      </div>
    </div>

    <div mt-3 flex gap-2>
      <c-button data-test-id="pd-export-json" @click="exportJson">
        Export JSON report
      </c-button>
      <c-button data-test-id="pd-export-md" @click="exportMarkdown">
        Export Markdown report
      </c-button>
      <c-button quaternary @click="copy()">
        Copy Markdown
      </c-button>
    </div>
  </c-card>
</template>

<style scoped>
.hint {
  opacity: 0.75;
  font-size: 0.9em;
}
.issue code {
  word-break: break-all;
}
</style>
