/**
 * API Studio CLI · 沙箱执行器（G2：OS 级隔离子进程传输；终审 P0-01 / yqh 裁定①）。
 *
 * 为什么改（审查实证）：worker_threads 与宿主同进程同账户——进程内 JS 沙箱对恶意代码不闭环
 * （构造器链混淆可达动态 import，Node Permission Model 实证同样无效）。G2 传输=每沙箱一个
 * **独立 Node 子进程**，默认 fail-closed：
 *   · 干净最小 env（TMPDIR/TEMP/TMP/SYSTEMROOT——不继承 CI Secrets/宿主环境，逃逸后也读不到 secret 面）
 *   · 空 cwd（mkdtemp 隔离工作目录，不继承仓库/用户目录）
 *   · 进程组 kill（POSIX detached 新进程组 + process.kill(-pid)；Windows taskkill /T /F）
 *   · 宿主内存软上限（rss 轮询；超限 kill tree 如实标记——V8 OOM 硬杀兜底）
 *   · 墙钟 5s/运行（整树 terminate；进行中的其他 run 如实标 timedOut）
 *   · 协议面不变：message 类型白名单 + nonce 防陈旧回填 + outbox 唯一网络路径（宿主桥）
 * 诚实登记（不正称闭合）：同账户 fs 读写面与直接网络面=构造器链逃逸后的残余（探针 P11 活体）；
 * 完整闭环需容器/VM/独立账户（基础设施决策）。CPU 配额=平台限制登记（墙钟口径不变）。
 *
 * 传输抽象（SandboxTransport）：协议面与传输面解耦——单测注入 Worker 传输（协议夹具，任务书 §10.2
 * 测试分层），产品默认子进程传输；CLI E2E/逃逸探针驱动真实子进程入口。
 */
/// <reference types="node" />
import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { type ScriptOutcomeData, type ScriptSnapshot, truncateResponseBody } from '../api-debugger/script-runtime';
import type { RunnerResponse } from '../api-debugger/runner';

/** 与浏览器 RunnerOptions.runScript 同签名（DI：单测注入 stub/夹具传输；E2E 走真实子进程）。 */
export type CliRunScriptFn = (code: string, snapshot: ScriptSnapshot, send: (payload: { url: string; method: string; headers: { name: string; value: string }[]; body: string }) => Promise<RunnerResponse>) => Promise<{ outcome: ScriptOutcomeData; error?: string; timedOut: boolean }>;

type SendBridge = (payload: { url: string; method: string; headers: { name: string; value: string }[]; body: string }) => Promise<RunnerResponse>;

/** G2 传输抽象：post/onMessage/kill 三件套，协议面与传输面解耦。 */
export interface SandboxTransport {
  post(message: unknown): void
  onMessage(handler: (d: any) => void): void
  /** 进程/线程死亡回调（崩溃承载 fail-closed）：实例校验防陈旧事件影响新传输。 */
  onDead(handler: () => void): void
  kill(): void
}

function emptyOutcome(): ScriptOutcomeData {
  return { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
}

const WIN = process.platform === 'win32';

/** 整树 kill：POSIX 进程组（-pid，detached 新组）；Windows taskkill /T /F。 */
function killTree(child: ChildProcess): void {
  const pid = child.pid;
  if (pid === undefined) {
    try {
      child.kill();
    }
    catch { /* 已退出 */ }
    return;
  }
  if (WIN) {
    try {
      spawn('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore' });
    }
    catch { /* 兜底 below */ }
  }
  else {
    try {
      process.kill(-pid, 'SIGKILL');
    }
    catch { /* 组已散 */ }
  }
  try {
    child.kill('SIGKILL');
  }
  catch { /* 已退出 */ }
}

/** 子进程 rss 软上限轮询（Windows tasklist / POSIX ps；解析失败=null=无意见，绝不静默判绿）。 */
function childMemoryKb(pid: number): Promise<number | null> {
  return new Promise((resolve) => {
    const cmd = WIN ? 'tasklist' : 'ps';
    const args = WIN ? ['/fi', `PID eq ${pid}`, '/fo', 'csv'] : ['-o', 'rss=', '-p', String(pid)];
    execFile(cmd, args, { timeout: 2000 }, (e, stdout) => {
      if (e) {
        resolve(null);
        return;
      }

      const m = WIN
        ? /"(\d[\d,]*)"\s*K/.exec(stdout.replace(/"/g, '')) || /(\d[\d,]*)\s*K/.exec(stdout)
        : /^\s*(\d+)\s*$/.exec(stdout.trim());
      if (!m) {
        resolve(null);

        return;
      }
      const kb = Number(m[1].replace(/,/g, ''));
      resolve(Number.isFinite(kb) ? kb : null);
    });
  });
}

/** G2 产品默认传输：隔离子进程（干净 env/空 cwd/进程组 kill/内存软上限）。 */
export class SubprocessTransport implements SandboxTransport {
  private child: ChildProcess;
  private deadHandlers: (() => void)[] = [];
  private dead = false;
  readonly pid: number | undefined;
  readonly cwd: string;

  constructor(url: URL, opts: { args?: string[]; memoryLimitMb?: number } = {}) {
    const empty = mkdtempSync(join(tmpdir(), 'api-studio-sandbox-'));
    this.cwd = empty;
    // 干净最小 env：不继承宿主 env（CI Secrets/用户自定义变量面闭合于边界）。
    // 实测经验口径（Windows Node spawn/libuv）：显式 env 之外自动补系统必需变量
    // （HOMEDRIVE/HOMEPATH/PATH/SYSTEMROOT/USERPROFILE 等——无用户定义变量、零 secret 模式）；
    // 判据锁见 sandbox.test（G2 边界①：键集封闭 + 零 secret 模式）。
    const env: Record<string, string> = { TMPDIR: empty, TEMP: empty, TMP: empty };
    if (process.env.SYSTEMROOT) {
      env.SYSTEMROOT = process.env.SYSTEMROOT;
    }
    this.child = spawn(process.execPath, [fileURLToPath(url), ...(opts.args ?? [])], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env,
      cwd: empty,
      detached: !WIN, // POSIX=新会话/进程组（组 kill）；Windows 由 taskkill /T 兜树
    });
    this.pid = this.child.pid;
    this.child.stderr?.resume(); // 诊断面不阻塞（崩溃文本由 exit 事件承载）
    this.child.stdout?.resume();
    this.child.on('exit', (code) => {
      if (this.dead) {
        return;
      }

      this.dead = true;
      if (code !== 0) {
        for (const h of this.deadHandlers) {
          h();
        }
      }
    });
  }

  post(message: unknown): void {
    try {
      this.child.send(message as Parameters<ChildProcess['send']>[0]);
    }
    catch { /* 通道已断：崩溃回调承载 */ }
  }

  onMessage(handler: (d: any) => void): void {
    this.child.on('message', handler);
  }

  onDead(handler: () => void): void {
    this.deadHandlers.push(handler);
  }

  kill(): void {
    if (this.dead) {
      return;
    }

    this.dead = true;
    killTree(this.child);
  }

  /** 内存软上限轮询句柄（由执行器启停）；超限返回 true=已 kill。 */
  async checkMemory(limitMb: number): Promise<boolean> {
    if (this.pid === undefined || this.dead) {
      return false;
    }

    const kb = await childMemoryKb(this.pid);
    if (kb !== null && kb > limitMb * 1024) {
      this.kill();
      return true;
    }
    return false;
  }
}

/** 单测/夹具传输：worker_threads（协议夹具 .ts 夹具由 vitest 加载；产品传输=子进程，见 SubprocessTransport）。 */
export class WorkerTransport implements SandboxTransport {
  private worker: Worker;
  constructor(url: URL) {
    this.worker = new Worker(url);
    this.worker.unref?.();
  }

  post(message: unknown): void {
    try {
      this.worker.postMessage(message);
    }
    catch { /* 通道已断：死亡回调承载 */ }
  }

  onMessage(handler: (d: any) => void): void {
    this.worker.on('message', handler);
  }

  onDead(handler: () => void): void {
    const wrapped = () => {
      if (this.worker !== undefined) {
        handler();
      }
    };
    this.worker.on('error', wrapped);
    this.worker.on('exit', (code) => {
      if (code !== 0) {
        wrapped();
      }
    });
  }

  kill(): void {
    try {
      this.worker.terminate();
    }
    catch { /* 已退出 */ }
  }
}

/**
 * 创建沙箱执行回调（G2：默认子进程传输；注入 makeTransport 可换夹具/Worker 传输）。
 * 单 run 协议：post run → 等 done/sendRequest 桥 → 单终态（done/超时/崩溃/内存超限只一种）。
 */
export function createSandboxRunScript(
  url: URL,
  timeoutMs = 5000,
  makeTransport: (u: URL) => SandboxTransport = u => new SubprocessTransport(u),
  memoryLimitMb = 512,
): CliRunScriptFn {
  let transport: SandboxTransport | null = null;
  let nonce = 0;
  const active = new Map<number, { resolve: (r: { outcome: ScriptOutcomeData; error?: string; timedOut: boolean }) => void; timer: ReturnType<typeof setTimeout>; send: SendBridge; memPoll: ReturnType<typeof setInterval> | null }>();

  function killTransport(): void {
    try {
      transport?.kill();
    }
    catch { /* 已死 */ }

    transport = null;
  }

  function ensureTransport(): SandboxTransport {
    if (!transport) {
      const t = makeTransport(url);
      const thisTransport = t;
      t.onMessage((d: any) => {
        if (transport !== thisTransport) {
          return;
        }

        // 陈旧事件（已 kill 重建的实例）忽略——A-017 同口径
        if (d?.type === 'sendRequest') {
          const run = active.get(d.nonce);
          if (!run) {
            return;
          }
          const spec = d.spec ?? {};
          void run.send({ url: String(spec.url), method: String(spec.method ?? 'GET'), headers: Array.isArray(spec.header) ? spec.header : [], body: String(spec.body ?? '') })
            .then((res) => {
              // 终审 P1-03 口径延续：宿主桥回填前响应体字节级截断（子进程面不接收无界响应体）
              const t = truncateResponseBody(res.body);
              thisTransport.post({
                type: 'sendResponse',
                reqId: d.reqId,
                ok: true,
                result: {
                  code: res.status,
                  status: String(res.status),
                  statusText: res.statusText,
                  headers: Object.entries(res.headers).map(([name, value]) => ({ name, value })),
                  body: t.body,
                  responseTime: res.elapsedMs,
                  truncated: t.truncated,
                },
              });
            })
            .catch(err => thisTransport.post({ type: 'sendResponse', reqId: d.reqId, ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 200) }));
          return;
        }
        if (d?.type === 'done') {
          const run = active.get(d.nonce);
          if (!run) {
            return;
          } // 陈旧 done（超时后迟到的旧实例消息）不回填——nonce 精确匹配+active 删除
          active.delete(d.nonce);
          clearTimeout(run.timer);
          if (run.memPoll) {
            clearInterval(run.memPoll);
          }
          run.resolve({ outcome: d.outcome ?? emptyOutcome(), error: d.error, timedOut: false });
        }
      });
      t.onDead(() => {
        if (transport !== thisTransport) {
          return;
        }

        for (const [n, run] of active) {
          clearTimeout(run.timer);
          if (run.memPoll) {
            clearInterval(run.memPoll);
          }
          active.delete(n);
          run.resolve({ outcome: emptyOutcome(), error: 'sandbox process exited unexpectedly (crash or killed) — run result not fabricated', timedOut: false });
        }
        transport = null; // 崩溃后重建（下一 run 新进程）
      });
      transport = t;
    }
    return transport;
  }

  return async (code, snapshot, send) => {
    const t = ensureTransport();
    const n = ++nonce;
    return new Promise<{ outcome: ScriptOutcomeData; error?: string; timedOut: boolean }>((resolve) => {
      let memPoll: ReturnType<typeof setInterval> | null = null;
      const finish = (r: { outcome: ScriptOutcomeData; error?: string; timedOut: boolean }) => {
        if (memPoll) {
          clearInterval(memPoll);
        }

        if (active.has(n)) {
          active.delete(n);
        }
        resolve(r);
      };
      const timer = setTimeout(() => {
        if (active.has(n)) {
          killTransport(); // 超时 kill 整个子进程树（无法只杀一段脚本）；进行中的其他 run 一并如实终止
          finish({ outcome: emptyOutcome(), error: `script timed out after ${timeoutMs} ms and was killed (sandbox process tree terminated)`, timedOut: true });
        }
      }, timeoutMs);
      // G2 内存软上限：rss 轮询（外部观察，脚本事件循环阻塞不影响宿主判据）；超限 kill tree 如实标记
      memPoll = setInterval(async () => {
        if (!active.has(n)) {
          if (memPoll) {
            clearInterval(memPoll);
          }
          return;
        }

        if (t instanceof SubprocessTransport && await t.checkMemory(memoryLimitMb)) {
          finish({ outcome: emptyOutcome(), error: `sandbox memory limit exceeded (${memoryLimitMb} MB rss) — process tree killed; result not fabricated`, timedOut: false });
        }
      }, 500);
      active.set(n, { resolve: finish as never, timer, send: send as SendBridge, memPoll });
      t.post({ type: 'run', nonce: n, code, snapshot });
    });
  };
}
