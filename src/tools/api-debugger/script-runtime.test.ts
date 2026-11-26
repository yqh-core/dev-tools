/**
 * API-011 Script Runtime 纯语义单测。
 * 判据方向：不只要"该过的过"，必须有"该红的红"（优先级错、断言不匹配、未实现 API 都必须失败）。
 */
import { describe, expect, it, vi } from 'vitest';
import { type RuntimeIO, type ScriptSnapshot, createPmAPI } from './script-runtime';

function snap(patch: Partial<ScriptSnapshot> = {}): ScriptSnapshot {
  return {
    request: { method: 'GET', url: 'https://api.test/v1', headers: [{ name: 'Accept', value: 'application/json' }], body: '' },
    response: { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"id":42,"name":"yqh"}', responseTime: 88 },
    globals: { g: '1' },
    collection: { c: '1', shared: 'COLL' },
    environment: { e: '1', shared: 'ENV' },
    iterationData: { d: '1', shared: 'DATA' },
    local: {},
    info: { event: 'test', iteration: 0, counter: 1, requestName: 'unit-req' },
    ...patch,
  };
}

function mkIO(s: ScriptSnapshot) {
  const outcome = { tests: [], envWrites: [], requestMutations: {}, logs: [] as string[], sendRequests: [], asyncPending: false };
  const io: RuntimeIO = { outcome, console: (...a) => outcome.logs.push(a.map(String).join(' ')), sendRequest: vi.fn(async () => ({ code: 201, status: 'Created', statusText: 'Created', headers: [{ name: 'Content-Type', value: 'application/json' }], body: '{"ok":1}', responseTime: 5 })) };
  return { io, outcome };
}

describe('作用域优先级（Postman 规则：local > data > environment > collection > globals）', () => {
  it('shared 冲突时 pm.variables.get 命中 data 层', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.get('shared')).toBe('DATA');
  });
  it('无 data 时 environment 胜过 collection', () => {
    const s = snap({ iterationData: {} });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.get('shared')).toBe('ENV');
  });
  it('终审 P1-01 五层同名矩阵：get/has/replaceIn/toObject 全部同序（local > data > env > collection > globals）', () => {
    const s = snap({ globals: { g: '1', shared: 'GLOB' } });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    // 无 local 写入：iterationData(DATA) > environment(ENV) > collection(COLL) > globals(GLOB)
    const to = () => pm.variables.toObject() as { key: string; value: string }[];
    expect(pm.variables.get('shared')).toBe('DATA');
    expect(pm.variables.has('shared')).toBe(true);
    expect(pm.variables.replaceIn('{{shared}}')).toBe('DATA');
    expect(to().find(e => e.key === 'shared')?.value).toBe('DATA');
    // local 写入后立刻最高优先
    pm.variables.set('shared', 'LOCAL');
    expect(pm.variables.get('shared')).toBe('LOCAL');
    expect(pm.variables.has('shared')).toBe(true);
    expect(pm.variables.replaceIn('x={{shared}}')).toBe('x=LOCAL');
    expect(to().find(e => e.key === 'shared')?.value).toBe('LOCAL');
  });
  it('终审 P1-01 负控：toObject 不被低优先级层遮蔽（去掉 data 层后 ENV 胜 COLL）', () => {
    const s = snap({ iterationData: {} });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect((pm.variables.toObject() as { key: string; value: string }[]).find(e => e.key === 'shared')?.value).toBe('ENV');
  });
  it('脚本内 set 只进 local 且立刻最高优先（负控：不得回写 environment）', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.variables.set('shared', 'LOCAL');
    expect(pm.variables.get('shared')).toBe('LOCAL');
    expect(s.environment.shared).toBe('ENV');
    expect(io.outcome.envWrites).toEqual([{ layer: 'local', name: 'shared', value: 'LOCAL' }]);
  });
  it('pm.environment.set 精确写 environment 层并记录', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.environment.set('token', 'abc');
    expect(s.environment.token).toBe('abc');
    expect(io.outcome.envWrites).toEqual([{ layer: 'environment', name: 'token', value: 'abc' }]);
  });
  it('replaceIn 按同一优先级插值', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.replaceIn('v={{shared}} g={{g}}')).toBe('v=DATA g=1');
  });

  it('同名 get/replaceIn 口径一致：environment>collection（终审 P0-4 修复锁；修复前 replaceIn 返回 COLL）', () => {
    const s = snap({ iterationData: { d: '1' } }); // 移除 data 层 shared，冲突只剩 collection=COLL vs environment=ENV
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.variables.get('shared')).toBe('ENV');
    expect(pm.variables.has('shared')).toBe(true);
    expect(pm.variables.replaceIn('{{shared}}')).toBe('ENV');
  });
});

describe('pm.test / pm.expect fail-closed', () => {
  it('通过路径：equal + property', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('status is 200', () => pm.expect(pm.response.code).to.equal(200));
    pm.test('name is yqh', () => pm.expect(pm.response.json()).to.have.property('name', 'yqh'));
    flushTests();
    expect(io.outcome.tests).toEqual([{ name: 'status is 200', passed: true }, { name: 'name is yqh', passed: true }]);
  });
  it('失败路径：不匹配断言记 failed 且带原因（负控防恒真）', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('wrong status', () => pm.expect(pm.response.code).to.equal(500));
    flushTests();
    expect(io.outcome.tests[0].passed).toBe(false);
    expect(io.outcome.tests[0].error).toContain('operator=equal');
  });
  it('终审裁定② G1 严格消息：失败消息不格式化原始 actual/expected（植物负控+类型信息正控）', () => {
    const s = snap({ environment: { apiKey: 'SK-G1-PLANT-3m9', shared: 'ENV' } });
    const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('secret expect fail', () => pm.expect(pm.variables.get('apiKey')).to.equal('different'));
    pm.test('obj expect fail', () => pm.expect(pm.response.json()).to.have.property('name', 'yqh-wrong'));
    flushTests();
    const err0 = io.outcome.tests[0].error ?? '';
    const err1 = io.outcome.tests[1].error ?? '';
    // 植物值零回显（uniform 口径：安全标量如状态码同样不回显）
    expect(err0).not.toContain('SK-G1-PLANT-3m9');
    expect(err0).toContain('operator=equal');
    expect(err0).toContain('actual type=string');
    // property 路径安全（用户配置面），值不回显
    expect(err1).toContain('property path "name"');
    expect(err1).not.toContain('yqh');
    expect(err1).not.toContain('SK-G1-PLANT-3m9');
  });
  it('终审裁定② G1：pm.info.requestName 真实注入（可定位性）', () => {
    const s = snap({ info: { event: 'test', iteration: 2, counter: 3, requestName: 'req-42' } });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.info.requestName).toBe('req-42');
    expect(pm.info.iteration).toBe(2);
    expect(pm.info.counter).toBe(3);
  });
  it('不认识的链式方法抛 TypeError → test 失败而非静默通过', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('unknown matcher', () => (pm.expect(1) as any).toBeMagical());
    flushTests();
    expect(io.outcome.tests[0].passed).toBe(false);
  });

  it('E5 异步断言：pm.test 回调返回 Promise——settled 后才定成败（终审 P1-2；同步路径双模不变）', async () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm, flushTests } = createPmAPI(s, io);
    pm.test('async pass', async () => {
      await Promise.resolve();
    });
    pm.test('async fail', async () => {
      throw new Error('late boom');
    });
    // 未 settled 前不出结论（延迟语义锁；拒绝按注册序断言——rejected 立即 settled 的用例会先落地）
    expect(io.outcome.tests).toHaveLength(0);
    await flushTests();
    const byName = (n: string) => io.outcome.tests.find(t => t.name === n);
    expect(io.outcome.tests).toHaveLength(2);
    expect(byName('async pass')?.passed).toBe(true);
    expect(byName('async fail')?.passed).toBe(false);
    expect(byName('async fail')?.error).toContain('late boom');
  });
  it('include / match / above / oneOf', () => {
    const s = snap();
    const { io } = mkIO(s);
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
    const s = snap({ response: null, info: { event: 'prerequest', iteration: 0, counter: 1, requestName: 'unit-req' } });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.response).toBeNull();
  });
  it('headers.get 大小写不敏感（上游常见小写化）', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(pm.response.headers.get('Content-Type')).toBe('application/json');
    expect(pm.request.headers.get('accept')).toBe('application/json');
  });
  it('upsert 记录 requestMutations（宿主稍后应用，不在沙箱内直改真请求）', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    pm.request.headers.upsert({ key: 'X-Run', value: '7' });
    expect(io.outcome.requestMutations.headers?.some(h => h.name === 'X-Run')).toBe(true);
  });
});

describe('sendRequest 经宿主桥（权限在宿主侧）', () => {
  it('排入 outbox 且 cb 收到宿主返回', async () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    let got: unknown = null;
    await pm.sendRequest('https://api.test/token', (_e: unknown, res: unknown) => {
      got = res;
    });
    expect(io.outcome.sendRequests).toHaveLength(1);
    expect(io.sendRequest).toHaveBeenCalledTimes(1);
    expect((got as { code: number }).code).toBe(201);
  });

  it('终审 P1-04：pm.sendRequest 返回 Postman 风格响应视图（text/json/headers.get/statusText/truncated）', async () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    const res = await pm.sendRequest('https://api.test/token');
    expect(res.code).toBe(201);
    expect(res.status).toBe('Created');
    expect(res.statusText).toBe('Created');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.text()).toBe('{"ok":1}');
    expect(res.json()).toEqual({ ok: 1 });
    expect(res.responseTime).toBe(5);
    expect(res.size).toBe(8); // '{"ok":1}' = 8 chars
    expect(res.truncated).toBeUndefined();
  });

  it('终审 P1-01/P1-04：outbox URL 经同一 resolver 插值（{{}} 在 pm.sendRequest 中解析）', async () => {
    const s = snap({ environment: { baseUrl: 'https://env.test' } });
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    await pm.sendRequest('{{baseUrl}}/path?x={{missing}}');
    expect(io.outcome.sendRequests).toHaveLength(1);
    expect(io.outcome.sendRequests[0].url).toBe('https://env.test/path?x=');
  });

  it('A-018/终审 P1-03 outbox 累计发送上限 fail-closed（第 101 条拒绝，cb 收到错误，不静默丢不假装成功）', async () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    for (let i = 0; i < 100; i++) {
      await pm.sendRequest(`https://api.test/q${i}`);
    }
    expect(io.outcome.sendRequests).toHaveLength(100);
    let cbErr: unknown = null;
    await expect(pm.sendRequest('https://api.test/overflow', (e: unknown) => {
      cbErr = e;
    })).rejects.toThrow(/cumulative send limit/);
    expect(cbErr).toBeTruthy(); // cb 与 promise 双通道都如实承载
    expect(io.outcome.sendRequests).toHaveLength(100); // 拒绝不计入
  });

  it('A-018 outbox 单 spec UTF-8 字节上限 fail-closed（异常大对象）', async () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    const big = 'x'.repeat(1_000_001);
    await expect(pm.sendRequest({ url: 'https://api.test/big', body: big })).rejects.toThrow(/exceeds 1000000 UTF-8 bytes/);
    expect(io.outcome.sendRequests).toHaveLength(0);
  });
});

describe('unsupported 显式失败（不静默 no-op 伪装支持）', () => {
  it('pm.unsupported 抛错并指明特性', () => {
    const s = snap();
    const { io } = mkIO(s);
    const { pm } = createPmAPI(s, io);
    expect(() => pm.unsupported('execution.setNextRequest')).toThrow(/not supported/);
  });
});
