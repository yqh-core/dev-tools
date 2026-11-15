/**
 * API-010 · 集合级批量 Runner（对标 Postman Collection Runner / Newman 核心）。
 *
 * 设计边界：
 *  · 顺序执行集合内全部已保存请求（集合顺序=保存顺序），每请求做变量替换→经 apiproxy 发送→
 *    跑该请求随存的断言（复用 API-009 runAssertions）；
 *  · send 依赖注入 → 全部编排逻辑可单测（stub sender，不触网）；
 *  · stopOnError（发送失败即停，默认开，对齐 Postman 默认）/ stopOnFailure（断言失败即停，默认关）
 *    两档分离，语义对齐 postman-runtime stopOnError / stopOnFailure；
 *  · 请求间延迟 delayMs、运行中取消 signal、逐请求进度 onProgress；
 *  · 不做：迭代/数据文件参数化、pm.* 脚本、拖拽改序、cookie jar、运行中改写 env（诚实边界，MVP 覆盖核心回归任务）；
 *  · 报告只含请求方法/URL/状态/断言结果，不携带凭据头。
 */

import { type AssertionReport, runAssertions } from './assertions';
import { type KV, buildProxyPayload } from './engine';
import type { SavedRequest } from './store';

export interface RunnerResponse {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  elapsedMs: number
  redirect?: string
  followed?: boolean
  note?: string
}

export interface RunnerPayload { url: string; method: string; headers: KV[]; body: string }
export type SendFn = (payload: RunnerPayload) => Promise<RunnerResponse>;

export interface RunnerOptions {
  stopOnError?: boolean
  stopOnFailure?: boolean
  delayMs?: number
  signal?: { aborted: boolean }
  onProgress?: (result: RequestRunResult, index: number, total: number) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface RequestRunResult {
  id: string
  name: string
  method: string
  url: string
  sent: boolean
  status: number | null
  elapsedMs: number | null
  error?: string
  report: AssertionReport | null
  /** sent 且（有断言则全过；无断言视为通过——与 Postman「无测试则发送成功即过」一致）。 */
  passed: boolean
}

export interface CollectionRunSummary {
  results: RequestRunResult[]
  total: number
  sent: number
  failed: number
  assertionsPassed: number
  assertionsTotal: number
  totalDurationMs: number
  avgResponseMs: number | null
  allPassed: boolean
  stoppedEarly: boolean
  cancelled: boolean
  startedAt: number
  finishedAt: number
}

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** 顺序运行集合。空集合 → total=0、allPassed=true（空真，UI 另行提示）。 */
export async function runCollection(
  saved: SavedRequest[],
  env: Record<string, string>,
  send: SendFn,
  opts: RunnerOptions = {},
): Promise<CollectionRunSummary> {
  const stopOnError = opts.stopOnError ?? true;
  const stopOnFailure = opts.stopOnFailure ?? false;
  const delayMs = Math.max(0, opts.delayMs ?? 0);
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? defaultSleep;
  const startedAt = now();
  const results: RequestRunResult[] = [];
  let stoppedEarly = false;
  let cancelled = false;

  for (let i = 0; i < saved.length; i++) {
    if (opts.signal?.aborted) {
      cancelled = true;
      break;
    }
    const s = saved[i];
    const base = { id: s.id, name: s.name, method: s.request.method, url: s.request.url };
    let result: RequestRunResult;
    const { payload, missing } = buildProxyPayload(s.request, env);
    if (missing.length) {
      result = { ...base, sent: false, status: null, elapsedMs: null, error: `Missing variables: ${missing.join(', ')}. Define them in the Variables panel.`, report: null, passed: false };
    }
    else {
      try {
        const resp = await send(payload);
        const report = runAssertions(s.assertions ?? [], resp, now());
        result = { ...base, sent: true, status: resp.status, elapsedMs: resp.elapsedMs, report, passed: report.allPassed };
      }
      catch (e) {
        result = { ...base, sent: false, status: null, elapsedMs: null, error: e instanceof Error ? e.message : String(e), report: null, passed: false };
      }
    }
    results.push(result);
    opts.onProgress?.(result, i, saved.length);

    if (stopOnError && !result.sent) {
      stoppedEarly = true;
      break;
    }
    if (stopOnFailure && result.sent && result.report && !result.report.allPassed) {
      stoppedEarly = true;
      break;
    }
    if (delayMs > 0 && i < saved.length - 1 && !opts.signal?.aborted) {
      await sleep(delayMs);
    }
  }

  const finishedAt = now();
  const sentResults = results.filter(r => r.sent);
  const failed = results.filter(r => !r.passed).length;
  const assertionsTotal = results.reduce((n, r) => n + (r.report?.total ?? 0), 0);
  const assertionsPassed = results.reduce((n, r) => n + (r.report?.passed ?? 0), 0);
  const avgResponseMs = sentResults.length
    ? Math.round(sentResults.reduce((n, r) => n + (r.elapsedMs ?? 0), 0) / sentResults.length)
    : null;
  return {
    results,
    total: saved.length,
    sent: sentResults.length,
    failed,
    assertionsPassed,
    assertionsTotal,
    totalDurationMs: finishedAt - startedAt,
    avgResponseMs,
    allPassed: failed === 0 && !cancelled,
    stoppedEarly,
    cancelled,
    startedAt,
    finishedAt,
  };
}

/** 可读纯文本运行报告（复制/下载共用）。不含凭据头。 */
export function formatCollectionReportText(summary: CollectionRunSummary): string {
  const lines: string[] = [];
  lines.push(`DigDevBox collection run report — ${new Date(summary.finishedAt).toISOString()}`);
  lines.push(`Requests: ${summary.sent}/${summary.total} sent, ${summary.failed} failed · Assertions: ${summary.assertionsPassed}/${summary.assertionsTotal} passed · Duration ${summary.totalDurationMs} ms${summary.avgResponseMs === null ? '' : ` · Avg ${summary.avgResponseMs} ms`}`);
  if (summary.cancelled) {
    lines.push('Run cancelled by user.');
  }
  else if (summary.stoppedEarly) {
    lines.push('Run stopped early after a failure.');
  }
  lines.push(`Result: ${summary.allPassed ? 'ALL PASSED' : 'FAILURES PRESENT'}`);
  lines.push('');
  if (!summary.results.length) {
    lines.push('(collection is empty)');
  }
  summary.results.forEach((r, i) => {
    const head = `[${i + 1}] ${r.passed ? 'PASS' : 'FAIL'} ${r.name} (${r.method} ${r.url})`;
    const meta = r.sent ? ` → ${r.status} (${r.elapsedMs} ms)${r.report && r.report.total ? ` · Tests ${r.report.passed}/${r.report.total}` : ''}` : ' → NOT SENT';
    lines.push(head + meta);
    if (r.error) {
      lines.push(`       ${r.error}`);
    }
    if (r.report) {
      for (const a of r.report.results) {
        lines.push(`       [${a.passed ? 'PASS' : 'FAIL'}] ${a.label} — ${a.message}`);
      }
    }
  });
  return lines.join('\n');
}
