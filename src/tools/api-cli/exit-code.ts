/**
 * API Studio CLI · 退出码分类（任务书 §8 C2/C5：可预测、文档化的退出码）。
 *
 * 纯函数——便于单测锁住映射表，main 只做 process.exit 翻译。
 * 约定（与 --help 文案一致）：
 *   0 全过 · 1 有失败 · 2 前置 fail-closed/运行未完成 · 3 报告写入失败 · 4 用法错误
 */

export type CliExitKind = { code: 0; label: 'ALL_PASSED' } | { code: 1; label: 'FAILURES_PRESENT' } | { code: 2; label: 'RUN_NOT_COMPLETED' } | { code: 3; label: 'REPORT_WRITE_FAILED' } | { code: 4; label: 'USAGE_ERROR' };

export interface CliRunOutcome {
  /** 运行是否完成到出摘要（false=前置加载失败/意外运行错误）。 */
  completed: boolean
  allPassed: boolean
  /** 报告写入是否失败（运行本身可能已通过——写失败必须非零且可识别，C5）。 */
  reportWriteFailed: boolean
}

export function classifyCliExit(o: CliRunOutcome): CliExitKind {
  if (o.reportWriteFailed) {
    return { code: 3, label: 'REPORT_WRITE_FAILED' };
  }

  if (!o.completed) {
    return { code: 2, label: 'RUN_NOT_COMPLETED' };
  }
  if (!o.allPassed) {
    return { code: 1, label: 'FAILURES_PRESENT' };
  }
  return { code: 0, label: 'ALL_PASSED' };
}
