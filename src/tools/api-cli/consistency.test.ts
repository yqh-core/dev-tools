/**
 * C-004 浏览器/CLI 一致性（任务书 §8 C3）：同一 fixture 经浏览器路径（runCollection 直接）
 * 与 CLI 路径（executeRun→同 runCollection）双跑，summary 语义字段逐键一致。
 * 时间字段（durationMs/startedAt/finishedAt/avgResponseMs）天然不等——排除后逐键深相等。
 * 价值：抓 CLI args→RunnerOptions 映射漂移（如 iterations/dataFile/stop 策略错位）。
 */
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCollection } from '../api-debugger/runner';
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

const fixtureSaved = (): SavedRequest[] => [
  { id: 'c1', name: 'C1', request: { method: 'GET', url: '{{baseUrl}}/a?email={{email}}', headers: [], body: '' }, createdAt: 1, updatedAt: 1, scriptEvents: { test: 'pm.test("c1", () => {});' } },
  { id: 'c2', name: 'C2', request: { method: 'GET', url: '{{baseUrl}}/b', headers: [], body: '' }, createdAt: 1, updatedAt: 1 },
];

const mkSend = () => async (p: { url: string }) => ({ url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 });
const mkScript = () => vi.fn(async () => ({ outcome: { tests: [{ name: 'c1', passed: true }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false }));

// 深度规范化：递归排除天然不等/非语义字段——
//   id（各路径存储层自生成：浏览器 fixture 'r-A'/'c1' vs CLI 'cli-N'，非执行语义）
//   ranAt（毫秒时间戳，双跑先后天然不等）
// 保留 elapsedMs（stub 固定口径下相等=耗时语义一致证明）。
const stripTiming = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(stripTiming);
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // 排除：id（存储标识各路径自生成）/ ranAt（毫秒时间戳）/ 顶层运行时间四字段（双跑先后天然不等）
      if (k === 'id' || k === 'ranAt' || k === 'totalDurationMs' || k === 'startedAt' || k === 'finishedAt' || k === 'avgResponseMs') continue;
      out[k] = stripTiming(v);
    }
    return out;
  }
  return obj;
};
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
      command: 'run', collectionPath: colPath, environmentFile: envPath, iterationDataFile: csvPath, iterations: 2,
      requestTimeoutMs: 30000, delayMs: 0, stopOnError: true, stopOnFailure: false, reporters: ['cli'], ci: false,
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
});
