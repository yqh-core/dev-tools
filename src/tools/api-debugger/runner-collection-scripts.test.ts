/**
 * A-002/A-003 集合级脚本叠加顺序契约（引擎层 lock；任务书 §6 A1/A3 + §4 Hoppscotch 对标点）。
 *
 * 断言口径纪律（时序诚实）：
 *  - prerequest/test 快照在 runScript 调用**前**构造——集合脚本的写入在 eval 内发生，
 *    阶段内快照不可见（不假装可见）；
 *  - 顺序用**合并文本内位置**锁（pre: 集合段<请求段=外先内后；test: 请求段<集合段=内先外后）；
 *  - 效果用**跨阶段/跨请求快照**锁（集合 pre 的 envWrites 经宿主 applyWrites 持久后，
 *    test 快照/下一请求快照可见）；
 *  - 沙箱内跨段读写可见性由 script-runtime 语义保证（set 同时更新 snap 读面，行 144），
 *    真实沙箱层由浏览器/CLI E2E 验证。
 */
import { describe, expect, it, vi } from 'vitest';
import { runCollection } from './runner';
import type { SavedRequest } from './store';

function req(name: string, scriptEvents?: { prerequest?: string; test?: string }): SavedRequest {
  return {
    id: `r-${name}`,
    name,
    request: { method: 'GET', url: 'https://api.example.test/x', headers: [], body: '' },
    createdAt: 1,
    updatedAt: 1,
    ...(scriptEvents ? { scriptEvents } : {}),
  };
}

interface Seen { event: string; code: string; snap: any }
/** 按代码标记注入效果：集合 pre 写 collection 层；请求 test 写 environment 层（跨请求持久口径）。 */
function makeRunScript(seen: Seen[]) {
  return vi.fn(async (code: string, snap: any) => {
    seen.push({ event: snap.info.event, code, snap });
    if (snap.info.event === 'prerequest' && code.includes('COLLECTION-PRE')) {
      return { outcome: { tests: [], envWrites: [{ layer: 'collection', name: 'colMark', value: 'COL' }], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    }
    if (snap.info.event === 'test' && code.includes('REQUEST-TEST')) {
      return { outcome: { tests: [], envWrites: [{ layer: 'environment', name: 'envMark', value: 'A-TEST' }], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    }
    return { outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
  });
}

const stubSend = async () => ({ status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 });

describe('集合级脚本叠加（collectionScripts 选项）', () => {
  it('prerequest：集合段先于请求段（文本位置锁）；集合写入跨阶段持久（test 快照可见=效果锁）', async () => {
    const seen: Seen[] = [];
    const runScript = makeRunScript(seen);
    const sum = await runCollection(
      [req('A', { prerequest: 'pm.variables.set("x","1"); // REQUEST-PRE' })],
      {},
      stubSend as never,
      {
        runScript: runScript as never,
        collectionScripts: { prerequest: 'pm.collectionVariables.set("colMark","COL"); // COLLECTION-PRE', test: '// COLLECTION-TEST' },
      },
    );
    expect(sum.total).toBe(1);
    const preCalls = seen.filter(s => s.event === 'prerequest');
    expect(preCalls).toHaveLength(1); // 合并文本单次调用
    const code = preCalls[0].code;
    expect(code.indexOf('COLLECTION-PRE')).toBeGreaterThanOrEqual(0);
    expect(code.indexOf('COLLECTION-PRE')).toBeLessThan(code.indexOf('REQUEST-PRE')); // 外先内后
    // 效果锁：集合 pre 的 envWrites 经宿主 applyWrites 持久 → test 快照（构造于 prerequest 完成后）可见
    const testCalls = seen.filter(s => s.event === 'test');
    expect(testCalls).toHaveLength(1); // mergedTest=集合 test（请求无自身 test）
    expect(testCalls[0].snap.collection.colMark).toBe('COL');
  });

  it('test：请求段先于集合段（内先外后）；请求 test 写入跨请求持久（下一请求 test 快照可见）', async () => {
    const seen: Seen[] = [];
    const runScript = makeRunScript(seen);
    await runCollection(
      [req('A', { test: 'pm.test("t", () => {}); // REQUEST-TEST' }), req('B')],
      {},
      stubSend as never,
      {
        runScript: runScript as never,
        collectionScripts: { test: 'pm.test("collection-level", () => {}); // COLLECTION-TEST' },
      },
    );
    const aTest = seen.filter(s => s.event === 'test' && s.code.includes('REQUEST-TEST'));
    expect(aTest).toHaveLength(1);
    expect(aTest[0].code.indexOf('REQUEST-TEST')).toBeLessThan(aTest[0].code.indexOf('COLLECTION-TEST')); // 内先外后
    const bTest = seen.filter(s => s.event === 'test' && !s.code.includes('REQUEST-TEST'));
    expect(bTest).toHaveLength(1); // B 无自身 test → 仅集合 test 执行（每请求都执行=Postman 语义）
    expect(bTest[0].snap.environment.envMark).toBe('A-TEST'); // A 的 test 写入跨请求持久
  });

  it('仅集合 test（无请求 test）：集合 test 单独执行，mergedTest 退化不双写', async () => {
    const seen: Seen[] = [];
    const runScript = makeRunScript(seen);
    await runCollection(
      [req('A')],
      {},
      stubSend as never,
      { runScript: runScript as never, collectionScripts: { test: '// COLLECTION-TEST' } },
    );
    const testCalls = seen.filter(s => s.event === 'test');
    expect(testCalls).toHaveLength(1);
    expect(testCalls[0].code).toContain('COLLECTION-TEST');
  });

  it('回归锁：不传 collectionScripts 时行为与原路径逐字一致（无集合层副作用）', async () => {
    const seen: Seen[] = [];
    const runScript = makeRunScript(seen);
    const sum = await runCollection(
      [req('A', { prerequest: '// REQ-ONLY', test: '// REQ-ONLY' })],
      {},
      stubSend as never,
      { runScript: runScript as never },
    );
    const preCalls = seen.filter(s => s.event === 'prerequest');
    expect(preCalls[0].code).toBe('// REQ-ONLY'); // 未叠加任何集合文本
    expect(preCalls[0].snap.collection).toEqual({}); // 无集合层写入
    expect(sum.total).toBe(1);
  });

  it('prerequest 段 pm.test 同样计入 scriptTests（Postman 语义；pre 在前 test 在后=执行序）', async () => {
    const runScript = vi.fn(async (code: string, snap: any) => {
      const tests = snap.info.event === 'prerequest'
        ? [{ name: 'pre-level t', passed: true }]
        : [{ name: 'test-level t', passed: true }];
      return { outcome: { tests, envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    });
    const sum = await runCollection([req('A', { prerequest: '// P', test: '// T' })], {}, stubSend as never, { runScript: runScript as never });
    expect(sum.results[0].scriptTests?.map(t => t.name)).toEqual(['pre-level t', 'test-level t']); // 顺序=执行序
    expect(sum.scriptTestsTotal).toBe(2);
    expect(sum.scriptTestsPassed).toBe(2);
  });
});
