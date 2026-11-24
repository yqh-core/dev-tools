import { describe, expect, it } from 'vitest';
import { evaluateRegexTestCases, matchRegex } from './regex-tester.service';

const regexesData = [
  {
    regex: '',
    text: '',
    flags: '',
    result: [],
  },
  {
    regex: '.*',
    text: '',
    flags: '',
    result: [
      {
        captures: [],
        groups: [],
        index: 0,
        value: '',
      },
    ],
  },
  {
    regex: '',
    text: 'aaa',
    flags: '',
    result: [],
  },
  {
    regex: 'a',
    text: 'baaa',
    flags: '',
    result: [
      {
        captures: [],
        groups: [],
        index: 1,
        value: 'a',
      },
    ],
  },
  {
    regex: '(.)(?<g>r)',
    text: 'azertyr',
    flags: 'g',
    result: [
      {
        captures: [
          { end: 3, name: '1', start: 2, value: 'e' },
          { end: 4, name: '2', start: 3, value: 'r' },
        ],
        groups: [
          { end: 4, name: 'g', start: 3, value: 'r' },
        ],
        index: 2,
        value: 'er',
      },
      {
        captures: [
          { end: 6, name: '1', start: 5, value: 'y' },
          { end: 7, name: '2', start: 6, value: 'r' },
        ],
        groups: [
          { end: 7, name: 'g', start: 6, value: 'r' },
        ],
        index: 5,
        value: 'yr',
      },
    ],
  },
];

describe('regex-tester', () => {
  for (const reg of regexesData) {
    const { regex, text, flags, result: expectedResult } = reg;
    it(`Should matchRegex("${regex}","${text}","${flags}") return correct result`, () => {
      const result = matchRegex(regex, text, `${flags}d`);
      expect(result).to.deep.equal(expectedResult);
    });
  }
});

describe('regex-tester named test cases', () => {
  it('reports positive and negative expectations independently', () => {
    const result = evaluateRegexTestCases('^ORD-[0-9]{4}$', 'd', [
      { id: '1', name: 'valid order', text: 'ORD-0042', shouldMatch: true },
      { id: '2', name: 'too short', text: 'ORD-42', shouldMatch: false },
      { id: '3', name: 'wrong prefix', text: 'XORD-0001', shouldMatch: false },
    ]);
    expect(result.map(item => item.passed)).toEqual([true, true, true]);
    expect(result.map(item => item.actualMatch)).toEqual([true, false, false]);
  });

  it('returns first match and capture details for a passing case', () => {
    const [result] = evaluateRegexTestCases('(?<id>ORD-[0-9]{4})', 'd', [
      { id: '1', name: 'capture order', text: 'pending ORD-0042', shouldMatch: true },
    ]);
    expect(result.firstMatch?.value).toBe('ORD-0042');
    expect(result.firstMatch?.groups[0]).toMatchObject({ name: 'id', value: 'ORD-0042', start: 8, end: 16 });
  });

  it('marks invalid patterns as errors rather than false test results', () => {
    expect(() => evaluateRegexTestCases('(', 'd', [
      { id: '1', name: 'invalid', text: 'x', shouldMatch: true },
    ])).toThrow();
  });
});
