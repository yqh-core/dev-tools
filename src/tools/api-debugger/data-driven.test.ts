/**
 * API-012/B 阶段 Runner 多轮编排单测。
 * 契约 v1.1 逐条锚定：轮数规则、cycle、local 每请求重置、environment 跨轮持久、
 * stopOnFailure 停整个运行、取消、无数据文件回归锁、进度全局长度。
 */
import { describe, expect, it, vi } from 'vitest';
import { type Assertion, makeAssertion } from './assertions';
import { type RunnerResponse, type RunScriptFn, formatCollectionReportText, runCollection } from './runner';
import type { SavedRequest } from './store';
import type { ScriptSnapshot } from './script-runtime';

function resp(patch: Partial<RunnerResponse> = {}): RunnerResponse {
  return { url: 'https://x.test/', status: 200, statusText: 'OK', headers: {}, body: '{"ok":1}', elapsedMs: 10, ...patch };
}
let seq = 0;
function saved(name: string, patch: Partial<SavedRequest['request']> = {}, scriptEvents?: { prerequest?: string; test?: string }): SavedRequest {
  seq += 1;
  return {
    id: `s-${seq}`, name,
    request: { method: 'GET', url: `https://x.test/${name}`, headers: [], body: '', ...patch },
    createdAt: 1, updatedAt: 1,
    ...(scriptEvents ? { scriptEvents } : {}),
  };
}
const DATA = { columns: ['email', 'role'], rows: [
  { email: 'a@x.test', role: 'admin' },
  { email: 'b@x.test', role: 'reader' },
  { email: 'c@x.test', role: 'editor' },
] };
function stubScript(recorder: { seen: ScriptSnapshot[] }): RunScriptFn {
  return async (_code, snap) => {
    recorder.seen.push(JSON.parse(JSON.stringify(snap)) as ScriptSnapshot);
    return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
  };
}

describe('B 轮数规则', () => {
  it('缺省 iterations = 数据行数（3 行 → 3 轮）', async () => {
    const rec = { seen: [] as ScriptSnapshot[] };
    const sum = await runCollection([saved('r', {}, { test: 't' })], {}, vi.fn(async () => resp()) as never, { runScript: stubScript(rec), dataFile: DATA });
    expect(sum.iterationCount).toBe(3);
    expect(sum.iterations.map(i => i.dataRowIndex)).toEqual([0, 1, 2]);
    expect(rec.seen.map(s => s.iterationData.email)).toEqual(['a@x.test', 'b@x.test', 'c@x.test']);
  });

  it('显式 iterations > 行数 → cycle（3 行 × 5 轮，第 4-5 轮回行 1-2）', async () => {
    const sum = await runCollection([saved('r', {}, { test: 't' })], {}, vi.fn(async () => resp()) as never, { dataFile: DATA, iterations: 5 });
    expect(sum.iterationCount).toBe(5);
    expect(sum.iterations.map(i => i.dataRowIndex)).toEqual([0, 1, 2, 0, 1]);
    expect(sum.dataFile).toEqual({ type: 'csv', rows: 3, columnsCount: 2 });
  });

  it('显式 iterations < 行数 → 只跑前 N 行', async () => {
    const sum = await runCollection([saved('r', {}, { test: 't' })], {}, vi.fn(async () => resp()) as never, { dataFile: DATA, iterations: 1 });
    expect(sum.iterationCount).toBe(1);
    expect(sum.iterations[0].dataRowIndex).toBe(0);
  });

  it('无数据文件 → 单轮（API-010 回归锁：iterations 结构为 1 轮且 dataFile=null）', async () => {
    const sum = await runCollection([saved('r')], {}, vi.fn(async () => resp()) as never, {});
    expect(sum.iterationCount).toBe(1);
    expect(sum.dataFile).toBeNull();
    expect(sum.iterations).toHaveLength(1);
    expect(sum.total).toBe(1);
  });
});

describe('B 作用域生命周期（契约 v1.1）', () => {
  it('environment 跨轮持久（轮 1 提取的 token，轮 2 快照可见）', async () => {
    const env: Record<string, string> = {};
    let call = 0;
    const runScript: RunScriptFn = async (_c, snap) => {
      call++;
      if (snap.info.event === 'test' && snap.info.iteration === 1) {
        return { outcome: { tests: [], envWrites: [{ layer: 'environment', name: 'token', value: 'T-ROUND-1' }], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
      }
      if (snap.info.event === 'prerequest' && snap.info.iteration === 2) {
        expect(snap.environment.token).toBe('T-ROUND-1'); // 轮 2 继承轮 1 的 environment 写入
      }
      return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    };
    const sum = await runCollection([saved('r', {}, { prerequest: 'p', test: 't' })], env, vi.fn(async () => resp()) as never, { runScript, dataFile: DATA, iterations: 2 });
    expect(sum.total).toBe(2);
    expect(env.token).toBe('T-ROUND-1'); // 宿主 env 被真实写入
  });

  it('local 每请求重置（请求 1 的 pm.variables 不见请求 2）；iterationData 每轮重置', async () => {
    const rec = { seen: [] as ScriptSnapshot[] };
    let n = 0;
    const runScript: RunScriptFn = async (_c, snap) => {
      rec.seen.push(JSON.parse(JSON.stringify(snap)) as ScriptSnapshot);
      n++;
      // 奇数次调用（每轮第 1 请求）写 local；偶数次（每轮第 2 请求）验证 local 为空
      if (n % 2 === 1) return { outcome: { tests: [], envWrites: [{ layer: 'local', name: 'tmp', value: 'x' }], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
      expect(Object.keys(snap.local)).toEqual([]);
      return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    };
    const two = [saved('a', {}, { test: 't' }), saved('b', {}, { test: 't' })];
    await runCollection(two, {}, vi.fn(async () => resp()) as never, { runScript, dataFile: DATA, iterations: 2 });
    expect(rec.seen.filter(s => s.info.event === 'test').length).toBe(4);
  });

  it('globals/collection 跨请求持久（B 修复：A 阶段旧实现会丢失）', async () => {
    let seenCollectionInSecond = '';
    const runScript: RunScriptFn = async (_c, snap) => {
      if (snap.info.counter === 1) {
        return { outcome: { tests: [], envWrites: [{ layer: 'collection', name: 'cid', value: 'C-1' }], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
      }
      seenCollectionInSecond = snap.collection.cid ?? '';
      return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    };
    await runCollection([saved('a', {}, { test: 't' }), saved('b', {}, { test: 't' })], {}, vi.fn(async () => resp()) as never, { runScript });
    expect(seenCollectionInSecond).toBe('C-1');
  });
});

describe('B 停止与取消', () => {
  it('stopOnFailure 命中即停整个运行（含剩余轮）', async () => {
    // 真断言失败路径（区别于 stopOnError）：send 成功但 HTTP 500，status 断言期望 200 → 失败
    const failing = saved('r', {}, { test: 't' });
    failing.assertions = [makeAssertion('a1', 'status')]; // 默认 eq 200
    const sum = await runCollection([failing], {}, vi.fn(async () => resp({ status: 500, statusText: 'Internal Error' })) as never, { dataFile: DATA, stopOnFailure: true });
    expect(sum.stoppedEarly).toBe(true);
    expect(sum.iterationCount).toBe(3); // 编排计划
    expect(sum.iterations).toHaveLength(1); // 实际只跑了 1 轮
    expect(sum.total).toBe(3); // 计划数（轮×请求，API-010 契约）
    expect(sum.sent).toBe(1); // attempted=1（首轮断言失败即停）
  });

  it('取消：signal 在轮间 abort → cancelled=true 且不再开新轮', async () => {
    const signal = { aborted: false };
    let rounds = 0;
    const runScript: RunScriptFn = async () => {
      rounds++;
      if (rounds === 2) signal.aborted = true; // 第 2 个脚本执行时取消
      return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    };
    const sum = await runCollection([saved('r', {}, { test: 't' })], {}, vi.fn(async () => resp()) as never, { runScript, dataFile: DATA, signal });
    expect(sum.cancelled).toBe(true);
    expect(sum.iterations.length).toBeLessThan(3);
  });

  it('进度为全局长度（2 轮 × 2 请求 = 4 次，index 0..3）', async () => {
    const seen: number[] = [];
    await runCollection([saved('a'), saved('b')], {}, vi.fn(async () => resp()) as never, {
      dataFile: { columns: ['x'], rows: [{ x: '1' }, { x: '2' }] },
      onProgress: (_r, idx) => seen.push(idx),
    });
    expect(seen).toEqual([0, 1, 2, 3]);
  });
});

describe('B 脱敏负控', () => {
  it('数据行值/环境值不进 summary、文本报告与 progress（负控：植入secret必须找不到）', async () => {
    const secret = 'SK-REDACT-NEG-CONTROL';
    const env = { token: secret };
    const rec = { seen: [] as ScriptSnapshot[] };
    const sum = await runCollection([saved('r', {}, { test: 't' })], env, vi.fn(async () => resp()) as never, {
      runScript: stubScript(rec),
      dataFile: { columns: ['apiKey'], rows: [{ apiKey: secret }] },
    });
    const text = formatCollectionReportText(sum);
    const json = JSON.stringify(sum);
    expect(json).not.toContain(secret);
    expect(text).not.toContain(secret);
    expect(JSON.stringify(rec.seen[0].iterationData)).toContain(secret); // 快照内含数据（执行需要），但不进报告
    expect(sum.iterations[0].dataRowColumns).toEqual(['apiKey']); // 只列名
  });
});
