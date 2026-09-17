<script setup lang="ts">
type Direction = 'encode' | 'decode';

const input = useStorage('morse-code-converter:input', '');
const direction = ref<Direction>('encode');

const directionOptions: { label: string, value: Direction }[] = [
  { label: '文本 → 摩斯电码', value: 'encode' },
  { label: '摩斯电码 → 文本', value: 'decode' },
];

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '\'': '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-',
  '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const REV: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([k, v]) => [v, k]),
);

const result = computed(() => {
  const raw = input.value;
  if (!raw.trim()) {
    return { output: '', error: '' };
  }

  if (direction.value === 'encode') {
    const output = raw
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(word => [...word.toUpperCase()].map(c => MORSE[c] ?? '').filter(Boolean).join(' '))
      .join(' / ');
    return { output, error: '' };
  }

  // 解码侧：接受 | 或 ｜ 作为词间隔的写法
  const cleaned = raw.trim().replace(/[|｜]/g, '/');
  if (!/^[.\-\s/]*$/.test(cleaned)) {
    return { output: '', error: '输入含非法字符：摩斯电码只能包含 . - 空格 与 /（词间隔）' };
  }
  const output = cleaned
    .split('/')
    .map(word => word.trim().split(/\s+/).filter(Boolean).map(code => REV[code] ?? '?').join(''))
    .join(' ');
  return { output, error: '' };
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="input"
      label="输入内容："
      placeholder="输入英文字母/数字，或摩斯电码，如 ... --- ..."
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-buttons-select
      v-model:value="direction"
      :options="directionOptions"
      label="转换方向："
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-alert v-if="result.error" type="warning" title="输入有误">
      {{ result.error }}
    </c-alert>

    <div v-else-if="result.output" mt-1>
      <div mb-1 op-70 text-13px>
        转换结果：
      </div>
      <TextareaCopyable :value="result.output" />
    </div>
  </div>
</template>
