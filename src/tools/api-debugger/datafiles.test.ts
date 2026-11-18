/**
 * API-012/B1 数据文件解析单测。判据方向：合法样例全过；任务书点名的每类异常 fail-closed；
 * 负控证明"该红的红"（如 split(',') 实现会在带逗号引号字段上立刻暴露）。
 */
import { describe, expect, it } from 'vitest';
import { dataFileSummary, parseCsvData, parseDataFile, parseJsonData, previewRows } from './datafiles';

const TASKBOOK_SAMPLE = 'email,expectedRole,caseId\nalice@example.test,admin,case-001\nbob@example.test,reader,case-002\ncharlie@example.test,editor,case-003\n';

describe('CSV 严格解析（RFC 4180）', () => {
  it('任务书样例：3 行 3 列，值逐字节一致', () => {
    const r = parseCsvData(TASKBOOK_SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.columns).toEqual(['email', 'expectedRole', 'caseId']);
    expect(r.data.rows).toHaveLength(3);
    expect(r.data.rows[0]).toEqual({ email: 'alice@example.test', expectedRole: 'admin', caseId: 'case-001' });
  });

  it('引号字段：内嵌逗号/转义引号/字段内换行（split(",") 实现必在此暴露）', () => {
    const csv = 'a,b\n"x,y","say ""hi""\nnewline"\n';
    const r = parseCsvData(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.rows[0]).toEqual({ a: 'x,y', b: 'say "hi"\nnewline' });
  });

  it('UTF-8 BOM 被剥离（不污染首列名）', () => {
    const r = parseCsvData('﻿a,b\n1,2\n');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.columns[0]).toBe('a');
  });

  it('负控：空文件 → error', () => {
    expect(parseCsvData('').ok).toBe(false);
    expect(parseCsvData('   \n  \n').ok).toBe(false);
  });

  it('负控：空表头列名 → error', () => {
    const r = parseCsvData('a,,c\n1,2,3\n');
    expect(r.ok).toBe(false);
  });

  it('负控：重复列名 → error（任务书点名）', () => {
    const r = parseCsvData('a,a\n1,2\n');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain('Duplicate column');
  });

  it('负控：字段数多于表头 → error；少于表头 → 补空字符串（Postman 兼容）', () => {
    const tooMany = parseCsvData('a,b\n1,2,3\n');
    expect(tooMany.ok).toBe(false);
    const tooFew = parseCsvData('a,b\n1\n');
    expect(tooFew.ok).toBe(true);
    if (tooFew.ok) expect(tooFew.data.rows[0]).toEqual({ a: '1', b: '' });
  });

  it('负控：只有表头无数据行 → error', () => {
    expect(parseCsvData('a,b\n').ok).toBe(false);
  });
});

describe('JSON 严格解析', () => {
  it('合法：顶层数组+对象，数值/布尔转字符串（Postman 语义）', () => {
    const r = parseJsonData('[{"email":"a@x.test","n":1,"flag":true},{"email":"b@x.test","n":2,"flag":false}]');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.columns.sort()).toEqual(['email', 'flag', 'n']);
    expect(r.data.rows[0]).toEqual({ email: 'a@x.test', n: '1', flag: 'true' });
  });

  it('负控：非法 JSON / 非顶层数组 / 非对象元素 / 嵌套值 → 全部 error', () => {
    expect(parseJsonData('{not json').ok).toBe(false);
    expect(parseJsonData('{"a":1}').ok).toBe(false);
    expect(parseJsonData('[1,2]').ok).toBe(false);
    expect(parseJsonData('[{"a":{"nested":1}}]').ok).toBe(false);
  });

  it('负控：空数组 → error；空对象元素集 → error', () => {
    expect(parseJsonData('[]').ok).toBe(false);
    expect(parseJsonData('[{},{}]').ok).toBe(false);
  });
});

describe('分发与安全摘要', () => {
  it('parseDataFile 按扩展名分发，未知扩展名 fail-closed', () => {
    expect(parseDataFile('u.csv', TASKBOOK_SAMPLE).ok).toBe(true);
    expect(parseDataFile('u.json', '[{"a":"1"}]').ok).toBe(true);
    expect(parseDataFile('u.txt', 'x').ok).toBe(false);
  });

  it('摘要只含类型/行数/列数（脱敏正控）', () => {
    const r = parseCsvData(TASKBOOK_SAMPLE);
    if (!r.ok) throw new Error('parse failed');
    const s = dataFileSummary(r.data, 'csv');
    expect(s).toEqual({ type: 'csv', rows: 3, columnsCount: 3 });
    expect(JSON.stringify(s)).not.toContain('alice');
  });

  it('预览截断长值且不超 5 行', () => {
    const r = parseCsvData('a\n' + 'x'.repeat(100) + '\n' + 'y'.repeat(100) + '\n' + 'z\n' + 'w\n' + 'v\n' + 'u\n');
    if (!r.ok) throw new Error('parse failed');
    const p = previewRows(r.data);
    expect(p.rows).toHaveLength(5);
    expect(p.rows[0][0].endsWith('…')).toBe(true);
  });
});
