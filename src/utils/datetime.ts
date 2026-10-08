/**
 * Shared datetime predicates and conversion helpers.
 *
 * Extracted from `src/tools/date-time-converter/date-time-converter.models.ts`
 * so the original 10-format converter and the focused `/unix-timestamp-converter`
 * can both reuse the same detection logic without duplicating the regexes.
 *
 * Every predicate accepts `undefined` (returns false) so it is safe to call on
 * optional / empty input without a guard at the call site.
 */
import _ from 'lodash';

const ISO8601_REGEX
  = /^([+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24:?00)([.,]\d+(?!:))?)?(\17[0-5]\d([.,]\d+)?)?([zZ]|([+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
const ISO9075_REGEX
  = /^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,6})?(([+-])([0-9]{2}):([0-9]{2})|Z)?$/;

const RFC3339_REGEX
  = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(\.[0-9]{1,9})?(([+-])([0-9]{2}):([0-9]{2})|Z)$/;

const RFC7231_REGEX = /^[A-Za-z]{3},\s[0-9]{2}\s[A-Za-z]{3}\s[0-9]{4}\s[0-9]{2}:[0-9]{2}:[0-9]{2}\sGMT$/;

const EXCEL_FORMAT_REGEX = /^-?\d+(\.\d+)?$/;

function createRegexMatcher(regex: RegExp) {
  return (date?: string) => !_.isNil(date) && regex.test(date);
}

export const isISO8601DateTimeString = createRegexMatcher(ISO8601_REGEX);
export const isISO9075DateString = createRegexMatcher(ISO9075_REGEX);
export const isRFC3339DateString = createRegexMatcher(RFC3339_REGEX);
export const isRFC7231DateString = createRegexMatcher(RFC7231_REGEX);
export const isUnixTimestamp = createRegexMatcher(/^[0-9]{1,10}$/);
export const isTimestamp = createRegexMatcher(/^[0-9]{1,13}$/);
export const isMongoObjectId = createRegexMatcher(/^[0-9a-fA-F]{24}$/);

export const isExcelFormat = createRegexMatcher(EXCEL_FORMAT_REGEX);

/**
 * Returns true only when `date` is a string that `new Date()` parses into a value
 * whose UTC string round-trips back to the exact same string (i.e. an RFC 7231 /
 * `toUTCString()`-shaped value, e.g. `Sun, 06 Nov 1994 08:49:37 GMT`).
 */
export function isUTCDateString(date?: string) {
  if (_.isNil(date)) {
    return false;
  }

  try {
    return new Date(date).toUTCString() === date;
  }
  catch (_ignored) {
    return false;
  }
}

/**
 * Convert a JS `Date` into the Excel serial number: whole days since 1900-01-01
 * (with the spreadsheet 1900 leap-year bug baked in, matching Excel), plus the
 * fractional part for the time of day.
 */
export function dateToExcelFormat(date: Date) {
  return String(((date.getTime()) / (1000 * 60 * 60 * 24)) + 25569);
}

/** Inverse of {@link dateToExcelFormat}: Excel serial number back to a JS `Date`. */
export function excelFormatToDate(excelFormat: string | number) {
  return new Date((Number(excelFormat) - 25569) * 86400 * 1000);
}
