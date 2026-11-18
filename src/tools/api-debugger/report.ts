/**
 * API-012/B3+B4 · 运行报告引擎（JSON + JUnit XML）。
 *
 * 脱敏（任务书 B3 硬要求）：报告**默认**不含 Secret、Authorization、Cookie、API Key、
 * 环境变量值、数据行值、请求/响应体、响应头值。URL 是用户自己书写的请求定义的一部分
 * （Postman 报告同样包含 URL），但 header 值一律不进报告。
 *
 * JUnit 映射（B4）：HTTP 4xx/5xx 本身**不是**测试失败——断言失败/脚本错误/请求错误才是；
 * 服务响应状态记录在 testcase 的 classname/属性中。取消的剩余轮次映射为 skipped。
 */

import type { CollectionRunSummary } from './runner';

export interface RunReportMeta {
  runId: string
  apiStudioVersion: string
  collectionName?: string
  environmentName?: string
  startedAt: string
  finishedAt: string
}

export interface RunReport {
  version: 1
  meta: RunReportMeta
  summary: {
    iterations: number
    requests: number
    sent: number
    passed: number
    failed: number
    skipped: number
    assertionsPassed: number
    assertionsTotal: number
    scriptTestsPassed: number
    scriptTestsTotal: number
    scriptErrors: number
    allPassed: boolean
    stoppedEarly: boolean
    cancelled: boolean
    durationMs: number
  }
  dataFile: { type: string; rows: number; columnsCount: number } | null
  /** 安全摘要（机器可读的脱敏声明，非口头承诺）。 */
  security: {
    secretsExcluded: true
    envValuesExcluded: true
    dataRowValuesExcluded: true
    requestResponseBodiesExcluded: true
    headerValuesExcluded: true
  }
  iterations: {
    iteration: number
    dataRowColumns: string[] | null
    dataRowIndex: number | null
    requests: {
      name: string
      method: string
      url: string
      sent: boolean
      status: number | null
      elapsedMs: number | null
      passed: boolean
      error?: string
      scriptError?: string
      assertions: { label: string; passed: boolean; message: string }[]
      scriptTests: { name: string; passed: boolean; error?: string }[]
    }[]
  }[]
}

export function buildRunReport(summary: CollectionRunSummary, meta: RunReportMeta): RunReport {
  return {
    version: 1,
    meta,
    summary: {
      iterations: summary.iterationCount,
      requests: summary.total,
      sent: summary.sent,
      // B3 口径：通过/失败/取消/跳过数量。failed 与 skipped 不重复计数——
      // 取消且未发送的行只计入 skipped（与 JUnit skipped 分支同口径）；
      // engine 的 summary.failed 是 API-010 锁定的全量 !passed 口径，报告面在此基础上剔除 skipped。
      passed: summary.results.filter(r => r.passed).length,
      failed: summary.results.filter(r => !r.passed && !(summary.cancelled && !r.sent)).length,
      skipped: summary.cancelled ? summary.results.filter(r => !r.sent).length : 0,
      assertionsPassed: summary.assertionsPassed,
      assertionsTotal: summary.assertionsTotal,
      scriptTestsPassed: summary.scriptTestsPassed,
      scriptTestsTotal: summary.scriptTestsTotal,
      scriptErrors: summary.scriptErrors,
      allPassed: summary.allPassed,
      stoppedEarly: summary.stoppedEarly,
      cancelled: summary.cancelled,
      durationMs: summary.totalDurationMs,
    },
    dataFile: summary.dataFile ? { ...summary.dataFile } : null,
    security: {
      secretsExcluded: true,
      envValuesExcluded: true,
      dataRowValuesExcluded: true,
      requestResponseBodiesExcluded: true,
      headerValuesExcluded: true,
    },
    iterations: summary.iterations.map(it => ({
      iteration: it.iteration,
      dataRowColumns: it.dataRowColumns ? [...it.dataRowColumns] : null,
      dataRowIndex: it.dataRowIndex,
      requests: it.results.map(r => ({
        name: r.name,
        method: r.method,
        url: r.url,
        sent: r.sent,
        status: r.status,
        elapsedMs: r.elapsedMs,
        passed: r.passed,
        ...(r.error ? { error: r.error } : {}),
        ...(r.scriptError ? { scriptError: r.scriptError } : {}),
        assertions: (r.report?.results ?? []).map(a => ({ label: a.label, passed: a.passed, message: a.message })),
        scriptTests: (r.scriptTests ?? []).map(t => ({ name: t.name, passed: t.passed, ...(t.error ? { error: t.error } : {}) })),
      })),
    })),
  };
}

/** XML 转义（属性值与文本同一处理；任务书 B4：特殊字符必须正确转义）。 */
function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** 失败类型映射（B4：请求错误/脚本错误/断言失败/超时/取消 明确区分；HTTP 状态≠失败）。
 *  输入为**报告请求面**（RunReport iterations[].requests[]：assertions/scriptTests 已扁平化，
 *  无 r.report 字段——runner 内部结构不经 buildRunReport 不得直接进 XML）。
 *  pm.test 失败（脚本正常执行但断言未过）归入 assertion_failed（Newman 同口径）；
 *  fail-closed：!passed 但无具体类型时绝不映射为"通过"——记 unknown_error。 */
function failureTypeOf(r: { sent: boolean; passed: boolean; error?: string; scriptError?: string; assertions: { passed: boolean }[]; scriptTests: { passed: boolean }[] }): string | null {
  if (r.passed) return null;
  if (r.scriptError && /timeout|killed/i.test(r.scriptError)) return 'timeout';
  if (!r.sent) return r.scriptError ? 'script_error' : 'request_error';
  if (r.scriptError) return 'script_error';
  if (r.assertions.some(a => !a.passed) || r.scriptTests.some(t => !t.passed)) return 'assertion_failed';
  return r.error ? 'request_error' : 'unknown_error';
}

export function toJUnitXml(report: RunReport): string {
  const esc = xmlEsc;
  const rows = report.iterations.flatMap(it => it.requests.map(r => ({ iteration: it.iteration, r })));
  const totalCases = rows.length;
  // 取消且未发送 → skipped（精确计数：结果面里实际未发送的行；不是 planned-sent，
  // 否则会把"取消后从未执行、根本不进 results 的计划行"也算进来，属性与元素数对不上）。
  const cancelledNotSent = (r: { sent: boolean }) => report.summary.cancelled && !r.sent;
  const skipped = report.summary.cancelled ? rows.filter(({ r }) => !r.sent).length : 0;
  const failures = rows.filter(({ r }) => !cancelledNotSent(r) && !r.passed).length;
  const timeSec = (report.summary.durationMs / 1000).toFixed(3);

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<testsuites name="${esc(report.meta.collectionName ?? 'API Studio Collection Run')}" tests="${totalCases}" failures="${failures}" skipped="${skipped}" time="${timeSec}">`);
  lines.push(`  <properties>`);
  lines.push(`    <property name="apiStudioVersion" value="${esc(report.meta.apiStudioVersion)}"/>`);
  lines.push(`    <property name="runId" value="${esc(report.meta.runId)}"/>`);
  lines.push(`    <property name="result" value="${report.summary.allPassed ? 'ALL PASSED' : 'FAILURES PRESENT'}"/>`);
  lines.push(`    <property name="dataFile" value="${report.dataFile ? `${report.dataFile.type} rows=${report.dataFile.rows}` : 'none'}"/>`);
  lines.push(`    <property name="security" value="secrets/env/data/bodies/header-values excluded by default"/>`);
  lines.push(`  </properties>`);
  for (const { iteration, r } of rows) {
    const classname = `iteration ${iteration} · ${esc(r.name)}`;
    const name = `${esc(r.method)} ${esc(r.url)}`;
    if (cancelledNotSent(r)) {
      // 取消且未执行 → skipped（优先于 failure：取消不是失败，B4 状态区分硬要求）
      lines.push(`  <testcase classname="${classname}" name="${name}" time="0">`);
      lines.push(`    <skipped message="run cancelled before this request"/>`);
      lines.push(`  </testcase>`);
      continue;
    }
    const ftype = failureTypeOf(r);
    if (!r.passed && ftype) {
      const detail = r.scriptError ?? r.error
        ?? r.assertions.find(a => !a.passed)?.message
        ?? r.scriptTests.find(t => !t.passed)?.error
        ?? r.scriptTests.find(t => !t.passed)?.name
        ?? 'failed';
      lines.push(`  <testcase classname="${classname}" name="${name}" time="${((r.elapsedMs ?? 0) / 1000).toFixed(3)}">`);
      lines.push(`    <failure type="${esc(ftype)}" message="${esc(detail.slice(0, 300))}">${esc(detail.slice(0, 2000))}</failure>`);
      lines.push(`  </testcase>`);
    }
    else {
      // 通过（含 HTTP 4xx/5xx 但断言全过——B4：服务响应状态≠测试失败，状态记入属性）
      lines.push(`  <testcase classname="${classname}" name="${name}" time="${((r.elapsedMs ?? 0) / 1000).toFixed(3)}">`);
      lines.push(`    <properties>`);
      lines.push(`      <property name="httpStatus" value="${r.status ?? 'not-sent'}"/>`);
      if (r.status !== null && r.status >= 400) {
        lines.push(`      <property name="note" value="HTTP ${r.status} returned but all assertions passed (service status is not a test failure)"/>`);
      }
      lines.push(`    </properties>`);
      lines.push(`  </testcase>`);
    }
  }
  lines.push(`</testsuites>`);
  return lines.join('\n');
}

/** JUnit XML 良构性校验（无外部依赖：栈式标签匹配，用于自证报告可解析）。 */
export function isWellFormedXml(x: string): boolean {
  const tagRe = /<(\/?)([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g;
  const stack: string[] = [];
  let m: RegExpExecArray | null;
  let lastIndexEnd = 0;
  while ((m = tagRe.exec(x)) !== null) {
    // 标签之间只允许空白/文本（这里允许任意文本，只校验标签结构）
    lastIndexEnd = tagRe.lastIndex;
    const closing = m[1] === '/';
    const name = m[2];
    const selfClosing = m[4] === '/' || m[0].endsWith('/>');
    if (name.toLowerCase() === '?xml') continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    }
    else if (!selfClosing) {
      stack.push(name);
    }
  }
  return stack.length === 0 && lastIndexEnd > 0;
}
