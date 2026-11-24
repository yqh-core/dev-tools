<script setup lang="ts">
// Duplicate issue with sub directory

import { addMilliseconds, formatRelative } from 'date-fns';
import { enGB } from 'date-fns/locale';

import { calculateRemainingEta, formatMsDuration } from './eta-calculator.service';

const unitCount = ref(3 * 62);
const completedUnitCount = ref(0);
const unitPerTimeSpan = ref(3);
const timeSpan = ref(5);
const timeSpanUnitMultiplier = ref(60000);
const bufferPercent = ref(0);
const startedAt = ref(Date.now());

watch(unitCount, (value) => {
  if (completedUnitCount.value > value) {
    completedUnitCount.value = value;
  }
});

const estimate = computed(() => calculateRemainingEta({
  totalUnits: unitCount.value,
  completedUnits: completedUnitCount.value,
  unitsPerInterval: unitPerTimeSpan.value,
  intervalMs: timeSpan.value * timeSpanUnitMultiplier.value,
  bufferPercent: bufferPercent.value,
}));
const progressPercent = computed(() => Math.round(estimate.value.completionPercent));
const endAt = computed(() =>
  formatRelative(addMilliseconds(startedAt.value, estimate.value.durationMs), Date.now(), { locale: enGB }),
);
const displayedDuration = computed(() =>
  estimate.value.remainingUnits === 0 ? '0 seconds' : formatMsDuration(estimate.value.durationMs),
);
</script>

<template>
  <div flex flex-col gap-3>
    <c-card title="How the estimate works" data-test-id="eta-calculator-example">
      <p>
        Remaining duration = (total amount − completed amount) ÷ processing rate × interval length × (1 + buffer).
      </p>
      <p mt-2>
        Example: 500 records − 200 completed = 300 remaining. At 5 records per 3 minutes, that is 180 minutes (3 hours) before any buffer.
      </p>
      <p mt-2 text-xs opacity-60>
        The estimate assumes a steady processing rate. A buffer can account for expected pauses or rate variation; it is not a prediction of network traffic or changing workloads.
      </p>
    </c-card>

    <div flex flex-col gap-2 md:flex-row>
      <n-form-item label="Total amount to process" flex-1>
        <n-input-number
          v-model:value="unitCount"
          :min="Math.max(1, completedUnitCount)"
          data-test-id="eta-total"
        />
      </n-form-item>
      <n-form-item label="Already completed" flex-1>
        <n-input-number
          v-model:value="completedUnitCount"
          :min="0"
          :max="unitCount"
          data-test-id="eta-completed"
        />
      </n-form-item>
    </div>

    <div flex gap-2>
      <div flex-1>
        <p mb-1 text-sm>Remaining work start time</p>
        <n-date-picker v-model:value="startedAt" type="datetime" data-test-id="eta-start-time" />
      </div>
      <n-form-item label="Extra time buffer (%)" flex-1>
        <n-input-number
          v-model:value="bufferPercent"
          :min="0"
          :max="100"
          :step="5"
          data-test-id="eta-buffer"
        />
      </n-form-item>
    </div>

    <p>Processing rate</p>
    <div flex flex-col items-baseline gap-y-2 md:flex-row>
      <n-input-number v-model:value="unitPerTimeSpan" :min="1" data-test-id="eta-rate" />
      <div flex items-baseline gap-2>
        <span ml-2>in</span>
        <n-input-number v-model:value="timeSpan" min-w-130px :min="1" data-test-id="eta-interval" />
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

    <div
      role="progressbar"
      aria-label="Work completed"
      :aria-valuenow="progressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
      w-full
      h-2
      rounded
      overflow-hidden
      bg-gray-200
      dark:bg-gray-700
      data-test-id="eta-progress"
    >
      <div
        h-full
        rounded
        bg-primary
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
    <p text-xs opacity-70 data-test-id="eta-progress-label">
      {{ completedUnitCount }} of {{ unitCount }} completed ({{ progressPercent }}%)
    </p>

    <n-divider />
    <c-card data-test-id="eta-result">
      <div flex flex-col gap-3>
        <n-statistic label="Remaining amount" data-test-id="eta-remaining">
          {{ estimate.remainingUnits }}
        </n-statistic>
        <n-statistic label="Estimated remaining duration" data-test-id="eta-duration">
          {{ displayedDuration }}
        </n-statistic>
        <n-statistic v-if="bufferPercent > 0 && estimate.remainingUnits > 0" label="Buffer included" data-test-id="eta-buffer-time">
          {{ formatMsDuration(estimate.bufferDurationMs) }}
        </n-statistic>
        <n-statistic v-if="estimate.remainingUnits > 0" label="Estimated finish time" data-test-id="eta-finish">
          {{ endAt }}
        </n-statistic>
        <p v-else text-sm font-semibold data-test-id="eta-complete">
          All work items are complete.
        </p>
      </div>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.n-input-number,
.n-date-picker {
  width: 100%;
}
</style>
