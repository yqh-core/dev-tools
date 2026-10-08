import { describe, expect, test } from 'vitest';
import { isTimestamp, isUnixTimestamp } from '@/utils/datetime';

describe('unix-timestamp-converter shared datetime predicates', () => {
  describe('isUnixTimestamp', () => {
    test('accepts 1-10 digit positive integers', () => {
      expect(isUnixTimestamp('0')).toBe(true);
      expect(isUnixTimestamp('1')).toBe(true);
      expect(isUnixTimestamp('1681333824')).toBe(true);
      expect(isUnixTimestamp('1234567890')).toBe(true);
    });

    test('rejects >10 digits, non-digits, negatives, empty and undefined', () => {
      expect(isUnixTimestamp('1681333824000')).toBe(false); // 13 digits = milliseconds
      expect(isUnixTimestamp('')).toBe(false);
      expect(isUnixTimestamp('foo')).toBe(false);
      expect(isUnixTimestamp('-123')).toBe(false);
      expect(isUnixTimestamp()).toBe(false);
    });
  });

  describe('isTimestamp', () => {
    test('accepts 1-13 digit positive integers', () => {
      expect(isTimestamp('0')).toBe(true);
      expect(isTimestamp('1681333824')).toBe(true);
      expect(isTimestamp('1681333824000')).toBe(true);
    });

    test('rejects >13 digits, non-digits, empty and undefined', () => {
      expect(isTimestamp('16813338240000')).toBe(false); // 14 digits
      expect(isTimestamp('')).toBe(false);
      expect(isTimestamp('foo')).toBe(false);
      expect(isTimestamp()).toBe(false);
    });
  });
});
