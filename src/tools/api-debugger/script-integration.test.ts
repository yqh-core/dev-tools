/**
 * API-011 集成语义单测：collection 事件提取 + runner 脚本生命周期 + 回归锁。
 * 判据：变量提取→下一请求复用（API-006↔API-011 闭环）、脚本失败必须使请求 fail、
 * 无 runScript 注入时与 API-010 行为完全一致（不许悄悄改变既有语义）。
 */
import { describe, expect, it, vi } from 'vitest';
import { importCollection } from './collection';
import { type RunScriptFn, type RunnerResponse, runCollection } from './runner';
import type { SavedRequest } from './store';
import type { ScriptOutcomeData, ScriptSnapshot } from './script-runtime';

function outcome(patch: Partial<ScriptOutcomeData> = {}): ScriptOutcomeData {
  return { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false, ...patch };
}

function saved(name: string, patch: Partial<SavedRequest> = {}): SavedRequest {
  return {
    id: `s-${name}`,
    name,
    request: { method: 'GET', url: `https://x.test/${name}`, headers: [], body: '' },
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

function resp(patch: Partial<RunnerResponse> = {}): RunnerResponse {
  return { url: 'https://x.test/', status: 200, statusText: 'OK', headers: {}, body: '{"token":"T1"}', elapsedMs: 50, ...patch };
}

describe('collection v2.1 事件提取', () => {
  const doc = JSON.stringify({
    item: [
      {
        name: 'Folder',
        event: [{ listen: 'prerequest', script: { exec: ['echo-folder'] } }],
        item: [
          {
            name: 'Req',
            event: [{ listen: 'test', script: { exec: ['pm.test("ok", function(){})'] } }],
            request: { method: 'GET', url: 'https://x.test/1' },
          },
          { name: 'NoEv', request: { method: 'GET', url: 'https://x.test/2' } },
        ],
      },
    ],
  });
  it('folder 继承在前 + request 自身在后，prerequest/test 各归各位', () => {
    const { requests } = importCollection(doc);
    const req = requests.find(r => r.name === 'Folder / Req');
    expect(req?.scriptEvents?.prerequest).toBe('echo-folder');
    expect(req?.scriptEvents?.test).toContain('pm.test');
  });
  it('folder 事件对子请求是继承不是噪音：NoEv 应带 inherited prerequest 且无 test；顶层无事件请求不带字段', () => {
    const { requests } = importCollection(doc);
    const noEv = requests.find(r => r.name === 'Folder / NoEv');
    expect(noEv?.scriptEvents?.prerequest).toBe('echo-folder'); // Postman 行为：folder 事件对子请求生效
    expect(noEv?.scriptEvents?.test).toBeUndefined(); // 没有 test 就不该出现 test 键
    const bare = importCollection(JSON.stringify({ item: [{ name: 'B', request: { method: 'GET', url: 'https://x.test/b' } }] })).requests[0];
    expect(bare.scriptEvents).toBeUndefined();
  });
});

describe('runner 脚本生命周期', () => {
  it('prerequest 写 environment → 下一请求 {{token}} 插值命中（提取→复用闭环）', async () => {
    const env: Record<string, string> = {};
    const send = vi.fn(async () => resp());
    const runScript: RunScriptFn = async (code, _snap, _s) => {
      // 模拟真实沙箱：脚本写的是 outcome.envWrites，由 runner 应用到分层
      if (code.includes('set-token')) {
        return { outcome: outcome({ envWrites: [{ layer: 'environment', name: 'token', value: 'T9' }] }), timedOut: false };
      }

      return { outcome: outcome(), timedOut: false };
    };
    const s1 = saved('login', { scriptEvents: { prerequest: 'set-token' } });
    const s2 = saved('me', { request: { method: 'GET', url: 'https://x.test/me?tk={{token}}', headers: [], body: '' } });
    const sum = await runCollection([s1, s2], env, send as never, { runScript });
    expect(sum.failed).toBe(0);
    expect(env.token).toBe('T9');
    const secondUrl = (send.mock.calls[1] as unknown as [{ url: string }])[0].url;
    expect(secondUrl).toContain('tk=T9');
  });

  it('pm.test 失败 → 该请求 passed=false 且计数进 summary', async () => {
    const send = vi.fn(async () => resp());
    const runScript: RunScriptFn = async () => ({ outcome: outcome({ tests: [{ name: 'bad', passed: false, error: 'expected 200 to equal 500' }] }), timedOut: false });
    const s = saved('a', { scriptEvents: { test: 'pm.test' } });
    const sum = await runCollection([s], {}, send as never, { runScript });
    expect(sum.results[0].passed).toBe(false);
    expect(sum.scriptTestsTotal).toBe(1);
    expect(sum.scriptTestsPassed).toBe(0);
  });

  it('脚本超时 → scriptError 记录、请求判失败（沙箱被杀不可伪装通过）', async () => {
    const send = vi.fn(async () => resp());
    const runScript: RunScriptFn = async () => ({ outcome: outcome(), error: 'killed', timedOut: true });
    const s = saved('a', { scriptEvents: { test: 'while(1){}' } });
    const sum = await runCollection([s], {}, send as never, { runScript });
    expect(sum.results[0].scriptError).toContain('timeout');
    expect(sum.results[0].passed).toBe(false);
    expect(sum.scriptErrors).toBe(1);
  });

  it('回归锁：未注入 runScript 时，带 scriptEvents 的请求行为与 API-010 完全一致', async () => {
    const send = vi.fn(async () => resp());
    const s = saved('a', { scriptEvents: { prerequest: 'x', test: 'y' } });
    const sum = await runCollection([s], {}, send as never, {});
    expect(sum.results[0].passed).toBe(true);
    expect(sum.results[0].scriptTests).toBeUndefined();
    expect(sum.scriptErrors).toBe(0);
  });

  it('request mutation（脚本改 header）作用于本次发送，不回写存储', async () => {
    const send = vi.fn(async () => resp());
    const runScript: RunScriptFn = async (_c, snap: ScriptSnapshot) => ({
      outcome: outcome({ requestMutations: { headers: snap.request.headers.concat({ name: 'X-Script', value: '1' }) } }),
      timedOut: false,
    });
    const s = saved('a', { scriptEvents: { prerequest: 'set header' } });
    await runCollection([s], {}, send as never, { runScript });
    const sent = (send.mock.calls[0] as unknown as [{ headers: { name: string }[] }])[0];
    expect(sent.headers.some(h => h.name === 'X-Script')).toBe(true);
    expect(s.request.headers.length).toBe(0);
  });

  it('取消语义：末行执行中 abort → summary.cancelled=true（单行集合可取消）', async () => {
    const send = vi.fn(async () => resp());
    const signal = { aborted: false };
    const runScript: RunScriptFn = async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      signal.aborted = true; // 模拟用户在脚本执行中点取消
      return { outcome: outcome(), timedOut: false };
    };
    const s = saved('cancel-row', { scriptEvents: { test: 'pm.test' } });
    const sum = await runCollection([s], {}, send as never, { runScript, signal });
    expect(sum.cancelled).toBe(true);
  });

  it('空响应守卫：send 返回 null → 干净错误，test 脚本仍跑（pm.response=null）', async () => {
    const send = vi.fn(async () => null as unknown as RunnerResponse);
    let sawNull = false;
    const runScript: RunScriptFn = async (_c, snap: ScriptSnapshot) => {
      sawNull = snap.response === null;
      return { outcome: outcome({ tests: [{ name: 'still ran', passed: true }] }), timedOut: false };
    };
    const s = saved('nullresp', { scriptEvents: { test: 'pm.test' } });
    const sum = await runCollection([s], {}, send as never, { runScript });
    expect(sum.results[0].error).toContain('no usable response');
    expect(sawNull).toBe(true);
    expect(sum.results[0].scriptTests?.[0].name).toBe('still ran');
  });

  it('snapshot.info.requestName 由 runner 注入真实请求名（A4 pm.info 契约）', async () => {
    const send = vi.fn(async () => resp());
    let seenName = '';
    const runScript: RunScriptFn = async (_c, snap: ScriptSnapshot) => {
      seenName = snap.info.requestName;
      return { outcome: outcome(), timedOut: false };
    };
    const s = saved('Login flow', { scriptEvents: { test: 'pm.test' } });
    await runCollection([s], {}, send as never, { runScript });
    expect(seenName).toBe('Login flow');
  });
});
