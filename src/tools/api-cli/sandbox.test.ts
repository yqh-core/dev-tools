/**
 * CLI 沙箱单测（真 worker_threads 传输；协议夹具验证传输/outbox 桥/超时/崩溃承载）。
 * 真实 pm 脚本执行链由 CLI E2E 对 vite 产物 bundle 验证（浏览器源码扩展名省略导入
 * 不能被 Node 原生 loader 解析——单元/E2E 分层，任务书 §10.2）。
 */
import { describe, expect, it } from 'vitest';
import { createSandboxRunScript } from './sandbox';
import type { ScriptSnapshot } from '../api-debugger/script-runtime';

const fixtureUrl = new URL('./test-fixtures/protocol-worker.ts', import.meta.url);
const snapshot = {} as ScriptSnapshot;
const noopSend = async () => ({ url: 'http://unused', status: 0, statusText: '', headers: {}, body: '', elapsedMs: 0 });

describe('createSandboxRunScript（worker_threads 真传输）', () => {
  it('run/done 协议：outcome 透传（tests 可见）', async () => {
    const run = createSandboxRunScript(fixtureUrl);
    const r = await run('echo', snapshot, noopSend);
    expect(r.timedOut).toBe(false);
    expect(r.error).toBeUndefined();
    expect(r.outcome.tests).toHaveLength(1);
    expect(r.outcome.tests[0].name).toBe('fixture test');
    expect(r.outcome.tests[0].passed).toBe(true);
  });

  it('outbox 桥：sendRequest 经宿主 send 桥接，sendRequests 回传（pm.sendRequest 唯一网络路径）', async () => {
    const seen: { url: string; method: string }[] = [];
    const send = async (p: { url: string; method: string }) => {
      seen.push({ url: p.url, method: p.method });
      return { url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 3 };
    };
    const run = createSandboxRunScript(fixtureUrl);
    const r = await run('OUTBOX', snapshot, send as never);
    expect(seen).toEqual([{ url: 'http://fixture.test/x', method: 'GET' }]);
    expect(r.outcome.sendRequests).toHaveLength(1);
    expect(r.outcome.sendRequests[0].url).toBe('http://fixture.test/x');
  });

  it('超时 kill（HANG 不回复 → timedOut 真 + error 如实；worker terminate 后重建可用）', async () => {
    // 预算 1500ms（生产口径 5s）：窗口须含 worker 冷启动（~200-300ms，合并跑高负载更久）——
    // 250ms 低负载碰巧绿=假绿（本用例合并跑实测暴露），预算必须负载鲁棒。
    const run = createSandboxRunScript(fixtureUrl, 1500);
    const r = await run('HANG', snapshot, noopSend);
    expect(r.timedOut).toBe(true);
    expect(r.error).toMatch(/timed out/);
    // kill 后同一沙箱函数重建 worker，后续执行恢复
    const r2 = await run('echo', snapshot, noopSend);
    expect(r2.timedOut).toBe(false);
    expect(r2.outcome.tests).toHaveLength(1);
  }, 10000);

  it('脚本错误承载（BOOM → error 如实，不假绿）', async () => {
    const run = createSandboxRunScript(fixtureUrl);
    const r = await run('BOOM', snapshot, noopSend);
    expect(r.error).toBe('fixture script error');
    expect(r.outcome.tests).toHaveLength(1); // done 仍带 outcome
  });

  it('worker 启动失败 fail-closed（不存在文件 → error 承载，不静默 no-op）', async () => {
    const run = createSandboxRunScript(new URL('./test-fixtures/absent-worker.ts', import.meta.url));
    const r = await run('echo', snapshot, noopSend);
    expect(r.error).toMatch(/sandbox worker (error|exited)/);
    expect(r.timedOut).toBe(false);
  }, 10000);
});
