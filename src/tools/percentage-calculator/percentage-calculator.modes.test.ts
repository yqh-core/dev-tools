import { describe, expect, it } from 'vitest';
import { PERCENTAGE_CALCULATION_MODES } from './percentage-calculator.modes';

describe('percentage calculator mode navigation', () => {
  it('exposes each supported calculation workflow exactly once', () => {
    expect(PERCENTAGE_CALCULATION_MODES).toEqual([
      'percent-of',
      'part-to-whole',
      'percentage-change',
      'adjustment',
      'reverse',
      'percentage-difference',
      'percentage-points',
    ]);
    expect(new Set(PERCENTAGE_CALCULATION_MODES).size).toBe(7);
  });
});
