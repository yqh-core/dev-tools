/// <reference lib="webworker" />
/**
 * API-011 · 脚本执行沙箱 Worker。
 * 用户脚本只在这里跑：Worker 上下文没有 DOM、没有 window、没有页面凭据引用；
 * 超时与资源控制由主线程（script-sandbox.ts）terminate 负责；
 * pm.sendRequest 不在 Worker 直发网络，而是消息往返主线程的 apiproxy（权限控制在宿主）。
 */
import { type BridgeResponse, CONSOLE_TOTAL_MAX_BYTES, type RuntimeIO, type ScriptOutcomeData, type ScriptSnapshot, createPmAPI, installSandboxGuards, utf8Bytes } from './script-runtime';

/** E6' 模块加载静态护栏判据（导出供单测锁；Postman 沙箱同口径：用户脚本无模块系统）。
 *  已知局限（如实）：静态正则，混淆构造可绕过——与运行时全局守卫同级口径，
 *  不正称"不可绕过的安全边界"（Node 官方 Permission Model 同样不防御恶意代码，实证不拦模块加载）。 */
export function isModuleLoadAttempt(code: string): boolean {
  return /\bimport\s*\(|\brequire\s*\(/.test(code);
}

interface RunMsg { type: 'run'; nonce: number; code: string; snapshot: ScriptSnapshot }
interface SendResponseMsg { type: 'sendResponse'; reqId: number; ok: boolean; result?: unknown; error?: string }

const pendingSends = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>();
let reqSeq = 0;

// A5 P0：在用户代码 eval 之前中和全部网络/持久化/子 Worker/构造器逃逸通道；
// 自身协议通道（postMessage）先抓引用再封锁全局，outbox 是唯一网络路径。
// 终审 P0-01：宿主自身 eval 用户代码用构造前捕获的 RawFunction（守卫后 new Function 读取即抛）。
const RawFunction = Function;
const rawPostMessage = (globalThis as unknown as Worker).postMessage.bind(globalThis);
installSandboxGuards(globalThis as unknown as Record<string, unknown>);
try {
  (globalThis as unknown as Record<string, unknown>).postMessage = () => {
    throw new Error('[api-studio sandbox] direct postMessage from script is disabled. Use pm.* APIs only.');
  };
}
catch { /* postMessage 不可配置时保留 raw 通道语义 */ }

function postOut(message: Record<string, unknown>, transfer?: Transferable[]) {
  rawPostMessage(message, transfer ?? []);
}

globalThis.onmessage = async (e: MessageEvent<RunMsg | SendResponseMsg>) => {
  const msg = e.data;
  if (msg.type === 'sendResponse') {
    const p = pendingSends.get(msg.reqId);
    if (p) {
      pendingSends.delete(msg.reqId);

      msg.ok ? p.resolve(msg.result) : p.reject(new Error(String(msg.error)));
    }
    return;
  }
  if (msg.type !== 'run') {
    return;
  }
  const outcome: ScriptOutcomeData = { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
  // 终审 P1-03：console 捕获单行 500 字符 + 全轮累计字节上限（超出丢弃并标记——不静默无限增长）
  let consoleBytes = 0;
  let consoleCapped = false;
  const io: RuntimeIO = {
    outcome,
    console: (...a) => {
      if (consoleCapped) {
        return;
      }

      const line = a.map(v => typeof v === 'string' ? v : JSON.stringify(v, null, 0) ?? String(v)).join(' ').slice(0, 500);
      consoleBytes += utf8Bytes(line);
      if (consoleBytes > CONSOLE_TOTAL_MAX_BYTES) {
        consoleCapped = true;
        outcome.logs.push(`[console capture exceeded ${CONSOLE_TOTAL_MAX_BYTES} bytes for this script run; further logs dropped]`);
        return;
      }
      outcome.logs.push(line);
    },
    sendRequest: async (spec) => {
      const reqId = ++reqSeq;
      postOut({ type: 'sendRequest', nonce: msg.nonce, reqId, spec });
      // 终审 P1-04：桥失败如实 reject（传播为脚本错误，fail-closed）；不再伪造 ERROR 占位响应
      return new Promise<BridgeResponse>((resolve, reject) => {
        pendingSends.set(reqId, { resolve: resolve as (v: unknown) => void, reject: reject as (e: unknown) => void });
      });
    },
  };
  const { pm, console: capi, flushTests } = createPmAPI(msg.snapshot, io);
  let error: string | undefined;
  // E6' 模块加载静态护栏（终审 P0-1；Postman 沙箱同口径：用户脚本无模块系统）。
  // 与运行时全局守卫同级口径=明文拒绝+fail-closed；混淆绕过登记为已知局限，
  // 不正称"不可绕过的安全边界"（Node 官方 Permission Model 同样不防御恶意代码，实证不拦模块加载）。
  if (isModuleLoadAttempt(msg.code)) {
    postOut({ type: 'done', nonce: msg.nonce, outcome, error: 'dynamic import()/require() is not allowed in the script sandbox (Postman sandbox parity: user scripts have no module system). Use pm.* APIs only.' });
    return;
  }
  // E5 outbox 等待：fire-and-forget 的 pm.sendRequest 响应到达前不发 done（响应回填脚本后续逻辑）。
  // 无内部硬上限——宿主 5s 超时 kill 是唯一预算口径（脚本未完成=如实 timedOut，不双重预算）。
  const waitPendingSends = async (): Promise<void> => {
    while (pendingSends.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    // E5：async 包装支持顶层 await；脚本未完成（含 await pm.sendRequest）不发送 done
    // 终审 P0-01：用构造前捕获的 RawFunction（全局 Function 已被守卫中和）
    const fn = RawFunction('pm', 'console', `return (async () => {\n${msg.code}\n})()`);
    await fn(pm, capi);
  }
  catch (err) {
    error = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  }
  await flushTests();
  await waitPendingSends();
  postOut({ type: 'done', nonce: msg.nonce, outcome, error });
};
