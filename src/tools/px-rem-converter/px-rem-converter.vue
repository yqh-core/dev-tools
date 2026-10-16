<script setup lang="ts">
type Direction = 'px2rem' | 'rem2px';

const root = ref(16);
const digits = ref(4);
const input = useStorage('px-rem-converter:input', '');
const direction = ref<Direction>('px2rem');

const directionOptions: { label: string; value: Direction }[] = [
  { label: 'px → rem', value: 'px2rem' },
  { label: 'rem → px', value: 'rem2px' },
];

function trimZeros(s: string): string {
  if (!s.includes('.')) {
    return s;
  }
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

const rows = computed(() => {
  const tokens = input.value.trim().split(/[\s,，;；\n]+/).filter(Boolean);
  if (!tokens.length) {
    return [];
  }
  const r = root.value > 0 ? root.value : 16;
  const d = Math.min(Math.max(Math.trunc(digits.value), 0), 10);
  return tokens.map((token) => {
    const n = Number.parseFloat(token.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(n)) {
      return { from: token, to: '—' };
    }
    const v = direction.value === 'px2rem' ? n / r : n * r;
    return { from: token, to: trimZeros(v.toFixed(d)) + (direction.value === 'px2rem' ? 'rem' : 'px') };
  });
});

const text = computed(() =>
  rows.value.map(r => `${r.from} → ${r.to}`).join('\n'),
);
</script>

<template>
  <div flex flex-col gap-3>
    <div flex items-center gap-4>
      <div flex items-center gap-2>
        <span>Root font size</span>
        <n-input-number v-model:value="root" :min="1" :max="100" w-120px>
          <template #suffix>
            px
          </template>
        </n-input-number>
      </div>
      <div flex items-center gap-2>
        <span>Decimals</span>
        <n-input-number v-model:value="digits" :min="0" :max="10" w-120px />
      </div>
    </div>

    <c-buttons-select
      v-model:value="direction"
      :options="directionOptions"
      label="Direction:"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="input"
      label="Values:"
      placeholder="Separated by space / comma / newline, px·rem units allowed, e.g. 16px 24px 1.5rem"
      multiline
      :rows="4"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div v-if="rows.length" mt-1>
      <div mb-1 text-13px op-70>
        Result (rem = px / root font size):
      </div>
      <TextareaCopyable :value="text" />
    </div>
  </div>
</template>
