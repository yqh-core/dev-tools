<script setup lang="ts">
// Duplicate issue with sub directory

import { addMilliseconds, formatRelative } from 'date-fns';

import { enGB } from 'date-fns/locale';

import { formatMsDuration } from './eta-calculator.service';

const unitCount = ref(3 * 62);
const unitPerTimeSpan = ref(3);
const timeSpan = ref(5);
const timeSpanUnitMultiplier = ref(60000);
const startedAt = ref(Date.now());

const durationMs = computed(() => {
  const timeSpanMs = timeSpan.value * timeSpanUnitMultiplier.value;

  return unitCount.value / (unitPerTimeSpan.value / timeSpanMs);
});
const endAt = computed(() =>
  formatRelative(addMilliseconds(startedAt.value, durationMs.value), Date.now(), { locale: enGB }),
);
</script>

<template>
  <div flex flex-col gap-3>
    <c-card title="How the estimate works" data-test-id="eta-calculator-example">
      <p>
        Estimated duration = total amount ÷ amount processed per interval × interval length.
      </p>
      <p mt-2>
        Example: 500 records ÷ 5 records per 3 minutes = 100 intervals, or 300 minutes (5 hours).
      </p>
      <p mt-2 text-xs opacity-60>
        The estimate assumes a steady processing rate. Pauses, setup time and changes in workload are not included.
      </p>
    </c-card>
    <div flex gap-2>
      <n-form-item label="Total amount to process" flex-1>
        <n-input-number v-model:value="unitCount" :min="1" />
      </n-form-item>
      <n-form-item label="Processing start time" flex-1>
        <n-date-picker v-model:value="startedAt" type="datetime" />
      </n-form-item>
    </div>

    <p>Amount processed per time interval</p>
    <div flex flex-col items-baseline gap-y-2 md:flex-row>
      <n-input-number v-model:value="unitPerTimeSpan" :min="1" />
      <div flex items-baseline gap-2>
        <span ml-2>in</span>
        <n-input-number v-model:value="timeSpan" min-w-130px :min="1" />
        <c-select
          v-model:value="timeSpanUnitMultiplier"
          min-w-130px
          :options="[
            { label: 'milliseconds', value: 1 },
            { label: 'seconds', value: 1000 },
            { label: 'minutes', value: 1000 * 60 },
            { label: 'hours', value: 1000 * 60 * 60 },
            { label: 'days', value: 1000 * 60 * 60 * 24 },
          ]"
        />
      </div>
    </div>

    <n-divider />
    <c-card mb-2>
      <n-statistic label="Total duration">
        {{ formatMsDuration(durationMs) }}
      </n-statistic>
    </c-card>
    <c-card>
      <n-statistic label="It will end ">
        {{ endAt }}
      </n-statistic>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.n-input-number,
.n-date-picker {
  width: 100%;
}
</style>
