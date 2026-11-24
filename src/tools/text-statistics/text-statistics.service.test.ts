import { describe, expect, it } from 'vitest';
import { getStringSizeInBytes, getTextStatistics } from './text-statistics.service';

describe('text-statistics', () => {
  it('counts UTF-8 bytes', () => {
    expect(getStringSizeInBytes('')).toBe(0);
    expect(getStringSizeInBytes('a')).toBe(1);
    expect(getStringSizeInBytes('😀')).toBe(4);
    expect(getStringSizeInBytes('你好')).toBe(6);
  });

  it('distinguishes UTF-16 units, code points and visible graphemes', () => {
    const result = getTextStatistics('👍🏽 e\u0301 👨‍👩‍👧');
    expect(result.utf16CodeUnits).toBeGreaterThan(result.codePoints);
    expect(result.codePoints).toBeGreaterThan(result.graphemes);
    expect(result.graphemes).toBe(5);
  });

  it('counts words, unique words, sentences and paragraphs', () => {
    const result = getTextStatistics('Hello hello world.\n\nHello again!');
    expect(result.words).toBe(5);
    expect(result.uniqueWords).toBe(3);
    expect(result.sentences).toBe(2);
    expect(result.paragraphs).toBe(2);
  });

  it('counts CRLF lines and ignores blank lines for non-empty line count', () => {
    const result = getTextStatistics('one\r\n\r\ntwo\r\n');
    expect(result.lines).toBe(4);
    expect(result.nonEmptyLines).toBe(2);
    expect(result.longestLine).toBe(3);
  });

  it('counts visible characters without whitespace', () => {
    const result = getTextStatistics('a 👍🏽\n你');
    expect(result.charactersWithoutWhitespace).toBe(3);
  });

  it('returns zero metrics for empty input', () => {
    expect(getTextStatistics('')).toEqual({
      utf16CodeUnits: 0,
      codePoints: 0,
      graphemes: 0,
      charactersWithoutWhitespace: 0,
      words: 0,
      uniqueWords: 0,
      lines: 0,
      nonEmptyLines: 0,
      paragraphs: 0,
      sentences: 0,
      longestLine: 0,
      bytes: 0,
    });
  });

  it('falls back when Intl.Segmenter is unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    try {
      const result = getTextStatistics('Hello, world!\n你好');
      expect(result.words).toBe(3);
      expect(result.codePoints).toBe(16);
      expect(result.graphemes).toBe(16);
      expect(result.sentences).toBe(2);
    }
    finally {
      if (original) {
        Object.defineProperty(Intl, 'Segmenter', original);
      }
      else {
        Reflect.deleteProperty(Intl, 'Segmenter');
      }
    }
  });
});
