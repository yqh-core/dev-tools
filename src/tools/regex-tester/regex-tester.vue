<script setup lang="ts">
import { render } from '@regexper/render';
import type { ShadowRootExpose } from 'vue-shadow-dom';
import {
  REGEX_PRESETS,
  type RegexEvaluation,
  type RegexMatch,
  type RegexTestCase,
  type RegexTestCaseResult,
  explainRegexFlags,
  explainRegexPattern,
} from './regex-tester.service';
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

const patternExplanation = computed(() => explainRegexPattern(regex.value, flags.value));
const flagExplanation = computed(() => explainRegexFlags(flags.value));

const results = ref<RegexMatch[]>([]);
const testCases = ref<RegexTestCase[]>([]);
const testCaseResults = ref<RegexTestCaseResult[]>([]);
let nextTestCaseId = 1;

function addTestCase() {
  testCases.value.push({ id: `case-${nextTestCaseId++}`, name: `Test case ${nextTestCaseId - 1}`, text: '', shouldMatch: true });
}

function removeTestCase(id: string) {
  testCases.value = testCases.value.filter(item => item.id !== id);
}

function moveTestCase(id: string, offset: -1 | 1) {
  const currentIndex = testCases.value.findIndex(item => item.id === id);
  const targetIndex = currentIndex + offset;
  const item = testCases.value[currentIndex];
  if (!item || targetIndex < 0 || targetIndex >= testCases.value.length) {
    return;
  }

  const reordered = [...testCases.value];
  reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, item);
  testCases.value = reordered;
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
  testCaseResults?: RegexTestCaseResult[]
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
    // Vue reactive proxies cannot be structured-cloned by postMessage; send plain data.
    testCases: testCases.value.map(({ id, name, text, shouldMatch }) => ({ id, name, text, shouldMatch })),
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
watch(testCases, scheduleEvaluation, { deep: true });

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
        data-test-id="regex-input"
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

      <div v-if="regex" class="mt-3 rounded border p-3" data-testid="pattern-explanation">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <strong>Pattern explanation</strong>
          <span class="text-xs op-60">JavaScript RegExp · best effort</span>
        </div>
        <p class="mb-3 text-xs op-65">
          Common tokens are explained below. This is a lightweight guide, not a complete parser; syntax marked “Review” needs a manual compatibility check.
        </p>
        <div v-for="(item, index) in patternExplanation" :key="index" class="mb-2 flex flex-wrap items-start gap-2 text-sm">
          <code class="shrink-0 rounded bg-gray-100 px-1 py-0.5">{{ item.token }}</code>
          <span class="min-w-0 flex-1">{{ item.explanation }}</span>
          <span v-if="!item.recognized" class="shrink-0 text-xs font-semibold text-amber-700">Review syntax</span>
        </div>
        <div class="mt-3 border-t pt-2 text-xs">
          <strong>Active flags:</strong>
          <span v-for="flag in flagExplanation" :key="flag.flag" class="ml-2 inline-block">
            <code>{{ flag.flag }}</code> {{ flag.explanation }}
          </span>
        </div>
      </div>

      <n-divider />

      <c-input-text
        v-model:value="text"
        label="Text to match:"
        placeholder="Put the text to match"
        multiline
        rows="5"
      />
      <div class="mt-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <strong>Test cases</strong>
          <n-button size="small" @click="addTestCase">Add test case</n-button>
        </div>
        <p class="mb-2 text-sm op-70">Keep accepted and rejected examples together. Each case runs in the isolated worker.</p>
        <div v-for="(testCase, index) in testCases" :key="testCase.id" class="regex-test-case mb-2 rounded border p-2">
          <div class="mb-2 flex items-center gap-2">
            <n-input v-model:value="testCase.name" size="small" aria-label="Test case name" placeholder="Case name" />
            <n-button size="tiny" quaternary aria-label="Move test case up" :disabled="index === 0" @click="moveTestCase(testCase.id, -1)">Move up</n-button>
            <n-button size="tiny" quaternary aria-label="Move test case down" :disabled="index === testCases.length - 1" @click="moveTestCase(testCase.id, 1)">Move down</n-button>
            <n-button size="tiny" quaternary type="error" @click="removeTestCase(testCase.id)">Remove</n-button>
          </div>
          <n-input v-model:value="testCase.text" type="textarea" size="small" aria-label="Test case input" placeholder="Input text" :autosize="{ minRows: 1, maxRows: 3 }" />
          <n-checkbox v-model:checked="testCase.shouldMatch" class="mt-2">Expected to match</n-checkbox>
          <span v-if="evaluationState === 'done' && testCaseResults.find(result => result.id === testCase.id)" role="status" aria-live="polite" class="ml-2 text-sm font-semibold" :class="testCaseResults.find(result => result.id === testCase.id)?.passed ? 'text-green-600' : 'text-red-600'" :aria-label="`Test case result: ${testCaseResults.find(result => result.id === testCase.id)?.passed ? 'PASS' : 'FAIL'}`">
            {{ testCaseResults.find(result => result.id === testCase.id)?.passed ? 'PASS' : 'FAIL' }}
          </span>
          <div v-if="evaluationState === 'done' && testCaseResults.find(result => result.id === testCase.id)?.firstMatch" class="mt-2 text-sm">
            <div>
              First match: <code>{{ testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.value }}</code>
              · index {{ testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.index }}
              · range [{{ testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.index }}, {{ (testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.index ?? 0) + (testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.value.length ?? 0) }})
            </div>
            <div v-for="capture in testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.captures ?? []" :key="capture.name">
              Group {{ capture.name }}: <code>{{ capture.value }}</code> [{{ capture.start }}–{{ capture.end }}]
            </div>
            <div v-for="group in testCaseResults.find(result => result.id === testCase.id)?.firstMatch?.groups ?? []" :key="group.name">
              Named group {{ group.name }}: <code>{{ group.value }}</code> [{{ group.start }}–{{ group.end }}]
            </div>
          </div>
        </div>
        <div v-if="evaluationState === 'done' && testCases.length" class="mt-2 text-sm font-semibold" role="status" aria-live="polite">
          {{ testCaseResults.filter(item => item.passed).length }} / {{ testCaseResults.length }} test cases passed
        </div>
      </div>
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
                Source range
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
              <td>[{{ match.index }}, {{ match.index + match.value.length }})</td>
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
