<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  PercentageBatchMode,
  PercentageBatchRow,
} from './percentage-calculator.batch';
import {
  MAX_SEQUENTIAL_PERCENTAGE_STEPS,
  type SequentialPercentageError,
  type SequentialPercentageStepInput,
  calculateSequentialPercentage,
} from './percentage-calculator.sequential';
import {
  percentageBatchToCsv,
  percentageBatchToTsv,
  runPercentageBatch,
} from './percentage-calculator.batch';
import { PERCENTAGE_CALCULATION_MODES } from './percentage-calculator.modes';

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
const percentageResultDetails = computed(() => {
  if (
    !isFiniteNumber(percentageX.value)
    || !isFiniteNumber(percentageY.value)
    || percentageResult.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.percentOf', {
      percent: percentageX.value,
      whole: percentageY.value,
      result: percentageResult.value,
    }),
    formula: `(${percentageX.value} ÷ 100) × ${percentageY.value} = ${percentageResult.value}`,
  };
});

const partToWholeDetails = computed(() => {
  if (
    !isFiniteNumber(numberX.value)
    || !isFiniteNumber(numberY.value)
    || numberY.value === 0
    || numberResult.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.partToWhole', {
      part: numberX.value,
      whole: numberY.value,
      result: numberResult.value,
    }),
    formula: `(${numberX.value} ÷ ${numberY.value}) × 100 = ${numberResult.value}%`,
  };
});

const percentageChangeDetails = computed(() => {
  if (
    !isFiniteNumber(numberFrom.value)
    || !isFiniteNumber(numberTo.value)
    || numberFrom.value === 0
    || percentageIncreaseDecrease.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.percentageChange', {
      oldValue: numberFrom.value,
      newValue: numberTo.value,
      result: percentageIncreaseDecrease.value,
    }),
    formula: `(${numberTo.value} − ${numberFrom.value}) ÷ ${numberFrom.value} × 100 = ${percentageIncreaseDecrease.value}%`,
  };
});

const adjustmentDetails = computed(() => {
  if (
    !isFiniteNumber(adjustmentValue.value)
    || !isFiniteNumber(adjustmentPercent.value)
    || increasedValue.value === ''
    || decreasedValue.value === ''
  ) {
    return null;
  }
  return {
    increaseWords: t('tools.percentage-calculator.resultDetails.increase', {
      value: adjustmentValue.value,
      percent: adjustmentPercent.value,
      result: increasedValue.value,
    }),
    decreaseWords: t('tools.percentage-calculator.resultDetails.decrease', {
      value: adjustmentValue.value,
      percent: adjustmentPercent.value,
      result: decreasedValue.value,
    }),
    increaseFormula: `${adjustmentValue.value} × (1 + ${adjustmentPercent.value} ÷ 100) = ${increasedValue.value}`,
    decreaseFormula: `${adjustmentValue.value} × (1 − ${adjustmentPercent.value} ÷ 100) = ${decreasedValue.value}`,
  };
});

const reverseIncreaseDetails = computed(() => {
  if (
    !isFiniteNumber(reverseFinalValue.value)
    || !isFiniteNumber(reversePercent.value)
    || originalBeforeIncrease.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.reverseIncrease', {
      percent: reversePercent.value,
      finalValue: reverseFinalValue.value,
      originalValue: originalBeforeIncrease.value,
    }),
    formula: `${reverseFinalValue.value} ÷ (1 + ${reversePercent.value} ÷ 100) = ${originalBeforeIncrease.value}`,
  };
});

const reverseDecreaseDetails = computed(() => {
  if (
    !isFiniteNumber(reverseFinalValue.value)
    || !isFiniteNumber(reversePercent.value)
    || originalBeforeDecrease.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.reverseDecrease', {
      percent: reversePercent.value,
      finalValue: reverseFinalValue.value,
      originalValue: originalBeforeDecrease.value,
    }),
    formula: `${reverseFinalValue.value} ÷ (1 − ${reversePercent.value} ÷ 100) = ${originalBeforeDecrease.value}`,
  };
});

const reverseDetails = computed(() => {
  if (!isFiniteNumber(reverseFinalValue.value) || !isFiniteNumber(reversePercent.value)) {
    return null;
  }
  return {
    increase: reverseIncreaseDetails.value,
    decrease: reverseDecreaseDetails.value,
  };
});

const percentageDifferenceDetails = computed(() => {
  if (
    !isFiniteNumber(differenceA.value)
    || !isFiniteNumber(differenceB.value)
    || percentageDifference.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.percentageDifference', {
      first: differenceA.value,
      second: differenceB.value,
      result: percentageDifference.value,
    }),
    formula: `|${differenceA.value} − ${differenceB.value}| ÷ ((|${differenceA.value}| + |${differenceB.value}|) ÷ 2) × 100 = ${percentageDifference.value}%`,
  };
});

const percentagePointsDetails = computed(() => {
  if (
    !isFiniteNumber(rateFrom.value)
    || !isFiniteNumber(rateTo.value)
    || percentagePointChange.value === ''
  ) {
    return null;
  }
  return {
    words: t('tools.percentage-calculator.resultDetails.percentagePoints', {
      oldRate: rateFrom.value,
      newRate: rateTo.value,
      result: percentagePointChange.value,
    }),
    formula: `${rateTo.value} − ${rateFrom.value} = ${percentagePointChange.value} percentage points`,
  };
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
const activeCalculationMode = ref<PercentageBatchMode>('percent-of');
const percentageBatchMode = ref<PercentageBatchMode>('percent-of');

type PercentageQuickExample = 'percent-of' | 'part-to-whole' | 'percentage-change' | 'adjustment';

function loadPercentageQuickExample(example: PercentageQuickExample): void {
  activeCalculationMode.value = example;
  switch (example) {
    case 'percent-of':
      percentageX.value = 15;
      percentageY.value = 80;
      break;
    case 'part-to-whole':
      numberX.value = 30;
      numberY.value = 120;
      break;
    case 'percentage-change':
      numberFrom.value = 80;
      numberTo.value = 92;
      break;
    case 'adjustment':
      adjustmentValue.value = 80;
      adjustmentPercent.value = 15;
      break;
  }
}
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
    'overflow': 'tools.percentage-calculator.sequential.errors.overflow',
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
      <p class="percentage-mode-intro">
        {{ $t('tools.percentage-calculator.ui.intro') }}
      </p>
      <div class="percentage-mode-switcher" role="group" :aria-label="$t('tools.percentage-calculator.ui.chooseMode')">
        <button
          v-for="mode in PERCENTAGE_CALCULATION_MODES"
          :key="mode"
          type="button"
          class="percentage-mode-button"
          :aria-pressed="activeCalculationMode === mode"
          @click="activeCalculationMode = mode"
        >
          {{ $t(`tools.percentage-calculator.ui.modes.${mode}`) }}
        </button>
      </div>

      <div class="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('tools.percentage-calculator.ui.tryExample') }}
      </div>
      <div class="percentage-example-strip" data-test-id="percentage-quick-examples">
        <button type="button" class="percentage-example-button" data-test-id="percentage-example-percent-of"
          :aria-label="`${$t('tools.percentage-calculator.ui.modes.percent-of')}: 15% of 80, result 12`"
          @click="loadPercentageQuickExample('percent-of')">15% × 80 = 12</button>
        <button type="button" class="percentage-example-button" data-test-id="percentage-example-part-to-whole"
          :aria-label="`${$t('tools.percentage-calculator.ui.modes.part-to-whole')}: 30 of 120, result 25 percent`"
          @click="loadPercentageQuickExample('part-to-whole')">30 ÷ 120 = 25%</button>
        <button type="button" class="percentage-example-button" data-test-id="percentage-example-percentage-change"
          :aria-label="`${$t('tools.percentage-calculator.ui.modes.percentage-change')}: 80 to 92, a 15 percent increase`"
          @click="loadPercentageQuickExample('percentage-change')">80 → 92 = +15%</button>
        <button type="button" class="percentage-example-button" data-test-id="percentage-example-adjustment"
          :aria-label="`${$t('tools.percentage-calculator.ui.modes.adjustment')}: increase or decrease 80 by 15 percent`"
          @click="loadPercentageQuickExample('adjustment')">80 ± 15% = 92 / 68</button>
      </div>

      <c-card mb-3 v-show="activeCalculationMode === 'percent-of'" data-test-id="percentage-mode-percent-of">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.percent-of') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-x" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.percentage') }}</label>
            <n-input-number id="percentage-x" v-model:value="percentageX" data-test-id="percentageX" :placeholder="$t('tools.percentage-calculator.ui.fields.percentagePlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-y" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.whole') }}</label>
            <n-input-number id="percentage-y" v-model:value="percentageY" data-test-id="percentageY" :placeholder="$t('tools.percentage-calculator.ui.fields.wholePlaceholder')" class="w-full" />
          </div>
          <div class="col-span-2 min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.result') }}</div>
            <input-copyable v-model:value="percentageResult" data-test-id="percentageResult" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <div v-if="percentageResultDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-percent-of">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ percentageResultDetails.words }}</p>
          <p class="mt-1"><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ percentageResultDetails.formula }}</code></p>
        </div>
      </c-card>

      <c-card mb-3 v-show="activeCalculationMode === 'part-to-whole'" data-test-id="percentage-mode-part-to-whole">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.part-to-whole') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="part-to-whole-part" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.part') }}</label>
            <n-input-number id="part-to-whole-part" v-model:value="numberX" data-test-id="numberX" :placeholder="$t('tools.percentage-calculator.ui.fields.partPlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="part-to-whole-whole" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.whole') }}</label>
            <n-input-number id="part-to-whole-whole" v-model:value="numberY" data-test-id="numberY" :placeholder="$t('tools.percentage-calculator.ui.fields.wholePlaceholder')" class="w-full" />
          </div>
          <div class="col-span-2 min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.result') }}</div>
            <input-copyable v-model:value="numberResult" data-test-id="numberResult" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <div v-if="partToWholeDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-part-to-whole">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ partToWholeDetails.words }}</p>
          <p class="mt-1"><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ partToWholeDetails.formula }}</code></p>
        </div>
      </c-card>

      <c-card mb-3 v-show="activeCalculationMode === 'percentage-change'" data-test-id="percentage-mode-percentage-change">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.percentage-change') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-old-value" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.oldValue') }}</label>
            <n-input-number id="percentage-old-value" v-model:value="numberFrom" data-test-id="numberFrom" :placeholder="$t('tools.percentage-calculator.ui.fields.oldValuePlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-new-value" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.newValue') }}</label>
            <n-input-number id="percentage-new-value" v-model:value="numberTo" data-test-id="numberTo" :placeholder="$t('tools.percentage-calculator.ui.fields.newValuePlaceholder')" class="w-full" />
          </div>
          <div class="col-span-2 min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.changeResult') }}</div>
            <input-copyable v-model:value="percentageIncreaseDecrease" data-test-id="percentageIncreaseDecrease" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-600 dark:text-slate-300" data-test-id="percentage-hint-change">{{ $t('tools.percentage-calculator.ui.hints.percentageChange') }}</p>
        <div v-if="percentageChangeDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-change">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ percentageChangeDetails.words }}</p>
          <p class="mt-1"><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ percentageChangeDetails.formula }}</code></p>
        </div>
      </c-card>

      <c-card mb-3 v-show="activeCalculationMode === 'adjustment'" data-test-id="percentage-mode-adjustment">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.adjustment') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-adjustment-value" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.baseValue') }}</label>
            <n-input-number id="percentage-adjustment-value" v-model:value="adjustmentValue" data-test-id="adjustmentValue" :placeholder="$t('tools.percentage-calculator.ui.fields.baseValuePlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-adjustment-rate" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.rate') }}</label>
            <n-input-number id="percentage-adjustment-rate" v-model:value="adjustmentPercent" data-test-id="adjustmentPercent" :placeholder="$t('tools.percentage-calculator.ui.fields.ratePlaceholder')" class="w-full" />
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.afterIncrease') }}</div>
            <input-copyable v-model:value="increasedValue" data-test-id="increasedValue" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.afterDecrease') }}</div>
            <input-copyable v-model:value="decreasedValue" data-test-id="decreasedValue" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <div v-if="adjustmentDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-adjustment">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ adjustmentDetails.increaseWords }}</p>
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ adjustmentDetails.increaseFormula }}</code></p>
          <p class="mt-2"><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ adjustmentDetails.decreaseWords }}</p>
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ adjustmentDetails.decreaseFormula }}</code></p>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="reverse-percentage-card" v-show="activeCalculationMode === 'reverse'">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.reverse') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-reverse-final" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.finalValue') }}</label>
            <n-input-number id="percentage-reverse-final" v-model:value="reverseFinalValue" data-test-id="reverseFinalValue" :placeholder="$t('tools.percentage-calculator.ui.fields.finalValuePlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-reverse-rate" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.rate') }}</label>
            <n-input-number id="percentage-reverse-rate" v-model:value="reversePercent" data-test-id="reversePercent" :placeholder="$t('tools.percentage-calculator.ui.fields.ratePlaceholder')" class="w-full" />
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.beforeIncrease') }}</div>
            <input-copyable v-model:value="originalBeforeIncrease" data-test-id="originalBeforeIncrease" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.beforeDecrease') }}</div>
            <input-copyable v-model:value="originalBeforeDecrease" data-test-id="originalBeforeDecrease" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <div v-if="reverseDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-reverse">
          <template v-if="reverseDetails.increase">
            <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ reverseDetails.increase.words }}</p>
            <p><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ reverseDetails.increase.formula }}</code></p>
          </template>
          <template v-if="reverseDetails.decrease">
            <p class="mt-2"><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ reverseDetails.decrease.words }}</p>
            <p><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ reverseDetails.decrease.formula }}</code></p>
          </template>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-difference-card" v-show="activeCalculationMode === 'percentage-difference'">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.percentage-difference') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-difference-a" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.valueA') }}</label>
            <n-input-number id="percentage-difference-a" v-model:value="differenceA" data-test-id="differenceA" :placeholder="$t('tools.percentage-calculator.ui.fields.valueAPlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-difference-b" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.valueB') }}</label>
            <n-input-number id="percentage-difference-b" v-model:value="differenceB" data-test-id="differenceB" :placeholder="$t('tools.percentage-calculator.ui.fields.valueBPlaceholder')" class="w-full" />
          </div>
          <div class="col-span-2 min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.symmetricDifference') }}</div>
            <input-copyable v-model:value="percentageDifference" data-test-id="percentageDifference" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-600 dark:text-slate-300" data-test-id="percentage-hint-difference">{{ $t('tools.percentage-calculator.ui.hints.percentageDifference') }}</p>
        <div v-if="percentageDifferenceDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-difference">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ percentageDifferenceDetails.words }}</p>
          <p class="mt-1"><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ percentageDifferenceDetails.formula }}</code></p>
        </div>
      </c-card>

      <c-card mb-3 data-test-id="percentage-points-card" v-show="activeCalculationMode === 'percentage-points'">
        <h3 class="mb-3 text-sm font-semibold">{{ $t('tools.percentage-calculator.ui.modes.percentage-points') }}</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="min-w-0">
            <label for="percentage-rate-from" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.oldRate') }}</label>
            <n-input-number id="percentage-rate-from" v-model:value="rateFrom" data-test-id="rateFrom" :placeholder="$t('tools.percentage-calculator.ui.fields.oldRatePlaceholder')" class="w-full" />
          </div>
          <div class="min-w-0">
            <label for="percentage-rate-to" class="mb-1 block text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.newRate') }}</label>
            <n-input-number id="percentage-rate-to" v-model:value="rateTo" data-test-id="rateTo" :placeholder="$t('tools.percentage-calculator.ui.fields.newRatePlaceholder')" class="w-full" />
          </div>
          <div class="col-span-2 min-w-0">
            <div class="mb-1 text-sm font-medium">{{ $t('tools.percentage-calculator.ui.fields.percentagePointChange') }}</div>
            <div class="flex items-center gap-2">
              <input-copyable v-model:value="percentagePointChange" data-test-id="percentagePointChange" readonly :placeholder="$t('tools.percentage-calculator.ui.fields.resultPlaceholder')" class="w-full" />
              <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">{{ $t('tools.percentage-calculator.ui.fields.percentagePointsUnit') }}</span>
            </div>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-600 dark:text-slate-300" data-test-id="percentage-hint-points">{{ $t('tools.percentage-calculator.ui.hints.percentagePoints') }}</p>
        <div v-if="percentagePointsDetails" class="mt-3 rounded border border-gray-200 p-3 text-xs dark:border-gray-700" data-test-id="percentage-details-points">
          <p><strong>{{ $t('tools.percentage-calculator.resultDetails.inWords') }}:</strong> {{ percentagePointsDetails.words }}</p>
          <p class="mt-1"><strong>{{ $t('tools.percentage-calculator.resultDetails.formula') }}:</strong> <code class="break-words">{{ percentagePointsDetails.formula }}</code></p>
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
      <h2 class="mb-3 text-xl font-semibold">{{ $t('tools.percentage-calculator.guide.title') }}</h2>
      <p class="mb-4">{{ $t('tools.percentage-calculator.guide.intro') }}</p>

      <h3 class="mb-2 text-lg font-semibold">{{ $t('tools.percentage-calculator.guide.formulasTitle') }}</h3>
      <ul class="mb-4 list-disc space-y-2 pl-6">
        <li>{{ $t('tools.percentage-calculator.guide.formulas.percentOf') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.partToWhole') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.percentageChange') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.adjustment') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.reverse') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.percentageDifference') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.formulas.percentagePoints') }}</li>
      </ul>

      <h3 class="mb-2 text-lg font-semibold">{{ $t('tools.percentage-calculator.guide.distinctionsTitle') }}</h3>
      <p class="mb-3">{{ $t('tools.percentage-calculator.guide.changeVsDifference') }}</p>
      <p class="mb-4">{{ $t('tools.percentage-calculator.guide.percentagePointsNote') }}</p>

      <h3 class="mb-2 text-lg font-semibold">{{ $t('tools.percentage-calculator.guide.edgeCasesTitle') }}</h3>
      <ul class="mb-4 list-disc space-y-2 pl-6">
        <li>{{ $t('tools.percentage-calculator.guide.denominatorLimits') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.sequentialAdjustments') }}</li>
        <li>{{ $t('tools.percentage-calculator.guide.displayPrecision') }}</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.percentage-example-strip {
  display: flex;
  gap: 0.45rem;
  margin: -0.15rem 0 0.8rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 0.15rem 0.1rem 0.35rem;
  scrollbar-width: thin;
}
.percentage-example-button {
  display: inline-flex;
  min-height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #f8fafc;
  color: #334155;
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
}
.percentage-example-button:hover {
  border-color: #0f766e;
  color: #0f766e;
}
.percentage-example-button:focus-visible {
  outline: 3px solid rgba(13, 148, 136, 0.35);
  outline-offset: 2px;
}
:global(html[data-theme="dark"]) .percentage-example-button {
  border-color: #475569;
  background: #1f2937;
  color: #e2e8f0;
}
:global(html[data-theme="dark"]) .percentage-example-button:hover {
  border-color: #2dd4bf;
  color: #5eead4;
}
.percentage-mode-intro {
  margin: 0 0 0.8rem;
  color: #64748b;
  font-size: 0.84rem;
  line-height: 1.55;
}
.percentage-mode-switcher {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
  margin: 0 0 1rem;
}
.percentage-mode-button {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 0.7rem;
  border: 1px solid #dbe3ea;
  border-radius: 0.65rem;
  background: #f8fafc;
  color: #334155;
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
  white-space: normal;
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease, color 150ms ease, transform 150ms ease;
}
.percentage-mode-button:hover {
  border-color: #0f766e;
  color: #0f766e;
}
.percentage-mode-button[aria-pressed="true"] {
  border-color: var(--dd-primary, #0f766e);
  background: var(--dd-primary, #0f766e);
  color: #fff;
  box-shadow: 0 4px 12px rgba(15, 118, 110, 0.18);
}
.percentage-mode-button:focus-visible {
  outline: 3px solid rgba(13, 148, 136, 0.35);
  outline-offset: 2px;
}
:global(html[data-theme="dark"]) .percentage-mode-intro {
  color: #aeb9c7;
}
:global(html[data-theme="dark"]) .percentage-mode-button {
  border-color: #475569;
  background: #1f2937;
  color: #e2e8f0;
}
:global(html[data-theme="dark"]) .percentage-mode-button:hover {
  border-color: #2dd4bf;
  color: #5eead4;
}
:global(html[data-theme="dark"]) .percentage-mode-button[aria-pressed="true"] {
  border-color: var(--dd-primary, #0f766e);
  background: var(--dd-primary, #0f766e);
  color: #fff;
}
@media (min-width: 480px) {
  .percentage-mode-switcher {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 800px) {
  .percentage-mode-switcher {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .percentage-mode-button {
    transition: none;
  }
}
</style>
