import { describe, expect, it } from 'vitest';
import {
  ASSERTIONS_CAP,
  type AssertableResponse,
  type Assertion,
  assertionLabel,
  assertionProblem,
  cloneAssertions,
  formatReportText,
  makeAssertion,
  parseAssertions,
  runAssertions,
} from './assertions';
import { parseHistory, parseSaved, saveRequest } from './store';

const RESP: AssertableResponse = {
  status: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Request-Id': 'abc123' },
  body: JSON.stringify({
    ok: true,
    count: 3,
    name: 'digest',
    nothing: null,
    data: { id: 42, tags: ['alpha', 'beta'], nested: { flag: false } },
    items: [{ id: 1 }, { id: 2 }],
  }),
  elapsedMs: 123,
};

let seq = 0;
function a(type: Assertion['type'], patch: Partial<Assertion> = {}): Assertion {
  seq += 1;
  return { ...makeAssertion(`t-${seq}`, type), ...patch };
}

function runOne(assertion: Assertion, resp: AssertableResponse = RESP) {
  const report = runAssertions([assertion], resp, 1000);
  expect(report.total).toBe(1);
  return report.results[0];
}

describe('status assertions', () => {
  it('eq passes on exact match and fails with readable diff otherwise', () => {
    expect(runOne(a('status', { operator: 'eq', expected: '200' })).passed).toBe(true);
    const bad = runOne(a('status', { operator: 'eq', expected: '201' }));
    expect(bad.passed).toBe(false);
    expect(bad.message).toContain('got 200');
    expect(bad.actual).toBe('200');
  });

  it('supports ne / lt / le / gt / ge with boundary semantics', () => {
    expect(runOne(a('status', { operator: 'ne', expected: '404' })).passed).toBe(true);
    expect(runOne(a('status', { operator: 'lt', expected: '300' })).passed).toBe(true);
    expect(runOne(a('status', { operator: 'le', expected: '200' })).passed).toBe(true);
    expect(runOne(a('status', { operator: 'gt', expected: '199' })).passed).toBe(true);
    expect(runOne(a('status', { operator: 'ge', expected: '200' })).passed).toBe(true);
    expect(runOne(a('status', { operator: 'lt', expected: '200' })).passed).toBe(false);
  });

  it('non-numeric expected fails closed (negative control)', () => {
    const r = runOne(a('status', { operator: 'eq', expected: 'abc' }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain('not a number');
  });
});

describe('JSON field assertions', () => {
  it('exists / not_exists follow JSONPath match semantics', () => {
    expect(runOne(a('json', { target: '$.data.id', operator: 'exists' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.missing', operator: 'exists' })).passed).toBe(false);
    expect(runOne(a('json', { target: '$.missing', operator: 'not_exists' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.nothing', operator: 'exists' })).passed).toBe(true);
  });

  it('eq parses JSON literals: number, boolean, null, string', () => {
    expect(runOne(a('json', { target: '$.data.id', operator: 'eq', expected: '42' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.ok', operator: 'eq', expected: 'true' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.nothing', operator: 'eq', expected: 'null' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.name', operator: 'eq', expected: 'digest' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.data.id', operator: 'eq', expected: '43' })).passed).toBe(false);
    expect(runOne(a('json', { target: '$.name', operator: 'ne', expected: 'other' })).passed).toBe(true);
  });

  it('eq does deep object equality independent of key order', () => {
    expect(runOne(a('json', { target: '$.data.nested', operator: 'eq', expected: '{"flag":false}' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.items', operator: 'eq', expected: '[{"id":1},{"id":2}]' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.items', operator: 'eq', expected: '[{"id":2},{"id":1}]' })).passed).toBe(false);
  });

  it('contains is substring on strings and membership on arrays', () => {
    expect(runOne(a('json', { target: '$.name', operator: 'contains', expected: 'ges' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.name', operator: 'contains', expected: 'GES' })).passed).toBe(false);
    expect(runOne(a('json', { target: '$.data.tags', operator: 'contains', expected: 'beta' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.data.tags', operator: 'contains', expected: 'gamma' })).passed).toBe(false);
    expect(runOne(a('json', { target: '$.data.tags', operator: 'not_contains', expected: 'gamma' })).passed).toBe(true);
  });

  it('gt / lt compare JSON numbers only (negative control on strings)', () => {
    expect(runOne(a('json', { target: '$.count', operator: 'gt', expected: '2' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.count', operator: 'lt', expected: '2' })).passed).toBe(false);
    const r = runOne(a('json', { target: '$.name', operator: 'gt', expected: '1' }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain('not a JSON number');
  });

  it('type_is covers all six JSON types', () => {
    expect(runOne(a('json', { target: '$.name', operator: 'type_is', expected: 'string' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.count', operator: 'type_is', expected: 'number' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.ok', operator: 'type_is', expected: 'boolean' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.data', operator: 'type_is', expected: 'object' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.items', operator: 'type_is', expected: 'array' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.nothing', operator: 'type_is', expected: 'null' })).passed).toBe(true);
    expect(runOne(a('json', { target: '$.name', operator: 'type_is', expected: 'number' })).passed).toBe(false);
    expect(runOne(a('json', { target: '$.name', operator: 'type_is', expected: 'int' })).passed).toBe(false);
  });

  it('array index and recursive paths work; multi-match notes first-of-N', () => {
    expect(runOne(a('json', { target: '$.items[1].id', operator: 'eq', expected: '2' })).passed).toBe(true);
    const r = runOne(a('json', { target: '$..id', operator: 'exists' }));
    expect(r.passed).toBe(true);
    expect(r.actual).toContain('match');
    const eq = runOne(a('json', { target: '$..id', operator: 'eq', expected: '42' }));
    expect(eq.passed).toBe(true);
    expect(eq.actual).toContain('first of');
  });

  it('invalid JSONPath fails with a readable path error (negative control)', () => {
    const r = runOne(a('json', { target: 'data.id', operator: 'exists' }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain('Invalid JSONPath');
  });

  it('non-JSON body fails every JSON assertion with the parse reason (negative control)', () => {
    const report = runAssertions(
      [a('json', { target: '$.a', operator: 'exists' }), a('status', { operator: 'eq', expected: '200' })],
      { ...RESP, body: '<html>not json</html>' },
      1000,
    );
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].message).toContain('not valid JSON');
    expect(report.results[1].passed).toBe(true);
  });

  it('missing path on value operators reports no-match, not a crash', () => {
    const r = runOne(a('json', { target: '$.ghost', operator: 'eq', expected: '1' }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain('matched nothing');
  });
});

describe('header assertions', () => {
  it('lookup is case-insensitive; exists/eq/contains behave', () => {
    expect(runOne(a('header', { target: 'CONTENT-TYPE', operator: 'exists' })).passed).toBe(true);
    expect(runOne(a('header', { target: 'content-type', operator: 'contains', expected: 'application/json' })).passed).toBe(true);
    expect(runOne(a('header', { target: 'x-request-id', operator: 'eq', expected: 'abc123' })).passed).toBe(true);
    expect(runOne(a('header', { target: 'x-request-id', operator: 'ne', expected: 'zzz' })).passed).toBe(true);
    expect(runOne(a('header', { target: 'x-missing', operator: 'not_exists' })).passed).toBe(true);
  });

  it('missing header fails value comparisons with a readable reason (negative control)', () => {
    const r = runOne(a('header', { target: 'x-missing', operator: 'eq', expected: '1' }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain('not present');
    expect(runOne(a('header', { target: 'x-missing', operator: 'exists' })).passed).toBe(false);
  });
});

describe('response time assertions', () => {
  it('compares elapsedMs with boundary semantics', () => {
    expect(runOne(a('time', { operator: 'lt', expected: '200' })).passed).toBe(true);
    expect(runOne(a('time', { operator: 'le', expected: '123' })).passed).toBe(true);
    expect(runOne(a('time', { operator: 'gt', expected: '100' })).passed).toBe(true);
    expect(runOne(a('time', { operator: 'lt', expected: '100' })).passed).toBe(false);
    const r = runOne(a('time', { operator: 'lt', expected: '100' }));
    expect(r.message).toContain('123 ms');
  });
});

describe('runner aggregation and discipline', () => {
  it('runs all enabled assertions in order and summarizes pass/fail', () => {
    const report = runAssertions([
      a('status', { operator: 'eq', expected: '200' }),
      a('json', { target: '$.data.id', operator: 'eq', expected: '42' }),
      a('json', { target: '$.data.id', operator: 'eq', expected: '99' }),
      a('time', { operator: 'lt', expected: '5000' }),
    ], RESP, 1000);
    expect(report.total).toBe(4);
    expect(report.passed).toBe(3);
    expect(report.failed).toBe(1);
    expect(report.allPassed).toBe(false);
    expect(report.results[2].passed).toBe(false);
    expect(report.ranAt).toBe(1000);
  });

  it('disabled assertions are skipped and not counted', () => {
    const report = runAssertions([
      a('status', { operator: 'eq', expected: '200' }),
      { ...a('status', { operator: 'eq', expected: '500' }), enabled: false },
    ], RESP, 1000);
    expect(report.total).toBe(1);
    expect(report.allPassed).toBe(true);
  });

  it('empty list yields an empty report (vacuous pass)', () => {
    const report = runAssertions([], RESP, 1000);
    expect(report.total).toBe(0);
    expect(report.allPassed).toBe(true);
  });

  it('incomplete assertions fail closed with a readable reason (negative control)', () => {
    const emptyExpected = runOne(a('json', { target: '$.ok', operator: 'eq', expected: '' }));
    expect(emptyExpected.passed).toBe(false);
    expect(emptyExpected.message).toContain('Expected value is empty');
    const emptyTarget = runOne(a('json', { target: '  ', operator: 'exists' }));
    expect(emptyTarget.passed).toBe(false);
    expect(emptyTarget.message).toContain('Target is empty');
    expect(assertionProblem(a('status', { operator: 'bogus' }))).toContain('Unknown operator');
  });

  it('labels are stable and human-readable', () => {
    expect(assertionLabel(a('status', { operator: 'eq', expected: '200' }))).toBe('Status equals 200');
    expect(assertionLabel(a('json', { target: '$.ok', operator: 'exists' }))).toBe('JSON $.ok exists');
    expect(assertionLabel(a('time', { operator: 'lt', expected: '500' }))).toBe('Response time less than 500 ms');
  });
});

describe('readable report', () => {
  it('contains request line, summary and per-assertion PASS/FAIL with reasons', () => {
    const report = runAssertions([
      a('status', { operator: 'eq', expected: '200' }),
      a('json', { target: '$.data.id', operator: 'eq', expected: '99' }),
    ], RESP, 1000);
    const text = formatReportText(report, { method: 'GET', url: 'https://x.test/v1', status: 200, elapsedMs: 123 });
    expect(text).toContain('GET https://x.test/v1 → 200 (123 ms)');
    expect(text).toContain('1/2 passed, 1 FAILED');
    expect(text).toContain('[PASS] Status equals 200');
    expect(text).toContain('[FAIL] JSON $.data.id equals 99');
    expect(text).toContain('got 42');
    expect(text).not.toContain('Content-Type');
  });

  it('empty report says so explicitly', () => {
    expect(formatReportText(runAssertions([], RESP, 1000))).toContain('(no enabled assertions)');
  });
});

describe('storage guard (parseAssertions)', () => {
  it('keeps valid entries, drops dirty ones, dedupes ids and caps the list', () => {
    const good = a('status');
    const raw = [
      good,
      null,
      { ...a('json'), operator: 'bogus' },
      { ...a('header'), enabled: 'yes' },
      { ...good },
      ...Array.from({ length: ASSERTIONS_CAP + 10 }, (_, i) => a('time', { id: `bulk-${i}` } as Partial<Assertion>)),
    ];
    const parsed = parseAssertions(raw);
    expect(parsed[0]).toEqual(good);
    expect(parsed.length).toBe(ASSERTIONS_CAP);
    expect(new Set(parsed.map(p => p.id)).size).toBe(parsed.length);
    expect(parseAssertions('junk')).toEqual([]);
    expect(parseAssertions(null)).toEqual([]);
  });

  it('cloneAssertions decouples snapshots from live editing', () => {
    const live = [a('status')];
    const snap = cloneAssertions(live);
    live[0].expected = '500';
    expect(snap[0].expected).toBe('200');
  });
});

describe('store integration (API-009 extensions)', () => {
  const req = { method: 'GET', url: 'https://x.test/', headers: [], body: '' };

  it('saveRequest stores a decoupled assertions snapshot; update keeps id', () => {
    const live = [a('json', { target: '$.ok', operator: 'exists' })];
    const first = saveRequest([], 'Login', req, 100, 'id-1', live);
    expect(first.saved?.assertions).toEqual(live);
    live[0].target = '$.changed';
    expect(first.saved?.assertions?.[0].target).toBe('$.ok');
    const second = saveRequest(first.list, 'login', req, 200, 'id-2', []);
    expect(second.saved?.id).toBe('id-1');
    expect(second.saved?.assertions).toEqual([]);
  });

  it('saveRequest without assertions preserves existing ones on overwrite', () => {
    const first = saveRequest([], 'A', req, 1, 'id-a', [a('status')]);
    const second = saveRequest(first.list, 'A', req, 2, 'id-b');
    expect(second.saved?.assertions?.length).toBe(1);
  });

  it('parseSaved round-trips assertions and drops invalid ones without losing the request', () => {
    const list = saveRequest([], 'A', req, 1, 'id-a', [a('status')]).list;
    const restored = parseSaved(JSON.parse(JSON.stringify(list)));
    expect(restored[0].assertions?.length).toBe(1);
    const dirty = [{ ...list[0], assertions: [{ id: 'x', type: 'status', operator: 'bogus' }] }];
    const cleaned = parseSaved(dirty);
    expect(cleaned.length).toBe(1);
    expect(cleaned[0].assertions).toEqual([]);
  });

  it('parseHistory accepts optional tests summary and rejects malformed ones (negative control)', () => {
    const base = { id: 'h1', at: 1, request: req, status: 200, elapsedMs: 10 };
    expect(parseHistory([{ ...base, tests: { passed: 2, failed: 1 } }])[0].tests).toEqual({ passed: 2, failed: 1 });
    expect(parseHistory([base]).length).toBe(1);
    expect(parseHistory([{ ...base, tests: { passed: 'two' } }]).length).toBe(0);
  });
});
