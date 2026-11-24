import { describe, expect, it } from 'vitest';
import { getStringSizeInBytes, getTextStatistics, getTopTermFrequency } from './text-statistics.service';

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
  it('returns normalized top-term counts and shares using the selected locale tokenizer', () => {
    const text = 'The cat cat, café CAFÉ and dog.';
    const result = getTopTermFrequency(text, 'en');

    expect(result.totalTokens).toBe(getTextStatistics(text, 'en').words);
    expect(result.terms.slice(0, 2)).toEqual([
      { term: 'café', count: 2, share: 2 / 7 },
      { term: 'cat', count: 2, share: 2 / 7 },
    ]);
  });

  it('excludes common English stop words only when the English filter is enabled', () => {
    const text = 'The cat and the dog cat.';
    const unfiltered = getTopTermFrequency(text, 'en');
    const filtered = getTopTermFrequency(text, 'en', { excludeEnglishStopWords: true });

    expect(unfiltered.totalTokens).toBe(6);
    expect(filtered.totalTokens).toBe(3);
    expect(filtered.terms).toEqual([
      { term: 'cat', count: 2, share: 2 / 3 },
      { term: 'dog', count: 1, share: 1 / 3 },
    ]);
    expect(getTopTermFrequency(text, 'es', { excludeEnglishStopWords: true }).totalTokens).toBe(6);
  });

  it('uses the selected language tokenizer for CJK terms without applying English stop words', () => {
    const text = '我喜欢苹果。我喜欢香蕉。';
    const result = getTopTermFrequency(text, 'zh', { excludeEnglishStopWords: true });

    expect(result.totalTokens).toBe(getTextStatistics(text, 'zh').words);
    expect(result.terms.reduce((total, term) => total + term.count, 0)).toBe(result.totalTokens);
  });

  it('handles empty text and limits the visible term list', () => {
    expect(getTopTermFrequency('')).toEqual({ totalTokens: 0, terms: [] });
    const result = getTopTermFrequency('one two three four five six seven', 'en', { limit: 3 });
    expect(result.terms).toHaveLength(3);
    expect(result.totalTokens).toBe(7);
  });
});
