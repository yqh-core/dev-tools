/**
 * API-011 Script Runtime 纯语义单测。
 * 判据方向：不只要"该过的过"，必须有"该红的红"（优先级错、断言不匹配、未实现 API 都必须失败）。
 */
import { describe, expect, it, vi } from 'vitest';
import { type ScriptSnapshot, createPmAPI, type RuntimeIO } from './script-runtime';

function snap(patch: Partial<ScriptSnapshot> = {}): ScriptSnapshot {
  return {
    request: { method: 'GET', url: 'https://api.test/v1', headers: [{ name: 'Accept', value: 'application/json' }], body: '' },
    response: { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"id":42,"name":"yqh"}', responseTime: 88 },
    globals: { g: '1' },
    collection: { c: '1', shared: 'COLL' },
    environment: { e: '1', shared: 'ENV' },
    iterationData: { d: '1', shared: 'DATA' },
    local: {},
    info: { event: 'test', iteration: 0, counter: 1 },
    ...patch,
  };
}

function mkIO(s: ScriptSnapshot) {
  const outcome = { tests: [], envWrites: [], requestMutations: {}, logs: [] as string[], sendRequests: [], asyncPending: false };
  const io: RuntimeIO = { outcome, console: (...a) => outcome.logs.push(a.map(String).join(' ')), sendRequest: vi.fn(async () => ({ code: 201, status: 'Created', responseTime: 5 })) };
  return { io, outcome };
}

describe('作用域优先级（Postman 规则：local > data > environment > collection > globals）', () => {
  it('shared 冲突时 pm.variables.get 命中 data 层', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.get('shared')).toBe('DATA');
  });
  it('无 data 时 environment 胜过 collection', () => {
    const s = snap({ iterationData: {} }); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.get('shared')).toBe('ENV');
  });
  it('脚本内 set 只进 local 且立刻最高优先（负控：不得回写 environment）', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.variables.set('shared', 'LOCAL');
    expect(pm.variables.get('shared')).toBe('LOCAL');
    expect(s.environment.shared).toBe('ENV');
    expect(io.outcome.envWrites).toEqual([{ layer: 'local', name: 'shared', value: 'LOCAL' }]);
  });
  it('pm.environment.set 精确写 environment 层并记录', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.environment.set('token', 'abc');
    expect(s.environment.token).toBe('abc');
    expect(io.outcome.envWrites).toEqual([{ layer: 'environment', name: 'token', value: 'abc' }]);
  });
  it('replaceIn 按同一优先级插值', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.replaceIn('v={{shared}} g={{g}}')).toBe('v=DATA g=1');
  });
});

describe('pm.test / pm.expect fail-closed', () => {
  it('通过路径：equal + property', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('status is 200', () => pm.expect(pm.response.code).to.equal(200));
    pm.test('name is yqh', () => pm.expect(pm.response.json()).to.have.property('name', 'yqh'));
    flushTests();
    expect(io.outcome.tests).toEqual([{ name: 'status is 200', passed: true }, { name: 'name is yqh', passed: true }]);
  });
  it('失败路径：不匹配断言记 failed 且带原因（负控防恒真）', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('wrong status', () => pm.expect(pm.response.code).to.equal(500));
    flushTests();
    expect(io.outcome.tests[0].passed).toBe(false);
    expect(io.outcome.tests[0].error).toContain('to equal');
  });
  it('不认识的链式方法抛 TypeError → test 失败而非静默通过', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('unknown matcher', () => (pm.expect(1) as any).toBeMagical());
    flushTests();
    expect(io.outcome.tests[0].passed).toBe(false);
  });
  it('include / match / above / oneOf', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('body includes id', () => pm.expect(pm.response.text()).to.include('"id"'));
    pm.test('status matches', () => pm.expect('OK').to.match(/^O/));
    pm.test('time below', () => pm.expect(pm.response.responseTime).to.be.below(1000));
    pm.test('one of', () => pm.expect(200).to.be.oneOf([200, 201]));
    flushTests();
    expect(io.outcome.tests.every(t => t.passed)).toBe(true);
  });
});

describe('response / request 面', () => {
  it('prerequest 事件时 pm.response 为 null（不误造对象）', () => {
    const s = snap({ response: null, info: { event: 'prerequest', iteration: 0, counter: 1 } }); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.response).toBeNull();
  });
  it('headers.get 大小写不敏感（上游常见小写化）', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.response.headers.get('Content-Type')).toBe('application/json');
    expect(pm.request.headers.get('accept')).toBe('application/json');
  });
  it('upsert 记录 requestMutations（宿主稍后应用，不在沙箱内直改真请求）', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.request.headers.upsert({ key: 'X-Run', value: '7' });
    expect(io.outcome.requestMutations.headers?.some(h => h.name === 'X-Run')).toBe(true);
  });
});

describe('sendRequest 经宿主桥（权限在宿主侧）', () => {
  it('排入 outbox 且 cb 收到宿主返回', async () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    let got: unknown = null;
    await pm.sendRequest('https://api.test/token', (_e: unknown, res: unknown) => { got = res });
    expect(io.outcome.sendRequests).toHaveLength(1);
    expect(io.sendRequest).toHaveBeenCalledTimes(1);
    expect((got as { code: number }).code).toBe(201);
  });
});

describe('unsupported 显式失败（不静默 no-op 伪装支持）', () => {
  it('pm.unsupported 抛错并指明特性', () => {
    const s = snap(); const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(() => pm.unsupported('execution.setNextRequest')).toThrow(/not supported/);
  });
});
