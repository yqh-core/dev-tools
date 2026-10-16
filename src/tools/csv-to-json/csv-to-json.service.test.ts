import { describe, expect, it } from 'vitest';
import { convertCsvToJson, countCsvRows } from './csv-to-json.service';

const H = { header: true } as const;
const NOH = { header: false } as const;

describe('csv-to-json service', () => {
  it('基本表格 → 对象数组', () => {
    const r = convertCsvToJson('name,age\nalice,30\nbob,25', H);

    expect(JSON.parse(r.json)).toEqual([
      { name: 'alice', age: '30' },
      { name: 'bob', age: '25' },
    ]);
    expect(r.error).toBe('');
    expect(r.warnings).toEqual([]);
    expect({ rows: r.rowCount, cols: r.columnCount }).toEqual({ rows: 2, cols: 2 });
  });

  it('空输入不报错也不产出 JSON', () => {
    expect(convertCsvToJson('   ', H)).toMatchObject({ json: '', error: '', warnings: [] });
  });

  it('只有表头时给出说明，而不是静默返回空数组', () => {
    const r = convertCsvToJson('a,b\n', H);

    expect(JSON.parse(r.json)).toEqual([]);
    expect(r.warnings.join(' ')).toContain('Only a header row');
  });

  it('引号内的逗号与换行不破坏结构（这是自建解析器最容易翻车的地方）', () => {
    const r = convertCsvToJson('a,b\n"x,y","line1\nline2"', H);

    expect(JSON.parse(r.json)).toEqual([{ a: 'x,y', b: 'line1\nline2' }]);
  });

  it('"" 还原成一个引号', () => {
    const r = convertCsvToJson('a\n"He said ""hi"""', H);

    expect(JSON.parse(r.json)).toEqual([{ a: 'He said "hi"' }]);
  });

  it('CRLF 与 BOM 都能吃', () => {
    expect(JSON.parse(convertCsvToJson('a,b\r\n1,2\r\n', H).json))
      .toEqual([{ a: '1', b: '2' }]);
    expect(JSON.parse(convertCsvToJson('﻿name,age\nx,1', H).json))
      .toEqual([{ name: 'x', age: '1' }]);
  });

  it('畸形 CSV 报明确错误，不静默丢记录', () => {
    const r = convertCsvToJson('a,b\n"unclosed,2', H);

    expect(r.json).toBe('');
    expect(r.error).toMatch(/Unterminated quoted field/);
    expect(r.error).toMatch(/line 2/);
  });

  it('重名列：一列都不丢，且明确告诉用户改了什么名', () => {
    const r = convertCsvToJson('a,a,b\n1,2,3', H);

    expect(JSON.parse(r.json)).toEqual([{ a: '1', a__2: '2', b: '3' }]);
    expect(r.warnings.join(' ')).toContain('"a" → "a__2"');
  });

  it('行比表头长：多余值保留在 __extra_N 并报行号', () => {
    const r = convertCsvToJson('a,b\n1,2,3', H);

    expect(JSON.parse(r.json)).toEqual([{ a: '1', b: '2', __extra_1: '3' }]);
    expect(r.warnings.join(' ')).toMatch(/Row 1 .*more values than the header/);
  });

  it('行比表头短：补空串并报行号', () => {
    const r = convertCsvToJson('a,b,c\n1', H);

    expect(JSON.parse(r.json)).toEqual([{ a: '1', b: '', c: '' }]);
    expect(r.warnings.join(' ')).toMatch(/fewer values/);
  });

  it('header:false 时首行也当数据，键按列号生成', () => {
    const r = convertCsvToJson('a,b\n1,2', NOH);

    expect(JSON.parse(r.json)).toEqual([
      { column_1: 'a', column_2: 'b' },
      { column_1: '1', column_2: '2' },
    ]);
  });

  it('输出是缩进 2 空格的 JSON（与站内其它 JSON 输出一致）', () => {
    const r = convertCsvToJson('a\n1', H);

    expect(r.json).toBe('[\n  {\n    "a": "1"\n  }\n]');
  });

  describe('countCsvRows', () => {
    it('引号内的换行不算新行', () => {
      expect(countCsvRows('a,b\n"x\ny",2')).toBe(2);
    });

    it('空文本与畸形文本都返回 0，不抛', () => {
      expect(countCsvRows('')).toBe(0);
      expect(countCsvRows('"oops,1')).toBe(0);
    });
  });
});
