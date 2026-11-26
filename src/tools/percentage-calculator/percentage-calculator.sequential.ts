export const MAX_SEQUENTIAL_PERCENTAGE_STEPS = 20;
export const MAX_SEQUENTIAL_PERCENTAGE_RATE = 1000;

export type SequentialPercentageOperation = 'increase' | 'decrease';

export interface SequentialPercentageStepInput {
  operation: SequentialPercentageOperation
  percentage: number | null
}

export interface SequentialPercentageStepResult {
  stepNumber: number
  operation: SequentialPercentageOperation
  percentage: number
  startingValue: number
  endingValue: number
  amountChange: number
  multiplier: number
}

export interface SequentialPercentageCalculation {
  startingAmount: number
  finalAmount: number
  totalAmountChange: number
  effectivePercentageChange: number | null
  steps: SequentialPercentageStepResult[]
  formula: string
}

export type SequentialPercentageError =
  | 'invalid-start'
  | 'no-steps'
  | 'too-many-steps'
  | 'invalid-rate'
  | 'discount-over-100'
  | 'overflow';

export interface SequentialPercentageCalculationResult {
  calculation: SequentialPercentageCalculation | null
  error: SequentialPercentageError | null
}

function displayNumber(value: number): number {
  if (Object.is(value, -0)) {
    return 0;
  }
  return Number(value.toPrecision(12));
}

function numberText(value: number): string {
  return String(displayNumber(value));
}

/**
 * Applies each percentage to the current intermediate value. The amount is
 * kept at full JavaScript precision during the chain; only returned display
 * values are normalized to 12 significant digits to avoid floating artefacts.
 */
export function calculateSequentialPercentage(
  startingAmount: number | null,
  steps: readonly SequentialPercentageStepInput[],
): SequentialPercentageCalculationResult {
  if (startingAmount === null || !Number.isFinite(startingAmount) || startingAmount < 0) {
    return { calculation: null, error: 'invalid-start' };
  }
  if (steps.length === 0) {
    return { calculation: null, error: 'no-steps' };
  }
  if (steps.length > MAX_SEQUENTIAL_PERCENTAGE_STEPS) {
    return { calculation: null, error: 'too-many-steps' };
  }

  let currentValue = startingAmount;
  const results: SequentialPercentageStepResult[] = [];
  const factors: string[] = [];

  for (const [index, step] of steps.entries()) {
    const { operation, percentage } = step;
    if (
      (operation !== 'increase' && operation !== 'decrease')
      || percentage === null
      || !Number.isFinite(percentage)
      || percentage < 0
      || percentage > MAX_SEQUENTIAL_PERCENTAGE_RATE
    ) {
      return { calculation: null, error: 'invalid-rate' };
    }
    if (operation === 'decrease' && percentage > 100) {
      return { calculation: null, error: 'discount-over-100' };
    }

    const multiplier = operation === 'increase'
      ? 1 + percentage / 100
      : 1 - percentage / 100;
    const nextValue = currentValue * multiplier;
    if (!Number.isFinite(nextValue)) {
      return { calculation: null, error: 'overflow' };
    }

    results.push({
      stepNumber: index + 1,
      operation,
      percentage: displayNumber(percentage),
      startingValue: displayNumber(currentValue),
      endingValue: displayNumber(nextValue),
      amountChange: displayNumber(nextValue - currentValue),
      multiplier: displayNumber(multiplier),
    });
    factors.push(multiplier.toString());
    currentValue = nextValue;
  }

  const finalAmount = displayNumber(currentValue);
  const effectivePercentageChange = startingAmount === 0
    ? null
    : displayNumber((currentValue / startingAmount - 1) * 100);

  return {
    calculation: {
      startingAmount: displayNumber(startingAmount),
      finalAmount,
      totalAmountChange: displayNumber(currentValue - startingAmount),
      effectivePercentageChange,
      steps: results,
      formula: `${[
        numberText(startingAmount),
        ...factors,
      ].join(' × ')} = ${numberText(finalAmount)}`,
    },
    error: null,
  };
}
