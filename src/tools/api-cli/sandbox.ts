/**
 * API Studio CLI · 脚本沙箱（worker_threads 传输层；任务书 §5「CLI 沙箱独立设计」）。
 *
 * 与浏览器侧 script-sandbox.ts 同契约（RunScriptFn）、同协议（run/done/sendRequest/sendResponse）、
 * 同超时杀（5s terminate 整个 worker，进行中其他 run 如实标 timedOut）、同 nonce 防陈旧回填；
 * 共享同一份 script-runtime（pm 语义与守卫）——核心执行语义只有一份（§5）。
 * 传输层独立：浏览器=专用 module Worker；CLI=worker_threads（Node 侧有真实 fetch，
 * 守卫中和即生效——逃逸负控在 CLI E2E 用真实 worker 证明）。
 */
/// <reference types="node" />
import { Worker } from 'node:worker_threads';
import type { ScriptSnapshot, ScriptOutcomeData } from '../api-debugger/script-runtime';
import type { RunnerResponse } from '../api-debugger/runner';

/** 与浏览器 RunnerOptions.runScript 同签名（DI：单测可注入 stub，E2E 走真实 worker）。 */
export type CliRunScriptFn = (code: string, snapshot: ScriptSnapshot, send: (payload: { url: string; method: string; headers: { name: string; value: string }[]; body: string }) => Promise<RunnerResponse>) => Promise<{ outcome: ScriptOutcomeData; error?: string; timedOut: boolean }>;

type SendBridge = (payload: { url: string; method: string; headers: { name: string; value: string }[]; body: string }) => Promise<RunnerResponse>;

function emptyOutcome(): ScriptOutcomeData {
  return { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
}

/** 创建沙箱执行回调。workerUrl 缺省由 main 入口按产物布局注入（单测注入 stub，本函数不猜路径）。 */
export function createSandboxRunScript(workerUrl: URL, timeoutMs = 5000): CliRunScriptFn {
  let worker: Worker | null = null;
  let nonce = 0;
  const active = new Map<number, { resolve: (r: { outcome: ScriptOutcomeData; error?: string; timedOut: boolean }) => void; timer: ReturnType<typeof setTimeout>; send: SendBridge }>();

  function killWorker(): void {
    if (worker) { try { worker.terminate() } catch { /* 已退出 */ } worker = null; }
    for (const [, run] of active) { clearTimeout(run.timer); run.resolve({ outcome: emptyOutcome(), error: 'sandbox terminated', timedOut: true }); }
    active.clear();
  }

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(workerUrl, {});
      worker.on('message', (d: any) => {
        if (d?.type === 'sendRequest') {
          const run = active.get(d.nonce);
          if (!run) return;
          const spec = d.spec ?? {};
          void run.send({ url: String(spec.url), method: String(spec.method ?? 'GET'), headers: Array.isArray(spec.header) ? spec.header : [], body: String(spec.body ?? '') })
            .then(res => { worker?.postMessage({ type: 'sendResponse', reqId: d.reqId, ok: true, result: { code: res.status, status: res.statusText, responseTime: res.elapsedMs } }); })
            .catch(err => worker?.postMessage({ type: 'sendResponse', reqId: d.reqId, ok: false, error: String(err instanceof Error ? err.message : err).slice(0, 200) }));
          return;
        }
        if (d?.type === 'done') {
          const run = active.get(d.nonce);
          if (!run) return;
          active.delete(d.nonce);
          clearTimeout(run.timer);
          run.resolve({ outcome: d.outcome ?? emptyOutcome(), error: d.error, timedOut: false });
        }
      });
      // worker 启动失败/运行期崩溃：如实承载，不静默 no-op（与浏览器沙箱同口径）。
      // 实例校验：terminate 后旧 worker 的迟来 exit/error 事件必须忽略——否则会假 resolve
      // 新 worker 的 active 项（竞态：超时 kill 与后续 run 之间，A5 级）。
      const thisWorker = worker;
      const onDead = (err?: Error) => {
        if (worker !== thisWorker) return; // 陈旧事件（已 terminate 并重建）
        const message = err ? `sandbox worker error: ${err.message}` : 'sandbox worker exited';
        for (const [, run] of active) { clearTimeout(run.timer); run.resolve({ outcome: emptyOutcome(), error: message, timedOut: false }); }
        active.clear();
        worker = null;
      };
      thisWorker.on('error', onDead);
      thisWorker.on('exit', (code) => { if (code !== 0) onDead(); });
    }
    return worker;
  }

  return async (code, snapshot, send) => {
    const w = ensureWorker();
    const n = ++nonce;
    return new Promise<{ outcome: ScriptOutcomeData; error?: string; timedOut: boolean }>(resolve => {
      active.set(n, {
        resolve,
        send,
        timer: setTimeout(() => {
          if (active.has(n)) {
            active.delete(n);
            resolve({ outcome: emptyOutcome(), error: `script timed out after ${timeoutMs} ms and was killed`, timedOut: true });
            killWorker(); // Worker API 无法只杀一段代码；进行中的其他 run 一并如实终止
          }
        }, timeoutMs),
      });
      w.postMessage({ type: 'run', nonce: n, code, snapshot });
    });
  };
}
