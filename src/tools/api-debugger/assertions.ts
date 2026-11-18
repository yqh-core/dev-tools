/**
 * API-009 · 测试断言（Assertion Runner，对标 Postman Tests）。
 *
 * 设计边界：
 *  · 纯函数核心，全部逻辑可单测（含负控）；不 eval、不执行任意脚本——
 *    Postman 的 pm.* JS 脚本不导入不执行（浏览器安全边界），以结构化断言覆盖
 *    状态码 / JSON 字段 / 响应头 / 响应时间四类，多断言顺序执行并汇总；
 *  · JSON 路径复用 json-workspace 的 JSONPath 子集引擎（解析失败抛错，不静默吞）；
 *  · 断言定义只存本机 localStorage；报告只含断言结果与请求方法/URL，不携带凭据头；
 *  · 不完整/非法断言运行时判 FAIL 并给出可读原因（fail-closed，不假装 PASS）。
 */

import JSON5 from 'json5';
import { JsonPathError, jsonPath } from '../json-workspace/jsonpath';

export type AssertionType = 'status' | 'json' | 'header' | 'time';

export interface Assertion {
  id: string
  enabled: boolean
  type: AssertionType
  /** json → JSONPath（如 $.data.id）；header → 头名；status/time → 不使用 */
  target: string
  operator: string
  expected: string
}

export interface AssertionResult {
  id: string
  label: string
  passed: boolean
  actual: string
  message: string
}

export interface AssertionReport {
  results: AssertionResult[]
  total: number
  passed: number
  failed: number
  allPassed: boolean
  ranAt: number
}

export interface AssertableResponse {
  status: number
  headers: Record<string, string>
  body: string
  elapsedMs: number
}

export const ASSERTIONS_CAP = 50;

export const OPS_BY_TYPE: Record<AssertionType, readonly string[]> = {
  status: ['eq', 'ne', 'lt', 'le', 'gt', 'ge'],
  json: ['exists', 'not_exists', 'eq', 'ne', 'contains', 'not_contains', 'gt', 'lt', 'type_is'],
  header: ['exists', 'not_exists', 'eq', 'ne', 'contains'],
  time: ['lt', 'le', 'gt', 'ge'],
};

export const OP_LABELS: Record<string, string> = {
  eq: 'equals',
  ne: 'not equals',
  lt: 'less than',
  le: 'at most',
  gt: 'greater than',
  ge: 'at least',
  exists: 'exists',
  not_exists: 'does not exist',
  contains: 'contains',
  not_contains: 'does not contain',
  type_is: 'type is',
};

const JSON_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'null'];
const NO_EXPECTED_OPS = new Set(['exists', 'not_exists']);
const DISPLAY_CAP = 200;

/** 新建断言的可用默认值（UI 添加按钮 / 快捷 snippet 共用）。 */
export function makeAssertion(id: string, type: AssertionType = 'status'): Assertion {
  switch (type) {
    case 'json':
      return { id, enabled: true, type, target: '$.', operator: 'exists', expected: '' };
    case 'header':
      return { id, enabled: true, type, target: 'content-type', operator: 'contains', expected: 'application/json' };
    case 'time':
      return { id, enabled: true, type, target: '', operator: 'lt', expected: '1000' };
    default:
      return { id, enabled: true, type: 'status', target: '', operator: 'eq', expected: '200' };
  }
}

export function cloneAssertions(list: Assertion[]): Assertion[] {
  return list.map(a => ({ ...a }));
}

/** 人类可读标签（结果面板与报告共用同一口径）。 */
export function assertionLabel(a: Assertion): string {
  const op = OP_LABELS[a.operator] ?? a.operator;
  switch (a.type) {
    case 'status':
      return `Status ${op} ${a.expected}`.trim();
    case 'json':
      return NO_EXPECTED_OPS.has(a.operator) ? `JSON ${a.target} ${op}` : `JSON ${a.target} ${op} ${a.expected}`;
    case 'header':
      return NO_EXPECTED_OPS.has(a.operator) ? `Header ${a.target} ${op}` : `Header ${a.target} ${op} ${a.expected}`;
    case 'time':
      return `Response time ${op} ${a.expected} ms`;
  }
}

/** 结构性问题检查：返回可读原因；null = 结构完整。运行时仍可能因响应内容判 FAIL。 */
export function assertionProblem(a: Assertion): string | null {
  if (!OPS_BY_TYPE[a.type]?.includes(a.operator)) {
    return `Unknown operator "${a.operator}" for a ${a.type} assertion.`;
  }
  if ((a.type === 'json' || a.type === 'header') && !a.target.trim()) {
    return 'Target is empty (a JSONPath or header name is required).';
  }
  if (!NO_EXPECTED_OPS.has(a.operator) && !a.expected.trim()) {
    return 'Expected value is empty.';
  }
  if ((a.type === 'status' || a.type === 'time') && !Number.isFinite(Number(a.expected))) {
    return `Expected value "${a.expected}" is not a number.`;
  }
  if (a.type === 'json' && (a.operator === 'gt' || a.operator === 'lt') && !Number.isFinite(Number(a.expected))) {
    return `Expected value "${a.expected}" is not a number.`;
  }
  if (a.type === 'json' && a.operator === 'type_is' && !JSON_TYPES.includes(a.expected.trim())) {
    return `Unknown type "${a.expected}" (use string, number, boolean, object, array or null).`;
  }
  return null;
}

function display(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  const t = s === undefined ? 'undefined' : s;
  return t.length > DISPLAY_CAP ? `${t.slice(0, DISPLAY_CAP)}…` : t;
}

/** 深比较：数组按序、对象键序无关（Postman eql 语义的结构化等价）。 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** 期望值按 JSON5 字面量解析（42 / true / null / "text" / {a:1}）；解析失败按原始字符串。 */
function parseExpected(raw: string): unknown {
  try {
    return JSON5.parse(raw);
  }
  catch {
    return raw;
  }
}

function jsonType(v: unknown): string {
  if (v === null) {
    return 'null';
  }
  if (Array.isArray(v)) {
    return 'array';
  }
  return typeof v;
}

function compareNumeric(op: string, actual: number, expected: number): boolean {
  switch (op) {
    case 'eq': return actual === expected;
    case 'ne': return actual !== expected;
    case 'lt': return actual < expected;
    case 'le': return actual <= expected;
    case 'gt': return actual > expected;
    case 'ge': return actual >= expected;
    default: return false;
  }
}

type JsonParse = { ok: true; value: unknown } | { ok: false; error: string };

function evaluate(a: Assertion, resp: AssertableResponse, json: JsonParse | null): AssertionResult {
  const label = assertionLabel(a);
  const pass = (actual: string, message: string): AssertionResult => ({ id: a.id, label, passed: true, actual, message });
  const fail = (actual: string, message: string): AssertionResult => ({ id: a.id, label, passed: false, actual, message });

  const problem = assertionProblem(a);
  if (problem) {
    return fail('—', `Assertion incomplete: ${problem}`);
  }
  const op = OP_LABELS[a.operator] ?? a.operator;

  switch (a.type) {
    case 'status': {
      const expected = Number(a.expected);
      return compareNumeric(a.operator, resp.status, expected)
        ? pass(String(resp.status), `Status ${resp.status} satisfies "${op} ${expected}".`)
        : fail(String(resp.status), `Expected status ${op} ${expected}, got ${resp.status}.`);
    }
    case 'time': {
      const expected = Number(a.expected);
      return compareNumeric(a.operator, resp.elapsedMs, expected)
        ? pass(`${resp.elapsedMs} ms`, `Response time ${resp.elapsedMs} ms satisfies "${op} ${expected} ms".`)
        : fail(`${resp.elapsedMs} ms`, `Expected response time ${op} ${expected} ms, got ${resp.elapsedMs} ms.`);
    }
    case 'header': {
      const wanted = a.target.trim().toLowerCase();
      const key = Object.keys(resp.headers).find(k => k.toLowerCase() === wanted);
      const value = key === undefined ? undefined : resp.headers[key];
      if (a.operator === 'exists') {
        return value === undefined
          ? fail('(absent)', `Header "${a.target}" is not present in the response.`)
          : pass(display(value), `Header "${a.target}" is present.`);
      }
      if (a.operator === 'not_exists') {
        return value === undefined
          ? pass('(absent)', `Header "${a.target}" is absent as expected.`)
          : fail(display(value), `Header "${a.target}" should be absent but is present.`);
      }
      if (value === undefined) {
        return fail('(absent)', `Header "${a.target}" is not present; cannot compare its value.`);
      }
      if (a.operator === 'eq') {
        return value === a.expected
          ? pass(display(value), `Header "${a.target}" equals the expected value.`)
          : fail(display(value), `Expected header "${a.target}" to equal "${a.expected}", got "${display(value)}".`);
      }
      if (a.operator === 'ne') {
        return value !== a.expected
          ? pass(display(value), `Header "${a.target}" differs from "${a.expected}" as expected.`)
          : fail(display(value), `Expected header "${a.target}" to differ from "${a.expected}", but it matches.`);
      }
      // contains
      return value.includes(a.expected)
        ? pass(display(value), `Header "${a.target}" contains "${a.expected}".`)
        : fail(display(value), `Expected header "${a.target}" to contain "${a.expected}", got "${display(value)}".`);
    }
    case 'json': {
      if (!json || !json.ok) {
        return fail('(unparsable)', `Response body is not valid JSON: ${json && !json.ok ? json.error : 'no body'}.`);
      }
      let matches: unknown[];
      try {
        matches = jsonPath(json.value, a.target);
      }
      catch (e) {
        return fail('(invalid path)', e instanceof JsonPathError ? `Invalid JSONPath "${a.target}": ${e.message}` : String(e));
      }
      if (a.operator === 'exists') {
        return matches.length
          ? pass(`${matches.length} match(es)`, `JSONPath ${a.target} matched ${matches.length} value(s).`)
          : fail('(no match)', `JSONPath ${a.target} matched nothing.`);
      }
      if (a.operator === 'not_exists') {
        return matches.length
          ? fail(display(matches[0]), `JSONPath ${a.target} should match nothing but found ${matches.length} value(s).`)
          : pass('(no match)', `JSONPath ${a.target} matched nothing as expected.`);
      }
      if (!matches.length) {
        return fail('(no match)', `JSONPath ${a.target} matched nothing.`);
      }
      const actual = matches[0];
      const multi = matches.length > 1 ? ` (first of ${matches.length} matches)` : '';
      const shown = `${display(actual)}${multi}`;
      if (a.operator === 'eq' || a.operator === 'ne') {
        const expected = parseExpected(a.expected);
        const equal = deepEqual(actual, expected);
        const ok = a.operator === 'eq' ? equal : !equal;
        return ok
          ? pass(shown, `Value at ${a.target} satisfies "${op} ${display(expected)}".`)
          : fail(shown, `Expected ${a.target} ${op} ${display(expected)}, got ${display(actual)}.`);
      }
      if (a.operator === 'contains' || a.operator === 'not_contains') {
        const included = Array.isArray(actual)
          ? actual.some(el => deepEqual(el, parseExpected(a.expected)))
          : display(actual).includes(a.expected);
        const ok = a.operator === 'contains' ? included : !included;
        return ok
          ? pass(shown, `Value at ${a.target} satisfies "${op} ${a.expected}".`)
          : fail(shown, `Expected ${a.target} ${op} "${a.expected}", got ${display(actual)}.`);
      }
      if (a.operator === 'gt' || a.operator === 'lt') {
        if (typeof actual !== 'number' || !Number.isFinite(actual)) {
          return fail(shown, `Value at ${a.target} is not a JSON number (${display(actual)}); cannot compare numerically.`);
        }
        const expected = Number(a.expected);
        const ok = a.operator === 'gt' ? actual > expected : actual < expected;
        return ok
          ? pass(shown, `Value ${actual} satisfies "${op} ${expected}".`)
          : fail(shown, `Expected ${a.target} ${op} ${expected}, got ${actual}.`);
      }
      // type_is
      const t = jsonType(actual);
      return t === a.expected.trim()
        ? pass(shown, `Value at ${a.target} is of type ${t}.`)
        : fail(shown, `Expected ${a.target} to be of type ${a.expected.trim()}, got ${t}.`);
    }
  }
}

/** 顺序执行全部启用断言并汇总。禁用项跳过、不计数；空列表 → total=0。 */
export function runAssertions(list: Assertion[], resp: AssertableResponse, now: number = Date.now()): AssertionReport {
  const active = list.filter(a => a.enabled);
  let json: JsonParse | null = null;
  if (active.some(a => a.type === 'json')) {
    try {
      json = { ok: true, value: JSON5.parse(resp.body) };
    }
    catch (e) {
      json = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const results = active.map(a => evaluate(a, resp, json));
  const passed = results.filter(r => r.passed).length;
  return { results, total: results.length, passed, failed: results.length - passed, allPassed: results.every(r => r.passed), ranAt: now };
}

/** 可读纯文本报告（复制/下载共用）。不含凭据头；meta 由调用方提供发送时快照。 */
export function formatReportText(report: AssertionReport, meta?: { method?: string; url?: string; status?: number; elapsedMs?: number }): string {
  const lines: string[] = [];
  lines.push(`DigDevBox API test report — ${new Date(report.ranAt).toISOString()}`);
  if (meta?.url) {
    lines.push(`${meta.method ?? 'GET'} ${meta.url}${meta.status === undefined ? '' : ` → ${meta.status}`}${meta.elapsedMs === undefined ? '' : ` (${meta.elapsedMs} ms)`}`);
  }
  lines.push(`Result: ${report.passed}/${report.total} passed${report.failed ? `, ${report.failed} FAILED` : ''}`);
  lines.push('');
  if (!report.results.length) {
    lines.push('(no enabled assertions)');
  }
  for (const r of report.results) {
    lines.push(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.label}`);
    lines.push(`       ${r.message}`);
  }
  return lines.join('\n');
}

/** 存储守卫：损坏/非法条目丢弃（与 parseHistory/parseSaved 同纪律），上限 ASSERTIONS_CAP。 */
export function parseAssertions(raw: unknown): Assertion[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: Assertion[] = [];
  const seen = new Set<string>();
  for (const e of raw) {
    if (!e || typeof e !== 'object') {
      continue;
    }
    const a = e as Record<string, unknown>;
    if (typeof a.id !== 'string' || seen.has(a.id) || typeof a.enabled !== 'boolean') {
      continue;
    }
    if (a.type !== 'status' && a.type !== 'json' && a.type !== 'header' && a.type !== 'time') {
      continue;
    }
    if (typeof a.target !== 'string' || typeof a.operator !== 'string' || typeof a.expected !== 'string') {
      continue;
    }
    if (!OPS_BY_TYPE[a.type].includes(a.operator)) {
      continue;
    }
    seen.add(a.id);
    out.push({ id: a.id, enabled: a.enabled, type: a.type, target: a.target, operator: a.operator, expected: a.expected });
    if (out.length >= ASSERTIONS_CAP) {
      break;
    }
  }
  return out;
}
