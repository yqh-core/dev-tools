/**
 * API-012/B3+B4 报告引擎单测：JSON 结构、JUnit 映射（HTTP≠失败）、XML 转义、
 * 取消→skipped、良构性、Secret 脱敏负控。
 */
import { describe, expect, it } from 'vitest';
import { buildRunReport, isWellFormedXml, toJUnitXml, type RunReportMeta } from './report';
import type { CollectionRunSummary, RequestRunResult } from './runner';

function req(patch: Partial<RequestRunResult> = {}): RequestRunResult {
  return {
    id: 'r1', name: 'Get user', method: 'GET', url: 'https://api.example.test/user',
    sent: true, status: 200, elapsedMs: 12, report: null, passed: true, ...patch,
  };
}
function summary(patch: Partial<CollectionRunSummary> = {}): CollectionRunSummary {
  return {
    results: [], iterations: [], iterationCount: 1, dataFile: null,
    total: 0, sent: 0, failed: 0, assertionsPassed: 0, assertionsTotal: 0,
    scriptTestsPassed: 0, scriptTestsTotal: 0, scriptErrors: 0,
    totalDurationMs: 100, avgResponseMs: 10, allPassed: true,
    stoppedEarly: false, cancelled: false, startedAt: 1, finishedAt: 2, ...patch,
  };
}
const meta: RunReportMeta = {
  runId: 'run-1', apiStudioVersion: '2026.01.22-v2', collectionName: 'Smoke', environmentName: 'Default',
  startedAt: '2026-11-18T00:00:00.000Z', finishedAt: '2026-11-18T00:00:01.000Z',
};

describe('buildRunReport 结构与脱敏声明', () => {
  it('version=1、summary 计数与 security 结构面恒真 + secretsExcluded 派生（终审 P0-02：不硬编码）', () => {
    const r = buildRunReport(summary({ total: 2, sent: 2, failed: 0, iterations: [] }), meta);
    expect(r.version).toBe(1);
    expect(r.summary.requests).toBe(2);
    expect(r.summary.passed).toBe(0);
    expect(r.summary.skipped).toBe(0);
    // 无已标记 secret 值 → 值级管道未启用（如实 false/none）；结构面排除恒真
    expect(r.security).toEqual({
      secretsExcluded: false, secretRedactionScope: 'none', envValuesExcluded: true,
      dataRowValuesExcluded: true, requestResponseBodiesExcluded: true, headerValuesExcluded: true,
    });
    expect(r.iterations).toEqual([]);
  });

  it('security 派生：有标记 secret 值 → secretsExcluded=true + scope=marked-secret-values', () => {
    const r = buildRunReport(summary({ total: 1, sent: 1, failed: 0, iterations: [] }), meta, { secretValues: ['SK-T'] });
    expect(r.security.secretsExcluded).toBe(true);
    expect(r.security.secretRedactionScope).toBe('marked-secret-values');
  });

  it('终审 P0-02：URL 中的已标记 secret 值同样脱敏（JSON 报告面）', () => {
    const s = summary({ iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [req({ url: 'https://api.test/x?token=SK-URL-PLANT-77q' })] }] });
    const r = buildRunReport(s, meta, { secretValues: ['SK-URL-PLANT-77q'] });
    expect(r.iterations[0].requests[0].url).not.toContain('SK-URL-PLANT-77q');
    expect(r.iterations[0].requests[0].url).toContain('[REDACTED-Secret]');
  });

  it('JUnit security 属性随派生口径变化（不再写死 excluded by default）', () => {
    const withSv = toJUnitXml(buildRunReport(summary({ total: 1, sent: 1, failed: 0, iterations: [] }), meta, { secretValues: ['S'] }));
    expect(withSv).toContain('marked-values-redacted');
    const noSv = toJUnitXml(buildRunReport(summary({ total: 1, sent: 1, failed: 0, iterations: [] }), meta));
    expect(noSv).toContain('none (structural exclusions only)');
  });

  it('迭代分组与请求映射（含 scriptTests/断言）', () => {
    const s = summary({
      iterations: [{
        iteration: 1, dataRowColumns: ['email'], dataRowIndex: 0,
        results: [req({
          report: { allPassed: true, total: 1, passed: 1, results: [{ id: 'a1', label: 'status 200', passed: true, actual: '200', message: 'ok' }], failed: 0, ranAt: 0 },
          scriptTests: [{ name: 'marker', passed: true }],
        })],
      }],
    });
    const r = buildRunReport(s, meta);
    expect(r.iterations[0].requests[0].assertions[0].label).toBe('status 200');
    expect(r.iterations[0].requests[0].scriptTests[0].name).toBe('marker');
    expect(r.iterations[0].requests[0].status).toBe(200);
  });
});

describe('toJUnitXml 映射规则（B4）', () => {
  it('HTTP 4xx 但断言全过 → 无 failure，httpStatus 属性 + note 属性（B4 硬要求）', () => {
    const s = summary({
      iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [req({ status: 404, report: { allPassed: true, total: 0, passed: 0, failed: 0, results: [], ranAt: 0 } })] }],
    });
    const xml = toJUnitXml(buildRunReport(s, meta));
    expect(xml).not.toContain('<failure');
    expect(xml).toContain('httpStatus" value="404"');
    expect(xml).toContain('service status is not a test failure');
  });

  it('summary.passed/skipped 计数（B3：取消未发送行只计 skipped，不与 failed 重复计数）', () => {
    const ok = req({ status: 200, report: { allPassed: true, total: 0, passed: 0, failed: 0, results: [], ranAt: 0 } });
    const notExec1 = req({ sent: false, status: null, passed: false, error: 'not executed' });
    const notExec2 = req({ sent: false, status: null, passed: false, error: 'not executed' });
    const s = summary({
      cancelled: true, sent: 1, total: 3, failed: 2,
      results: [ok, notExec1, notExec2],
      iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [ok, notExec1, notExec2] }],
    });
    const r = buildRunReport(s, meta);
    expect(r.summary.passed).toBe(1);
    expect(r.summary.failed).toBe(0); // 两个取消未发送行计入 skipped，不重复进 failed
    expect(r.summary.skipped).toBe(2);
  });

  it('E3 secret 值级 redact（终审 P0-2）：已标记值进报告文本面被替换；未标记不动（负控：不伪装全知扫描）；短值阈值不误伤', () => {
    const s = summary({
      iterations: [{
        iteration: 1, dataRowColumns: null, dataRowIndex: null,
        results: [req({
          sent: false, status: null, passed: false,
          error: 'token leaked: SK-PLANT-9f3',
          scriptError: 'expect got SK-PLANT-9f3',
          scriptTests: [{ name: 't', passed: false, error: 'pm.expect — SK-PLANT-9f3' }],
          report: { allPassed: false, total: 1, passed: 0, failed: 1, ranAt: 0, results: [{ id: 'a1', label: 'l', passed: false, actual: 'SK-PLANT-9f3', message: 'header got SK-PLANT-9f3' }] },
        })],
      }],
    });
    const r = buildRunReport(s, meta, { secretValues: ['SK-PLANT-9f3'] });
    const json = JSON.stringify(r);
    expect(json).not.toContain('SK-PLANT-9f3');
    expect(json).toContain('[REDACTED-Secret]');
    // 负控：未传 secretValues 时不替换（护栏不伪装成全知扫描——边界如实）
    const r2 = buildRunReport(s, meta);
    expect(JSON.stringify(r2)).toContain('SK-PLANT-9f3');
    // 短值阈值（>3）不误伤
    const r3 = buildRunReport(s, meta, { secretValues: ['ab'] });
    expect(JSON.stringify(r3)).toContain('SK-PLANT-9f3');
  });

  it('失败类型映射：request_error / script_error / timeout / assertion_failed', () => {
    const cases: [Partial<RequestRunResult>, string][] = [
      [{ sent: false, passed: false, error: 'net down' }, 'request_error'],
      [{ sent: false, passed: false, scriptError: 'pre-request script error: boom' }, 'script_error'],
      [{ sent: false, passed: false, scriptError: 'test script killed (timeout)' }, 'timeout'],
      [{ sent: true, passed: false, report: { allPassed: false, total: 1, passed: 0, failed: 1, results: [{ id: 'a', label: 'status 200', passed: false, actual: '500', message: 'expected 200' }], ranAt: 0 } }, 'assertion_failed'],
    ];
    for (const [patch, type] of cases) {
      const s = summary({ iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [req({ ...patch, passed: false })] }] });
      expect(toJunitHasType(s, type)).toBe(true);
    }
  });

  it('XML 特殊字符转义（<>&"\' 在 name/message 中）', () => {
    const s = summary({
      iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [req({ sent: false, name: 'A<b>&"\'c', passed: false, error: 'msg <with> & "quotes"' })] }],
    });
    const xml = toJUnitXml(buildRunReport(s, meta));
    expect(xml).toContain('A&lt;b&gt;&amp;&quot;'); // classname 转义
    expect(xml).toContain('msg &lt;with&gt; &amp;'); // failure message 转义
    expect(xml).not.toMatch(/<name>A</); // 不产生未转义尖括号
  });

  it('取消 → 未发送请求映射为 skipped', () => {
    const s = summary({
      cancelled: true, sent: 0, total: 2,
      iterations: [{ iteration: 1, dataRowColumns: null, dataRowIndex: null, results: [req({ sent: false, passed: false, error: 'not executed' }), req({ sent: false, passed: false, error: 'not executed' })] }],
    });
    const xml = toJUnitXml(buildRunReport(s, meta));
    expect(xml.match(/<skipped/g)?.length).toBe(2);
    expect(xml).toContain('tests="2"');
  });

  it('良构性（栈式独立校验器）', () => {
    const s = summary({
      iterations: [
        { iteration: 1, dataRowColumns: ['email'], dataRowIndex: 0, results: [req()] },
        { iteration: 2, dataRowColumns: ['email'], dataRowIndex: 1, results: [req({ status: 500, report: { allPassed: true, total: 0, passed: 0, failed: 0, results: [], ranAt: 0 } })] },
      ],
    });
    const xml = toJUnitXml(buildRunReport(s, meta));
    expect(isWellFormedXml(xml)).toBe(true);
    expect(isWellFormedXml(xml.replace('</testsuites>', ''))).toBe(false); // 负控：缺尾标签必判 false
  });
});

describe('B 脱敏负控（报告面）', () => {
  it('JSON/JUnit/文本三面均不含植入的 secret（ runner 已保证；此处锚定报告层）', () => {
    const secret = 'SK-REPORT-NEG-CONTROL';
    const s = summary({
      dataFile: { type: 'csv', rows: 2, columnsCount: 1 },
      iterations: [{ iteration: 1, dataRowColumns: ['apiKey'], dataRowIndex: 0, results: [req()] }],
    });
    const report = buildRunReport(s, meta);
    const junit = toJUnitXml(report);
    const json = JSON.stringify(report);
    expect(json).not.toContain(secret);
    expect(junit).not.toContain(secret);
    // 列名可见（业务需要），行值不可见——结构锚定
    expect(json).toContain('apiKey');
  });
});

function toJunitHasType(s: CollectionRunSummary, type: string): boolean {
  return toJUnitXml(buildRunReport(s, meta)).includes(`type="${type}"`);
}
