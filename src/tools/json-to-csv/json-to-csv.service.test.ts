import { describe, expect, it } from 'vitest';
import { convertArrayToCsv, getHeaders, csvShapeError } from './json-to-csv.service';
import { parseCsv } from '@/utils/csv';

describe('json-to-csv service', () => {
  describe('getHeaders', () => {
    it('extracts all the keys from the array of objects', () => {
      expect(getHeaders({ array: [{ a: 1, b: 2 }, { a: 3, c: 4 }] })).toEqual(['a', 'b', 'c']);
    });

    it('returns an empty array if the array is empty', () => {
      expect(getHeaders({ array: [] })).toEqual([]);
    });
  });

  describe('convertArrayToCsv', () => {
    it('converts an array of objects to a CSV string', () => {
      const array = [
        { a: 1, b: 2 },
        { a: 3, b: 4 },

      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b
        1,2
        3,4"
      `);
    });

    it('converts an array of objects with different keys to a CSV string', () => {
      const array = [
        { a: 1, b: 2 },
        { a: 3, c: 4 },
      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b,c
        1,2,
        3,,4"
      `);
    });

    it('when a value is null, it is converted to the string "null"', () => {
      const array = [
        { a: null, b: 2 },
      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b
        null,2"
      `);
    });

    it('when a value is undefined, it is converted to an empty string', () => {
      const array = [
        { a: undefined, b: 2 },
        { b: 3 },
      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b
        ,2
        ,3"
      `);
    });

    it('when a value contains a comma, it is wrapped in double quotes', () => {
      const array = [
        { a: 'hello, world', b: 2 },
      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b
        \\"hello, world\\",2"
      `);
    });

    it('when a value contains a double quote, it is escaped with another double quote', () => {
      const array = [
        { a: 'hello "world"', b: 2 },
      ];

      expect(convertArrayToCsv({ array })).toMatchInlineSnapshot(`
        "a,b
        \\"hello \\"\\"world\\"\\"\\",2"
      `);
    });

    // 下面四条是这次修复才补的覆盖：旧实现把换行折成字面 \n、对反斜杠完全不处理，
    // 而这两类恰恰决定"输出能否被标准读取器读回来"。
    it('a value containing a newline is quoted, not folded into a literal backslash-n', () => {
      const csv = convertArrayToCsv({ array: [{ a: 'line1\nline2', b: 2 }] });

      expect(csv).toBe('a,b\n"line1\nline2",2');
      expect(csv).not.toContain('\\nline2'); // 反证旧行为
    });

    it('a value containing a backslash is passed through untouched (CSV has no backslash escapes)', () => {
      const csv = convertArrayToCsv({ array: [{ a: 'C:\\path\\to', b: 2 }] });

      expect(csv).toBe('a,b\nC:\\path\\to,2');
    });

    it('an empty array yields no header row (unchanged behaviour)', () => {
      expect(convertArrayToCsv({ array: [] })).toBe('');
    });

    it('output round-trips through the shared RFC 4180 parser', () => {
      const array = [
        { name: 'He said "hi"', note: 'a,b' },
        { name: 'multi\nline', note: 'plain' },
        { name: 'C:\\path', note: 'tab\there' },
      ];

      expect(parseCsv(convertArrayToCsv({ array }))).toEqual([
        ['name', 'note'],
        ['He said "hi"', 'a,b'],
        ['multi\nline', 'plain'],
        ['C:\\path', 'tab\there'],
      ]);
    });
  });

  describe('csvShapeError（异常输入的错误提示，替代旧的静默空输出）', () => {
    it('空数组与对象数组都判定为合法（返回空串）', () => {
      expect(csvShapeError([])).toBe('');
      expect(csvShapeError([{ a: 1 }, { b: 2 }])).toBe('');
    });

    it('非数组的顶层值给出「需要对象数组」并点明实际类型', () => {
      expect(csvShapeError({ a: 1 })).toMatch(/needs an array of objects.*an object/);
      expect(csvShapeError(42)).toMatch(/a number/);
      expect(csvShapeError('hi')).toMatch(/a string/);
      expect(csvShapeError(null)).toMatch(/null/);
      expect(csvShapeError(true)).toMatch(/a boolean/);
    });

    it('数组里混入非对象元素时，指出是第几个、是什么类型', () => {
      expect(csvShapeError([{ a: 1 }, 5, { b: 2 }])).toMatch(/item #2 is a number/);
      expect(csvShapeError([['x']])).toMatch(/item #1 is an array/);
    });

    it('嵌套数组即使顶层是数组也会被拦下（CSV 展平不了嵌套结构）', () => {
      expect(csvShapeError([1, 2, 3])).toMatch(/item #1 is a number/);
    });
  });
});
