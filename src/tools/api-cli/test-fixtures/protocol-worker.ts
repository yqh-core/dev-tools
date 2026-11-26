/**
 * 沙箱协议夹具（无任何导入——Node 原生 type-strip 可直接作为 worker 加载）。
 * 验证 sandbox.ts 的传输/outbox 桥/超时 kill/崩溃承载/nonce 竞态忽略，不含真实 pm 逻辑。
 * 协议：run{nonce,code} → done{nonce,outcome,error}；outbox：sendRequest → 等 sendResponse 后 done。
 * 特殊代码路径：HANG=不回复（超时 kill）；LATE=延迟 400ms 回复（迟到 done 竞态）；
 * OUTBOX_FAIL=发 sendRequest 等桥接结果（宿主 send reject 时 done 带 error）；BOOM=脚本错误承载。
 */
import { parentPort } from 'node:worker_threads';

// worker_threads 契约：worker 上下文中 parentPort 非 null；类型层显式收窄（vue-tsc 门禁）
const port = parentPort;
if (!port) {
  throw new Error('protocol-worker must run inside worker_threads');
}

let lastNonce = 0;
let lastSpec: { url: string; method: string; header: { name: string; value: string }[]; body: string } | null = null;

port.on('message', (msg: { type: string; nonce?: number; code?: string; reqId?: number; ok?: boolean }) => {
  if (msg.type === 'sendResponse') {
    port.postMessage({ type: 'done', nonce: lastNonce, outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [lastSpec], asyncPending: false }, ...(msg.ok === false ? { error: 'outbox bridge rejected (fixture)' } : {}) });
    return;
  }
  if (msg.type !== 'run') {
    return;
  }
  lastNonce = msg.nonce ?? 0;
  const code = String(msg.code ?? '');
  if (code.includes('HANG')) {
    return; // 不回复 → 模拟死循环（超时 kill 路径）
  }
  if (code.includes('LATE')) {
    setTimeout(() => {
      port.postMessage({ type: 'done', nonce: lastNonce, outcome: { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false }, error: 'late done from previous run' });
    }, 400);
    return; // 延迟回复 → 制造迟到 done 竞态
  }
  // OUTBOX 与 OUTBOX_FAIL 共用此分支（差异在宿主侧 send stub：resolve=成功桥 / reject=失败桥）
  if (code.includes('OUTBOX')) {
    lastSpec = { url: 'http://fixture.test/x', method: 'GET', header: [], body: '' };
    port.postMessage({ type: 'sendRequest', nonce: msg.nonce, reqId: 1, spec: lastSpec });
    return; // 等宿主桥接 sendResponse（ok:false 时 done 带 error）
  }
  port.postMessage({
    type: 'done',
    nonce: msg.nonce,
    outcome: { tests: [{ name: 'fixture test', passed: true }], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false },
    ...(code.includes('BOOM') ? { error: 'fixture script error' } : {}),
  });
});
