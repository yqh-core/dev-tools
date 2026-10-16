<script setup lang="ts">
type Direction = 'encode' | 'decode';

const input = useStorage('morse-code-converter:input', '');
const direction = ref<Direction>('encode');

const directionOptions: { label: string; value: Direction }[] = [
  { label: 'Text → Morse code', value: 'encode' },
  { label: 'Morse code → Text', value: 'decode' },
];

const MORSE: Record<string, string> = {
  'A': '.-',
  'B': '-...',
  'C': '-.-.',
  'D': '-..',
  'E': '.',
  'F': '..-.',
  'G': '--.',
  'H': '....',
  'I': '..',
  'J': '.---',
  'K': '-.-',
  'L': '.-..',
  'M': '--',
  'N': '-.',
  'O': '---',
  'P': '.--.',
  'Q': '--.-',
  'R': '.-.',
  'S': '...',
  'T': '-',
  'U': '..-',
  'V': '...-',
  'W': '.--',
  'X': '-..-',
  'Y': '-.--',
  'Z': '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '\'': '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  '_': '..--.-',
  '"': '.-..-.',
  '$': '...-..-',
  '@': '.--.-.',
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
    return { output: '', error: 'Invalid characters: Morse code accepts only . , - , spaces and / (word separator)' };
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
      label="Input:"
      placeholder="Type letters/digits, or Morse code such as ... --- ..."
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
      label="Direction:"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-alert v-if="result.error" type="warning" title="Invalid input">
      {{ result.error }}
    </c-alert>

    <div v-else-if="result.output" mt-1>
      <div mb-1 text-13px op-70>
        Result:
      </div>
      <TextareaCopyable :value="result.output" />
    </div>
  </div>
</template>
