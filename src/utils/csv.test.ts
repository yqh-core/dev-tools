import { describe, expect, it } from 'vitest';
import { csvToObjects, needsQuoting, parseCsv, serializeCsv } from './csv';

describe('csv utils (RFC 4180)', () => {
  describe('parseCsv', () => {
    it('解析基本表格', () => {
      expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('CRLF、裸 CR、LF 三种记录分隔符都认', () => {
      const want = [['a', 'b'], ['1', '2']];
      expect(parseCsv('a,b\r\n1,2')).toEqual(want);
      expect(parseCsv('a,b\n1,2')).toEqual(want);
      expect(parseCsv('a,b\r1,2')).toEqual(want);
    });

    it('带引号的字段里，分隔符与换行不算结构字符', () => {
      expect(parseCsv('"a,1",b')).toEqual([['a,1', 'b']]);
      expect(parseCsv('"line1\nline2",b')).toEqual([['line1\nline2', 'b']]);
    });

    it('"" 还原成一个引号（这正是旧写侧做错的地方）', () => {
      expect(parseCsv('"hello ""world"""')).toEqual([['hello "world"']]);
      expect(parseCsv('a\n"x,y"')).toEqual([['a'], ['x,y']]);
    });

    it('末尾换行不产生多余空记录', () => {
      expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
      expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
    });

    it('空文本得到空数组；只有分隔符得到空字段', () => {
      expect(parseCsv('')).toEqual([]);
      expect(parseCsv(',')).toEqual([['', '']]);
      expect(parseCsv('a,,b')).toEqual([['a', '', 'b']]);
    });

    it('剥掉 Excel 导出的 BOM，避免污染首列表头', () => {
      expect(parseCsv('﻿name,age')).toEqual([['name', 'age']]);
    });

    it('引号未闭合要报错，而不是静默吞掉半条记录', () => {
      expect(() => parseCsv('a,b\n"unclosed,2')).toThrowError(/Unterminated quoted field/);
    });

    it('分隔符可换（分号 CSV 是 Excel 区域的常见导出）', () => {
      expect(parseCsv('a;b\n1;2', { delimiter: ';' })).toEqual([['a', 'b'], ['1', '2']]);
    });
  });

  describe('serializeCsv', () => {
    it('只在真的需要时加引号', () => {
      expect(serializeCsv([['plain', 'a,b'], ['x', 'y']])).toBe('plain,"a,b"\nx,y');
    });

    it('引号按 RFC 4180 双写，而不是反斜杠转义', () => {
      expect(serializeCsv([['hello "world"']])).toBe('"hello ""world"""');
      // 反证：旧实现会输出不带引号的 `hello \"world\"`，标准读取器读不回来
      expect(serializeCsv([['hello "world"']])).not.toBe('hello \\"world\\"');
    });

    it('含换行的值被引号包住，换行原样保留（不折成字面 \\n）', () => {
      expect(serializeCsv([['line1\nline2']])).toBe('"line1\nline2"');
    });

    it('反斜杠不做任何转义（CSV 没有反斜杠转义这回事）', () => {
      expect(serializeCsv([['C:\\path\\to']])).toBe('C:\\path\\to');
    });
  });

  describe('needsQuoting', () => {
    it('分隔符/引号/CR/LF 触发引号，制表符与普通字符不触发', () => {
      expect(needsQuoting('a,b', ',')).toBe(true);
      expect(needsQuoting('a"b', ',')).toBe(true);
      expect(needsQuoting('a\nb', ',')).toBe(true);
      expect(needsQuoting('a\rb', ',')).toBe(true);
      expect(needsQuoting('a\tb', ',')).toBe(false);
      expect(needsQuoting('plain', ',')).toBe(false);
    });
  });

  // 往返属性是这套实现唯一真正要紧的判据：写出去必须能原样读回来。
  describe('往返属性 parseCsv(serializeCsv(x)) === x', () => {
    const cases: string[][][] = [
      [['a', 'b'], ['1', '2']],
      [['hello "world"', 'plain']],
      [['a,b', 'c']],
      [['line1\nline2', 'x']],
      [['C:\\path\\to', 'tab\there']],
      [['', '']],
      [['中文', 'ünïcödé'], ['emoji 🎯', '']],
      [['leading space', ' trailing']],
    ];

    cases.forEach((rows, i) => {
      it(`用例 ${i + 1}`, () => {
        expect(parseCsv(serializeCsv(rows))).toEqual(rows);
      });
    });

    it('对随机生成的表格也成立（含分隔符、引号、换行的混合）', () => {
      const alphabet = ['a', ',', '"', '\n', '\r', ' ', ';', '中', '\\'];
      let seed = 42;
      const rnd = (n: number) => {
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
        return seed % n;
      };
      for (let round = 0; round < 200; round++) {
        const rows = Array.from({ length: 1 + rnd(4) }, () => Array.from(
          { length: 1 + rnd(4) },
          () => Array.from({ length: rnd(8) }, () => alphabet[rnd(alphabet.length)]).join(''),
        ));
        // 避开"整行只有一个空字段"这种序列化后与空文本无法区分的退化情形
        const safe = rows.filter(r => !(r.length === 1 && r[0] === ''));
        if (safe.length === 0) {
          continue;
        }
        expect(parseCsv(serializeCsv(safe))).toEqual(safe);
      }
    });
  });

  describe('csvToObjects', () => {
    it('首行作表头', () => {
      expect(csvToObjects('name,age\nalice,30\nbob,25').rows)
        .toEqual([{ name: 'alice', age: '30' }, { name: 'bob', age: '25' }]);
    });

    it('空表头列生成稳定 key，不产生空字符串键', () => {
      const r = csvToObjects('a,,c\n1,2,3');
      expect(r.headers).toEqual(['a', 'column_2', 'c']);
      expect(r.rows).toEqual([{ a: '1', column_2: '2', c: '3' }]);
    });

    it('重名列改名保序，一列都不丢，并如实回报改了什么', () => {
      const r = csvToObjects('a,a,b\n1,2,3');
      expect(r.headers).toEqual(['a', 'a__2', 'b']);
      expect(r.rows).toEqual([{ a: '1', a__2: '2', b: '3' }]);
      expect(r.duplicateHeaders).toEqual(['a']);
      expect(r.renamed).toEqual([{ from: 'a', to: 'a__2' }]);
    });

    it('三重名逐级改名，不撞车', () => {
      expect(csvToObjects('x,x,x\n1,2,3').headers).toEqual(['x', 'x__2', 'x__3']);
    });

    it('短行补空字符串并记下行号，不产生 undefined 值', () => {
      const r = csvToObjects('a,b,c\n1');
      expect(r.rows).toEqual([{ a: '1', b: '', c: '' }]);
      expect(r.rowsWithMissingCells).toEqual([1]);
    });

    it('长行的多余单元格不丢，记下行号并放进 __extra_N', () => {
      const r = csvToObjects('a,b\n1,2,3');
      expect(r.rows).toEqual([{ a: '1', b: '2', __extra_1: '3' }]);
      expect(r.rowsWithExtraCells).toEqual([1]);
    });

    it('header:false 时按列号生成 key，首行也当数据', () => {
      const r = csvToObjects('1,2\n3,4', { header: false });
      expect(r.headers).toEqual(['column_1', 'column_2']);
      expect(r.rows.length).toBe(2);
    });

    it('空文本不炸', () => {
      expect(csvToObjects('')).toEqual({
        headers: [],
        rows: [],
        duplicateHeaders: [],
        renamed: [],
        rowsWithExtraCells: [],
        rowsWithMissingCells: [],
      });
    });
  });
});
