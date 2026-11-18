/**
 * API-011 · 主线程侧脚本沙箱客户端。
 * 职责：起一个 module Worker 跑 script-worker.ts；每次执行带 nonce 防陈旧回填；
 * 超时（默认 5s）直接 terminate 重建——这就是审查裁定要的"隔离沙箱+超时+资源限制"。
 * pm.sendRequest 的桥接到宿主注入的 send（走既有 apiproxy allowlist，凭据不回给脚本）。
 */
import type { ScriptSnapshot, ScriptOutcomeData } from './script-runtime';
import { truncateResponseBody } from './script-runtime';
import type { RunnerResponse } from './runner';

export interface SandboxRunResult { outcome: ScriptOutcomeData; error?: string; timedOut: boolean }

type SendBridge = (payload: { url: string; method: string; headers: { name: string; value: string }[]; body: string }) => Promise<RunnerResponse>;

let worker: Worker | null = null;
let nonce = 0;
const active = new Map<number, {
  resolve: (r: SandboxRunResult) => void
  timer: ReturnType<typeof setTimeout>
  send: SendBridge
}>();

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./script-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d.type === 'sendRequest') {
        const run = active.get(d.nonce);
        if (!run) { return; }
        const spec = d.spec as { url: string; method?: string; header?: { name: string; value: string }[]; body?: string };
        void run.send({ url: String(spec.url), method: String(spec.method ?? 'GET'), headers: spec.header ?? [], body: String(spec.body ?? '') })
          .then(res => {
            // 终审 P1-03/P1-04：桥回填完整响应面；响应体字节级截断（脚本面不接收无界响应体）
            const t = truncateResponseBody(res.body);
            worker?.postMessage({ type: 'sendResponse', reqId: d.reqId, ok: true, result: {
              code: res.status, status: String(res.status), statusText: res.statusText,
              headers: Object.entries(res.headers).map(([name, value]) => ({ name, value })),
              body: t.body, responseTime: res.elapsedMs, truncated: t.truncated,
            } });
          })
          .catch(err => worker?.postMessage({ type: 'sendResponse', reqId: d.reqId, ok: false, error: String(err).slice(0, 200) }));
        return;
      }
      if (d.type === 'done') {
        const run = active.get(d.nonce);
        if (!run) { return; }
        active.delete(d.nonce);
        clearTimeout(run.timer);
        run.resolve({ outcome: d.outcome, error: d.error, timedOut: false });
      }
    };
  }
  return worker;
}

function killWorker() {
  if (worker) { worker.terminate(); worker = null; }
  for (const [n, run] of active) { clearTimeout(run.timer); run.resolve({ outcome: emptyOutcome(), error: 'sandbox terminated', timedOut: true }); active.delete(n); }
}

function emptyOutcome(): ScriptOutcomeData {
  return { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
}

export function runScriptIsolated(
  code: string,
  snapshot: ScriptSnapshot,
  send: SendBridge,
  timeoutMs = 5000,
): Promise<SandboxRunResult> {
  return new Promise(resolve => {
    const w = ensureWorker();
    const n = ++nonce;
    active.set(n, {
      resolve,
      send,
      timer: setTimeout(() => {
        if (active.has(n)) {
          active.delete(n);
          resolve({ outcome: emptyOutcome(), error: `script timed out after ${timeoutMs} ms and was killed`, timedOut: true });
          // 杀整个 worker（Worker API 无法只杀一段代码）；进行中的其他 run 也终止并如实标记。
          killWorker();
        }
      }, timeoutMs),
    });
    w.postMessage({ type: 'run', nonce: n, code, snapshot });
  });
}

/** 测试/清理钩子：终止当前 worker（单测或页面卸载用）。 */
export function resetSandbox() { killWorker(); }
