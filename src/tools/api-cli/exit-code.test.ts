/**
 * 退出码分类单测（C2/C5：文档化契约的机器锁）。
 */
import { describe, expect, it } from 'vitest';
import { classifyCliExit } from './exit-code';

describe('classifyCliExit', () => {
  it.each([
    [{ completed: true, allPassed: true, reportWriteFailed: false }, 0, 'ALL_PASSED'],
    [{ completed: true, allPassed: false, reportWriteFailed: false }, 1, 'FAILURES_PRESENT'],
    [{ completed: false, allPassed: false, reportWriteFailed: false }, 2, 'RUN_NOT_COMPLETED'],
    [{ completed: true, allPassed: true, reportWriteFailed: true }, 3, 'REPORT_WRITE_FAILED'],
  ])('%j → %i/%s', (o, code, label) => {
    const r = classifyCliExit(o as never);
    expect(r.code).toBe(code);
    expect(r.label).toBe(label);
  });

  it('写失败优先于通过（运行通过但报告落盘失败仍非零，C5）', () => {
    const r = classifyCliExit({ completed: true, allPassed: true, reportWriteFailed: true });
    expect(r.code).toBe(3);
  });
});
