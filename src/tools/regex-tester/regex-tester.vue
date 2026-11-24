<script setup lang="ts">
import { render } from '@regexper/render';
import type { ShadowRootExpose } from 'vue-shadow-dom';
import { REGEX_PRESETS, type RegexEvaluation, type RegexMatch, type RegexTestCase, type RegexTestCaseResult } from './regex-tester.service';
import { useValidation } from '@/composable/validation';
import { useQueryParamOrStorage } from '@/composable/queryParams';

const regex = useQueryParamOrStorage({ name: 'regex', storageName: 'regex-tester:regex', defaultValue: '' });
const text = ref('');
const replacement = ref('');
const selectedPreset = ref('');
const presetOptions = REGEX_PRESETS.map(preset => ({ label: preset.label, value: preset.pattern }));
const global = ref(true);
const ignoreCase = ref(false);
const multiline = ref(false);
const dotAll = ref(true);
const unicode = ref(true);
const unicodeSets = ref(false);
const visualizerSVG = ref<ShadowRootExpose>();

const regexValidation = useValidation({
  source: regex,
  rules: [
    {
      message: 'Invalid regex: {0}',
      validator: value => new RegExp(value),
      getErrorMessage: (value) => {
        const _ = new RegExp(value);
        return '';
      },
    },
  ],
});

watch(selectedPreset, (value) => {
  const preset = REGEX_PRESETS.find(item => item.pattern === value);
  if (!preset) {
    return;
  }
  regex.value = preset.pattern;
  global.value = preset.flags.includes('g');
  ignoreCase.value = preset.flags.includes('i');
  multiline.value = preset.flags.includes('m');
  dotAll.value = preset.flags.includes('s');
  unicode.value = preset.flags.includes('u');
  unicodeSets.value = preset.flags.includes('v');
  selectedPreset.value = '';
});

const flags = computed(() => {
  let value = 'd';
  if (global.value) {
    value += 'g';
  }
  if (ignoreCase.value) {
    value += 'i';
  }
  if (multiline.value) {
    value += 'm';
  }
  if (dotAll.value) {
    value += 's';
  }
  if (unicode.value) {
    value += 'u';
  }
  else if (unicodeSets.value) {
    value += 'v';
  }
  return value;
});

const results = ref<RegexMatch[]>([]);
const testCases = ref<RegexTestCase[]>([]);
const testCaseResults = ref<RegexTestCaseResult[]>([]);
let nextTestCaseId = 1;

function addTestCase() {
  testCases.value.push({ id: `case-${nextTestCaseId++}`, name: `Test case ${nextTestCaseId - 1}`, text: '', shouldMatch: true });
  scheduleEvaluation();
}

function removeTestCase(id: string) {
  testCases.value = testCases.value.filter(item => item.id !== id);
  scheduleEvaluation();
}
const replacementPreview = ref('');
const sample = ref('');
const evaluationError = ref('');
const evaluationState = ref<'idle' | 'running' | 'done' | 'error' | 'timeout'>('idle');
const TIMEOUT_MS = 300;
const DEBOUNCE_MS = 100;

let activeWorker: Worker | null = null;
let debounceTimer: number | undefined;
let timeoutTimer: number | undefined;
let requestId = 0;

interface RegexWorkerResponse {
  id: number
  result?: RegexEvaluation
  error?: string
}

function terminateWorker() {
  if (timeoutTimer !== undefined) {
    window.clearTimeout(timeoutTimer);
    timeoutTimer = undefined;
  }
  activeWorker?.terminate();
  activeWorker = null;
}

function runEvaluation(id: number) {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./regex-tester.worker.ts', import.meta.url), { type: 'module' });
    activeWorker = worker;
  }
  catch (error) {
    evaluationError.value = error instanceof Error ? error.message : String(error);
    evaluationState.value = 'error';
    return;
  }

  worker.onmessage = (event: MessageEvent<RegexWorkerResponse>) => {
    if (id !== requestId || event.data.id !== id) {
      return;
    }
    terminateWorker();
    if (event.data.error) {
      evaluationError.value = event.data.error;
      evaluationState.value = 'error';
      return;
    }
    results.value = event.data.result?.results ?? [];
    replacementPreview.value = event.data.result?.replacementPreview ?? '';
    sample.value = event.data.result?.sample ?? '';
    testCaseResults.value = event.data.testCaseResults ?? [];
    evaluationError.value = '';
    evaluationState.value = 'done';
  };

  worker.onerror = (event) => {
    if (id !== requestId) {
      return;
    }
    terminateWorker();
    evaluationError.value = event.message || 'Regex worker failed';
    evaluationState.value = 'error';
  };

  timeoutTimer = window.setTimeout(() => {
    if (id !== requestId) {
      return;
    }
    terminateWorker();
    evaluationError.value = `Timed out after ${TIMEOUT_MS}ms. The worker was terminated; simplify the pattern or reduce the input.`;
    evaluationState.value = 'timeout';
  }, TIMEOUT_MS);

  worker.postMessage({
    id,
    regex: regex.value,
    text: text.value,
    flags: flags.value,
    replacement: replacement.value,
    testCases: testCases.value,
  });
}

function scheduleEvaluation() {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
    debounceTimer = undefined;
  }
  terminateWorker();
  const id = ++requestId;
  evaluationError.value = '';
  results.value = [];
  replacementPreview.value = '';
  sample.value = '';
  testCaseResults.value = [];
  evaluationState.value = 'running';
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    runEvaluation(id);
  }, DEBOUNCE_MS);
}

watch(
  [regex, text, replacement, global, ignoreCase, multiline, dotAll, unicode, unicodeSets],
  scheduleEvaluation,
  { immediate: true },
);

onBeforeUnmount(() => {
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  terminateWorker();
});

watchEffect(
  async () => {
    const regexValue = regex.value;
    // shadow root is required:
    // @regexper/render append a <defs><style> that broke svg transparency of icons in the whole site
    const visualizer = visualizerSVG.value?.shadow_root;
    if (visualizer) {
      while (visualizer.lastChild) {
        visualizer.removeChild(visualizer.lastChild);
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      try {
        await render(regexValue, svg);
      }
      catch (_) {
      }
      visualizer.appendChild(svg);
    }
  },
);
</script>

<template>
  <div max-w-600px>
    <c-card title="Regex" mb-1>
      <c-input-text
        v-model:value="regex"
        label="Regex to test:"
        placeholder="Put the regex to test"
        multiline
        rows="3"
        :validation="regexValidation"
      />
      <c-select v-model:value="selectedPreset" :options="presetOptions" label="Verified presets:" clearable />
      <router-link target="_blank" to="/regex-memo" mb-1 mt-1>
        See Regular Expression Cheatsheet
      </router-link>
      <n-space>
        <n-checkbox v-model:checked="global">
          <span title="Global search">Global search. (<code>g</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="ignoreCase">
          <span title="Case-insensitive search">Case-insensitive search. (<code>i</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="multiline">
          <span title="Allows ^ and $ to match next to newline characters.">Multiline(<code>m</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="dotAll">
          <span title="Allows . to match newline characters.">Singleline(<code>s</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="unicode">
          <span title="Unicode; treat a pattern as a sequence of Unicode code points.">Unicode(<code>u</code>)</span>
        </n-checkbox>
        <n-checkbox v-model:checked="unicodeSets">
          <span title="An upgrade to the u mode with more Unicode features.">Unicode Sets (<code>v</code>)</span>
        </n-checkbox>
      </n-space>

      <n-divider />

      <c-input-text
        v-model:value="text"
        label="Text to match:"
        placeholder="Put the text to match"
        multiline
        rows="5"
      />
      <c-input-text
        v-model:value="replacement"
        label="Replacement:"
        placeholder="Use JavaScript replacement tokens such as $1, $&, or $<name>"
        multiline
        rows="2"
      />
      <c-alert v-if="evaluationError">
        {{ evaluationError }}
      </c-alert>
      <c-alert v-else-if="evaluationState === 'running'">
        Evaluating in an isolated worker…
      </c-alert>
    </c-card>

    <c-card title="Matches" mb-1 mt-3>
      <div v-if="evaluationState === 'done' && results.length > 0" class="relative max-w-full overflow-x-auto rounded">
        <n-table>
          <thead>
            <tr>
              <th scope="col">
                Index in text
              </th>
              <th scope="col">
                Value
              </th>
              <th scope="col">
                Captures
              </th>
              <th scope="col">
                Groups
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="match of results" :key="match.index">
              <td>{{ match.index }}</td>
              <td>{{ match.value }}</td>
              <td>
                <ul>
                  <li v-for="capture in match.captures" :key="capture.name">
                    "{{ capture.name }}" = {{ capture.value }} [{{ capture.start }} - {{ capture.end }}]
                  </li>
                </ul>
              </td>
              <td>
                <ul>
                  <li v-for="group in match.groups" :key="group.name">
                    "{{ group.name }}" = {{ group.value }} [{{ group.start }} - {{ group.end }}]
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </n-table>
      </div>
      <c-alert v-else-if="evaluationState === 'done'">
        No match
      </c-alert>
    </c-card>

    <c-card title="Replacement preview" mt-3>
      <pre class="max-w-full overflow-x-auto whitespace-pre-wrap break-all">{{ replacementPreview }}</pre>
    </c-card>

    <c-card title="Sample matching text" mt-3>
      <pre style="white-space: pre-wrap; word-break: break-all;">{{ sample }}</pre>
    </c-card>

    <c-card title="Regex Diagram" style="overflow-x: scroll;" mt-3>
      <shadow-root ref="visualizerSVG">
&#xa0;
      </shadow-root>
    </c-card>
  </div>
</template>
