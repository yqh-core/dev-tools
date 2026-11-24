<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  PercentageBatchMode,
  PercentageBatchRow,
} from './percentage-calculator.batch';
import {
  calculateSequentialPercentage,
  MAX_SEQUENTIAL_PERCENTAGE_STEPS,
  type SequentialPercentageError,
  type SequentialPercentageOperation,
  type SequentialPercentageStepInput,
} from './percentage-calculator.sequential';
import {
  percentageBatchToCsv,
  percentageBatchToTsv,
  runPercentageBatch,
} from './percentage-calculator.batch';

const { t } = useI18n();

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function resultText(value: number): string {
  return Number.isFinite(value) ? value.toString() : '';
}

const percentageX = ref();
const percentageY = ref();
const percentageResult = computed(() => {
  if (!isFiniteNumber(percentageX.value) || !isFiniteNumber(percentageY.value)) {
    return '';
  }
  return resultText(percentageX.value / 100 * percentageY.value);
});

const numberX = ref();
const numberY = ref();
const numberResult = computed(() => {
  if (!isFiniteNumber(numberX.value) || !isFiniteNumber(numberY.value) || numberY.value === 0) {
    return '';
  }
  return resultText(100 * numberX.value / numberY.value);
});

const numberFrom = ref();
const numberTo = ref();
const percentageIncreaseDecrease = computed(() => {
  if (!isFiniteNumber(numberFrom.value) || !isFiniteNumber(numberTo.value) || numberFrom.value === 0) {
    return '';
  }
  return resultText((numberTo.value - numberFrom.value) / numberFrom.value * 100);
});

const adjustmentValue = ref();
const adjustmentPercent = ref();
const increasedValue = computed(() => {
  if (!isFiniteNumber(adjustmentValue.value) || !isFiniteNumber(adjustmentPercent.value)) {
    return '';
  }
  return resultText(adjustmentValue.value * (1 + adjustmentPercent.value / 100));
});
const decreasedValue = computed(() => {
  if (!isFiniteNumber(adjustmentValue.value) || !isFiniteNumber(adjustmentPercent.value)) {
    return '';
  }
  return resultText(adjustmentValue.value * (1 - adjustmentPercent.value / 100));
});

const reverseFinalValue = ref();
const reversePercent = ref();
const originalBeforeIncrease = computed(() => {
  if (!isFiniteNumber(reverseFinalValue.value) || !isFiniteNumber(reversePercent.value)) {
    return '';
  }
  const factor = 1 + reversePercent.value / 100;
  if (factor === 0) {
    return '';
  }
  return resultText(reverseFinalValue.value / factor);
});
const originalBeforeDecrease = computed(() => {
  if (!isFiniteNumber(reverseFinalValue.value) || !isFiniteNumber(reversePercent.value)) {
    return '';
  }
  const factor = 1 - reversePercent.value / 100;
  if (factor === 0) {
    return '';
  }
  return resultText(reverseFinalValue.value / factor);
});

const differenceA = ref();
const differenceB = ref();
const percentageDifference = computed(() => {
  if (!isFiniteNumber(differenceA.value) || !isFiniteNumber(differenceB.value)) {
    return '';
  }
  const averageMagnitude = (Math.abs(differenceA.value) + Math.abs(differenceB.value)) / 2;
  if (averageMagnitude === 0) {
    return '';
  }
  return resultText(Math.abs(differenceA.value - differenceB.value) / averageMagnitude * 100);
});

const rateFrom = ref();
const rateTo = ref();
const percentagePointChange = computed(() => {
  if (!isFiniteNumber(rateFrom.value) || !isFiniteNumber(rateTo.value)) {
    return '';
  }
  return resultText(rateTo.value - rateFrom.value);
});
interface PercentageBatchHistoryItem {
  id: string
  mode: PercentageBatchMode
  input: string
  savedAt: number
}

const percentageBatchHistoryKey = 'digdevbox.percentage-calculator.batch-history.v1';
const percentageBatchModeNames = computed<Record<PercentageBatchMode, string>>(() => ({
  'percent-of': t('tools.percentage-calculator.batch.modes.percent-of'),
  'part-to-whole': t('tools.percentage-calculator.batch.modes.part-to-whole'),
  'percentage-change': t('tools.percentage-calculator.batch.modes.percentage-change'),
  'adjustment': t('tools.percentage-calculator.batch.modes.adjustment'),
  'reverse': t('tools.percentage-calculator.batch.modes.reverse'),
  'percentage-difference': t('tools.percentage-calculator.batch.modes.percentage-difference'),
  'percentage-points': t('tools.percentage-calculator.batch.modes.percentage-points'),
}));
const percentageBatchModeHints = computed<Record<PercentageBatchMode, string>>(() => ({
  'percent-of': t('tools.percentage-calculator.batch.hints.percent-of'),
  'part-to-whole': t('tools.percentage-calculator.batch.hints.part-to-whole'),
  'percentage-change': t('tools.percentage-calculator.batch.hints.percentage-change'),
  'adjustment': t('tools.percentage-calculator.batch.hints.adjustment'),
  'reverse': t('tools.percentage-calculator.batch.hints.reverse'),
  'percentage-difference': t('tools.percentage-calculator.batch.hints.percentage-difference'),
  'percentage-points': t('tools.percentage-calculator.batch.hints.percentage-points'),
}));
const percentageBatchMode = ref<PercentageBatchMode>('percent-of');
const percentageBatchInput = ref('');
const percentageBatchRows = ref<PercentageBatchRow[]>([]);
const percentageBatchHistory = ref<PercentageBatchHistoryItem[]>([]);
const percentageBatchStatus = ref('');
const percentageBatchInputHint = computed(() => percentageBatchModeHints.value[percentageBatchMode.value]);

function loadPercentageBatchHistory(): void {
  try {
    const saved = localStorage.getItem(percentageBatchHistoryKey);
    const parsed: unknown = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) {
      return;
    }
    percentageBatchHistory.value = parsed
      .filter((item): item is PercentageBatchHistoryItem =>
        Boolean(item)
        && typeof item.id === 'string'
        && typeof item.input === 'string'
        && typeof item.mode === 'string'
        && Object.prototype.hasOwnProperty.call(percentageBatchModeNames.value, item.mode)
        && typeof item.savedAt === 'number',
      )
      .slice(0, 8);
  }
  catch {
    percentageBatchHistory.value = [];
  }
}

function persistPercentageBatchHistory(): void {
  try {
    localStorage.setItem(percentageBatchHistoryKey, JSON.stringify(percentageBatchHistory.value));
  }
  catch {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.historyUnavailable');
  }
}

onMounted(loadPercentageBatchHistory);

function runPercentageBatchRows(): void {
  const rows = runPercentageBatch(percentageBatchInput.value, percentageBatchMode.value);
  percentageBatchRows.value = rows;
  if (!rows.length) {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.empty');
    return;
  }

  const item: PercentageBatchHistoryItem = {
    id: `run-${Date.now()}-${percentageBatchHistory.value.length + 1}`,
    mode: percentageBatchMode.value,
    input: percentageBatchInput.value,
    savedAt: Date.now(),
  };
  percentageBatchHistory.value = [item, ...percentageBatchHistory.value].slice(0, 8);
  persistPercentageBatchHistory();

  const successful = rows.filter(row => !row.error).length;
  const failed = rows.length - successful;
  percentageBatchStatus.value = failed
    ? t('tools.percentage-calculator.batch.rowsStatusPartial', { successful, total: rows.length, failed })
    : t('tools.percentage-calculator.batch.rowsStatusSuccess', { total: rows.length });
}

async function copyPercentageBatchText(text: string, successMessage: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(text);
    percentageBatchStatus.value = successMessage;
  }
  catch {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.clipboardUnavailable');
  }
}

function copyPercentageBatchRow(row: PercentageBatchRow): void {
  const text = [row.label, row.formula, row.result, row.error].filter(Boolean).join('\n');
  copyPercentageBatchText(text, t('tools.percentage-calculator.batch.copiedRow', { label: row.label }));
}

function copyPercentageBatchCsv(): void {
  if (!percentageBatchRows.value.length) {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.calculateBeforeCopy');
    return;
  }
  copyPercentageBatchText(
    percentageBatchToCsv(percentageBatchRows.value),
    t('tools.percentage-calculator.batch.copiedCsv'),
  );
}

function copyPercentageBatchTsv(): void {
  if (!percentageBatchRows.value.length) {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.calculateBeforeCopy');
    return;
  }
  copyPercentageBatchText(
    percentageBatchToTsv(percentageBatchRows.value),
    t('tools.percentage-calculator.batch.copiedTsv'),
  );
}

function downloadPercentageBatch(format: 'csv' | 'tsv'): void {
  if (!percentageBatchRows.value.length) {
    percentageBatchStatus.value = t('tools.percentage-calculator.batch.calculateBeforeDownload');
    return;
  }
  const content = format === 'csv'
    ? percentageBatchToCsv(percentageBatchRows.value)
    : percentageBatchToTsv(percentageBatchRows.value);
  const blob = new Blob(['\uFEFF', content], {
    type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/tab-separated-values;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `percentage-calculations.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  percentageBatchStatus.value = t('tools.percentage-calculator.batch.downloaded', { format: format.toUpperCase() });
}

function percentageBatchErrorMessage(error: string): string {
  const errorKeys: Record<string, string> = {
    'Expected two numeric columns. Separate values with a tab or comma; an optional text label may come first.': 'tools.percentage-calculator.batch.errors.columns',
    'Both input columns must contain finite numbers.': 'tools.percentage-calculator.batch.errors.numbers',
    'The whole value cannot be zero.': 'tools.percentage-calculator.batch.errors.wholeZero',
    'The starting value cannot be zero for percentage change.': 'tools.percentage-calculator.batch.errors.startZero',
    'Percentage difference is undefined when both values are zero.': 'tools.percentage-calculator.batch.errors.differenceZero',
  };
  const key = errorKeys[error];
  return key ? t(key) : error;
}

function restorePercentageBatchHistory(item: PercentageBatchHistoryItem): void {
  percentageBatchMode.value = item.mode;
  percentageBatchInput.value = item.input;
  percentageBatchRows.value = runPercentageBatch(item.input, item.mode);
  percentageBatchStatus.value = t('tools.percentage-calculator.batch.restored', { date: new Date(item.savedAt).toLocaleString() });
}

function removePercentageBatchHistory(id: string): void {
  percentageBatchHistory.value = percentageBatchHistory.value.filter(item => item.id !== id);
  persistPercentageBatchHistory();
  percentageBatchStatus.value = t('tools.percentage-calculator.batch.removed');
}

function clearPercentageBatchHistory(): void {
  percentageBatchHistory.value = [];
  try {
    localStorage.removeItem(percentageBatchHistoryKey);
  }
  catch {
    // The in-memory history is still cleared even when storage is blocked.
  }
  percentageBatchStatus.value = t('tools.percentage-calculator.batch.cleared');
}

function percentageBatchSavedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

interface SequentialStepEditor extends SequentialPercentageStepInput {
  id: number
}

const sequentialStartingAmount = ref<number | null>(100);
const sequentialSteps = ref<SequentialStepEditor[]>([
  { id: 1, operation: 'decrease', percentage: 20 },
  { id: 2, operation: 'decrease', percentage: 10 },
]);
let nextSequentialStepId = 3;
const sequentialStatus = ref('');

const sequentialCalculationResult = computed(() =>
  calculateSequentialPercentage(sequentialStartingAmount.value, sequentialSteps.value),
);
const sequentialCalculation = computed(() => sequentialCalculationResult.value.calculation);

const sequentialErrorMessage = computed(() => {
  const error = sequentialCalculationResult.value.error;
  if (!error) {
    return '';
  }
  const keys: Record<SequentialPercentageError, string> = {
    'invalid-start': 'tools.percentage-calculator.sequential.errors.invalidStart',
    'no-steps': 'tools.percentage-calculator.sequential.errors.noSteps',
    'too-many-steps': 'tools.percentage-calculator.sequential.errors.tooManySteps',
    'invalid-rate': 'tools.percentage-calculator.sequential.errors.invalidRate',
    'discount-over-100': 'tools.percentage-calculator.sequential.errors.discountOver100',
    overflow: 'tools.percentage-calculator.sequential.errors.overflow',
  };
  return t(keys[error], { maximum: MAX_SEQUENTIAL_PERCENTAGE_STEPS });
});

function addSequentialStep(): void {
  if (sequentialSteps.value.length >= MAX_SEQUENTIAL_PERCENTAGE_STEPS) {
    sequentialStatus.value = t('tools.percentage-calculator.sequential.errors.tooManySteps', {
      maximum: MAX_SEQUENTIAL_PERCENTAGE_STEPS,
    });
    return;
  }
  sequentialSteps.value.push({
    id: nextSequentialStepId++,
    operation: 'decrease',
    percentage: 10,
  });
  sequentialStatus.value = '';
}

function removeSequentialStep(id: number): void {
  sequentialSteps.value = sequentialSteps.value.filter(step => step.id !== id);
  sequentialStatus.value = '';
}

function moveSequentialStep(index: number, direction: -1 | 1): void {
  const target = index + direction;
  if (target < 0 || target >= sequentialSteps.value.length) {
    return;
  }
  const steps = [...sequentialSteps.value];
  [steps[index], steps[target]] = [steps[target], steps[index]];
  sequentialSteps.value = steps;
  sequentialStatus.value = '';
}

function loadSequentialExample(): void {
  sequentialStartingAmount.value = 100;
  sequentialSteps.value = [
    { id: nextSequentialStepId++, operation: 'decrease', percentage: 20 },
    { id: nextSequentialStepId++, operation: 'decrease', percentage: 10 },
  ];
  sequentialStatus.value = t('tools.percentage-calculator.sequential.exampleLoaded');
}

function sequentialSignedNumber(value: number): string {
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized > 0 ? `+${normalized}` : String(normalized);
}

async function copySequentialSummary(): Promise<void> {
  const calculation = sequentialCalculation.value;
  if (!calculation) {
    sequentialStatus.value = sequentialErrorMessage.value;
    return;
  }

  const lines = [
    `${t('tools.percentage-calculator.sequential.startingAmount')}: ${calculation.startingAmount}`,
    ...calculation.steps.map(step =>
      `${step.stepNumber}. ${t(`tools.percentage-calculator.sequential.operations.${step.operation}`)} ${step.percentage}%: ${step.startingValue} → ${step.endingValue}`,
    ),
    `${t('tools.percentage-calculator.sequential.finalAmount')}: ${calculation.finalAmount}`,
    `${t('tools.percentage-calculator.sequential.totalChange')}: ${sequentialSignedNumber(calculation.totalAmountChange)}`,
    `${t('tools.percentage-calculator.sequential.effectiveChange')}: ${calculation.effectivePercentageChange === null ? t('tools.percentage-calculator.sequential.notDefined') : `${sequentialSignedNumber(calculation.effectivePercentageChange)}%`}`,
    `${t('tools.percentage-calculator.sequential.formula')}: ${calculation.formula}`,
  ];

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(lines.join('\n'));
    sequentialStatus.value = t('tools.percentage-calculator.sequential.copied');
  }
  catch {
    sequentialStatus.value = t('tools.percentage-calculator.sequential.clipboardUnavailable');
  }
}

</script>

<template>
  <div style="flex: 0 0 100%">
    <div style="margin: 0 auto; max-width: 600px">
      <c-card mb-3>
        <div mb-3 sm:hidden>
          What is
        </div>
        <div flex gap-2>
          <div hidden pt-1 sm:block style="min-width: 48px;">
            What is
          </div>
          <n-input-number v-model:value="percentageX" data-test-id="percentageX" placeholder="X" />
          <div min-w-fit pt-1>
            % of
          </div>
          <n-input-number v-model:value="percentageY" data-test-id="percentageY" placeholder="Y" />
          <input-copyable v-model:value="percentageResult" data-test-id="percentageResult" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3 sm:hidden>
          X is what percent of Y
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="numberX" data-test-id="numberX" placeholder="X" />
          <div hidden min-w-fit pt-1 sm:block>
            is what percent of
          </div>
          <n-input-number v-model:value="numberY" data-test-id="numberY" placeholder="Y" />
          <input-copyable v-model:value="numberResult" data-test-id="numberResult" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3>
          What is the percentage increase/decrease
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="numberFrom" data-test-id="numberFrom" placeholder="From" />
          <n-input-number v-model:value="numberTo" data-test-id="numberTo" placeholder="To" />
          <input-copyable v-model:value="percentageIncreaseDecrease" data-test-id="percentageIncreaseDecrease" readonly placeholder="Result" style="max-width: 150px;" />
        </div>
      </c-card>

      <c-card mb-3>
        <div mb-3>
          Increase or decrease a value by a percentage
        </div>
        <div flex gap-2>
          <n-input-number v-model:value="adjustmentValue" data-test-id="adjustmentValue" placeholder="Value" />
          <div min-w-fit pt-1>
            by
          </div>
          <n-input-number v-model:value="adjustmentPercent" data-test-id="adjustmentPercent" placeholder="Percent" />
        </div>
        <div grid grid-cols-2 gap-2 mt-2>
          <div>
            <div text-sm op-70 mb-1>Increased</div>
            <input-copyable v-model:value="increasedValue" data-test-id="increasedValue" readonly placeholder="Result" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Decreased</div>
            <input-copyable v-model:value="decreasedValue" data-test-id="decreasedValue" readonly placeholder="Result" />
          </div>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="reverse-percentage-card">
        <div mb-3>
          Find the original value before a percentage increase or decrease
        </div>
        <div grid grid-cols-2 gap-2>
          <div>
            <div text-sm op-70 mb-1>Final value</div>
            <n-input-number v-model:value="reverseFinalValue" data-test-id="reverseFinalValue" placeholder="Final value" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Percentage applied</div>
            <n-input-number v-model:value="reversePercent" data-test-id="reversePercent" placeholder="Percent" />
          </div>
        </div>
        <div grid grid-cols-2 gap-2 mt-2>
          <div>
            <div text-sm op-70 mb-1>Original before an increase</div>
            <input-copyable v-model:value="originalBeforeIncrease" data-test-id="originalBeforeIncrease" readonly placeholder="Result" />
          </div>
          <div>
            <div text-sm op-70 mb-1>Original before a decrease</div>
            <input-copyable v-model:value="originalBeforeDecrease" data-test-id="originalBeforeDecrease" readonly placeholder="Result" />
          </div>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-difference-card">
        <div mb-3>
          Percentage difference between two values
        </div>
        <div grid grid-cols-2 gap-2>
          <n-input-number v-model:value="differenceA" data-test-id="differenceA" placeholder="Value A" />
          <n-input-number v-model:value="differenceB" data-test-id="differenceB" placeholder="Value B" />
        </div>
        <div mt-2>
          <div text-sm op-70 mb-1>Symmetric percentage difference</div>
          <input-copyable v-model:value="percentageDifference" data-test-id="percentageDifference" readonly placeholder="Result" />
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-points-card">
        <div mb-3>
          Percentage-point change between two rates
        </div>
        <div grid grid-cols-2 gap-2>
          <div>
            <div text-sm op-70 mb-1>Old rate (%)</div>
            <n-input-number v-model:value="rateFrom" data-test-id="rateFrom" placeholder="Old rate" />
          </div>
          <div>
            <div text-sm op-70 mb-1>New rate (%)</div>
            <n-input-number v-model:value="rateTo" data-test-id="rateTo" placeholder="New rate" />
          </div>
        </div>
        <div flex items-center gap-2 mt-2>
          <input-copyable v-model:value="percentagePointChange" data-test-id="percentagePointChange" readonly placeholder="Result" />
          <span text-sm op-70>percentage points</span>
        </div>
      </c-card>
    </div>

    <details class="mx-auto mt-8 max-w-800px px-4" data-test-id="percentage-sequential-panel">
      <summary class="cursor-pointer rounded-lg border border-gray-300 px-4 py-3 font-semibold dark:border-gray-600">
        {{ $t('tools.percentage-calculator.sequential.summary') }}
      </summary>
      <div class="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h2 class="mb-2 text-lg font-semibold">{{ $t('tools.percentage-calculator.sequential.title') }}</h2>
        <p class="mb-4 text-sm text-gray-700 dark:text-gray-300">
          {{ $t('tools.percentage-calculator.sequential.description') }}
        </p>

        <div class="mb-4 max-w-sm">
          <label class="mb-1 block text-sm font-semibold" for="percentage-sequential-start">
            {{ $t('tools.percentage-calculator.sequential.startingAmount') }}
          </label>
          <n-input-number
            id="percentage-sequential-start"
            v-model:value="sequentialStartingAmount"
            data-test-id="percentage-sequential-start"
            :min="0"
            class="w-full"
          />
        </div>

        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="font-semibold">{{ $t('tools.percentage-calculator.sequential.stepsTitle') }}</h3>
          <span class="text-xs text-gray-600 dark:text-gray-400">
            {{ $t('tools.percentage-calculator.sequential.stepLimit', { maximum: MAX_SEQUENTIAL_PERCENTAGE_STEPS }) }}
          </span>
        </div>

        <ol class="space-y-2">
          <li
            v-for="(step, index) in sequentialSteps"
            :key="step.id"
            :data-test-id="`percentage-sequential-step-${index + 1}`"
            class="grid grid-cols-1 items-end gap-2 rounded border border-gray-200 p-3 dark:border-gray-700 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <div>
              <label class="mb-1 block text-xs font-semibold" :for="`percentage-sequential-operation-${step.id}`">
                {{ $t('tools.percentage-calculator.sequential.stepNumber', { number: index + 1 }) }}
              </label>
              <select
                :id="`percentage-sequential-operation-${step.id}`"
                v-model="step.operation"
                :data-test-id="`percentage-sequential-operation-${index + 1}`"
                class="w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="decrease">{{ $t('tools.percentage-calculator.sequential.operations.decrease') }}</option>
                <option value="increase">{{ $t('tools.percentage-calculator.sequential.operations.increase') }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold" :for="`percentage-sequential-rate-${step.id}`">
                {{ $t('tools.percentage-calculator.sequential.percentage') }}
              </label>
              <n-input-number
                :id="`percentage-sequential-rate-${step.id}`"
                v-model:value="step.percentage"
                :data-test-id="`percentage-sequential-rate-${index + 1}`"
                :min="0"
                :max="1000"
                :step="0.1"
                class="w-full"
              />
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                type="button"
                :aria-label="$t('tools.percentage-calculator.sequential.moveUp', { number: index + 1 })"
                :disabled="index === 0"
                :data-test-id="`percentage-sequential-up-${index + 1}`"
                class="rounded border border-gray-300 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
                @click="moveSequentialStep(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                :aria-label="$t('tools.percentage-calculator.sequential.moveDown', { number: index + 1 })"
                :disabled="index === sequentialSteps.length - 1"
                :data-test-id="`percentage-sequential-down-${index + 1}`"
                class="rounded border border-gray-300 px-2 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
                @click="moveSequentialStep(index, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                :aria-label="$t('tools.percentage-calculator.sequential.removeStep', { number: index + 1 })"
                :data-test-id="`percentage-sequential-remove-${index + 1}`"
                class="rounded border border-gray-300 px-2 py-2 text-xs dark:border-gray-600"
                @click="removeSequentialStep(step.id)"
              >
                {{ $t('tools.percentage-calculator.sequential.remove') }}
              </button>
            </div>
          </li>
        </ol>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-test-id="percentage-sequential-add"
            :disabled="sequentialSteps.length >= MAX_SEQUENTIAL_PERCENTAGE_STEPS"
            class="rounded bg-primary px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="addSequentialStep"
          >
            {{ $t('tools.percentage-calculator.sequential.addStep') }}
          </button>
          <button
            type="button"
            data-test-id="percentage-sequential-example"
            class="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            @click="loadSequentialExample"
          >
            {{ $t('tools.percentage-calculator.sequential.loadExample') }}
          </button>
        </div>

        <div
          v-if="sequentialErrorMessage"
          class="mt-3 text-sm text-red-700 dark:text-red-300"
          role="alert"
          data-test-id="percentage-sequential-error"
        >
          {{ sequentialErrorMessage }}
        </div>

        <section v-if="sequentialCalculation" class="mt-4 rounded bg-gray-50 p-3 dark:bg-gray-900" data-test-id="percentage-sequential-results">
          <h3 class="mb-2 font-semibold">{{ $t('tools.percentage-calculator.sequential.resultsTitle') }}</h3>
          <ol class="space-y-2 text-sm">
            <li
              v-for="step in sequentialCalculation.steps"
              :key="step.stepNumber"
              :data-test-id="`percentage-sequential-result-${step.stepNumber}`"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <span>
                {{ $t('tools.percentage-calculator.sequential.stepNumber', { number: step.stepNumber }) }}:
                {{ $t(`tools.percentage-calculator.sequential.operations.${step.operation}`) }}
                {{ step.percentage }}%
              </span>
              <code>{{ step.startingValue }} → {{ step.endingValue }}</code>
            </li>
          </ol>

          <div class="mt-4 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 dark:border-gray-700 sm:grid-cols-3">
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400">{{ $t('tools.percentage-calculator.sequential.finalAmount') }}</div>
              <div class="text-lg font-semibold" data-test-id="percentage-sequential-final">{{ sequentialCalculation.finalAmount }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400">{{ $t('tools.percentage-calculator.sequential.totalChange') }}</div>
              <div class="font-semibold" data-test-id="percentage-sequential-total-change">{{ sequentialSignedNumber(sequentialCalculation.totalAmountChange) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400">{{ $t('tools.percentage-calculator.sequential.effectiveChange') }}</div>
              <div class="font-semibold" data-test-id="percentage-sequential-effective-change">
                {{ sequentialCalculation.effectivePercentageChange === null ? $t('tools.percentage-calculator.sequential.notDefined') : `${sequentialSignedNumber(sequentialCalculation.effectivePercentageChange)}%` }}
              </div>
            </div>
          </div>
          <p class="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {{ $t('tools.percentage-calculator.sequential.formula') }}:
            <code class="break-words">{{ sequentialCalculation.formula }}</code>
          </p>
          <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
            {{ $t('tools.percentage-calculator.sequential.compoundingNote') }}
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-test-id="percentage-sequential-copy"
              class="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600"
              @click="copySequentialSummary"
            >
              {{ $t('tools.percentage-calculator.sequential.copySummary') }}
            </button>
            <span
              role="status"
              aria-live="polite"
              data-test-id="percentage-sequential-status"
              class="text-sm"
            >
              {{ sequentialStatus }}
            </span>
          </div>
        </section>
      </div>
    </details>

    <details class="mx-auto mt-8 max-w-800px px-4" data-test-id="percentage-batch-panel">
      <summary class="cursor-pointer rounded-lg border border-gray-300 px-4 py-3 font-semibold dark:border-gray-600">
        {{ $t('tools.percentage-calculator.batch.summary') }}
      </summary>
      <div class="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h2 class="mb-2 text-lg font-semibold">{{ $t('tools.percentage-calculator.batch.title') }}</h2>
        <p class="mb-4 text-sm">
          {{ $t('tools.percentage-calculator.batch.description') }}
        </p>

        <label class="mb-2 block text-sm font-semibold" for="percentage-batch-mode">{{ $t('tools.percentage-calculator.batch.calculation') }}</label>
        <select
          id="percentage-batch-mode"
          v-model="percentageBatchMode"
          data-test-id="percentage-batch-mode"
          class="mb-2 w-full rounded border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-900"
        >
          <option value="percent-of">{{ $t('tools.percentage-calculator.batch.modes.percent-of') }}</option>
          <option value="part-to-whole">{{ $t('tools.percentage-calculator.batch.modes.part-to-whole') }}</option>
          <option value="percentage-change">{{ $t('tools.percentage-calculator.batch.modes.percentage-change') }}</option>
          <option value="adjustment">{{ $t('tools.percentage-calculator.batch.modes.adjustment') }}</option>
          <option value="reverse">{{ $t('tools.percentage-calculator.batch.modes.reverse') }}</option>
          <option value="percentage-difference">{{ $t('tools.percentage-calculator.batch.modes.percentage-difference') }}</option>
          <option value="percentage-points">{{ $t('tools.percentage-calculator.batch.modes.percentage-points') }}</option>
        </select>
        <p class="mb-2 text-xs text-gray-600 dark:text-gray-300">{{ percentageBatchInputHint }}</p>

        <label class="mb-2 block text-sm font-semibold" for="percentage-batch-input">{{ $t('tools.percentage-calculator.batch.inputLabel') }}</label>
        <textarea
          id="percentage-batch-input"
          v-model="percentageBatchInput"
          data-test-id="percentage-batch-input"
          rows="5"
          spellcheck="false"
          :placeholder="$t('tools.percentage-calculator.batch.placeholder')"
          class="w-full rounded border border-gray-300 bg-white p-3 font-mono text-sm dark:border-gray-600 dark:bg-gray-900"
        />

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            data-test-id="percentage-batch-run"
            :disabled="!percentageBatchInput.trim()"
            class="rounded bg-primary px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="runPercentageBatchRows"
          >
            {{ $t('tools.percentage-calculator.batch.run') }}
          </button>
          <button
            type="button"
            data-test-id="percentage-batch-copy-csv"
            :disabled="!percentageBatchRows.length"
            class="rounded border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            @click="copyPercentageBatchCsv"
          >
            {{ $t('tools.percentage-calculator.batch.copyCsv') }}
          </button>
          <button
            type="button"
            data-test-id="percentage-batch-copy-tsv"
            :disabled="!percentageBatchRows.length"
            class="rounded border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            @click="copyPercentageBatchTsv"
          >
            {{ $t('tools.percentage-calculator.batch.copyTsv') }}
          </button>
          <button
            type="button"
            data-test-id="percentage-batch-download-csv"
            :disabled="!percentageBatchRows.length"
            class="rounded border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            @click="downloadPercentageBatch('csv')"
          >
            {{ $t('tools.percentage-calculator.batch.downloadCsv') }}
          </button>
          <button
            type="button"
            data-test-id="percentage-batch-download-tsv"
            :disabled="!percentageBatchRows.length"
            class="rounded border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600"
            @click="downloadPercentageBatch('tsv')"
          >
            {{ $t('tools.percentage-calculator.batch.downloadTsv') }}
          </button>
        </div>

        <div
          class="mt-3 text-sm"
          role="status"
          aria-live="polite"
          data-test-id="percentage-batch-status"
        >
          {{ percentageBatchStatus }}
        </div>

        <div v-if="percentageBatchRows.length" class="mt-4 overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-gray-300 dark:border-gray-600">
                <th class="px-2 py-2">{{ $t('tools.percentage-calculator.batch.row') }}</th>
                <th class="px-2 py-2">{{ $t('tools.percentage-calculator.batch.formula') }}</th>
                <th class="px-2 py-2">{{ $t('tools.percentage-calculator.batch.resultIssue') }}</th>
                <th class="px-2 py-2">{{ $t('tools.percentage-calculator.batch.action') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in percentageBatchRows"
                :key="row.lineNumber"
                :data-test-id="`percentage-batch-result-${row.lineNumber}`"
                class="border-b border-gray-200 align-top dark:border-gray-700"
              >
                <td class="px-2 py-2">{{ row.label }}</td>
                <td class="px-2 py-2">
                  <code class="break-words">{{ row.formula || '—' }}</code>
                </td>
                <td class="px-2 py-2">
                  <span v-if="row.error" class="text-red-700 dark:text-red-300" role="alert">{{ percentageBatchErrorMessage(row.error) }}</span>
                  <span v-else>{{ row.result }}</span>
                </td>
                <td class="px-2 py-2">
                  <button
                    type="button"
                    class="whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                    @click="copyPercentageBatchRow(row)"
                  >
                    {{ $t('tools.percentage-calculator.batch.copyRow') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section v-if="percentageBatchHistory.length" class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-semibold">{{ $t('tools.percentage-calculator.batch.historyTitle') }}</h3>
            <button
              type="button"
              data-test-id="percentage-batch-clear-history"
              class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
              @click="clearPercentageBatchHistory"
            >
              {{ $t('tools.percentage-calculator.batch.clearHistory') }}
            </button>
          </div>
          <ul class="space-y-2">
            <li
              v-for="item in percentageBatchHistory"
              :key="item.id"
              data-test-id="percentage-batch-history-item"
              class="flex flex-wrap items-center justify-between gap-2 rounded bg-gray-50 p-2 text-sm dark:bg-gray-900"
            >
              <span>{{ percentageBatchModeNames[item.mode] }} · {{ percentageBatchSavedAt(item.savedAt) }}</span>
              <span class="flex gap-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  @click="restorePercentageBatchHistory(item)"
                >
                  {{ $t('tools.percentage-calculator.batch.restore') }}
                </button>
                <button
                  type="button"
                  class="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
                  :aria-label="$t('tools.percentage-calculator.batch.removeAria', { mode: percentageBatchModeNames[item.mode] })"
                  @click="removePercentageBatchHistory(item.id)"
                >
                  {{ $t('tools.percentage-calculator.batch.remove') }}
                </button>
              </span>
            </li>
          </ul>
        </section>

        <p class="mt-4 text-xs text-gray-600 dark:text-gray-300">
          {{ $t('tools.percentage-calculator.batch.privacy') }}
        </p>
      </div>
    </details>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="percentage-calculator-guide">
      <h2 class="mb-3 text-xl font-semibold">How to calculate a percentage</h2>
      <p class="mb-4">
        Use the calculator above for seven common percentage problems: finding a percent of a number,
        expressing one number as a percent of another, measuring percentage change, applying an
        increase or decrease, reversing a percentage change, comparing two values symmetrically, and
        measuring percentage-point change between rates.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Percentage formulas and examples</h3>
      <ul class="mb-4 list-disc pl-6">
        <li><strong>What is X% of Y?</strong> Calculate (X ÷ 100) × Y. Example: 15% of 80 is 12.</li>
        <li><strong>X is what percent of Y?</strong> Calculate (X ÷ Y) × 100. Example: 30 is 25% of 120.</li>
        <li><strong>Percentage change:</strong> Calculate ((new value − original value) ÷ original value) × 100. Example: a price rising from 80 to 92 is a 15% increase.</li>
        <li><strong>Increase or decrease by a percent:</strong> Multiply the starting value by (1 + p ÷ 100) to increase, or (1 − p ÷ 100) to decrease. Example: reducing 80 by 15% gives 68.</li>
        <li><strong>Reverse percentage:</strong> Divide a final value by (1 + p ÷ 100) to find the value before an increase, or by (1 − p ÷ 100) to reverse a decrease. For example, 120 after a 20% increase came from 120 ÷ 1.20 = 100.</li>
        <li><strong>Percentage difference:</strong> Divide the absolute difference by the average of the two values' absolute magnitudes, then multiply by 100. For 100 and 150, the symmetric difference is 40%.</li>
        <li><strong>Percentage points:</strong> Subtract the old rate from the new rate. A move from 5% to 7% is +2 percentage points, or +40% relative change.</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">Discounts, sales tax and percentage change</h3>
      <p class="mb-4">
        For a discount, use the decrease calculation: subtract the discount percentage from the original
        price. To recover the pre-discount price from a sale price, use reverse percentage instead.
        For sales tax, use the increase calculation: add the tax percentage to the pre-tax price.
        For example, a 10% discount on 50 gives 45 before any additional taxes or fees; reversing that
        discount divides 45 by 0.90 to recover 50.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Common percentage calculation mistakes</h3>
      <ul class="list-disc pl-6">
        <li>Percentage change uses the original value as its denominator, not the new value.</li>
        <li>Percentage difference uses the average magnitude of both values, not the original value as a baseline.</li>
        <li>A percentage change from an original value of zero is undefined; choose a non-zero starting value.</li>
        <li>A 15% increase followed by a 15% decrease does not return to the starting value, because the second change uses a different base.</li>
        <li>A percentage-point change is an absolute difference between rates, not the same as relative percentage change.</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">Common percentage questions</h3>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate a percentage of a number?</h4>
        <p>
          Divide the percentage by 100, then multiply by the number. For example, 18% of 250 is
          (18 ÷ 100) × 250 = 45.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I find what percentage one number is of another?</h4>
        <p>
          Divide the first number by the total, then multiply by 100. For example, 45 out of 250 is
          (45 ÷ 250) × 100 = 18%. The total cannot be zero.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate percentage increase or decrease?</h4>
        <p>
          Subtract the original value from the new value, divide by the original value, and multiply
          by 100. A positive result is an increase; a negative result is a decrease. An original
          value of zero makes percentage change undefined.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I find the original value before a discount or increase?</h4>
        <p>
          Divide the final value by one plus the increase rate, or one minus the decrease rate. A
          $80 item after a 20% discount had an original price of 80 ÷ 0.80 = $100; adding 20% to $80
          would not reverse the discount.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">What is the difference between percentage change and percentage difference?</h4>
        <p>
          Percentage change is directional and uses the starting value as its base. Percentage
          difference is symmetric: it divides the absolute gap by the average magnitude of both
          values, so swapping A and B does not change the result.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">What is a percentage-point change?</h4>
        <p>
          It is the new rate minus the old rate. A move from 5% to 7% is +2 percentage points and
          +40% relative change; the two measurements answer different questions.
        </p>
      </div>
      <div class="mb-4">
        <h4 class="mb-1 font-semibold">How do I calculate a discount or add sales tax?</h4>
        <p>
          Apply a discount with the decrease calculator and add a tax rate with the increase
          calculator. If both apply, calculate each step using the updated amount; actual tax rules
          depend on the product and location.
        </p>
      </div>
    </section>
  </div>
</template>
