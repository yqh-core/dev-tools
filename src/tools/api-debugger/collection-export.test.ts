/**
 * A-002/A-003 集合级脚本导出 round-trip（doc 级事件层 lock）。
 *
 * 判据：手动集合脚本导出为 Postman v2.1 doc 级 event（独立层，不污染请求级事件）；
 * 导出→导入按契约 v1.1 合并进各请求执行链（语义不丢）；无集合脚本时不造 doc event 噪音。
 */
import { describe, expect, it } from 'vitest';
import { exportCollection, importCollection } from './collection';
import type { SavedRequest } from './store';

function saved(name: string): SavedRequest {
  return {
    id: 'r1',
    name,
    request: { method: 'GET', url: 'https://api.example.test/x', headers: [], body: '' },
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('exportCollection 集合级脚本 doc 级事件', () => {
  it('手动集合脚本导出为 doc 级 event（prerequest/test 各一条，exec 按行）', () => {
    const doc = exportCollection([saved('A')], 'Col', true, { prerequest: 'pm.variables.set("k","v");', test: 'pm.test("t", () => {});' }) as any;
    expect(doc.event).toHaveLength(2);
    expect(doc.event[0]).toEqual({ listen: 'prerequest', script: { exec: ['pm.variables.set("k","v");'] } });
    expect(doc.event[1]).toEqual({ listen: 'test', script: { exec: ['pm.test("t", () => {});'] } });
    // 请求级不携带集合脚本（层间不混淆）
    expect(doc.item[0].event).toBeUndefined();
  });

  it('round-trip：导出 doc 级 → 导入合并进各请求执行链（语义不丢）', () => {
    const colPre = 'pm.collectionVariables.set("colMark","COL");';
    const doc = exportCollection([saved('A')], 'Col', true, { prerequest: colPre });
    const text = JSON.stringify(doc);
    const r = importCollection(text);
    expect(r.requests).toHaveLength(1);
    expect(r.requests[0].scriptEvents?.prerequest).toContain(colPre); // 合并进请求链
    expect(r.requests[0].scriptEvents?.prerequest).toContain(colPre.trim());
  });

  it('无集合脚本时不造 doc event 噪音（负控：键不凭空出现）', () => {
    const doc = exportCollection([saved('A')]) as any;
    expect(doc.event).toBeUndefined();
    expect(JSON.stringify(doc)).not.toContain('"event"');
  });

  it('空文本集合脚本视为无（trim 后空不导出）', () => {
    const doc = exportCollection([saved('A')], 'Col', true, { prerequest: '   ', test: '' }) as any;
    expect(doc.event).toBeUndefined();
  });
});
