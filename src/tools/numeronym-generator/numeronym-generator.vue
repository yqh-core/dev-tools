<script setup lang="ts">
import { ESTABLISHED_NUMERONYMS, evaluate } from './numeronym-generator.service';

const word = ref('');

const result = computed(() => evaluate(word.value));
const dictionaryKeys = Object.keys(ESTABLISHED_NUMERONYMS);
</script>

<template>
  <div flex flex-col items-center gap-4>
    <c-input-text
      v-model:value="word"
      placeholder="Enter a word (internationalization) or a known numeronym (k8s)"
      size="large"
      clearable
      test-id="word-input"
    />

    <!-- encode 方向：保持既有「输入 → 生成结果」布局（e2e 锁定 numeronym 输出框） -->
    <template v-if="result.mode === 'encode'">
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
      Enter a single plain word (to build a numeronym) or one of the known short forms (to look it up).
    </c-alert>
  </div>
</template>
