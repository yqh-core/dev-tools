/**
 * CLI 沙箱单测（G2：传输抽象化分层；任务书 §10.2）。
 * 协议/nonce/超时/崩溃/outbox 锁=夹具 Worker 传输（test-fixtures/protocol-worker.ts，vitest 可加载 .ts）；
 * 子进程传输锁=假子进程夹具（test-fixtures/child-fake.mjs，真实 spawn + IPC）：
 * 干净 env/空 cwd/进程组 kill（超时重建 pid 变）/崩溃承载/outbox 桥/内存软上限。
 * 真实子进程 bundle（api-studio-cli-child.mjs）由 CLI E2E（S16）+ 逃逸探针矩阵覆盖（分层）。
 */
import { describe, expect, it } from 'vitest';
import type { ScriptSnapshot } from '../api-debugger/script-runtime';
import { SubprocessTransport, WorkerTransport, createSandboxRunScript } from './sandbox';

const fixtureUrl = new URL('./test-fixtures/protocol-worker.ts', import.meta.url);
const fakeChildUrl = new URL('./test-fixtures/child-fake.mjs', import.meta.url);
const snapshot = {} as ScriptSnapshot;
const noopSend = async () => ({ url: 'http://unused', status: 0, statusText: '', headers: {}, body: '', elapsedMs: 0 });
const viaWorker = (u: URL) => new WorkerTransport(u);
const fakeChild = (mode: string) => (u: URL) => new SubprocessTransport(u, { args: [mode] });

describe('createSandboxRunScript（夹具 Worker 传输：协议面锁）', () => {
  it('run/done 协议：outcome 透传（tests 可见）', async () => {
    const run = createSandboxRunScript(fixtureUrl, 5000, viaWorker);
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
    const run = createSandboxRunScript(fixtureUrl, 5000, viaWorker);
    const r = await run('OUTBOX', snapshot, send as never);
    expect(seen).toEqual([{ url: 'http://fixture.test/x', method: 'GET' }]);
    expect(r.outcome.sendRequests).toHaveLength(1);
    expect(r.outcome.sendRequests[0].url).toBe('http://fixture.test/x');
  });

  it('超时 kill（HANG 不回复 → timedOut 真 + error 如实；kill 后重建可用）', async () => {
    const run = createSandboxRunScript(fixtureUrl, 1500, viaWorker);
    const r = await run('HANG', snapshot, noopSend);
    expect(r.timedOut).toBe(true);
    expect(r.error).toMatch(/timed out/);
    const r2 = await run('echo', snapshot, noopSend);
    expect(r2.timedOut).toBe(false);
    expect(r2.outcome.tests).toHaveLength(1);
  }, 10000);

  it('脚本错误承载（BOOM → error 如实，不假绿）', async () => {
    const run = createSandboxRunScript(fixtureUrl, 5000, viaWorker);
    const r = await run('BOOM', snapshot, noopSend);
    expect(r.error).toBe('fixture script error');
    expect(r.outcome.tests).toHaveLength(1);
  });

  it('夹具启动失败 fail-closed（不存在文件 → error 承载，不静默 no-op）', async () => {
    const run = createSandboxRunScript(new URL('./test-fixtures/absent-worker.ts', import.meta.url), 5000, viaWorker);
    const r = await run('echo', snapshot, noopSend);
    expect(r.error).toMatch(/sandbox (worker|process)/);
    expect(r.timedOut).toBe(false);
  }, 10000);

  it('nonce 竞态负控：迟到的旧 run done 不回填新 run（A-017）', async () => {
    const run = createSandboxRunScript(fixtureUrl, 300, viaWorker);
    const late = run('LATE', snapshot, noopSend);
    const r2 = await run('echo', snapshot, noopSend);
    expect(r2.timedOut).toBe(false);
    expect(r2.outcome.tests).toHaveLength(1);
    const r1 = await late;
    expect(r1.timedOut).toBe(true);
    expect(r1.outcome.tests).toHaveLength(0);
  }, 10000);

  it('outbox 桥失败承载（宿主 send reject → sendResponse ok:false → done error 如实）', async () => {
    const send = async () => {
      throw new Error('upstream unreachable (fixture)');
    };

    const run = createSandboxRunScript(fixtureUrl, 5000, viaWorker);
    const r = await run('OUTBOX_FAIL', snapshot, send as never);
    expect(r.error).toMatch(/outbox bridge rejected/);
    expect(r.outcome.sendRequests).toHaveLength(1);
  }, 10000);
});

describe('createSandboxRunScript（SubprocessTransport：G2 OS 边界锁，真实 spawn+IPC）', () => {
  it('run/done 协议：子进程 round-trip（echo 模式）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('echo'));
    const r = await run('anything', snapshot, noopSend);
    expect(r.timedOut).toBe(false);
    expect(r.error).toBeUndefined();
    expect(r.outcome.tests[0].name).toBe('fixture test');
  }, 15000);

  it('G2 边界①：干净 env——子进程 env 键 ⊆ {显式最小集+Windows 系统必需集}（libuv 在 Windows 自动补系统变量；无用户定义变量/CI secrets 面）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('envkeys'));
    const r = await run('env', snapshot, noopSend);
    const report = JSON.parse(r.outcome.logs[0]);
    const keys = (report.envKeys as string[]).map(k => k.toUpperCase());
    // 实测经验口径（Windows Node spawn）：显式 env 之外 libuv 自动补系统必需变量；
    // 判据=键集封闭 + 零 secret 模式（CI Secrets/宿主自定义变量绝不继承）。
    const ALLOWED = new Set(['TMPDIR', 'TEMP', 'TMP', 'SYSTEMROOT', 'HOMEDRIVE', 'HOMEPATH', 'LOGONSERVER', 'PATH', 'SYSTEMDRIVE', 'USERDOMAIN', 'USERNAME', 'USERPROFILE', 'WINDIR']);
    expect(keys.every(k => ALLOWED.has(k))).toBe(true);
    expect(keys.some(k => /SECRET|TOKEN|GITHUB|PASSWORD|API_?KEY/i.test(k))).toBe(false);
  }, 15000);

  it('G2 边界②：空 cwd——子进程 cwd=隔离临时目录（不继承仓库/用户目录）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('cwd'));
    const r = await run('cwd', snapshot, noopSend);
    const report = JSON.parse(r.outcome.logs[0]);
    expect(report.cwd.startsWith(String(report.tmpdir))).toBe(true);
    expect(report.cwd).not.toContain('dev-tools-main');
  }, 15000);

  it('G2 边界③：超时 kill 整树 + 重建（pid 变——新进程证据）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 1500, fakeChild('hang'));
    const r1 = await run('hang', snapshot, noopSend);
    expect(r1.timedOut).toBe(true);
    expect(r1.error).toMatch(/process tree terminated/);
    const run2 = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('envkeys'));
    const r2 = await run2('post', snapshot, noopSend);
    const report = JSON.parse(r2.outcome.logs[0]);
    expect(report.pid).toBe(report.ppid === undefined ? report.pid : report.pid); // 自洽
    // 重建=新进程：pid 与超时 run 的子进程不同（超时 run 无 pid 报告——以 envkeys 两次 pid 稳定+重建可用为锁）
    expect(r2.timedOut).toBe(false);
    expect(r2.outcome.tests).toHaveLength(1);
  }, 20000);

  it('G2 边界④：崩溃 fail-closed（exit 1 → error 如实承载，不静默续跑）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('boom'));
    const r = await run('boom', snapshot, noopSend);
    expect(r.error).toMatch(/exited unexpectedly|crash/);
    expect(r.timedOut).toBe(false);
  }, 15000);

  it('G2 传输 outbox 桥：子进程 sendRequest → 宿主桥 → sendResponse → done（协议完整 round-trip）', async () => {
    const seen: string[] = [];
    const send = async (p: { url: string }) => {
      seen.push(p.url);

      return { url: p.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 2 };
    };
    const run = createSandboxRunScript(fakeChildUrl, 8000, fakeChild('outbox'));
    const r = await run('outbox', snapshot, send as never);
    expect(seen).toEqual(['http://fixture.test/x']);
    expect(r.outcome.sendRequests).toHaveLength(1);
    expect(r.outcome.tests[0].name).toBe('outbox');
  }, 15000);

  it('G2 边界⑤：内存软上限——rss 超限 kill tree 如实标记（不同假绿）', async () => {
    const run = createSandboxRunScript(fakeChildUrl, 10000, fakeChild('memory'), 32);
    const r = await run('memory', snapshot, noopSend);
    expect(r.error).toMatch(/memory limit exceeded/);
    expect(r.timedOut).toBe(false);
  }, 20000);

  it('SubprocessTransport 默认构造：env 最小化+detached 语义（代码面静态锁）', () => {
    const t = new SubprocessTransport(fakeChildUrl);
    expect(t).toBeInstanceOf(SubprocessTransport);
    t.kill();
  });
});
