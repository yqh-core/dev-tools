/**
 * CLI run 编排单测（加载/目录合并/环境/数据文件/stub 执行/报告落盘/写失败/退出码）。
 * 顺序锁：B 阶段暴露过 store 头插致逆序执行缺陷——此处锁导入顺序=执行顺序。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliRunError, executeRun, loadCollectionRequests, loadEnvironment, loadIterationData } from './run';
import type { CliArgs } from './args';

const COLLECTION = JSON.stringify({
  info: { name: 'CLI Fixture', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    { name: 'R1', request: { method: 'GET', url: '{{baseUrl}}/a?email={{email}}' } },
    { name: 'R2', request: { method: 'POST', url: '{{baseUrl}}/b' }, event: [{ listen: 'test', script: { exec: ['pm.test("t", () => {});'] } }] },
  ],
});
const ENV_FILE = JSON.stringify({ name: 'cli-test', values: [{ key: 'baseUrl', value: 'https://upstream.example.test', enabled: true }, { key: 'token', value: 'T-CLI', enabled: true, secret: true }] });
const DATA_CSV = 'email,expectedRole\nalice@example.test,admin\nbob@example.test,reader\n';

function tmpDir(): string { return mkdtempSync(join(tmpdir(), 'api-cli-run-')); }
function baseArgs(patch: Partial<CliArgs> = {}): CliArgs {
  return { command: 'run', collectionPath: '', requestTimeoutMs: 30000, delayMs: 0, stopOnError: true, stopOnFailure: false, reporters: ['cli'], ci: false, ...patch };
}
const stubSend = async (p: { url: string }) => ({ url: p.url, status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"id":1}', elapsedMs: 2 });
const passingScript = async () => ({ outcome: { tests: [{ name: 't', passed: true }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false });
const failingScript = async () => ({ outcome: { tests: [{ name: 't', passed: false, error: 'boom' }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false });

describe('loadCollectionRequests', () => {
  it('文件：请求顺序=文档顺序（顺序锁），scriptEvents 保留，id 确定性', () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    const { requests, label } = loadCollectionRequests(join(dir, 'c.json'));
    expect(requests.map(r => r.name)).toEqual(['R1', 'R2']);
    expect(requests[0].id).toBe('cli-1');
    expect(requests[1].scriptEvents?.test).toContain('pm.test');
    expect(label).toBe('c');
  });

  it('目录：按文件名排序合并多集合', () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'b.json'), JSON.stringify({ item: [{ name: 'B1', request: { method: 'GET', url: 'https://x/b' } }] }));
    writeFileSync(join(dir, 'a.json'), JSON.stringify({ item: [{ name: 'A1', request: { method: 'GET', url: 'https://x/a' } }] }));
    const { requests, label } = loadCollectionRequests(dir);
    expect(requests.map(r => r.name)).toEqual(['A1', 'B1']);
    expect(label).toContain('(2 file(s))');
  });

  it.each([
    ['空目录', () => tmpDir()],
    ['路径缺失', () => join(tmpDir(), 'nope.json')],
  ])('fail-closed：%s', (_label, pathFn) => {
    const p = pathFn();
    // 同步 throw 函数：不能用 .rejects（那是 promise 专用——写法纪律）
    expect(() => loadCollectionRequests(p)).toThrow(CliRunError);
    try {
      loadCollectionRequests(p);
      expect.unreachable('should have thrown');
    }
    catch (e) {
      expect((e as CliRunError).kind).toBe('load');
    }
  });
});

describe('loadEnvironment / loadIterationData', () => {
  it('环境文件 Postman 格式 → env map（含 secret 值照常参与替换）', () => {
    const dir = tmpDir();
    const p = join(dir, 'env.json');
    writeFileSync(p, ENV_FILE);
    const r = loadEnvironment(p);
    expect(r.env).toEqual({ baseUrl: 'https://upstream.example.test', token: 'T-CLI' });
    expect(r.name).toBe('cli-test');
  });

  it('环境文件非法 JSON → CliRunError load', () => {
    const dir = tmpDir();
    const p = join(dir, 'env.json');
    writeFileSync(p, '{bad');
    expect(() => loadEnvironment(p)).toThrow(CliRunError);
  });

  it('数据文件 CSV 严格解析 → DataFile + type', () => {
    const dir = tmpDir();
    const p = join(dir, 'd.csv');
    writeFileSync(p, DATA_CSV);
    const r = loadIterationData(p);
    expect(r?.dataFile.rows).toHaveLength(2);
    expect(r?.dataFileType).toBe('csv');
  });

  it('数据文件重复列 → CliRunError load（前置 fail-closed，不进运行）', () => {
    const dir = tmpDir();
    const p = join(dir, 'bad.csv');
    writeFileSync(p, 'a,a\n1,2\n');
    expect(() => loadIterationData(p)).toThrow(CliRunError);
  });
});

describe('executeRun（stub send/runScript）', () => {
  // 结构类型收窄（vi.spyOn 重载的 ReturnType 与 MockInstance 泛型不匹配——TS2322 根因）
  type WriteSpy = { mock: { calls: unknown[][] }; mockRestore: () => void };
  let stdoutSpy: WriteSpy;
  let stderrSpy: WriteSpy;
  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('全过：exit 0 + stdout 文本报告 + JSON 报告落盘可独立解析 + 数据文件/轮数进入摘要', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    writeFileSync(join(dir, 'env.json'), ENV_FILE);
    writeFileSync(join(dir, 'd.csv'), DATA_CSV);
    const reportPath = join(dir, 'report.json');
    const r = await executeRun(baseArgs({ collectionPath: join(dir, 'c.json'), environmentFile: join(dir, 'env.json'), iterationDataFile: join(dir, 'd.csv'), iterations: 2, reporters: ['cli', 'json'], reportJsonPath: reportPath }), { runScript: passingScript as never, send: stubSend as never });
    expect(r.exit).toBe(0);
    expect(r.label).toBe('ALL_PASSED');
    expect(r.summary?.iterationCount).toBe(2);
    expect(r.summary?.dataFile).toEqual({ type: 'csv', rows: 2, columnsCount: 2 });
    const stdoutText = stdoutSpy.mock.calls.map(c => String(c[0])).join('');
    expect(stdoutText).toContain('ALL PASSED');
    const written = JSON.parse((await import('node:fs')).readFileSync(reportPath, 'utf8'));
    expect(written.version).toBe(1);
    expect(written.security.secretsExcluded).toBe(true);
    expect(written.meta.apiStudioVersion).toBe('2026.01.22-v2');
  }, 20000);

  it('失败：failing pm.test → exit 1（断言失败非零码，C5）', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    const r = await executeRun(baseArgs({ collectionPath: join(dir, 'c.json') }), { runScript: failingScript as never, send: stubSend as never });
    expect(r.exit).toBe(1);
    expect(r.label).toBe('FAILURES_PRESENT');
  }, 20000);

  it('报告写入失败：exit 3 + reportWriteError 可识别（运行本身通过）', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    const blocker = join(dir, 'blocker-file');
    writeFileSync(blocker, 'x'); // 文件当目录组件 → writeFileSync 必失败
    const r = await executeRun(baseArgs({ collectionPath: join(dir, 'c.json'), reporters: ['json'], reportJsonPath: join(blocker, 'r.json') }), { runScript: passingScript as never, send: stubSend as never });
    expect(r.exit).toBe(3);
    expect(r.label).toBe('REPORT_WRITE_FAILED');
    expect(r.reportWriteError).toContain('blocker-file');
  }, 20000);

  it('变量替换端到端：env baseUrl + iterationData email 替换后到达 send（stub 记录替换后 URL）', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    writeFileSync(join(dir, 'env.json'), ENV_FILE);
    writeFileSync(join(dir, 'd.csv'), DATA_CSV);
    const seenUrls: string[] = [];
    const send = async (p: { url: string }) => { seenUrls.push(p.url); return { url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 1 }; };
    await executeRun(baseArgs({ collectionPath: join(dir, 'c.json'), environmentFile: join(dir, 'env.json'), iterationDataFile: join(dir, 'd.csv') }), { runScript: passingScript as never, send: send as never });
    expect(seenUrls).toEqual(['https://upstream.example.test/a?email=alice@example.test', 'https://upstream.example.test/b', 'https://upstream.example.test/a?email=bob@example.test', 'https://upstream.example.test/b']);
  }, 20000);

  it('C-006 报告父目录自动创建（嵌套路径写入成功，无需 workflow 预 mkdir；终审 07 指令）', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    // baseUrl+email 齐夹具（缺变量→请求不发送→exit 1 假象，首轮失败根因同 E3 锁）
    writeFileSync(join(dir, 'env.json'), JSON.stringify({ name: 'cli-mkdir', values: [
      { key: 'baseUrl', value: 'https://upstream.example.test', enabled: true },
      { key: 'email', value: 'alice@example.test', enabled: true },
    ] }));
    const nested = join(dir, 'fresh-reports', 'sub', 'run.json');
    const r = await executeRun(baseArgs({ collectionPath: join(dir, 'c.json'), environmentFile: join(dir, 'env.json'), reporters: ['json'], reportJsonPath: nested }), { runScript: passingScript as never, send: stubSend as never });
    expect(r.exit).toBe(0);
    expect(readFileSync(nested, 'utf8').length).toBeGreaterThan(0);
  }, 20000);

  it('前置失败：集合缺失 → CliRunError load（main 译为退出码 2）', async () => {
    await expect(executeRun(baseArgs({ collectionPath: join(tmpDir(), 'absent.json') }), { runScript: passingScript as never, send: stubSend as never })).rejects.toBeInstanceOf(CliRunError);
  });

  it('E3 secret 值级 redact 端到端（env 文件 secret 标记 → stub 脚本失败消息含值 → 落盘 JSON 无值有替换标记）', async () => {
    const dir = tmpDir();
    writeFileSync(join(dir, 'c.json'), COLLECTION);
    // baseUrl/email 必须齐：缺变量 → 请求不发送 → runScript 不触发 → 夹具空洞（首轮失败根因）。
    writeFileSync(join(dir, 'env.json'), JSON.stringify({ name: 'cli-test', values: [
      { key: 'baseUrl', value: 'https://upstream.example.test', enabled: true },
      { key: 'email', value: 'alice@example.test', enabled: true },
      { key: 'apiToken', value: 'SK-CLI-PLANT-9f3', enabled: true, secret: true },
    ] }));
    const failingScript = async () => ({ outcome: { tests: [{ name: 't', passed: false, error: 'expected 200 got 500; token=SK-CLI-PLANT-9f3' }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, timedOut: false });
    const reportPath = join(dir, 'report.json');
    const r = await executeRun(baseArgs({ collectionPath: join(dir, 'c.json'), environmentFile: join(dir, 'env.json'), reporters: ['json'], reportJsonPath: reportPath }), { runScript: failingScript as never, send: stubSend as never });
    expect(r.exit).toBe(1);
    const written = JSON.parse(readFileSync(reportPath, 'utf8'));
    expect(JSON.stringify(written)).not.toContain('SK-CLI-PLANT-9f3');
    expect(JSON.stringify(written)).toContain('[REDACTED-Secret]');
  }, 20000);
});
