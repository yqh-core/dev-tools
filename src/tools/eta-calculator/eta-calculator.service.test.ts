import { describe, expect, it } from 'vitest';
import { calculateObservedPaceEta, calculateRemainingEta } from './eta-calculator.service';

describe('calculateRemainingEta', () => {
  it('calculates remaining work rather than estimating the original total again', () => {
    expect(calculateRemainingEta({
      totalUnits: 500,
      completedUnits: 200,
      unitsPerInterval: 5,
      intervalMs: 3 * 60 * 1000,
      bufferPercent: 0,
    })).toEqual({
      remainingUnits: 300,
      completionPercent: 40,
      baseDurationMs: 3 * 60 * 60 * 1000,
      bufferDurationMs: 0,
      durationMs: 3 * 60 * 60 * 1000,
    });
  });

  it('adds a configurable buffer only to the remaining duration', () => {
    const estimate = calculateRemainingEta({
      totalUnits: 500,
      completedUnits: 200,
      unitsPerInterval: 5,
      intervalMs: 3 * 60 * 1000,
      bufferPercent: 10,
    });
    expect(estimate.baseDurationMs).toBe(3 * 60 * 60 * 1000);
    expect(estimate.bufferDurationMs).toBe(18 * 60 * 1000);
    expect(estimate.durationMs).toBe(3 * 60 * 60 * 1000 + 18 * 60 * 1000);
  });

  it('returns zero duration when all work is complete', () => {
    expect(calculateRemainingEta({
      totalUnits: 500,
      completedUnits: 500,
      unitsPerInterval: 5,
      intervalMs: 60_000,
      bufferPercent: 25,
    })).toMatchObject({
      remainingUnits: 0,
      completionPercent: 100,
      baseDurationMs: 0,
      bufferDurationMs: 0,
      durationMs: 0,
    });
  });

  it('supports an empty progress state with no buffer', () => {
    expect(calculateRemainingEta({
      totalUnits: 100,
      completedUnits: 0,
      unitsPerInterval: 10,
      intervalMs: 1000,
      bufferPercent: 0,
    })).toMatchObject({
      remainingUnits: 100,
      completionPercent: 0,
      durationMs: 10_000,
    });
  });

  it('rejects invalid totals, progress, rate, intervals and buffers', () => {
    const base = {
      totalUnits: 100,
      completedUnits: 20,
      unitsPerInterval: 10,
      intervalMs: 1000,
      bufferPercent: 0,
    };
    expect(() => calculateRemainingEta({ ...base, totalUnits: 0 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, completedUnits: -1 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, completedUnits: 101 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, unitsPerInterval: 0 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, intervalMs: 0 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, bufferPercent: -1 })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, bufferPercent: 101 })).toThrow(RangeError);
  });

  it('rejects non-finite values', () => {
    const base = {
      totalUnits: 100,
      completedUnits: 20,
      unitsPerInterval: 10,
      intervalMs: 1000,
      bufferPercent: 0,
    };
    expect(() => calculateRemainingEta({ ...base, totalUnits: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => calculateRemainingEta({ ...base, unitsPerInterval: Number.NaN })).toThrow(RangeError);
  });
});

describe('calculateObservedPaceEta', () => {
  it('derives an hourly processing rate and estimates only the remaining work', () => {
    expect(calculateObservedPaceEta({
      totalUnits: 500,
      completedUnits: 200,
      elapsedMs: 2 * 60 * 60 * 1000,
      bufferPercent: 0,
    })).toEqual({
      remainingUnits: 300,
      completionPercent: 40,
      baseDurationMs: 3 * 60 * 60 * 1000,
      bufferDurationMs: 0,
      durationMs: 3 * 60 * 60 * 1000,
      unitsPerHour: 100,
    });
  });

  it('applies the optional buffer to the remaining time only', () => {
    const estimate = calculateObservedPaceEta({
      totalUnits: 500,
      completedUnits: 200,
      elapsedMs: 2 * 60 * 60 * 1000,
      bufferPercent: 10,
    });
    expect(estimate.unitsPerHour).toBe(100);
    expect(estimate.baseDurationMs).toBe(3 * 60 * 60 * 1000);
    expect(estimate.bufferDurationMs).toBe(18 * 60 * 1000);
    expect(estimate.durationMs).toBe(3 * 60 * 60 * 1000 + 18 * 60 * 1000);
  });

  it('returns a zero-duration result for a completed workload without requiring an elapsed sample', () => {
    expect(calculateObservedPaceEta({
      totalUnits: 500,
      completedUnits: 500,
      elapsedMs: 0,
      bufferPercent: 25,
    })).toMatchObject({
      remainingUnits: 0,
      completionPercent: 100,
      durationMs: 0,
      unitsPerHour: 0,
    });
  });

  it('rejects a missing progress sample, zero elapsed time and invalid input', () => {
    const base = {
      totalUnits: 500,
      completedUnits: 200,
      elapsedMs: 2 * 60 * 60 * 1000,
      bufferPercent: 0,
    };
    expect(() => calculateObservedPaceEta({ ...base, completedUnits: 0 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, elapsedMs: 0 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, elapsedMs: -1 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, totalUnits: 0 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, completedUnits: 501 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, bufferPercent: 101 })).toThrow(RangeError);
    expect(() => calculateObservedPaceEta({ ...base, elapsedMs: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('rejects results that overflow the supported numeric range', () => {
    expect(() => calculateObservedPaceEta({
      totalUnits: Number.MAX_VALUE,
      completedUnits: 1,
      elapsedMs: 1,
      bufferPercent: 100,
    })).toThrow(RangeError);
  });
});
