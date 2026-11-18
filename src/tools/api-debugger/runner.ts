/**
 * API-010/011/012 · 集合级 Runner（对标 Postman Collection Runner / Newman 核心）。
 *
 * 设计边界：
 *  · 顺序执行集合内全部已保存请求（集合顺序=保存顺序），每请求做变量替换→经 apiproxy 发送→
 *    跑该请求随存的断言（复用 API-009 runAssertions）；
 *  · send 依赖注入 → 全部编排逻辑可单测（stub sender，不触网）；
 *  · stopOnError（发送失败即停，默认开，对齐 Postman 默认）/ stopOnFailure（断言失败即停，默认关）
 *    两档分离，语义对齐 postman-runtime stopOnError / stopOnFailure；
 *  · 请求间延迟 delayMs、运行中取消 signal、逐请求进度 onProgress；
 *  · API-011：pm.* 脚本生命周期经注入的 runScript 沙箱回调执行；
 *  · API-011/A-002/A-003（D 批次盘查补缺）：集合级脚本经 collectionScripts 选项叠加执行——
 *    完整 prerequest 序 = 集合级（手动，最外先执行）→ doc/folder 级（导入时合并入请求文本）→
 *    request 级；test 序反之（内先外后，集合级最后执行）。prerequest 段的 pm.test 结果同样计入
 *    scriptTests（Postman 语义，徽章/报告/JUnit 不分阶段）。
 *  · API-012（B 阶段）：数据文件驱动多轮迭代。迭代语义契约 v1.1（与 docs/api-studio/SCRIPT-CONTRACT.md 同步）：
 *      - 轮数 = 显式 iterations > 0 ? iterations : 数据行数；轮数 > 行数 → 行循环取用（cycle）；
 *        轮数 < 行数 → 只跑前 N 行；无数据文件 → 单轮（与 API-010 逐键一致）。
 *      - 作用域生命周期（Postman 语义）：globals/collection/environment 写入**跨请求跨轮持久**；
 *        local（pm.variables.set）**每次请求重置**；iterationData **每轮重置**。
 *      - 一轮内提取的 token 供本轮后续请求复用（environment 持久）；下一轮继承 environment 写入，
 *        local/data 不串轮（每轮 local 全新、data 取当轮行）。
 *      - stopOnError/stopOnFailure 命中即停止**整个运行**（含剩余轮），stoppedEarly 如实标记。
 *  · 脱敏（B3）：报告与 summary 只含轮序号、列名、计数——数据行值、环境变量值、请求/响应体
 *    一律不进报告；onProgress 同样只携带白名单标量。
 *  · 报告不含凭据头（API-010 起）。
 */

import { type AssertionReport, runAssertions } from './assertions';
import { type KV, buildProxyPayload } from './engine';
import type { SavedRequest } from './store';
import type { DataFile } from './datafiles';
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
  /** API-012：解析后的数据文件（datafiles.ts 产物）。行值绝不进报告（脱敏）。 */
  dataFile?: DataFile
  dataFileType?: 'csv' | 'json'
  /** API-012：显式迭代次数；缺省=数据行数。见文件头迭代语义契约 v1.1。 */
  iterations?: number
  /** @deprecated API-011 单轮注入点；B 阶段起由 dataFile/iterations 编排，保留兜底兼容。 */
  iterationData?: Record<string, string>
  /** @deprecated 同上；轮次由编排器赋值。 */
  iteration?: number
  /** A-002/A-003：手动管理的集合级脚本（浏览器 UI 集合脚本区）。独立一层事件，
   *  按契约 v1.1 叠加执行：prerequest 在请求链之前（外先内后）、test 在请求链之后
   *  （内先外后）——与 Postman 三层事件语义一致。CLI 无手动入口（边界登记）。 */
  collectionScripts?: { prerequest?: string; test?: string }
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

/** API-012：一轮迭代的摘要。脱敏：只含轮次、列名、行序号——绝无数据行值。 */
export interface IterationSummary {
  iteration: number
  dataRowColumns: string[] | null
  dataRowIndex: number | null
  results: RequestRunResult[]
}

export interface CollectionRunSummary {
  results: RequestRunResult[]
  iterations: IterationSummary[]
  iterationCount: number
  dataFile: { type: string; rows: number; columnsCount: number } | null
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

/** 顺序运行集合（可多轮数据驱动）。空集合 → total=0、allPassed=true（空真，UI 另行提示）。 */
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

  // —— B 阶段多轮编排（迭代语义契约 v1.1） ——
  const dataRows = opts.dataFile?.rows ?? [];
  const roundCount = dataRows.length
    ? (opts.iterations && opts.iterations > 0 ? opts.iterations : dataRows.length)
    : 1;
  const allResults: RequestRunResult[] = [];
  const iterations: IterationSummary[] = [];
  let stoppedEarly = false;
  let cancelled = false;
  let globalIdx = 0;
  const totalRequests = roundCount * saved.length;

  // 跨请求/跨轮持久层（Postman 语义）：globals/collection 写入持久；environment 用宿主 env 引用。
  // B 阶段修复：持久层必须在请求循环外（A 阶段旧实现把 layers 声明在请求内，
  // globals/collection 写入跨请求丢失——environment 因用宿主引用而幸免）。
  const persistent = {
    globals: { ...(opts.variableLayers?.globals ?? {}) },
    collection: { ...(opts.variableLayers?.collection ?? {}) },
  };
  // A-002/A-003 集合级脚本（手动集合脚本区；独立一层事件，契约 v1.1 叠加执行）
  const colPre = opts.collectionScripts?.prerequest?.trim() ? opts.collectionScripts.prerequest : '';
  const colTest = opts.collectionScripts?.test?.trim() ? opts.collectionScripts.test : '';

  for (let round = 0; round < roundCount; round++) {
    if (opts.signal?.aborted) { cancelled = true; break; }
    const dataRow = dataRows.length ? dataRows[round % dataRows.length] : (opts.iterationData ?? null);
    const roundResults: RequestRunResult[] = [];

    for (let i = 0; i < saved.length; i++) {
      if (opts.signal?.aborted) { cancelled = true; break; }
      const s = saved[i];
      const base = { id: s.id, name: s.name, method: s.request.method, url: s.request.url };
      // 集合级脚本叠加（Postman 三层事件语义；调用方保证文本来源不重复）：
      //   prerequest = 集合级（外，先执行）+ 请求链（内，后执行）
      //   test       = 请求链（内，先执行）+ 集合级（外，后执行）
      const reqPre = s.scriptEvents?.prerequest ?? '';
      const reqTest = s.scriptEvents?.test ?? '';
      const mergedPre = colPre ? (reqPre ? `${colPre}\n${reqPre}` : colPre) : reqPre;
      const mergedTest = colTest ? (reqTest ? `${reqTest}\n${colTest}` : colTest) : reqTest;
      // local 每次请求重置；iterationData 每轮重置（契约 v1.1）
      const layers = { globals: persistent.globals, collection: persistent.collection, local: {} as Record<string, string> };
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
      const mergedForSubstitution = (): Record<string, string> => ({ ...layers.globals, ...layers.collection, ...env, ...(dataRow ?? {}), ...layers.local });
      const snapshotFor = (event: 'prerequest' | 'test', response: RunnerResponse | null): ScriptSnapshot => ({
        request: { method: workingReq.method, url: workingReq.url, headers: workingReq.headers.map(h => ({ name: h.name, value: h.value })), body: workingReq.body },
        response: response ? { status: response.status, statusText: response.statusText, headers: response.headers, body: response.body, responseTime: response.elapsedMs } : null,
        globals: { ...layers.globals }, collection: { ...layers.collection }, environment: { ...env },
        iterationData: { ...(dataRow ?? {}) }, local: { ...layers.local },
        info: { event, iteration: round + 1, counter: i + 1, requestName: s.name },
      });

      let scriptTests: RequestRunResult['scriptTests'];
      let scriptError: string | undefined;
      if (opts.runScript && mergedPre) {
        const r = await opts.runScript(mergedPre, snapshotFor('prerequest', null), send);
        if (r.timedOut) scriptError = 'pre-request script killed (timeout)';
        else if (r.error) scriptError = 'pre-request script error: ' + r.error;
        // Postman 语义：prerequest 阶段的 pm.test 结果同样计入（徽章/报告/JUnit 不分阶段）。
        // D 批次盘查补缺：原实现丢弃 pre 段 tests——跨段断言（如集合 pre 写标记、请求 pre 断言）
        // 的结果不可见，判据级缺口。
        if (r.outcome.tests.length) scriptTests = r.outcome.tests.map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) }));
        applyWrites(r.outcome); takeMutations(r.outcome);
      }

      const { payload, missing } = buildProxyPayload(workingReq, mergedForSubstitution());
      let result: RequestRunResult;
      if (missing.length) {
        result = { ...base, sent: false, status: null, elapsedMs: null, error: `Missing variables: ${missing.join(', ')}. Define them in the Variables panel.`, report: null, passed: false };
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
          if (opts.runScript && mergedTest) {
            const r2 = await opts.runScript(mergedTest, snapshotFor('test', resp), send);
            if (r2.outcome.tests.length) scriptTests = [...(scriptTests ?? []), ...r2.outcome.tests.map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) }))];
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
          if (opts.runScript && mergedTest && !scriptError) {
            try {
              const r2 = await opts.runScript(mergedTest, snapshotFor('test', null), send);
              if (r2.outcome.tests.length) scriptTests = [...(scriptTests ?? []), ...r2.outcome.tests.map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) }))];
              if (r2.timedOut) scriptError = 'test script killed (timeout)';
              else if (r2.error) scriptError = 'test script error: ' + r2.error;
              applyWrites(r2.outcome);
            }
            catch { /* 沙箱层错误已由 r2 承载 */ }
          }
          result = { ...base, sent: false, status: null, elapsedMs: null, error: e instanceof Error ? e.message : String(e), report: null, ...(scriptTests ? { scriptTests } : {}), passed: false };
        }
      }
      if (!result.sent && scriptError && !result.error) result.error = scriptError;
      roundResults.push(result);
      allResults.push(result);
      opts.onProgress?.(result, globalIdx, totalRequests);
      globalIdx++;

      if (stopOnError && !result.sent) { stoppedEarly = true; break; }
      if (stopOnFailure && result.sent && result.report && !result.report.allPassed) { stoppedEarly = true; break; }
      const isLastRequestOfLastRound = round === roundCount - 1 && i === saved.length - 1;
      if (delayMs > 0 && !isLastRequestOfLastRound && !opts.signal?.aborted) {
        await sleep(delayMs);
      }
    }

    iterations.push({
      iteration: round + 1,
      dataRowColumns: dataRow ? Object.keys(dataRow) : null,
      dataRowIndex: dataRow ? round % dataRows.length : null,
      results: roundResults,
    });
    if (stoppedEarly) break;
  }

  // 取消语义：末行执行中（含脚本在沙箱内跑）点取消，run 也如实标 cancelled。
  if (opts.signal?.aborted) { cancelled = true; }
  const finishedAt = now();
  const sentResults = allResults.filter(r => r.sent);
  const failed = allResults.filter(r => !r.passed).length;
  const assertionsTotal = allResults.reduce((n, r) => n + (r.report?.total ?? 0), 0);
  const assertionsPassed = allResults.reduce((n, r) => n + (r.report?.passed ?? 0), 0);
  const scriptTestsTotal = allResults.reduce((n, r) => n + (r.scriptTests?.length ?? 0), 0);
  const scriptTestsPassed = allResults.reduce((n, r) => n + (r.scriptTests?.filter(t => t.passed).length ?? 0), 0);
  const scriptErrors = allResults.filter(r => r.scriptError).length;
  const avgResponseMs = sentResults.length
    ? Math.round(sentResults.reduce((n, r) => n + (r.elapsedMs ?? 0), 0) / sentResults.length)
    : null;
  return {
    results: allResults,
    iterations,
    iterationCount: roundCount,
    dataFile: opts.dataFile
      ? { type: opts.dataFileType ?? 'csv', rows: dataRows.length, columnsCount: opts.dataFile.columns.length }
      : null,
    total: totalRequests, // 计划数（轮×请求）——API-010 契约：total 指计划，非 attempted；attempted 看 sent
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

/** 可读纯文本运行报告（复制/下载共用）。脱敏：不含凭据头、数据行值、环境变量值、响应体。 */
export function formatCollectionReportText(summary: CollectionRunSummary): string {
  const lines: string[] = [];
  lines.push(`API Studio collection run report — ${new Date(summary.finishedAt).toISOString()}`);
  const dataLine = summary.dataFile
    ? `Data file: ${summary.dataFile.type} · ${summary.dataFile.rows} rows × ${summary.iterationCount} iteration(s)${summary.iterationCount > summary.dataFile.rows ? ' (row cycle)' : ''}`
    : 'Data file: none (single iteration)';
  lines.push(`Requests: ${summary.sent}/${summary.total} sent, ${summary.failed} failed · Assertions: ${summary.assertionsPassed}/${summary.assertionsTotal} passed · pm.test ${summary.scriptTestsPassed}/${summary.scriptTestsTotal} passed${summary.scriptErrors ? ` · ${summary.scriptErrors} script error(s)` : ''} · Duration ${summary.totalDurationMs} ms${summary.avgResponseMs === null ? '' : ` · Avg ${summary.avgResponseMs} ms`}`);
  lines.push(dataLine);
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
  let n = 0;
  for (const it of summary.iterations) {
    if (summary.iterations.length > 1) {
      lines.push(`—— Iteration ${it.iteration}${it.dataRowColumns ? ` (data row ${(it.dataRowIndex ?? 0) + 1}; columns: ${it.dataRowColumns.join(', ')})` : ''} ——`);
    }
    for (const r of it.results) {
      n++;
      const head = `[${n}] ${r.passed ? 'PASS' : 'FAIL'} ${r.name} (${r.method} ${r.url})`;
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
      if (r.scriptError) lines.push(`       [SCRIPT] ${r.scriptError}`);
      for (const t of r.scriptTests ?? []) {
        lines.push(`       [${t.passed ? 'PASS' : 'FAIL'}] pm.test: ${t.name}${t.error ? ` — ${t.error}` : ''}`);
      }
    }
  }
  return lines.join('\n');
}
