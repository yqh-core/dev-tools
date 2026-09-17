<script setup lang="ts">
type Mode = 'to-full' | 'to-half' | 'punct-to-half' | 'punct-to-full';

const input = useStorage('fullwidth-converter:input', '');
const mode = ref<Mode>('to-full');

const modeOptions: { label: string, value: Mode }[] = [
  { label: '半角 → 全角', value: 'to-full' },
  { label: '全角 → 半角', value: 'to-half' },
  { label: '全角标点 → 半角标点', value: 'punct-to-half' },
  { label: '半角标点 → 全角标点', value: 'punct-to-full' },
];

// 半角 ! 至 ~ 与全角 ！ 至 ～ 相差固定偏移 0xFEE0；全角空格 U+3000 需单独处理
const toFull = (s: string) =>
  s.replace(/[!-~]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, '\u3000');
const toHalf = (s: string) =>
  s.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');

// 「只转标点」用的对照表，两串按位一一对应
const PUNCT_FULL = '，。！？；：（）【】“”‘’《》、·—…￥';
const PUNCT_HALF = ',.!?;:()[]""\'\'<>,.-~$';

const output = computed(() => {
  const s = input.value;
  if (!s) {
    return '';
  }
  if (mode.value === 'to-full') {
    return toFull(s);
  }
  if (mode.value === 'to-half') {
    return toHalf(s);
  }
  const [from, to] = mode.value === 'punct-to-half' ? [PUNCT_FULL, PUNCT_HALF] : [PUNCT_HALF, PUNCT_FULL];
  const map: Record<string, string> = {};
  for (let i = 0; i < from.length; i++) {
    map[from[i]] = to[i];
  }
  return [...s].map(c => map[c] ?? c).join('');
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="input"
      label="输入文本："
      placeholder="输入要转换的文本，如 ＡＢＣ１２３ 或 abc123"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-buttons-select
      v-model:value="mode"
      :options="modeOptions"
      label="转换方式："
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div v-if="output" mt-1>
      <div mb-1 op-70 text-13px>
        转换结果：
      </div>
      <TextareaCopyable :value="output" />
    </div>
  </div>
</template>
