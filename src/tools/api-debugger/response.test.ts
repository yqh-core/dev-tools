import { describe, expect, it } from 'vitest';
import { formatBytes, searchBody, utf8Bytes } from './response';

describe('utf8Bytes (byte size ≠ string length)', () => {
  it('counts ASCII as 1 byte per char', () => {
    expect(utf8Bytes('abc')).toBe(3);
    expect(utf8Bytes('')).toBe(0);
  });

  it('counts multibyte chars by real UTF-8 bytes (negative control against String.length)', () => {
    const s = '中文€';
    expect(s.length).toBe(3);
    expect(utf8Bytes(s)).toBe(9); // 中=3 文=3 €=3
  });

  it('handles emoji surrogate pairs as 4 bytes', () => {
    expect(utf8Bytes('😀')).toBe(4);
  });
});

describe('formatBytes', () => {
  it('formats B / KB / MB bands', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
  });
});

describe('searchBody (case-insensitive line filter)', () => {
  const body = 'Authorization: Bearer abc\ncontent-type: application/json\nX-Empty:\nauthorization: basic xyz';

  it('empty / whitespace query returns all lines unfiltered', () => {
    const r = searchBody(body, '   ');
    expect(r.lines).toHaveLength(4);
    expect(r.matchedLines).toBe(4);
    expect(r.occurrences).toBe(0);
  });

  it('matches case-insensitively across lines', () => {
    const r = searchBody(body, 'AUTHORIZATION');
    expect(r.matchedLines).toBe(2);
    expect(r.occurrences).toBe(2);
    expect(r.totalLines).toBe(4);
  });

  it('counts multiple occurrences within one line', () => {
    const r = searchBody('aa aa aa\nbb', 'aa');
    expect(r.matchedLines).toBe(1);
    expect(r.occurrences).toBe(3);
  });

  it('no match returns empty lines but keeps totalLines (negative control)', () => {
    const r = searchBody(body, 'zzz-not-present');
    expect(r.lines).toEqual([]);
    expect(r.matchedLines).toBe(0);
    expect(r.totalLines).toBe(4);
  });

  it('preserves original line content (no lowercasing of output)', () => {
    const r = searchBody(body, 'bearer');
    expect(r.lines[0]).toBe('Authorization: Bearer abc');
  });
});
