<script setup lang="ts">
// Duplicate issue with sub directory

import { useI18n } from 'vue-i18n';

import {
  calculateObservedPaceEta,
  calculateRemainingEta,
  calculateRequiredPaceForDeadline,
  calculateWorkingHoursFinishAt,
  calculateWorkingWindowDurationMs,
} from './eta-calculator.service';
import { useCopy } from '@/composable/copy';

type EtaMode = 'rate' | 'observed';
type EtaScheduleMode = 'calendar' | 'weekdays';

const { t, locale } = useI18n();
const { copy } = useCopy({ text: t('tools.eta-calculator.copySuccess') });
const workUnit = ref('');
const displayedWorkUnit = computed(() => workUnit.value.trim() || t('tools.eta-calculator.defaultUnit'));
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';
const scheduleMode = ref<EtaScheduleMode>('calendar');
const workingDayStart = ref('09:00');
const workingDayEnd = ref('17:00');
const workingHoursSchedule = computed(() => ({
  startTime: workingDayStart.value,
  endTime: workingDayEnd.value,
}));

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

const projectedFinishAt = computed<number | null>(() => {
  if (!estimate.value) {
    return null;
  }
  const anchor = calculationMode.value === 'observed' ? Date.now() : startedAt.value;
  if (scheduleMode.value === 'calendar') {
    return anchor + projectedDurationMs.value;
  }
  try {
    return calculateWorkingHoursFinishAt(anchor, projectedDurationMs.value, workingHoursSchedule.value);
  }
  catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
});

const progressPercent = computed(() => Math.round(
  estimate.value?.completionPercent
    ?? (unitCount.value > 0 ? (completedUnitCount.value / unitCount.value) * 100 : 0),
));
function formatEtaDuration(durationMs: number): string {
  const totalMs = Math.max(0, Math.floor(durationMs));
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = totalMs % 1000;
  const parts: string[] = [];
  const unitText = (unit: 'hour' | 'minute' | 'second' | 'millisecond', count: number) => {
    const singular = count === 1;
    return t(`tools.eta-calculator.duration.${unit}${singular ? 'Singular' : 'Plural'}`, { count });
  };

  if (hours > 0) parts.push(unitText('hour', hours));
  if (minutes > 0) parts.push(unitText('minute', minutes));
  if (seconds > 0) parts.push(unitText('second', seconds));
  if (milliseconds > 0 && parts.length === 0) parts.push(unitText('millisecond', milliseconds));
  if (parts.length === 0) parts.push(unitText('second', 0));

  return parts.join(locale.value.startsWith('zh') ? '' : ' ');
}

const displayedDuration = computed(() => {
  if (!estimate.value) {
    return '—';
  }
  return formatEtaDuration(projectedDurationMs.value);
});
const formattedEndAt = computed(() => {
  if (projectedFinishAt.value === null) {
    return '';
  }
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(projectedFinishAt.value);
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
  const observedUnitsPerHour: unknown = (
    estimate.value as { unitsPerHour?: unknown }
  ).unitsPerHour;
  const currentUnitsPerHour: number = calculationMode.value === 'observed'
    ? (typeof observedUnitsPerHour === 'number' ? observedUnitsPerHour : 0)
    : unitPerTimeSpan.value / (timeSpan.value * timeSpanUnitMultiplier.value) * 60 * 60 * 1000;

  try {
    const availableMs = scheduleMode.value === 'weekdays'
      ? calculateWorkingWindowDurationMs(anchor, deadlineAt.value, workingHoursSchedule.value)
      : deadlineAt.value - anchor;
    const required = calculateRequiredPaceForDeadline({
      remainingUnits: estimate.value.remainingUnits,
      availableMs,
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
type EtaScenarioId = 'build' | 'migration' | 'batch' | 'conversion';

const scenarioIds: EtaScenarioId[] = ['build', 'migration', 'batch', 'conversion'];
const activeScenario = ref<EtaScenarioId | null>(null);

const etaScenarios: Record<EtaScenarioId, {
  mode: EtaMode
  schedule: EtaScheduleMode
  total: number
  completed: number
  rate: number
  interval: number
  intervalMs: number
  elapsedHours: number
  elapsedMinutes: number
  elapsedSeconds: number
  buffer: number
  pause: number
}> = {
  build: {
    mode: 'observed',
    schedule: 'calendar',
    total: 240,
    completed: 90,
    rate: 8,
    interval: 10,
    intervalMs: 60_000,
    elapsedHours: 1,
    elapsedMinutes: 15,
    elapsedSeconds: 0,
    buffer: 10,
    pause: 15,
  },
  migration: {
    mode: 'observed',
    schedule: 'weekdays',
    total: 12_000,
    completed: 4_200,
    rate: 100,
    interval: 10,
    intervalMs: 60_000,
    elapsedHours: 2,
    elapsedMinutes: 30,
    elapsedSeconds: 0,
    buffer: 15,
    pause: 30,
  },
  batch: {
    mode: 'rate',
    schedule: 'calendar',
    total: 10_000,
    completed: 3_600,
    rate: 500,
    interval: 10,
    intervalMs: 60_000,
    elapsedHours: 0,
    elapsedMinutes: 0,
    elapsedSeconds: 0,
    buffer: 10,
    pause: 10,
  },
  conversion: {
    mode: 'rate',
    schedule: 'calendar',
    total: 2_400,
    completed: 900,
    rate: 300,
    interval: 5,
    intervalMs: 60_000,
    elapsedHours: 0,
    elapsedMinutes: 0,
    elapsedSeconds: 0,
    buffer: 5,
    pause: 0,
  },
};

function loadScenario(scenario: EtaScenarioId) {
  const sample = etaScenarios[scenario];
  activeScenario.value = scenario;
  workUnit.value = t(`tools.eta-calculator.scenarioUnit.${scenario}`);
  calculationMode.value = sample.mode;
  scheduleMode.value = sample.schedule;
  unitCount.value = sample.total;
  completedUnitCount.value = sample.completed;
  unitPerTimeSpan.value = sample.rate;
  timeSpan.value = sample.interval;
  timeSpanUnitMultiplier.value = sample.intervalMs;
  elapsedHours.value = sample.elapsedHours;
  elapsedMinutes.value = sample.elapsedMinutes;
  elapsedSeconds.value = sample.elapsedSeconds;
  bufferPercent.value = sample.buffer;
  additionalPauseMinutes.value = sample.pause;
  workingDayStart.value = '09:00';
  workingDayEnd.value = '17:00';
  startedAt.value = Date.now();
  deadlineLocalInput.value = '';
}

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
    <section flex flex-col gap-3 data-test-id="eta-first-screen-intro">
      <div flex flex-col gap-1>
        <h2 text-xl font-semibold>{{ $t('tools.eta-calculator.firstScreenTitle') }}</h2>
        <p text-sm opacity-70>{{ $t('tools.eta-calculator.firstScreenIntro') }}</p>
      </div>
      <div flex flex-col gap-2>
        <strong text-sm>{{ $t('tools.eta-calculator.scenariosTitle') }}</strong>
        <div role="group" :aria-label="$t('tools.eta-calculator.scenariosTitle')" flex flex-wrap gap-2>
          <n-button
            v-for="scenario in scenarioIds"
            :key="scenario"
            :data-test-id="`eta-scenario-${scenario}`"
            :type="activeScenario === scenario ? 'primary' : 'default'"
            @click="loadScenario(scenario)"
          >
            {{ $t(`tools.eta-calculator.scenario.${scenario}`) }}
          </n-button>
        </div>
        <p text-xs opacity-60>{{ $t('tools.eta-calculator.scenariosHint') }}</p>
      </div>
    </section>

    <div flex flex-col gap-2 md:flex-row>
      <n-form-item :label="$t('tools.eta-calculator.totalAmountLabel', { unit: displayedWorkUnit })" flex-1>
        <n-input-number
          v-model:value="unitCount"
          :min="Math.max(1, completedUnitCount)"
          data-test-id="eta-total"
        />
      </n-form-item>
      <n-form-item :label="$t('tools.eta-calculator.completedAmountLabel', { unit: displayedWorkUnit })" flex-1>
        <n-input-number
          v-model:value="completedUnitCount"
          :min="0"
          :max="unitCount"
          data-test-id="eta-completed"
        />
      </n-form-item>
      <label flex flex-1 flex-col gap-1 text-sm>
        {{ $t('tools.eta-calculator.workUnitLabel') }}
        <input
          v-model.trim="workUnit"
          type="text"
          maxlength="24"
          :placeholder="$t('tools.eta-calculator.workUnitPlaceholder')"
          data-test-id="eta-unit-name"
          class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
      </label>
    </div>
    <p text-xs opacity-70 data-test-id="eta-unit-help">
      {{ $t('tools.eta-calculator.workUnitHelp') }}
    </p>

    <div role="group" :aria-label="$t('tools.eta-calculator.methodLabel')" flex flex-wrap gap-2>
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


    <template v-if="calculationMode === 'rate'">
      <div flex gap-2>
        <div flex-1>
          <p mb-1 text-sm>{{ $t('tools.eta-calculator.remainingWorkStartTime') }}</p>
          <n-date-picker v-model:value="startedAt" type="datetime" data-test-id="eta-start-time" />
        </div>
        <n-form-item :label="$t('tools.eta-calculator.bufferLabel')" flex-1>
          <n-input-number
            v-model:value="bufferPercent"
            :min="0"
            :max="100"
            :step="5"
            data-test-id="eta-buffer"
          />
        </n-form-item>
      </div>

      <p text-sm>{{ $t('tools.eta-calculator.processingRateLabel') }}</p>
      <div flex flex-col items-baseline gap-y-2 md:flex-row>
        <n-input-number v-model:value="unitPerTimeSpan" :min="1" :aria-label="$t('tools.eta-calculator.rateValueLabel')" data-test-id="eta-rate" />
        <span text-sm>{{ displayedWorkUnit }}</span>
        <div flex items-baseline gap-2>
          <span ml-2 text-sm>{{ $t('tools.eta-calculator.ratePer') }}</span>
          <n-input-number v-model:value="timeSpan" min-w-130px :min="1" :aria-label="$t('tools.eta-calculator.rateIntervalLabel')" data-test-id="eta-interval" />
          <c-select
            v-model:value="timeSpanUnitMultiplier"
            min-w-130px
            :options="[
              { label: $t('tools.eta-calculator.milliseconds'), value: 1 },
              { label: $t('tools.eta-calculator.seconds'), value: 1000 },
              { label: $t('tools.eta-calculator.minutes'), value: 1000 * 60 },
              { label: $t('tools.eta-calculator.hours'), value: 1000 * 60 * 60 },
              { label: $t('tools.eta-calculator.days'), value: 1000 * 60 * 60 * 24 },
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
          {{ $t('tools.eta-calculator.observedModeHelp', { unit: displayedWorkUnit }) }}
        </p>
        <n-form-item :label="$t('tools.eta-calculator.bufferLabel')" flex-1>
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
    <p text-xs opacity-70 data-test-id="eta-buffer-help">{{ $t('tools.eta-calculator.bufferHelp') }}</p>

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

    <c-card data-test-id="eta-schedule-card">
      <div flex flex-col gap-2>
        <strong>{{ $t('tools.eta-calculator.scheduleTitle') }}</strong>
        <div role="group" :aria-label="$t('tools.eta-calculator.scheduleTitle')" flex flex-wrap gap-2>
          <n-button
            data-test-id="eta-schedule-calendar"
            :type="scheduleMode === 'calendar' ? 'primary' : 'default'"
            @click="scheduleMode = 'calendar'"
          >
            {{ $t('tools.eta-calculator.calendarSchedule') }}
          </n-button>
          <n-button
            data-test-id="eta-schedule-weekdays"
            :type="scheduleMode === 'weekdays' ? 'primary' : 'default'"
            @click="scheduleMode = 'weekdays'"
          >
            {{ $t('tools.eta-calculator.weekdaySchedule') }}
          </n-button>
        </div>
        <template v-if="scheduleMode === 'weekdays'">
          <div flex flex-col gap-2 sm:flex-row>
            <label flex flex-1 flex-col gap-1 text-sm>
              {{ $t('tools.eta-calculator.workingDayStart') }}
              <input
                v-model="workingDayStart"
                type="time"
                data-test-id="eta-working-start"
                class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
            </label>
            <label flex flex-1 flex-col gap-1 text-sm>
              {{ $t('tools.eta-calculator.workingDayEnd') }}
              <input
                v-model="workingDayEnd"
                type="time"
                data-test-id="eta-working-end"
                class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
            </label>
          </div>
          <p text-xs opacity-70 data-test-id="eta-working-schedule-help">
            {{ $t('tools.eta-calculator.weekdayScheduleHelp', { timezone: localTimeZone }) }}
          </p>
          <p
            v-if="projectedFinishAt === null && estimate"
            role="alert"
            text-sm
            data-test-id="eta-working-schedule-error"
          >
            {{ $t('tools.eta-calculator.workingScheduleError') }}
          </p>
          <p v-if="estimate && estimate.remainingUnits > 0" text-sm data-test-id="eta-working-window-counted">
            {{ $t('tools.eta-calculator.workingWindowCounted') }}:
            <strong tabular-nums>{{ formatEtaDuration(projectedDurationMs) }}</strong>
          </p>
        </template>
      </div>
    </c-card>

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
          <strong tabular-nums data-test-id="eta-required-pace">
            {{ $t('tools.eta-calculator.requiredPace') }}:
            {{ formatUnitsPerHour(deadlineAnalysis.requiredUnitsPerHour) }} {{ $t('tools.eta-calculator.unitPerHour', { unit: displayedWorkUnit }) }}
          </strong>
          <span tabular-nums>
            {{ $t('tools.eta-calculator.currentPace') }}:
            {{ formatUnitsPerHour(deadlineAnalysis.currentUnitsPerHour) }} {{ $t('tools.eta-calculator.unitPerHour', { unit: displayedWorkUnit }) }}
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
      :aria-label="$t('tools.eta-calculator.progressAriaLabel')"
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
      {{ $t('tools.eta-calculator.progressSummary', { completed: completedUnitCount, total: unitCount, unit: displayedWorkUnit, percent: progressPercent }) }}
    </p>

    <n-divider />
    <c-card data-test-id="eta-result">
      <div flex flex-col gap-3>
        <n-statistic
          v-if="calculationMode === 'observed' && estimate && estimate.remainingUnits > 0"
          :label="$t('tools.eta-calculator.observedRateLabel')"
          data-test-id="eta-observed-rate"
        >
          {{ displayedObservedRate }} {{ $t('tools.eta-calculator.unitPerHour', { unit: displayedWorkUnit }) }}
        </n-statistic>
        <n-statistic v-if="estimate" :label="$t('tools.eta-calculator.remainingWorkLabel')" data-test-id="eta-remaining">
          {{ estimate.remainingUnits }} {{ displayedWorkUnit }}
        </n-statistic>
        <n-statistic v-if="estimate && estimate.remainingUnits > 0" :label="$t('tools.eta-calculator.baseProcessingDurationLabel')" data-test-id="eta-base-duration">
          {{ formatEtaDuration(estimate.baseDurationMs) }}
        </n-statistic>
        <n-statistic
          v-if="estimate && estimate.remainingUnits > 0"
          :label="$t(scheduleMode === 'weekdays' ? 'tools.eta-calculator.workWindowDurationLabel' : 'tools.eta-calculator.calendarDurationLabel')"
          data-test-id="eta-duration"
        >
          {{ displayedDuration }}
        </n-statistic>
        <n-statistic
          v-if="estimate && bufferPercent > 0 && estimate.remainingUnits > 0"
          :label="$t('tools.eta-calculator.bufferAllowanceLabel')"
          data-test-id="eta-buffer-time"
        >
          {{ formatEtaDuration(estimate.bufferDurationMs) }}
        </n-statistic>
        <n-statistic
          v-if="estimate && additionalPauseMinutes > 0 && estimate.remainingUnits > 0"
          :label="$t('tools.eta-calculator.additionalPauseResult')"
          data-test-id="eta-pause-time"
        >
          {{ formatEtaDuration(additionalPauseMs) }}
        </n-statistic>
        <n-statistic v-if="estimate && estimate.remainingUnits > 0" :label="$t('tools.eta-calculator.projectedCompletionLabel')" data-test-id="eta-finish">
          <span data-test-id="eta-finish-local">{{ formattedEndAt }}</span>
        </n-statistic>
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
          {{ $t('tools.eta-calculator.completeMessage') }}
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

    <c-card :title="$t('tools.eta-calculator.formulaTitle')" data-test-id="eta-calculator-example">
      <p>{{ $t('tools.eta-calculator.formulaBase') }}</p>
      <p mt-2>
        {{ $t('tools.eta-calculator.formulaExample') }}
      </p>
      <p mt-2 text-xs opacity-70>
        {{ $t('tools.eta-calculator.formulaAssumption') }}
      </p>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.n-input-number,
.n-date-picker {
  width: 100%;
}
</style>
