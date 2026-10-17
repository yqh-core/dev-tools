<script setup lang="ts">
import { ALPHABET_PRESETS, DEFAULT_ALPHABET, generateIds, normalizeAlphabet } from './nanoid.service';
import { computedRefreshable } from '@/composable/computedRefreshable';
import { useCopy } from '@/composable/copy';

/**
 * Nano ID 生成器：长度、数量、字符集三项都持久化在本地（useStorage），
 * 生成过程不产生任何网络请求 —— ID 只存在于这台设备上。
 */
const size = useStorage('nanoid-generator-size', 21);
const count = useStorage('nanoid-generator-count', 5);
const preset = useStorage('nanoid-generator-preset', DEFAULT_ALPHABET);
const custom = useStorage('nanoid-generator-custom', '');

// 自定义优先，但留空时回落到预设；重复字符由服务层折叠，避免出现
// 「字母表里 a 出现两次 -> 某些字符概率翻倍」这种看不出来的偏差。
const effectiveAlphabet = computed(() => {
  const raw = custom.value.trim();
  return raw ? normalizeAlphabet(raw) : preset.value;
});

const alphabetTooSmall = computed(() => effectiveAlphabet.value.length < 2);

const entropyNote = computed(() => {
  const chars = effectiveAlphabet.value.length;
  if (chars < 2) {
    return 'Needs at least two distinct characters.';
  }
  const bitsPerChar = Math.log2(chars);
  const total = Math.round(bitsPerChar * size.value);
  return `${chars} characters in the alphabet, about ${total} bits of entropy per ID.`;
});

const [ids, refreshIds] = computedRefreshable(() =>
  generateIds({ size: size.value, count: count.value, alphabet: effectiveAlphabet.value }).join('\n'),
);

const { copy } = useCopy({ source: ids, text: 'IDs copied to the clipboard' });
</script>

<template>
  <div flex flex-col justify-center gap-2>
    <div flex items-center gap-4>
      <div flex-1 flex items-center>
        <label w-75px>Length:</label>
        <n-input-number v-model:value="size" min="1" max="256" flex-1 />
      </div>
      <div flex-1 flex items-center>
        <label w-75px>Quantity:</label>
        <n-input-number v-model:value="count" min="1" max="200" flex-1 />
      </div>
    </div>

    <c-select
      v-model:value="preset"
      label="Alphabet:"
      label-width="75px"
      label-position="left"
      :options="ALPHABET_PRESETS"
    />

    <c-input-text
      v-model:value="custom"
      label="Custom alphabet:"
      label-position="left"
      label-width="145px"
      placeholder="Leave empty to use the preset above"
      raw-text
      :validation-status="alphabetTooSmall ? 'error' : undefined"
      :message="alphabetTooSmall ? 'Add at least two distinct characters' : undefined"
    />

    <div text-13px op-65>
      {{ entropyNote }}
    </div>

    <c-card v-if="!alphabetTooSmall" mt-2 flex data-test-id="nanoids">
      <pre m-0 ws-pre-wrap break-all>{{ ids }}</pre>
    </c-card>

    <div flex justify-center gap-2 mt-2>
      <c-button data-test-id="refresh" :disabled="alphabetTooSmall" @click="refreshIds()">
        Generate again
      </c-button>
      <c-button :disabled="alphabetTooSmall" @click="copy()">
        Copy
      </c-button>
    </div>
  </div>
</template>
