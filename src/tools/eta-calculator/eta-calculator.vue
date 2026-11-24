<script setup lang="ts">
// Duplicate issue with sub directory

import { addMilliseconds, formatRelative } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useI18n } from 'vue-i18n';

import {
  calculateObservedPaceEta,
  calculateRemainingEta,
  calculateRequiredPaceForDeadline,
  formatMsDuration,
} from './eta-calculator.service';
import { useCopy } from '@/composable/copy';

type EtaMode = 'rate' | 'observed';

const { t } = useI18n();
const { copy } = useCopy({ text: t('tools.eta-calculator.copySuccess') });
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

const calculationMode = ref<EtaMode>('rate');
const unitCount = ref(3 * 62);
const completedUnitCount = ref(0);
const unitPerTimeSpan = ref(3);
const timeSpan = ref(5);
const timeSpanUnitMultiplier = ref(60000);
const elapsedHours = ref(2);
const elapsedMinutes = ref(0);
const elapsedSeconds = ref(0);
const bufferPercent = ref(0);
const additionalPauseMinutes = ref(0);
const additionalPauseMs = computed(() => additionalPauseMinutes.value * 60_000);
const startedAt = ref(Date.now());
const deadlineLocalInput = ref('');
const deadlineAt = computed(() => {
  if (!deadlineLocalInput.value) {
    return null;
  }
  const timestamp = new Date(deadlineLocalInput.value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
});

const elapsedMs = computed(() => (
  (elapsedHours.value * 60 * 60 + elapsedMinutes.value * 60 + elapsedSeconds.value) * 1000
));

watch(unitCount, (value) => {
  if (completedUnitCount.value > value) {
    completedUnitCount.value = value;
  }
});

const estimate = computed(() => {
  if (calculationMode.value === 'observed') {
    try {
      return calculateObservedPaceEta({
        totalUnits: unitCount.value,
        completedUnits: completedUnitCount.value,
        elapsedMs: elapsedMs.value,
        bufferPercent: bufferPercent.value,
      });
    }
    catch (error) {
      if (error instanceof RangeError) {
        return null;
      }
      throw error;
    }
  }

  return calculateRemainingEta({
    totalUnits: unitCount.value,
    completedUnits: completedUnitCount.value,
    unitsPerInterval: unitPerTimeSpan.value,
    intervalMs: timeSpan.value * timeSpanUnitMultiplier.value,
    bufferPercent: bufferPercent.value,
  });
});

const projectedDurationMs = computed(() => (
  estimate.value ? estimate.value.durationMs + additionalPauseMs.value : 0
));

const progressPercent = computed(() => Math.round(
  estimate.value?.completionPercent
    ?? (unitCount.value > 0 ? (completedUnitCount.value / unitCount.value) * 100 : 0),
));
const endAt = computed(() => {
  if (!estimate.value) {
    return '';
  }
  const anchor = calculationMode.value === 'observed' ? Date.now() : startedAt.value;
  return formatRelative(
    addMilliseconds(anchor, projectedDurationMs.value),
    Date.now(),
    { locale: enGB },
  );
});
const displayedDuration = computed(() => {
  if (!estimate.value) {
    return '—';
  }
  return estimate.value.remainingUnits === 0
    ? '0 seconds'
    : formatMsDuration(projectedDurationMs.value);
});
const formattedEndAt = computed(() => {
  if (!estimate.value) {
    return '';
  }
  const anchor = calculationMode.value === 'observed' ? Date.now() : startedAt.value;
  const finish = addMilliseconds(anchor, projectedDurationMs.value);
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(finish);
  return `${formatted} (${localTimeZone})`;
});
function copyFinishTime() {
  if (formattedEndAt.value) {
    copy(formattedEndAt.value);
  }
}
function copyRemainingDuration() {
  if (estimate.value) {
    copy(displayedDuration.value);
  }
}
const deadlineAnalysis = computed(() => {
  if (deadlineAt.value === null || !estimate.value) {
    return null;
  }

  const anchor = calculationMode.value === 'observed' ? Date.now() : startedAt.value;
  const currentUnitsPerHour = calculationMode.value === 'observed'
    ? ('unitsPerHour' in estimate.value ? estimate.value.unitsPerHour : 0)
    : unitPerTimeSpan.value / (timeSpan.value * timeSpanUnitMultiplier.value) * 60 * 60 * 1000;

  try {
    const required = calculateRequiredPaceForDeadline({
      remainingUnits: estimate.value.remainingUnits,
      availableMs: deadlineAt.value - anchor,
      bufferPercent: bufferPercent.value,
      additionalPauseMs: additionalPauseMs.value,
    });
    const onTrack = estimate.value.remainingUnits === 0 || currentUnitsPerHour >= required.requiredUnitsPerHour;
    const neededFasterPercent = required.requiredUnitsPerHour > 0 && currentUnitsPerHour > 0
      ? Math.max(0, (required.requiredUnitsPerHour / currentUnitsPerHour - 1) * 100)
      : required.requiredUnitsPerHour > 0 ? 100 : 0;
    return {
      valid: true as const,
      requiredUnitsPerHour: required.requiredUnitsPerHour,
      currentUnitsPerHour,
      onTrack,
      neededFasterPercent,
      complete: estimate.value.remainingUnits === 0,
    };
  }
  catch (error) {
    if (error instanceof RangeError) {
      return { valid: false as const };
    }
    throw error;
  }
});
function formatUnitsPerHour(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
const displayedObservedRate = computed(() => {
  if (
    calculationMode.value !== 'observed'
    || !estimate.value
    || !('unitsPerHour' in estimate.value)
    || typeof estimate.value.unitsPerHour !== 'number'
  ) {
    return '';
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 })
    .format(estimate.value.unitsPerHour);
});
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

    <div role="group" aria-label="ETA estimation method" flex flex-wrap gap-2>
      <n-button
        data-test-id="eta-mode-rate"
        :type="calculationMode === 'rate' ? 'primary' : 'default'"
        @click="calculationMode = 'rate'"
      >
        {{ $t('tools.eta-calculator.rateMode') }}
      </n-button>
      <n-button
        data-test-id="eta-mode-observed"
        :type="calculationMode === 'observed' ? 'primary' : 'default'"
        @click="calculationMode = 'observed'"
      >
        {{ $t('tools.eta-calculator.observedMode') }}
      </n-button>
    </div>

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

    <template v-if="calculationMode === 'rate'">
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
    </template>

    <template v-else>
      <p text-sm>{{ $t('tools.eta-calculator.elapsedTitle') }}</p>
      <div flex flex-col gap-2 md:flex-row>
        <n-form-item :label="$t('tools.eta-calculator.elapsedHours')" flex-1>
          <n-input-number
            v-model:value="elapsedHours"
            :min="0"
            :precision="0"
            data-test-id="eta-elapsed-hours"
          />
        </n-form-item>
        <n-form-item :label="$t('tools.eta-calculator.elapsedMinutes')" flex-1>
          <n-input-number
            v-model:value="elapsedMinutes"
            :min="0"
            :max="59"
            :precision="0"
            data-test-id="eta-elapsed-minutes"
          />
        </n-form-item>
        <n-form-item :label="$t('tools.eta-calculator.elapsedSeconds')" flex-1>
          <n-input-number
            v-model:value="elapsedSeconds"
            :min="0"
            :max="59"
            :precision="0"
            data-test-id="eta-elapsed-seconds"
          />
        </n-form-item>
      </div>
      <div flex flex-col gap-2 md:flex-row>
        <p flex-1 text-xs opacity-70>
          {{ $t('tools.eta-calculator.observedModeHelp') }}
        </p>
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
    </template>

    <n-form-item
      :label="$t('tools.eta-calculator.additionalPauseMinutes')"
      :show-feedback="false"
    >
      <n-input-number
        v-model:value="additionalPauseMinutes"
        :min="0"
        :max="10080"
        :step="5"
        data-test-id="eta-pause-minutes"
      />
      <p ml-2 text-xs opacity-65>
        {{ $t('tools.eta-calculator.additionalPauseHelp') }}
      </p>
    </n-form-item>

    <c-card data-test-id="eta-deadline-card">
      <div flex flex-col gap-2>
        <label flex flex-col gap-1 text-sm>
          {{ $t('tools.eta-calculator.deadlineLabel') }}
          <input
            v-model="deadlineLocalInput"
            type="datetime-local"
            data-test-id="eta-deadline-input"
            class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
        </label>
        <p text-xs opacity-70>
          {{ $t('tools.eta-calculator.deadlineHelp') }}
        </p>
        <div
          v-if="deadlineAnalysis?.valid && deadlineAnalysis.complete"
          text-sm
          data-test-id="eta-deadline-result"
        >
          {{ $t('tools.eta-calculator.deadlineComplete') }}
        </div>
        <div
          v-else-if="deadlineAnalysis?.valid"
          flex
          flex-col
          gap-1
          data-test-id="eta-deadline-result"
        >
          <strong tabular-nums>
            {{ $t('tools.eta-calculator.requiredPace') }}:
            {{ formatUnitsPerHour(deadlineAnalysis.requiredUnitsPerHour) }} {{ $t('tools.eta-calculator.unitsPerHour') }}
          </strong>
          <span tabular-nums>
            {{ $t('tools.eta-calculator.currentPace') }}:
            {{ formatUnitsPerHour(deadlineAnalysis.currentUnitsPerHour) }} {{ $t('tools.eta-calculator.unitsPerHour') }}
          </span>
          <p v-if="deadlineAnalysis.onTrack" text-sm>
            {{ $t('tools.eta-calculator.deadlineOnTrack') }}
          </p>
          <p v-else text-sm>
            {{ $t('tools.eta-calculator.deadlineBehind', { percent: formatUnitsPerHour(deadlineAnalysis.neededFasterPercent) }) }}
          </p>
        </div>
        <p
          v-else-if="deadlineAnalysis && !deadlineAnalysis.valid"
          role="alert"
          text-sm
          data-test-id="eta-deadline-error"
        >
          {{ $t('tools.eta-calculator.deadlineTooSoon') }}
        </p>
      </div>
    </c-card>
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
        <n-statistic
          v-if="calculationMode === 'observed' && estimate && estimate.remainingUnits > 0"
          label="Observed processing rate"
          data-test-id="eta-observed-rate"
        >
          {{ displayedObservedRate }} {{ $t('tools.eta-calculator.unitsPerHour') }}
        </n-statistic>
        <n-statistic v-if="estimate" label="Remaining amount" data-test-id="eta-remaining">
          {{ estimate.remainingUnits }}
        </n-statistic>
        <n-statistic v-if="estimate" label="Estimated remaining duration" data-test-id="eta-duration">
          {{ displayedDuration }}
        </n-statistic>
        <n-statistic
          v-if="estimate && bufferPercent > 0 && estimate.remainingUnits > 0"
          label="Buffer included"
          data-test-id="eta-buffer-time"
        >
          {{ formatMsDuration(estimate.bufferDurationMs) }}
        </n-statistic>
        <n-statistic
          v-if="estimate && additionalPauseMinutes > 0 && estimate.remainingUnits > 0"
          :label="$t('tools.eta-calculator.additionalPauseResult')"
          data-test-id="eta-pause-time"
        >
          {{ formatMsDuration(additionalPauseMs) }}
        </n-statistic>
        <n-statistic v-if="estimate && estimate.remainingUnits > 0" label="Estimated finish time" data-test-id="eta-finish">
          {{ endAt }}
        </n-statistic>
        <p
          v-if="estimate && estimate.remainingUnits > 0"
          text-xs
          opacity-70
          data-test-id="eta-finish-local"
        >
          {{ $t('tools.eta-calculator.localFinishTime') }}: {{ formattedEndAt }}
        </p>
        <div v-if="estimate && estimate.remainingUnits > 0" flex flex-wrap gap-2>
          <n-button
            secondary
            data-test-id="eta-copy-finish"
            @click="copyFinishTime"
          >
            {{ $t('tools.eta-calculator.copyFinishTime') }}
          </n-button>
          <n-button
            secondary
            data-test-id="eta-copy-remaining"
            @click="copyRemainingDuration"
          >
            {{ $t('tools.eta-calculator.copyRemainingDuration') }}
          </n-button>
        </div>
        <p v-if="estimate && estimate.remainingUnits === 0" text-sm font-semibold data-test-id="eta-complete">
          All work items are complete.
        </p>
        <p
          v-if="calculationMode === 'observed' && !estimate && completedUnitCount < unitCount"
          role="alert"
          text-sm
          data-test-id="eta-observed-error"
        >
          {{ $t('tools.eta-calculator.observedModeHint') }}
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
