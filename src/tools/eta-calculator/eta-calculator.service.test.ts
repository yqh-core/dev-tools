import { describe, expect, it } from 'vitest';
import { calculateObservedPaceEta, calculateRemainingEta, calculateRequiredPaceForDeadline } from './eta-calculator.service';

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

describe('calculateRequiredPaceForDeadline', () => {
  it('calculates the pace needed after planned pauses and the configured buffer', () => {
    const estimate = calculateRequiredPaceForDeadline({
      remainingUnits: 100,
      availableMs: 3.5 * 60 * 60 * 1000,
      additionalPauseMs: 30 * 60 * 1000,
      bufferPercent: 20,
    });
    expect(estimate.availableWorkMs).toBe(2.5 * 60 * 60 * 1000);
    expect(estimate.requiredUnitsPerHour).toBeCloseTo(40, 10);
  });

  it('returns zero required pace for completed work', () => {
    expect(calculateRequiredPaceForDeadline({
      remainingUnits: 0,
      availableMs: 60 * 60 * 1000,
      additionalPauseMs: 0,
      bufferPercent: 0,
    })).toEqual({ availableWorkMs: 0, requiredUnitsPerHour: 0 });
  });

  it('rejects expired deadlines, consumed time windows and invalid inputs', () => {
    const base = {
      remainingUnits: 100,
      availableMs: 60 * 60 * 1000,
      additionalPauseMs: 0,
      bufferPercent: 0,
    };
    expect(() => calculateRequiredPaceForDeadline({ ...base, availableMs: 0 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, availableMs: -1 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, additionalPauseMs: 60 * 60 * 1000 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, additionalPauseMs: -1 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, bufferPercent: 101 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, remainingUnits: -1 })).toThrow(RangeError);
    expect(() => calculateRequiredPaceForDeadline({ ...base, availableMs: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });
});


describe('weekday working-hours schedule', () => {
  const schedule = { startTime: '09:00', endTime: '17:00' };
  const local = (year: number, month: number, day: number, hour: number, minute = 0) =>
    new Date(year, month - 1, day, hour, minute, 0, 0).getTime();

  it('keeps a same-day finish inside the configured weekday window', () => {
    const start = local(2026, 11, 23, 10);
    expect(calculateWorkingHoursFinishAt(start, 2 * 60 * 60 * 1000, schedule))
      .toBe(local(2026, 11, 23, 12));
  });

  it('moves an estimate that starts after closing to the next weekday opening', () => {
    const start = local(2026, 11, 23, 18);
    expect(calculateWorkingHoursFinishAt(start, 60 * 60 * 1000, schedule))
      .toBe(local(2026, 11, 24, 10));
  });

  it('carries unfinished work from Friday afternoon to Monday morning', () => {
    const friday = local(2026, 11, 27, 16);
    expect(calculateWorkingHoursFinishAt(friday, 2 * 60 * 60 * 1000, schedule))
      .toBe(local(2026, 11, 30, 10));
  });

  it('returns the original start for zero remaining work', () => {
    const saturday = local(2026, 11, 28, 12);
    expect(calculateWorkingHoursFinishAt(saturday, 0, schedule)).toBe(saturday);
  });

  it('counts only weekday overlap and returns zero when the deadline contains no working time', () => {
    const fridayAfterHours = local(2026, 11, 27, 18);
    const sundayEvening = local(2026, 11, 29, 20);
    const mondayMorning = local(2026, 11, 30, 9);
    expect(calculateWorkingWindowDurationMs(fridayAfterHours, sundayEvening, schedule)).toBe(0);
    expect(calculateWorkingWindowDurationMs(local(2026, 11, 27, 16), mondayMorning, schedule))
      .toBe(60 * 60 * 1000);
  });

  it('rejects a deadline before the estimate start time', () => {
    expect(() => calculateWorkingWindowDurationMs(
      local(2026, 11, 23, 12),
      local(2026, 11, 23, 11),
      schedule,
    )).toThrow('Deadline must be later than the estimate start time');
  });

  it('rejects invalid work windows and malformed local time values', () => {
    expect(() => calculateWorkingHoursFinishAt(0, 1000, { startTime: '17:00', endTime: '09:00' })).toThrow(RangeError);
    expect(() => calculateWorkingWindowDurationMs(0, 1000, { startTime: '9:00', endTime: '17:00' })).toThrow(RangeError);
  });
});
