import { formatDuration } from 'date-fns';

export interface EtaCalculationInput {
  totalUnits: number
  completedUnits: number
  unitsPerInterval: number
  intervalMs: number
  bufferPercent: number
}

export interface EtaEstimate {
  remainingUnits: number
  completionPercent: number
  baseDurationMs: number
  bufferDurationMs: number
  durationMs: number
}

/**
 * Estimate the remaining work from the current progress and a measured rate.
 * The optional buffer is applied only to the remaining duration.
 */
export function calculateRemainingEta(input: EtaCalculationInput): EtaEstimate {
  const {
    totalUnits,
    completedUnits,
    unitsPerInterval,
    intervalMs,
    bufferPercent,
  } = input;

  const values = [totalUnits, completedUnits, unitsPerInterval, intervalMs, bufferPercent];
  if (values.some(value => !Number.isFinite(value))) {
    throw new RangeError('ETA inputs must be finite numbers');
  }
  if (totalUnits <= 0) {
    throw new RangeError('Total amount must be greater than zero');
  }
  if (completedUnits < 0 || completedUnits > totalUnits) {
    throw new RangeError('Completed amount must be between zero and the total amount');
  }
  if (unitsPerInterval <= 0 || intervalMs <= 0) {
    throw new RangeError('Processing rate and interval must be greater than zero');
  }
  if (bufferPercent < 0 || bufferPercent > 100) {
    throw new RangeError('Buffer must be between zero and 100 percent');
  }

  const remainingUnits = totalUnits - completedUnits;
  const baseDurationMs = (remainingUnits / unitsPerInterval) * intervalMs;
  const bufferDurationMs = baseDurationMs * (bufferPercent / 100);

  return {
    remainingUnits,
    completionPercent: (completedUnits / totalUnits) * 100,
    baseDurationMs,
    bufferDurationMs,
    durationMs: baseDurationMs + bufferDurationMs,
  };
}

export interface ObservedPaceEtaInput {
  totalUnits: number
  completedUnits: number
  elapsedMs: number
  bufferPercent: number
}

export interface ObservedPaceEtaEstimate extends EtaEstimate {
  /** Measured throughput, normalized to units per hour. */
  unitsPerHour: number
}

/**
 * Derive throughput from completed work over elapsed time, then estimate only
 * the unfinished work. A fully completed workload needs no elapsed-time sample.
 */
export function calculateObservedPaceEta(input: ObservedPaceEtaInput): ObservedPaceEtaEstimate {
  const { totalUnits, completedUnits, elapsedMs, bufferPercent } = input;
  const values = [totalUnits, completedUnits, elapsedMs, bufferPercent];

  if (values.some(value => !Number.isFinite(value))) {
    throw new RangeError('ETA inputs must be finite numbers');
  }
  if (totalUnits <= 0) {
    throw new RangeError('Total amount must be greater than zero');
  }
  if (completedUnits < 0 || completedUnits > totalUnits) {
    throw new RangeError('Completed amount must be between zero and the total amount');
  }
  if (elapsedMs < 0) {
    throw new RangeError('Elapsed time cannot be negative');
  }
  if (bufferPercent < 0 || bufferPercent > 100) {
    throw new RangeError('Buffer must be between zero and 100 percent');
  }

  if (completedUnits === totalUnits) {
    return {
      ...calculateRemainingEta({
        totalUnits,
        completedUnits,
        unitsPerInterval: 1,
        intervalMs: 1,
        bufferPercent,
      }),
      unitsPerHour: 0,
    };
  }
  if (completedUnits <= 0) {
    throw new RangeError('Observed pace requires completed work greater than zero');
  }
  if (elapsedMs <= 0) {
    throw new RangeError('Elapsed time must be greater than zero');
  }

  const unitsPerHour = completedUnits / elapsedMs * 60 * 60 * 1000;
  const estimate = calculateRemainingEta({
    totalUnits,
    completedUnits,
    unitsPerInterval: completedUnits,
    intervalMs: elapsedMs,
    bufferPercent,
  });
  if (![unitsPerHour, estimate.baseDurationMs, estimate.bufferDurationMs, estimate.durationMs]
    .every(Number.isFinite)) {
    throw new RangeError('ETA result exceeds the supported numeric range');
  }

  return { ...estimate, unitsPerHour };
}

export function formatMsDuration(duration: number) {
  const ms = Math.floor(duration % 1000);
  const secs = Math.floor(((duration - ms) / 1000) % 60);
  const mins = Math.floor((((duration - ms) / 1000 - secs) / 60) % 60);
  const hrs = Math.floor((((duration - ms) / 1000 - secs) / 60 - mins) / 60);

  return (
    formatDuration({
      hours: hrs,
      minutes: mins,
      seconds: secs,
    }) + (ms > 0 ? ` ${ms} ms` : '')
  );
}
