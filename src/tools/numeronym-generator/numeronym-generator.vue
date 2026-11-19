<script setup lang="ts">
import { ESTABLISHED_NUMERONYMS, evaluate } from './numeronym-generator.service';

const word = ref('');

const result = computed(() => evaluate(word.value));
const batchResults = computed(() => word.value
  .split(/\r?\n/)
  .map(input => input.trim())
  .filter(Boolean)
  .map(input => ({ input, result: evaluate(input) })));
const isBatch = computed(() => batchResults.value.length > 1);
const batchOutput = computed(() => batchResults.value
  .map(({ result }) => result.mode === 'encode'
    ? result.output
    : result.mode === 'decode'
      ? (result.matches ?? []).join(' / ')
      : '')
  .filter(Boolean)
  .join('\n'));
const dictionaryKeys = Object.keys(ESTABLISHED_NUMERONYMS);

function batchResultLabel(item: (typeof batchResults.value)[number]): string {
  if (item.result.mode === 'encode') return item.result.output;
  if (item.result.mode === 'decode') return (item.result.matches ?? []).join(' / ');
  return 'No established match';
}
</script>

<template>
  <div flex flex-col items-center gap-4>
    <n-input
      v-model:value="word"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 8 }"
      placeholder="Enter one word or known numeronym per line. Multiple lines are supported."
      data-test-id="word-input"
    />

    <c-card v-if="isBatch" w-full max-w-600px data-test-id="numeronym-batch">
      <div v-for="item in batchResults" :key="item.input" flex justify-between items-center gap-3 py-1>
        <span font-mono>{{ item.input }}</span>
        <span opacity-60>→</span>
        <span text-right>{{ batchResultLabel(item) }}</span>
      </div>
      <div mt-3>
        <n-input :value="batchOutput" type="textarea" readonly data-test-id="batch-numeronyms" />
        <input-copyable :value="batchOutput" readonly placeholder="Copy all generated results" test-id="batch-copy" />
      </div>
    </c-card>

    <!-- encode 方向：保持既有单词输入 → 输出契约 -->
    <template v-else-if="result.mode === 'encode'">
      <icon-mdi-arrow-down text-30px />
      <input-copyable :value="result.output" size="large" readonly placeholder="Your numeronym will be here, e.g. 'i18n'" test-id="numeronym" />
    </template>

    <!-- decode 方向：词典命中，多候选必须并列呈现，不伪装唯一答案 -->
    <c-card
      v-else-if="result.mode === 'decode'"
      :title="result.ambiguous ? 'Likely meanings' : 'Meaning'"
      w-full
      max-w-600px
      data-test-id="numeronym-meaning"
    >
      <div v-for="m in result.matches" :key="m" data-test-id="meaning-row" flex justify-between items-center>
        <span font-mono>{{ word.trim().toLowerCase() }}</span>
        <span opacity-60>=</span>
        <span font-weight-600>{{ m }}</span>
      </div>
      <div v-if="result.ambiguous" mt-2 text-sm opacity-70 data-test-id="ambiguous-note">
        This abbreviation is used for more than one term — both readings are listed; the intended one depends on your context.
      </div>
    </c-card>

    <!-- invalid：未匹配时把词典边界摊给用户看，绝不现场编造释义 -->
    <c-alert v-else-if="word.trim() !== '' && result.reason === 'not-in-dictionary'" type="warning" w-full max-w-600px data-test-id="not-in-dict">
      <div>
        "<strong>{{ word.trim() }}</strong>" looks like a numeronym, but look-up only covers a fixed dictionary of established ones — nothing was invented for it.
      </div>
      <div mt-2 text-sm>
        Supported look-ups: <span v-for="(k, i) in dictionaryKeys" :key="k"><code>{{ k }}</code><span v-if="i < dictionaryKeys.length - 1">, </span></span>.
        Any plain English word still converts normally (e.g. type "internationalization").
      </div>
    </c-alert>
    <c-alert v-else-if="word.trim() !== '' && result.reason === 'mixed'" w-full max-w-600px data-test-id="mixed-input">
      Enter one plain English word or one established short form per line.
    </c-alert>
  </div>
</template>