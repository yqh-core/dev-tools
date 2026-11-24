import { describe, expect, it } from 'vitest';

import {
  MAX_SEQUENTIAL_PERCENTAGE_RATE,
  MAX_SEQUENTIAL_PERCENTAGE_STEPS,
  calculateSequentialPercentage,
} from './percentage-calculator.sequential';

describe('sequential percentage adjustments', () => {
  it('applies each discount to the previous intermediate amount', () => {
    const { calculation, error } = calculateSequentialPercentage(100, [
      { operation: 'decrease', percentage: 20 },
      { operation: 'decrease', percentage: 10 },
    ]);

    expect(error).toBeNull();
    expect(calculation?.steps.map(step => step.endingValue)).toEqual([80, 72]);
    expect(calculation).toMatchObject({
      startingAmount: 100,
      finalAmount: 72,
      totalAmountChange: -28,
      effectivePercentageChange: -28,
      formula: '100 × 0.8 × 0.9 = 72',
    });
  });

  it('shows each intermediate value when the same rates are reordered', () => {
    const discountThenIncrease = calculateSequentialPercentage(100, [
      { operation: 'decrease', percentage: 20 },
      { operation: 'increase', percentage: 10 },
    ]).calculation;
    const increaseThenDiscount = calculateSequentialPercentage(100, [
      { operation: 'increase', percentage: 10 },
      { operation: 'decrease', percentage: 20 },
    ]).calculation;

    expect(discountThenIncrease?.steps.map(step => step.endingValue)).toEqual([80, 88]);
    expect(increaseThenDiscount?.steps.map(step => step.endingValue)).toEqual([110, 88]);
    // Percentage multipliers commute, so the final result is the same even though
    // the audit trail and intermediate amounts differ.
    expect(discountThenIncrease?.finalAmount).toBe(88);
    expect(increaseThenDiscount?.finalAmount).toBe(88);
  });

  it('calculates mixed adjustments without adding percentage points', () => {
    const result = calculateSequentialPercentage(100, [
      { operation: 'increase', percentage: 10 },
      { operation: 'decrease', percentage: 10 },
    ]).calculation;

    expect(result?.finalAmount).toBe(99);
    expect(result?.effectivePercentageChange).toBe(-1);
  });

  it('keeps zero-percent steps unchanged', () => {
    const result = calculateSequentialPercentage(250, [
      { operation: 'increase', percentage: 0 },
      { operation: 'decrease', percentage: 0 },
    ]).calculation;

    expect(result?.steps.map(step => step.endingValue)).toEqual([250, 250]);
    expect(result?.effectivePercentageChange).toBe(0);
  });

  it('supports a full 100% discount and leaves a zero final amount', () => {
    const result = calculateSequentialPercentage(45, [
      { operation: 'decrease', percentage: 100 },
    ]).calculation;

    expect(result?.finalAmount).toBe(0);
    expect(result?.effectivePercentageChange).toBe(-100);
  });

  it('supports a zero starting amount but marks the effective percentage as undefined', () => {
    const result = calculateSequentialPercentage(0, [
      { operation: 'increase', percentage: 15 },
    ]).calculation;

    expect(result?.finalAmount).toBe(0);
    expect(result?.effectivePercentageChange).toBeNull();
  });

  it('normalizes decimal display values without exposing binary floating-point noise', () => {
    const result = calculateSequentialPercentage(19.99, [
      { operation: 'decrease', percentage: 15 },
    ]).calculation;

    expect(result?.finalAmount).toBe(16.9915);
    expect(result?.steps[0].endingValue).toBe(16.9915);
  });

  it('rejects missing, negative and non-finite starting values', () => {
    expect(calculateSequentialPercentage(null, [{ operation: 'decrease', percentage: 10 }]).error).toBe('invalid-start');
    expect(calculateSequentialPercentage(-1, [{ operation: 'decrease', percentage: 10 }]).error).toBe('invalid-start');
    expect(calculateSequentialPercentage(Number.POSITIVE_INFINITY, [{ operation: 'decrease', percentage: 10 }]).error).toBe('invalid-start');
  });

  it('requires at least one adjustment step and caps the number of steps', () => {
    expect(calculateSequentialPercentage(100, []).error).toBe('no-steps');
    const tooMany = Array.from({ length: MAX_SEQUENTIAL_PERCENTAGE_STEPS + 1 }, () => ({
      operation: 'decrease' as const,
      percentage: 1,
    }));
    expect(calculateSequentialPercentage(100, tooMany).error).toBe('too-many-steps');
  });

  it('rejects negative, missing, non-finite and excessively large rates', () => {
    expect(calculateSequentialPercentage(100, [{ operation: 'increase', percentage: -1 }]).error).toBe('invalid-rate');
    expect(calculateSequentialPercentage(100, [{ operation: 'increase', percentage: null }]).error).toBe('invalid-rate');
    expect(calculateSequentialPercentage(100, [{ operation: 'increase', percentage: Number.NaN }]).error).toBe('invalid-rate');
    expect(calculateSequentialPercentage(100, [{ operation: 'increase', percentage: MAX_SEQUENTIAL_PERCENTAGE_RATE + 1 }]).error).toBe('invalid-rate');
  });

  it('does not allow a discount larger than 100%', () => {
    expect(calculateSequentialPercentage(100, [{ operation: 'decrease', percentage: 100.01 }]).error).toBe('discount-over-100');
  });

  it('rejects numeric overflow rather than returning Infinity', () => {
    expect(calculateSequentialPercentage(Number.MAX_VALUE, [
      { operation: 'increase', percentage: 1000 },
    ]).error).toBe('overflow');
  });
});
