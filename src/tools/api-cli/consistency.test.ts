/**
 * C-004 浏览器/CLI 一致性（任务书 §8 C3）：同一 fixture 经浏览器路径（runCollection 直接）
 * 与 CLI 路径（executeRun→同 runCollection）双跑，summary 语义字段逐键一致。
 * 时间字段（durationMs/startedAt/finishedAt/avgResponseMs）天然不等——排除后逐键深相等。
 * 价值：抓 CLI args→RunnerOptions 映射漂移（如 iterations/dataFile/stop 策略错位）。
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCollection } from '../api-debugger/runner';
import { type ScriptSnapshot, createPmAPI } from '../api-debugger/script-runtime';
import type { SavedRequest } from '../api-debugger/store';
import { executeRun } from './run';
import type { CliArgs } from './args';

const COLLECTION = JSON.stringify({
  info: { name: 'Consistency Fixture', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    { name: 'C1', request: { method: 'GET', url: '{{baseUrl}}/a?email={{email}}' }, event: [{ listen: 'test', script: { exec: ['pm.test("c1", () => {});'] } }] },
    { name: 'C2', request: { method: 'GET', url: '{{baseUrl}}/b' } },
  ],
});
const CSV = 'email\na@x.test\nb@x.test\n';

function fixtureSaved(): SavedRequest[] {
  return [
    { id: 'c1', name: 'C1', request: { method: 'GET', url: '{{baseUrl}}/a?email={{email}}', headers: [], body: '' }, createdAt: 1, updatedAt: 1, scriptEvents: { test: 'pm.test("c1", () => {});' } },
    { id: 'c2', name: 'C2', request: { method: 'GET', url: '{{baseUrl}}/b', headers: [], body: '' }, createdAt: 1, updatedAt: 1 },
  ];
}

const mkSend = () => async (p: { url: string }) => ({ url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 });
const mkScript = () => vi.fn(async () => ({ outcome: { tests: [{ name: 'c1', passed: true }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false }));

// 深度规范化：递归排除天然不等/非语义字段——
//   id（各路径存储层自生成：浏览器 fixture 'r-A'/'c1' vs CLI 'cli-N'，非执行语义）
//   ranAt（毫秒时间戳，双跑先后天然不等）
// 保留 elapsedMs（stub 固定口径下相等=耗时语义一致证明）。
function stripTiming(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripTiming);
  }

  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // 排除：id（存储标识各路径自生成）/ ranAt（毫秒时间戳）/ 顶层运行时间四字段（双跑先后天然不等）
      if (k === 'id' || k === 'ranAt' || k === 'totalDurationMs' || k === 'startedAt' || k === 'finishedAt' || k === 'avgResponseMs') {
        continue;
      }

      out[k] = stripTiming(v);
    }
    return out;
  }
  return obj;
}
const norm = (s: unknown) => stripTiming(s);

describe('C-004 浏览器/CLI 双跑一致性', () => {
  it('同 fixture：CLI executeRun 与浏览器 runCollection summary 语义字段逐键一致', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-consistency-'));
    const colPath = join(dir, 'c.json');
    const csvPath = join(dir, 'd.csv');
    const envPath = join(dir, 'env.json');
    writeFileSync(colPath, COLLECTION);
    writeFileSync(csvPath, CSV);
    writeFileSync(envPath, JSON.stringify({ name: 'fixture', values: [{ key: 'baseUrl', value: 'https://fixture.test', enabled: true }] }));

    // 浏览器路径（直接引擎调用）
    const browserSum = await runCollection(
      fixtureSaved(),
      { baseUrl: 'https://fixture.test' },
      mkSend() as never,
      { runScript: mkScript() as never, dataFile: { columns: ['email'], rows: [{ email: 'a@x.test' }, { email: 'b@x.test' }] }, dataFileType: 'csv', iterations: 2 },
    );

    // CLI 路径（args → executeRun → 同引擎；注入同口径 stub）
    const args: CliArgs = {
      command: 'run',
      collectionPath: colPath,
      environmentFile: envPath,
      iterationDataFile: csvPath,
      iterations: 2,
      requestTimeoutMs: 30000,
      delayMs: 0,
      stopOnError: true,
      stopOnFailure: false,
      reporters: ['cli'],
      ci: false,
    };
    const cli = await executeRun(args, { runScript: mkScript() as never, send: mkSend() as never });

    expect(cli.exit).toBe(0);
    // 语义字段逐键一致（排除天然不等的时间字段）
    expect(norm(cli.summary as unknown as Record<string, unknown>)).toEqual(norm(browserSum as unknown as Record<string, unknown>));
    // 关键判据抽查（双路径同值）
    expect(cli.summary?.total).toBe(browserSum.total); // 2 请求 × 2 轮 = 4
    expect(cli.summary?.sent).toBe(4);
    expect(cli.summary?.iterationCount).toBe(2);
    expect(cli.summary?.scriptTestsTotal).toBe(2); // C1 每轮一次 pm.test
    expect(cli.summary?.dataFile).toEqual(browserSum.dataFile);
  }, 30000);

  it('终审 P1-01 五层同名矩阵：runtime resolveVariable 与 runner 请求插值同序（iterationData > environment > collection > globals）', async () => {
    // runtime 侧（createPmAPI：local > iterationData > environment > collection > globals）
    const s: ScriptSnapshot = {
      request: { method: 'GET', url: 'https://x/', headers: [], body: '' },
      response: null,
      globals: { shared: 'GLOB' },
      collection: { shared: 'COLL' },
      environment: { shared: 'ENV' },
      iterationData: { shared: 'DATA' },
      local: {},
      info: { event: 'test', iteration: 1, counter: 1, requestName: 'matrix' },
    };
    const outcome = { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
    const { pm } = createPmAPI(s, { outcome, console: () => {}, sendRequest: async () => ({ code: 200, status: 'OK' }) });
    expect(pm.variables.get('shared')).toBe('DATA');
    pm.variables.set('shared', 'LOCAL');
    expect(pm.variables.get('shared')).toBe('LOCAL');
    // runner 插值侧（mergedForSubstitution 同序；无 local 写入时 dataRow 胜 environment）
    const saved: SavedRequest = { id: 'm', name: 'M', request: { method: 'GET', url: 'https://x/?v={{shared}}', headers: [], body: '' }, createdAt: 1, updatedAt: 1 };
    const sent: string[] = [];
    const send = async (p: { url: string }) => {
      sent.push(p.url);

      return { url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 };
    };
    await runCollection([saved], { shared: 'ENV' }, send as never, {
      runScript: vi.fn(async () => ({ outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false })) as never,
      variableLayers: { globals: { shared: 'GLOB' }, collection: { shared: 'COLL' } },
      dataFile: { columns: ['shared'], rows: [{ shared: 'DATA' }] },
      dataFileType: 'csv',
    });
    expect(sent[0]).toContain('v=DATA'); // 与 runtime 侧同 winner
  }, 30000);
});
