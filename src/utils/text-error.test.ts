import { describe, expect, it } from 'vitest';
import { describeJsonProblem, offsetAt } from './text-error';

describe('text error locations', () => {
  it('maps a 1-based line and column onto the string', () => {
    expect(offsetAt('ab\ncd', 2, 2)).toBe(4);
    expect(offsetAt('ab', 1, 1)).toBe(0);
  });

  it('reads JSON5 line:column and JSON.parse position', () => {
    const raw = '{\n  "a": }';
    expect(describeJsonProblem(raw, new Error('JSON5: invalid character at 2:9'))).toMatchObject({
      start: offsetAt(raw, 2, 9),
    });
    expect(describeJsonProblem('abcdef', new SyntaxError('Unexpected token at position 3')).start).toBe(3);
  });
});
