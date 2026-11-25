import type { PercentageBatchMode } from './percentage-calculator.batch';

/** The seven individual workflows presented by the percentage calculator. */
export const PERCENTAGE_CALCULATION_MODES: readonly PercentageBatchMode[] = [
  'percent-of',
  'part-to-whole',
  'percentage-change',
  'adjustment',
  'reverse',
  'percentage-difference',
  'percentage-points',
];
