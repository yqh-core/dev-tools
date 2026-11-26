/**
 * 沙箱协议夹具（纯 .mjs——**不依赖 Node 类型剥离**）。
 * 验证 sandbox.ts 的传输/outbox 桥/超时 kill/崩溃承载/nonce 竞态忽略，不含真实 pm 逻辑。
 * 协议：run{nonce,code} → done{nonce,outcome,error}；outbox：sendRequest → 等 sendResponse 后 done。
 * 特殊代码路径：HANG=不回复（超时 kill）；LATE=延迟 400ms 回复（迟到 done 竞态）；
 * OUTBOX_FAIL=发 sendRequest 等桥接结果（宿主 send reject 时 done 带 error）；BOOM=脚本错误承载。
 *
 * 为什么是 .mjs 而不是 .ts（别改回去）：
 * 本文件被 `new Worker(url)` 直接当作 Node worker_threads 入口加载。
 * Node 从 22.18 起才**默认**开启 .ts 类型剥离，而本仓库 .nvmrc 钉 22.16.0
 * （为对齐 Cloudflare Pages v3 构建镜像默认值，不能擅自升）。
 * 在 22.16 上 .ts worker 入口直接报 ERR_UNKNOWN_FILE_EXTENSION，worker 立刻死亡 →
 * 传输层如实承载成「sandbox process exited unexpectedly」，整组 Worker 传输用例假红。
 * 夹具本身不含任何运行时 TS 特性，改成 .mjs 后与 Node 版本彻底解耦。
 */
import { parentPort } from 'node:worker_threads';

// worker_threads 契约：worker 上下文中 parentPort 非 null
const port = parentPort;
if (!port) {
  throw new Error('protocol-worker must run inside worker_threads');
}

let lastNonce = 0;
let lastSpec = null;

port.on('message', (msg) => {
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
