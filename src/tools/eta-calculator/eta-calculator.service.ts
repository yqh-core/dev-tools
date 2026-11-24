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

export interface RequiredPaceForDeadlineInput {
  remainingUnits: number
  availableMs: number
  bufferPercent: number
  additionalPauseMs: number
}

export interface RequiredPaceForDeadlineEstimate {
  availableWorkMs: number
  requiredUnitsPerHour: number
}

/**
 * Calculate the base processing pace needed to finish before a deadline.
 * The available window is reduced by planned pauses, then divided by the
 * configured buffer factor so the same buffer policy is preserved.
 */
export function calculateRequiredPaceForDeadline(
  input: RequiredPaceForDeadlineInput,
): RequiredPaceForDeadlineEstimate {
  const { remainingUnits, availableMs, bufferPercent, additionalPauseMs } = input;
  const values = [remainingUnits, availableMs, bufferPercent, additionalPauseMs];

  if (values.some(value => !Number.isFinite(value))) {
    throw new RangeError('Deadline pace inputs must be finite numbers');
  }
  if (remainingUnits < 0) {
    throw new RangeError('Remaining work cannot be negative');
  }
  if (availableMs <= 0) {
    throw new RangeError('Deadline must be later than the estimate start time');
  }
  if (bufferPercent < 0 || bufferPercent > 100) {
    throw new RangeError('Buffer must be between zero and 100 percent');
  }
  if (additionalPauseMs < 0) {
    throw new RangeError('Additional pause time cannot be negative');
  }
  if (remainingUnits === 0) {
    return { availableWorkMs: 0, requiredUnitsPerHour: 0 };
  }

  const availableAfterPausesMs = availableMs - additionalPauseMs;
  if (availableAfterPausesMs <= 0) {
    throw new RangeError('Planned pauses use all available time before the deadline');
  }

  const availableWorkMs = availableAfterPausesMs / (1 + bufferPercent / 100);
  const requiredUnitsPerHour = remainingUnits / availableWorkMs * 60 * 60 * 1000;
  if (![availableWorkMs, requiredUnitsPerHour].every(Number.isFinite) || availableWorkMs <= 0) {
    throw new RangeError('Required pace exceeds the supported numeric range');
  }

  return { availableWorkMs, requiredUnitsPerHour };
}
export interface WorkingHoursSchedule {
  /** Local wall-clock opening time in HH:mm format. */
  startTime: string
  /** Local wall-clock closing time in HH:mm format. */
  endTime: string
}

function parseWorkingTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new RangeError('Working hours must use a valid 24-hour HH:mm time');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function validateWorkingHours(schedule: WorkingHoursSchedule) {
  const startMinutes = parseWorkingTime(schedule.startTime);
  const endMinutes = parseWorkingTime(schedule.endTime);
  if (endMinutes <= startMinutes) {
    throw new RangeError('Working hours must end later than they start on the same day');
  }
  return { startMinutes, endMinutes };
}

function localTimeOnDate(date: Date, minutesAfterMidnight: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutesAfterMidnight / 60),
    minutesAfterMidnight % 60,
    0,
    0,
  );
}

function nextLocalDay(date: Date): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + 1);
  return next;
}

function isWeekday(date: Date): boolean {
  return date.getDay() >= 1 && date.getDay() <= 5;
}

/**
 * Project a duration across Monday-Friday local work windows.
 *
 * Calendar dates are advanced with local setDate()/constructors rather than
 * adding 24 hours, so weekends and daylight-saving transitions do not shift
 * the configured wall-clock opening and closing times.
 */
export function calculateWorkingHoursFinishAt(
  startAt: number | Date,
  durationMs: number,
  schedule: WorkingHoursSchedule,
): number {
  const startTimestamp = startAt instanceof Date ? startAt.getTime() : startAt;
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError('Working-hours estimate requires a finite start and non-negative duration');
  }
  const { startMinutes, endMinutes } = validateWorkingHours(schedule);
  if (durationMs === 0) {
    return startTimestamp;
  }

  let remainingMs = durationMs;
  let cursor = new Date(startTimestamp);

  for (let dayCount = 0; dayCount < 36_600; dayCount += 1) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    if (!isWeekday(dayStart)) {
      cursor = localTimeOnDate(nextLocalDay(dayStart), startMinutes);
      continue;
    }

    const opening = localTimeOnDate(dayStart, startMinutes);
    const closing = localTimeOnDate(dayStart, endMinutes);
    if (cursor < opening) {
      cursor = opening;
    }
    if (cursor >= closing) {
      cursor = localTimeOnDate(nextLocalDay(dayStart), startMinutes);
      continue;
    }

    const availableTodayMs = closing.getTime() - cursor.getTime();
    if (remainingMs <= availableTodayMs) {
      return cursor.getTime() + remainingMs;
    }

    remainingMs -= availableTodayMs;
    cursor = localTimeOnDate(nextLocalDay(dayStart), startMinutes);
  }

  throw new RangeError('Working-hours estimate exceeds the supported calendar range');
}

/**
 * Count the overlap between a local calendar interval and Monday-Friday
 * working windows. A zero result means there is no productive window before
 * the deadline; the deadline calculator can then report that no pace is valid.
 */
export function calculateWorkingWindowDurationMs(
  startAt: number | Date,
  endAt: number | Date,
  schedule: WorkingHoursSchedule,
): number {
  const startTimestamp = startAt instanceof Date ? startAt.getTime() : startAt;
  const endTimestamp = endAt instanceof Date ? endAt.getTime() : endAt;
  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
    throw new RangeError('Working-hours interval requires finite start and end times');
  }
  if (endTimestamp < startTimestamp) {
    throw new RangeError('Deadline must be later than the estimate start time');
  }

  const { startMinutes, endMinutes } = validateWorkingHours(schedule);
  if (endTimestamp === startTimestamp) {
    return 0;
  }

  let countedMs = 0;
  let dayStart = new Date(
    new Date(startTimestamp).getFullYear(),
    new Date(startTimestamp).getMonth(),
    new Date(startTimestamp).getDate(),
  );
  for (let dayCount = 0; dayCount < 36_600 && dayStart.getTime() <= endTimestamp; dayCount += 1) {
    if (isWeekday(dayStart)) {
      const opening = localTimeOnDate(dayStart, startMinutes).getTime();
      const closing = localTimeOnDate(dayStart, endMinutes).getTime();
      const overlapStart = Math.max(startTimestamp, opening);
      const overlapEnd = Math.min(endTimestamp, closing);
      if (overlapEnd > overlapStart) {
        countedMs += overlapEnd - overlapStart;
      }
    }
    dayStart = nextLocalDay(dayStart);
  }

  if (!Number.isFinite(countedMs)) {
    throw new RangeError('Working-hours interval exceeds the supported numeric range');
  }
  return countedMs;
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
