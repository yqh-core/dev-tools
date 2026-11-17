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
 *  · API-011 起：pm.* 脚本生命周期（pre-request/test、folder 继承事件、分层变量、运行中写 env）
 *    经注入的 runScript 沙箱回调执行；API-012 起支持 iterationData 数据行。
 *    仍不做：拖拽改序、cookie jar（登记在总控板队列）；
 *  · 未注入 runScript 且请求无 scriptEvents 时，行为与 API-010 历史版本一致（回归保护）。
 *  · 报告只含请求方法/URL/状态/断言结果，不携带凭据头。
 */

import { type AssertionReport, runAssertions } from './assertions';
import { type KV, buildProxyPayload } from './engine';
import type { SavedRequest } from './store';
import type { ScriptSnapshot, ScriptOutcomeData } from './script-runtime';

/** API-011：沙箱执行回调由宿主注入（浏览器=script-sandbox Worker；单测=stub）。 */
export type RunScriptFn = (code: string, snapshot: ScriptSnapshot, send: SendFn) => Promise<{ outcome: ScriptOutcomeData; error?: string; timedOut: boolean }>;

export interface ScriptTestResult { name: string; passed: boolean; error?: string }

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
  /** API-011：pm.* 脚本执行钩子（未提供=完全不跑脚本，行为与历史版本一致）。 */
  runScript?: RunScriptFn
  /** API-011：变量分层起始快照（environment 用函数参数 env）。 */
  variableLayers?: { globals?: Record<string, string>; collection?: Record<string, string>; local?: Record<string, string> }
  /** API-012：本次迭代的数据行（CSV/JSON 一行），作为 iterationData 层。 */
  iterationData?: Record<string, string>
  iteration?: number
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
  /** API-011：pm.test 结果（无脚本事件则缺省）。 */
  scriptTests?: ScriptTestResult[]
  scriptError?: string
  /** sent 且（有断言则全过；无断言视为通过——与 Postman「无测试则发送成功即过」一致）且脚本测试全过。 */
  passed: boolean
}

export interface CollectionRunSummary {
  results: RequestRunResult[]
  total: number
  sent: number
  failed: number
  assertionsPassed: number
  assertionsTotal: number
  scriptTestsPassed: number
  scriptTestsTotal: number
  scriptErrors: number
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
    // 运行期分层（Postman 优先级 local > data > environment > collection > globals）
    const layers = {
      globals: { ...(opts.variableLayers?.globals ?? {}) },
      collection: { ...(opts.variableLayers?.collection ?? {}) },
      local: { ...(opts.variableLayers?.local ?? {}) },
    };
    const workingReq = { ...s.request, headers: [...s.request.headers], body: s.request.body };
    const applyWrites = (outcome: ScriptOutcomeData) => {
      for (const w of outcome.envWrites) {
        const target = w.layer === 'environment' ? env : w.layer === 'globals' ? layers.globals : w.layer === 'collection' ? layers.collection : layers.local;
        if (w.value === null) delete target[w.name]; else target[w.name] = w.value;
      }
    };
    const takeMutations = (outcome: ScriptOutcomeData) => {
      if (outcome.requestMutations.headers) workingReq.headers = outcome.requestMutations.headers as KV[];
      if (typeof outcome.requestMutations.body === 'string') workingReq.body = outcome.requestMutations.body;
      if (typeof outcome.requestMutations.url === 'string') workingReq.url = outcome.requestMutations.url;
      if (typeof outcome.requestMutations.method === 'string') workingReq.method = outcome.requestMutations.method;
    };
    const mergedForSubstitution = (): Record<string, string> => ({ ...layers.globals, ...layers.collection, ...env, ...(opts.iterationData ?? {}), ...layers.local });
    const snapshotFor = (event: 'prerequest' | 'test', response: RunnerResponse | null): ScriptSnapshot => ({
      request: { method: workingReq.method, url: workingReq.url, headers: workingReq.headers.map(h => ({ name: h.name, value: h.value })), body: workingReq.body },
      response: response ? { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, responseTime: response.elapsedMs } : null,
      globals: { ...layers.globals }, collection: { ...layers.collection }, environment: { ...env },
      iterationData: { ...(opts.iterationData ?? {}) }, local: { ...layers.local },
      info: { event, iteration: opts.iteration ?? 0, counter: i + 1, requestName: s.name },
    });

    let scriptTests: ScriptTestResult[] | undefined;
    let scriptError: string | undefined;
    if (opts.runScript && s.scriptEvents?.prerequest) {
      const r = await opts.runScript(s.scriptEvents.prerequest, snapshotFor('prerequest', null), send);
      if (r.timedOut) scriptError = 'pre-request script killed (timeout)';
      else if (r.error) scriptError = 'pre-request script error: ' + r.error;
      applyWrites(r.outcome); takeMutations(r.outcome);
    }

    const { payload, missing } = buildProxyPayload(workingReq, mergedForSubstitution());
    if (missing.length) {
      result = { ...base, sent: false, status: null, elapsedMs: null, error: 'Missing variables: ' + missing.join(', ') + '. Define them in the Variables panel.', report: null, passed: false };
    }
    else {
      try {
        const resp = await send(payload);
        // 空响应守卫：代理返回非 JSON/空体（本地预览、502-HTML 兜底页）时，
        // 干净失败而非让 runAssertions 对 null 崩出 TypeError。
        if (!resp || typeof resp.status !== 'number') {
          throw new Error('Executor returned no usable response (proxy empty or non-JSON). Check the proxy route and upstream availability.');
        }
        const report = runAssertions(s.assertions ?? [], resp, now());
        if (opts.runScript && s.scriptEvents?.test) {
          const r2 = await opts.runScript(s.scriptEvents.test, snapshotFor('test', resp), send);
          if (r2.outcome.tests.length) scriptTests = r2.outcome.tests.map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) }));
          if (r2.timedOut) scriptError = (scriptError ? scriptError + ' | ' : '') + 'test script killed (timeout)';
          else if (r2.error) scriptError = (scriptError ? scriptError + ' | ' : '') + 'test script error: ' + r2.error;
          applyWrites(r2.outcome);
        }
        const scriptOk = !scriptError && (scriptTests ?? []).every(t => t.passed);
        result = { ...base, sent: true, status: resp.status, elapsedMs: resp.elapsedMs, report, ...(scriptTests ? { scriptTests } : {}), ...(scriptError ? { scriptError } : {}), passed: report.allPassed && scriptOk };
      }
      catch (e) {
        // Postman 语义：请求本身失败时 test 脚本仍执行（pm.response 为 null）。
        // 失败路径的 envWrites 同样应用（如重试脚本写回退标记），mutation 无意义故不取。
        if (opts.runScript && s.scriptEvents?.test && !scriptError) {
          try {
            const r2 = await opts.runScript(s.scriptEvents.test, snapshotFor('test', null), send);
            if (r2.outcome.tests.length) scriptTests = r2.outcome.tests.map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) }));
            if (r2.timedOut) scriptError = 'test script killed (timeout)';
            else if (r2.error) scriptError = 'test script error: ' + r2.error;
            applyWrites(r2.outcome);
          }
          catch { /* 沙箱层错误已由 r2 承载 */ }
        }
        result = { ...base, sent: false, status: null, elapsedMs: null, error: e instanceof Error ? e.message : String(e), report: null, ...(scriptTests ? { scriptTests } : {}), ...(scriptError ? { scriptError } : {}), passed: false };
      }
    }
    if (!result.sent && scriptError && !result.error) result.error = scriptError;
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

  // 取消语义补全：末行执行中（含脚本在沙箱内跑）点取消，run 也如实标 cancelled，
  // 不要求"下一轮迭代开头"才看见取消（单行集合同样可取消）。
  if (opts.signal?.aborted) { cancelled = true; }
  const finishedAt = now();
  const sentResults = results.filter(r => r.sent);
  const failed = results.filter(r => !r.passed).length;
  const assertionsTotal = results.reduce((n, r) => n + (r.report?.total ?? 0), 0);
  const assertionsPassed = results.reduce((n, r) => n + (r.report?.passed ?? 0), 0);
  const scriptTestsTotal = results.reduce((n, r) => n + (r.scriptTests?.length ?? 0), 0);
  const scriptTestsPassed = results.reduce((n, r) => n + (r.scriptTests?.filter(t => t.passed).length ?? 0), 0);
  const scriptErrors = results.filter(r => r.scriptError).length;
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
    scriptTestsPassed,
    scriptTestsTotal,
    scriptErrors,
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
    if (r.scriptError) lines.push('       [SCRIPT] ' + r.scriptError);
    for (const t of r.scriptTests ?? []) {
      lines.push('       [' + (t.passed ? 'PASS' : 'FAIL') + '] pm.test: ' + t.name + (t.error ? ' — ' + t.error : ''));
    }
  });
  return lines.join('\n');
}
