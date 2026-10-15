import { describe, expect, it } from 'vitest';
import { collapseSqlWhitespace, minifySQL } from './sql-prettify.service';

const cfg = { language: 'sql', keywordCase: 'upper' } as const;

describe('sql-prettify service', () => {
  describe('collapseSqlWhitespace', () => {
    it('多行折成一行', () => {
      expect(collapseSqlWhitespace('SELECT a,\n    b\nFROM t\nWHERE x = 1;')).toEqual('SELECT a, b FROM t WHERE x = 1;');
    });

    it('字符串字面量内部的空白与内容一字不改', () => {
      expect(collapseSqlWhitespace('SELECT \'a  b   c\' AS x FROM t')).toEqual('SELECT \'a  b   c\' AS x FROM t');
    });

    // 证伪组：朴素实现（直接 replace(/\s+/g,' ') 或按 -- 切）会在这两条上翻车。
    it('字面量里含 -- 时不能被当成语法注释（\'a--b\' 必须原样留着）', () => {
      const sql = 'SELECT \'a--b\' AS x FROM t';
      expect(collapseSqlWhitespace(sql)).toEqual(sql);
      expect(collapseSqlWhitespace(sql)).toContain('FROM t');
    });

    it('行注释转块注释，保住后面的代码不被注释吃掉', () => {
      const out = collapseSqlWhitespace('SELECT a -- 说明\nFROM t');
      expect(out).toContain('FROM t');
      expect(out).toContain('/* 说明*/');
      expect(out.split('\n')).toHaveLength(1);
    });

    it('块注释内容原样保留（含其中的换行与星号）', () => {
      const sql = 'SELECT a /* 多\n行 注*释 */ FROM t';
      expect(collapseSqlWhitespace(sql)).toContain('/* 多\n行 注*释 */');
    });
  });

  describe('minifySQL', () => {
    it('先美化再压缩：美化产生的缩进全部消失', () => {
      const flat = minifySQL('select field1,field2 from my_table where my_condition;', cfg);
      expect(flat).toBe('SELECT field1, field2 FROM my_table WHERE my_condition;');
      expect(flat).not.toContain('\n');
    });

    // 我原本断言「语法错误返回空串」，实测不成立：sql-formatter 是**分词器不是语法校验器**，
    // `SELECT FROM WHERE` 它照样能处理。所以这条改成断言真实契约：不抛异常、按空白折叠输出。
    it('非语法合法的 SQL 不抛异常（sql-formatter 不做语法校验，别假装我们做了）', () => {
      expect(minifySQL('SELECT FROM WHERE', cfg)).toEqual('SELECT FROM WHERE');
      expect(() => minifySQL('))) not sql ((( ;', cfg)).not.toThrow();
    });

    it('空输入返回空串', () => {
      expect(minifySQL('', cfg)).toEqual('');
      expect(minifySQL('   \n  ', cfg)).toEqual('');
    });
  });
});
