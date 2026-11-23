import { describe, expect, it } from 'vitest';
import { REGEX_PRESETS, evaluateRegex, matchRegex } from './regex-tester.service';

describe('matchRegex', () => {
  it('preserves match positions, numbered captures and named groups', () => {
    const results = matchRegex('(?<user>[a-z]+)@(\\w+\\.com)', 'a@test.com b@site.com', 'dgu');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      index: 0,
      value: 'a@test.com',
      captures: [{ name: '2', value: 'test.com', start: 2, end: 10 }],
      groups: [{ name: 'user', value: 'a', start: 0, end: 1 }],
    });
  });

  it('returns only the first result when global mode is disabled', () => {
    expect(matchRegex('a', 'a a a', 'd')).toHaveLength(1);
  });

  it('advances through zero-width global matches without looping forever', () => {
    const results = matchRegex('(?=a)', 'aaa', 'dg');
    expect(results.map(result => result.index)).toEqual([0, 1, 2]);
  });

  it('handles optional unmatched captures without throwing', () => {
    const results = matchRegex('(a)?b', 'b ab', 'dg');
    expect(results[0].captures).toEqual([]);
    expect(results[1].captures).toEqual([{ name: '1', value: 'a', start: 2, end: 3 }]);
  });

  it('keeps every shipped preset valid in the JavaScript RegExp engine', () => {
    for (const preset of REGEX_PRESETS) {
      expect(() => new RegExp(preset.pattern, preset.flags.replace('d', ''))).not.toThrow();
      expect(matchRegex(preset.pattern, preset.sample, preset.flags)).toHaveLength(1);
    }
    const ipv4 = REGEX_PRESETS.find(preset => preset.label === 'IPv4 address');
    expect(matchRegex(ipv4!.pattern, '999.999.999.999', ipv4!.flags)).toHaveLength(0);
  });

  it('handles large input with a simple pattern', () => {
    const results = matchRegex('a+', 'a'.repeat(100_000), 'dg');
    expect(results).toHaveLength(1);
    expect(results[0].value).toHaveLength(100_000);
  });
});

describe('evaluateRegex replacement preview', () => {
  it('supports numbered capture references', () => {
    expect(evaluateRegex('(\\w+)', 'hello world', 'dg', '[$1]').replacementPreview)
      .toBe('[hello] [world]');
  });

  it('supports the full-match reference', () => {
    expect(evaluateRegex('cat', 'a cat and a cat', 'dg', '<$&>').replacementPreview)
      .toBe('a <cat> and a <cat>');
  });

  it('supports named-group replacement references', () => {
    expect(evaluateRegex('(?<word>hello)', 'hello world', 'dg', '$<word>!').replacementPreview)
      .toBe('hello! world');
  });

  it('reports invalid expressions to the caller', () => {
    expect(() => evaluateRegex('(', 'text', 'dg', 'x')).toThrow();
  });
});
