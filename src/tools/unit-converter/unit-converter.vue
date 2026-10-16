<script setup lang="ts">
import { CATEGORIES, convertRow, unitsOf } from './unit-converter.service';
import type { Category } from './unit-converter.service';

// 数据与换算都搬到 unit-converter.service.ts：放组件里没法单测，
// 而这些因子（如 bit=0.125、kgf=9.80665、g/cm³=1000）一旦写错是静默错值。

const category = ref<Category>('Length');
const amount = ref(1);
const fromUnit = ref(unitsOf('Length')[1]);

const units = computed(() => unitsOf(category.value));

watch(category, (c) => {
  fromUnit.value = unitsOf(c)[0];
});

function format(n: number): string {
  if (!Number.isFinite(n)) {
    return '—';
  }
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    return n.toExponential(6);
  }
  return String(Number(n.toPrecision(12)));
}

const TEMP_SYMBOL: Record<string, string> = { Celsius: '°C', Fahrenheit: '°F', Kelvin: 'K' };

const rows = computed<{ label: string; value: string }[]>(() => {
  const v = amount.value;
  if (v === null || !Number.isFinite(v)) {
    return [];
  }
  const converted = convertRow(category.value, v, fromUnit.value);
  return Object.entries(converted).map(([u, n]) => ({
    // '(input)' 后缀是给复制出去的文本看的，粘贴到别处还能认出哪条是来源
    label: u === fromUnit.value ? `${u} (input)` : u,
    value: category.value === 'Temperature'
      ? `${format(n)} ${TEMP_SYMBOL[u]}`
      : format(n),
  }));
});

const output = computed(() =>
  `${amount.value} ${fromUnit.value}\n${rows.value.map(r => `${r.label}: ${r.value}`).join('\n')}`,
);
</script>

<template>
  <div flex flex-col gap-3>
    <c-buttons-select
      v-model:value="category"
      :options="[...CATEGORIES]"
      label="Category:"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div flex items-center gap-4 pl-90px>
      <n-input-number v-model:value="amount" flex-1 :show-button="false" placeholder="Value" />
      <c-select v-model:value="fromUnit" :options="units" w-200px />
    </div>

    <div v-if="rows.length" mt-1>
      <div mb-1 text-13px op-70>
        Conversion result:
      </div>
      <TextareaCopyable :value="output" />
    </div>
  </div>
</template>
