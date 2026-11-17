/// <reference lib="webworker" />
/**
 * API-011 · 脚本执行沙箱 Worker。
 * 用户脚本只在这里跑：Worker 上下文没有 DOM、没有 window、没有页面凭据引用；
 * 超时与资源控制由主线程（script-sandbox.ts）terminate 负责；
 * pm.sendRequest 不在 Worker 直发网络，而是消息往返主线程的 apiproxy（权限控制在宿主）。
 */
import { createPmAPI, installSandboxGuards, type ScriptSnapshot, type RuntimeIO, type ScriptOutcomeData } from './script-runtime';

interface RunMsg { type: 'run'; nonce: number; code: string; snapshot: ScriptSnapshot }
interface SendResponseMsg { type: 'sendResponse'; reqId: number; ok: boolean; result?: unknown; error?: string }

const pendingSends = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
let reqSeq = 0;

// A5 P0：在用户代码 eval 之前中和全部网络/持久化/子 Worker 逃逸通道；
// 自身协议通道（postMessage）先抓引用再封锁全局，outbox 是唯一网络路径。
const rawPostMessage = (self as unknown as Worker).postMessage.bind(self);
installSandboxGuards(self as unknown as Record<string, unknown>);
try {
  (self as unknown as Record<string, unknown>).postMessage = () => {
    throw new Error('[api-studio sandbox] direct postMessage from script is disabled. Use pm.* APIs only.');
  };
}
catch { /* postMessage 不可配置时保留 raw 通道语义 */ }

function postOut(message: Record<string, unknown>, transfer?: Transferable[]) {
  rawPostMessage(message, transfer ?? []);
}

self.onmessage = (e: MessageEvent<RunMsg | SendResponseMsg>) => {
  const msg = e.data;
  if (msg.type === 'sendResponse') {
    const p = pendingSends.get(msg.reqId);
    if (p) { pendingSends.delete(msg.reqId); msg.ok ? p.resolve(msg.result) : p.reject(new Error(String(msg.error))); }
    return;
  }
  if (msg.type !== 'run') { return; }
  const outcome: ScriptOutcomeData = { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
  const io: RuntimeIO = {
    outcome,
    console: (...a) => outcome.logs.push(a.map(v => typeof v === 'string' ? v : JSON.stringify(v, null, 0) ?? String(v)).join(' ').slice(0, 500)),
    sendRequest: async spec => {
      const reqId = ++reqSeq;
      postOut({ type: 'sendRequest', nonce: msg.nonce, reqId, spec });
      return new Promise<{ code: number; status: string; responseTime: number }>(resolve => {
        pendingSends.set(reqId, { resolve: resolve as (v: unknown) => void, reject: () => resolve({ code: 0, status: 'ERROR', responseTime: 0 }) });
      });
    },
  };
  const { pm, console: capi, flushTests } = createPmAPI(msg.snapshot, io);
  let error: string | undefined;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('pm', 'console', msg.code);
    fn(pm, capi);
  }
  catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  flushTests();
  postOut({ type: 'done', nonce: msg.nonce, outcome, error });
};
