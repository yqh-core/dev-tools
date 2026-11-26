/**
 * API-011/A1 收口测试：脚本持久化（store）、导入↔导出往返（collection）、
 * 请求失败时 test 脚本仍执行（runner，pm.response=null 语义）。
 */
import { describe, expect, it, vi } from 'vitest';
import { parseSaved, saveRequest } from './store';
import type { SavedRequest } from './store';
import { exportCollection, importCollection } from './collection';
import { type RunScriptFn, type RunnerResponse, runCollection } from './runner';
import type { ScriptSnapshot } from './script-runtime';

const baseReq = { method: 'GET' as const, url: 'https://api.example.test/x', headers: [], body: '' };

describe('store：scriptEvents 持久化与白名单', () => {
  it('保存与加载往返（更新路径也保留）', () => {
    const se = { prerequest: 'pm.environment.set("a","1");', test: 'pm.test("t", () => {});' };
    const r1 = saveRequest([], 'R1', baseReq, 1, 'id-1', undefined, 100, se);
    expect(r1.saved?.scriptEvents).toEqual(se);
    const r2 = saveRequest(r1.list, 'R1', baseReq, 2, 'id-2', undefined, 100, { test: 'only-test' });
    expect(r2.saved?.scriptEvents).toEqual({ test: 'only-test' });
    // 持久化往返
    const back = parseSaved(JSON.parse(JSON.stringify(r2.list)));
    expect(back[0].scriptEvents).toEqual({ test: 'only-test' });
  });

  it('白名单形状校验：非字符串字段与未知键被丢弃，不崩溃不伪造', () => {
    const dirty = { prerequest: 'ok', test: 42, extra: 'drop-me' } as unknown as { prerequest?: string; test?: string };
    const r = saveRequest([], 'R2', baseReq, 1, 'id-3', undefined, 100, dirty);
    expect(r.saved?.scriptEvents).toEqual({ prerequest: 'ok' });
  });

  it('无脚本时不写字段（不造空对象噪音）', () => {
    const r = saveRequest([], 'R3', baseReq, 1, 'id-4');
    expect(r.saved?.scriptEvents).toBeUndefined();
  });
});

describe('collection：Postman v2.1 脚本往返', () => {
  const doc = {
    info: { name: 'RT', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{
      name: 'Auth',
      event: [
        { listen: 'prerequest', script: { exec: ['pm.environment.set("t","1");'] } },
        { listen: 'test', script: { exec: ['pm.test("has t", () => pm.expect(pm.environment.get("t")).to.exist);'] } },
      ],
      request: { method: 'GET', url: 'https://api.example.test/auth' },
    }],
  };

  it('导入 → 导出 → 再导入：脚本文本逐字节一致（事件不丢不改写）', () => {
    const first = importCollection(JSON.stringify(doc));
    expect(first.requests[0].scriptEvents?.prerequest).toBe('pm.environment.set("t","1");');
    const savedForExport: SavedRequest[] = first.requests.map(r => ({
      id: 'x',
      name: r.name,
      request: r.request,
      createdAt: 1,
      updatedAt: 1,
      ...(r.scriptEvents ? { scriptEvents: r.scriptEvents } : {}),
    }));
    const exported = exportCollection(savedForExport);
    const round = importCollection(JSON.stringify(exported));
    expect(round.requests[0].scriptEvents).toEqual(first.requests[0].scriptEvents);
    // 导出形态是合法 v2.1 events
    const expObj = exported as { item: { event?: { listen: string; script: { exec: string[] } }[] }[] };
    expect(expObj.item[0].event?.map(e => e.listen).sort()).toEqual(['prerequest', 'test']);
  });
});

describe('runner：请求失败时 test 脚本仍执行（pm.response=null）', () => {
  function resp(): RunnerResponse {
    return { url: 'https://x.test/', status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 };
  }
  it('send 抛错 → test 脚本照跑、scriptTests 记录、passed=false', async () => {
    const send = vi.fn(async () => {
      throw new Error('network down');
    });

    let seenResponse: unknown = 'unset';
    const runScript: RunScriptFn = async (_code, snap: ScriptSnapshot) => {
      seenResponse = snap.response;
      return { outcome: { tests: [{ name: 'ran anyway', passed: true }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false };
    };
    const s = { id: 's1', name: 'net-fail', request: baseReq, createdAt: 1, updatedAt: 1, scriptEvents: { test: 'pm.test("ran anyway")' } } as SavedRequest;
    const sum = await runCollection([s], {}, send as never, { runScript });
    expect(sum.results[0].sent).toBe(false);
    expect(sum.results[0].scriptTests).toEqual([{ name: 'ran anyway', passed: true }]);
    expect(seenResponse).toBeNull(); // pm.response = null 语义
    expect(sum.scriptTestsTotal).toBe(1);
    expect(sum.scriptTestsPassed).toBe(1);
  });
});
