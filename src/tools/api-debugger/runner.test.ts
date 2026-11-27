import { describe, expect, it, vi } from 'vitest';
import { type Assertion, makeAssertion } from './assertions';
import { type RunnerPayload, type RunnerResponse, type SendFn, formatCollectionReportText, runCollection } from './runner';
import type { SavedRequest } from './store';

function resp(patch: Partial<RunnerResponse> = {}): RunnerResponse {
  return { url: 'https://x.test/', status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"ok":true,"id":42}', elapsedMs: 100, ...patch };
}

let seq = 0;
function saved(name: string, patch: Partial<SavedRequest['request']> = {}, assertions?: Assertion[]): SavedRequest {
  seq += 1;
  return {
    id: `s-${seq}`,
    name,
    request: { method: 'GET', url: `https://x.test/${name}`, headers: [], body: '', ...patch },
    createdAt: 1,
    updatedAt: 1,
    ...(assertions === undefined ? {} : { assertions }),
  };
}
function statusAssertion(expected: string): Assertion {
  return { ...makeAssertion(`a-${seq}-${expected}`, 'status'), operator: 'eq', expected };
}

function tick() {
  let t = 1000;
  return () => (t += 10);
}

describe('runCollection core', () => {
  it('runs requests in order, substitutes vars, and runs each request assertions', async () => {
    const calls: string[] = [];
    const send: SendFn = async (p) => {
      calls.push(p.url);
      return resp({ url: p.url });
    };
    const list = [
      saved('first', { url: 'https://{{host}}/a' }, [statusAssertion('200')]),
      saved('second', {}, [{ ...makeAssertion('j', 'json'), target: '$.id', operator: 'eq', expected: '42' }]),
    ];
    const sum = await runCollection(list, { host: 'x.test' }, send, { now: tick() });
    expect(calls).toEqual(['https://x.test/a', 'https://x.test/second']);
    expect(sum.total).toBe(2);
    expect(sum.sent).toBe(2);
    expect(sum.failed).toBe(0);
    expect(sum.allPassed).toBe(true);
    expect(sum.assertionsTotal).toBe(2);
    expect(sum.assertionsPassed).toBe(2);
    expect(sum.results[1].report?.results[0].passed).toBe(true);
  });

  it('request with no assertions passes when sent (Postman semantics)', async () => {
    const send: SendFn = async () => resp({ status: 404 });
    const sum = await runCollection([saved('no-tests')], {}, send, { now: tick() });
    expect(sum.results[0].passed).toBe(true);
    expect(sum.results[0].report?.total).toBe(0);
    expect(sum.allPassed).toBe(true);
  });

  it('failed assertion marks request failed and aggregates', async () => {
    const send: SendFn = async () => resp({ status: 200 });
    const sum = await runCollection([saved('bad', {}, [statusAssertion('500')])], {}, send, { now: tick() });
    expect(sum.results[0].passed).toBe(false);
    expect(sum.failed).toBe(1);
    expect(sum.assertionsPassed).toBe(0);
    expect(sum.allPassed).toBe(false);
  });

  it('missing variables → not sent, failed, readable error (negative control)', async () => {
    const send = vi.fn(async (_p: RunnerPayload): Promise<RunnerResponse> => resp());
    const sum = await runCollection([saved('missing', { url: 'https://{{nope}}/x' })], {}, send, { now: tick(), stopOnError: false });
    expect(send).not.toHaveBeenCalled();
    expect(sum.results[0].sent).toBe(false);
    expect(sum.results[0].passed).toBe(false);
    expect(sum.results[0].error).toContain('Missing variables: nope');
  });

  it('send rejection is captured as error, not a crash (negative control)', async () => {
    const send: SendFn = async () => {
      throw new Error('network down');
    };
    const sum = await runCollection([saved('boom')], {}, send, { now: tick(), stopOnError: false });
    expect(sum.results[0].sent).toBe(false);
    expect(sum.results[0].error).toBe('network down');
    expect(sum.failed).toBe(1);
  });

  it('empty collection yields vacuous pass with zero stats', async () => {
    const sum = await runCollection([], {}, async () => resp(), { now: tick() });
    expect(sum.total).toBe(0);
    expect(sum.allPassed).toBe(true);
    expect(sum.avgResponseMs).toBeNull();
  });
});

describe('runCollection control flow', () => {
  it('stopOnError default true halts after a send failure', async () => {
    const send = vi.fn(async (_p: RunnerPayload): Promise<RunnerResponse> => {
      throw new Error('down');
    });
    const sum = await runCollection([saved('a'), saved('b'), saved('c')], {}, send, { now: tick() });
    expect(send).toHaveBeenCalledTimes(1);
    expect(sum.results.length).toBe(1);
    expect(sum.stoppedEarly).toBe(true);
    expect(sum.total).toBe(3);
  });

  it('stopOnError false continues past send failure', async () => {
    let n = 0;
    const send: SendFn = async () => {
      n += 1;
      if (n === 1) {
        throw new Error('down');
      }
      return resp();
    };
    const sum = await runCollection([saved('a'), saved('b')], {}, send, { now: tick(), stopOnError: false });
    expect(sum.results.length).toBe(2);
    expect(sum.sent).toBe(1);
    expect(sum.stoppedEarly).toBe(false);
  });

  it('stopOnFailure halts after an assertion failure but not by default', async () => {
    const send: SendFn = async () => resp({ status: 200 });
    const list = [saved('a', {}, [statusAssertion('500')]), saved('b')];
    const cont = await runCollection(list, {}, send, { now: tick() });
    expect(cont.results.length).toBe(2);
    const halt = await runCollection(list, {}, send, { now: tick(), stopOnFailure: true });
    expect(halt.results.length).toBe(1);
    expect(halt.stoppedEarly).toBe(true);
  });

  it('delay sleeps between requests but not after the last', async () => {
    const sleeps: number[] = [];
    const send: SendFn = async () => resp();
    await runCollection([saved('a'), saved('b'), saved('c')], {}, send, {
      now: tick(),
      delayMs: 250,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(sleeps).toEqual([250, 250]);
  });

  it('cancel signal stops before next request and flags cancelled', async () => {
    const signal = { aborted: false };
    const send: SendFn = async () => {
      signal.aborted = true;
      return resp();
    };
    const sum = await runCollection([saved('a'), saved('b')], {}, send, { now: tick(), signal });
    expect(sum.results.length).toBe(1);
    expect(sum.cancelled).toBe(true);
    expect(sum.allPassed).toBe(false);
  });

  it('onProgress fires once per executed request with index/total', async () => {
    const seen: [number, number][] = [];
    const send: SendFn = async () => resp();
    await runCollection([saved('a'), saved('b')], {}, send, { now: tick(), onProgress: (_r, i, t) => seen.push([i, t]) });
    expect(seen).toEqual([[0, 2], [1, 2]]);
  });

  it('announces each request after substitution and before sending it', async () => {
    const events: string[] = [];
    const send: SendFn = async (payload) => {
      events.push(`send:${payload.method}:${payload.url}`);
      return resp({ url: payload.url });
    };
    await runCollection([saved('first'), saved('second')], {}, send, {
      now: tick(),
      onRequestStart: (request, index, total) => {
        events.push(`start:${index + 1}/${total}:${request.name}:${request.method}:${request.url}`);
      },
    });
    expect(events).toEqual([
      'start:1/2:first:GET:https://x.test/first',
      'send:GET:https://x.test/first',
      'start:2/2:second:GET:https://x.test/second',
      'send:GET:https://x.test/second',
    ]);
  });

  it('computes duration and average response time', async () => {
    let t = 1000;
    const now = () => t;
    const send: SendFn = async () => {
      t += 50;
      return resp({ elapsedMs: t === 1050 ? 100 : 300 });
    };
    const sum = await runCollection([saved('a'), saved('b')], {}, send, { now });
    expect(sum.totalDurationMs).toBe(100);
    expect(sum.avgResponseMs).toBe(200);
  });
});

describe('formatCollectionReportText', () => {
  it('renders summary, per-request and per-assertion lines without credentials', async () => {
    const send: SendFn = async () => resp({ status: 200 });
    const sum = await runCollection([
      saved('ok', {}, [statusAssertion('200')]),
      saved('bad', {}, [statusAssertion('500')]),
    ], {}, send, { now: tick(), stopOnError: false });
    const text = formatCollectionReportText(sum);
    expect(text).toContain('Requests: 2/2 sent, 1 failed');
    expect(text).toContain('Assertions: 1/2 passed');
    expect(text).toContain('FAILURES PRESENT');
    expect(text).toContain('[1] PASS ok');
    expect(text).toContain('[2] FAIL bad');
    expect(text).toContain('[FAIL] Status equals 500');
    expect(text).not.toContain('content-type');
  });

  it('labels the marked-secret redaction boundary even when the secret is not otherwise present in report fields', async () => {
    const sum = await runCollection([saved('safe', { url: 'https://x.test/safe' })], {}, async () => resp(), { now: tick() });
    const report = formatCollectionReportText(sum, { secretValues: ['marked-secret-value'] });

    expect(report).toContain('[REDACTED-Secret]');
    expect(report).not.toContain('marked-secret-value');
    expect(report).toContain('matching text is replaced');
  });

  it('replaces a marked secret when it appears in a reported URL', async () => {
    const secret = 'marked-secret-value';
    const sum = await runCollection([saved('secret', { url: `https://x.test/items?token=${secret}` })], {}, async (payload) => resp({ url: payload.url }), { now: tick() });
    const report = formatCollectionReportText(sum, { secretValues: [secret] });

    expect(report).not.toContain(secret);
    expect(report).toContain('[REDACTED-Secret]');
  });

  it('empty collection report says so', async () => {
    const sum = await runCollection([], {}, async () => resp(), { now: tick() });
    expect(formatCollectionReportText(sum)).toContain('(collection is empty)');
  });
});
