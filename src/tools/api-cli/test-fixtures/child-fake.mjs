// G2 假子进程夹具（sandbox.test.ts 传输锁驱动）：argv[2]=模式。
// 协议=产品子进程同口径（process IPC：run/sendRequest/sendResponse/done）——主机侧管理器驱动真实 spawn。
// 模式：echo / envkeys（env+pod 报告）/ cwd / hang / boom / outbox / memory。
import { Buffer } from 'node:buffer';
import process from 'node:process';

const mode = process.argv[2] ?? 'echo';
const g = globalThis;
g.self = g;
let handler = null;
Object.defineProperty(g, 'onmessage', {
  configurable: true,
  set(fn) { handler = fn; },
  get() { return handler; },
});
process.on('message', d => handler?.({ data: d }));
function post(m) {
  try {
    process.send?.(m);
  }
  catch { /* 通道已断 */ }
}
const empty = { tests: [], envWrites: [], requestMutations: {}, logs: [], sendRequests: [], asyncPending: false };
const done = (outcome, error) => post({ type: 'done', nonce: 1, outcome, ...(error ? { error } : {}) });

if (mode === 'echo') {
  // 等待 run → done（1 个通过测试）
  process.on('message', (d) => {
    if (d?.type === 'run') {
      done({ ...empty, tests: [{ name: 'fixture test', passed: true }] });
    }
  });
}
else if (mode === 'envkeys') {
  process.on('message', (d) => {
    if (d?.type === 'run') {
      done({ ...empty, tests: [{ name: 'envkeys', passed: true }], logs: [JSON.stringify({ envKeys: Object.keys(process.env).sort(), pid: process.pid, ppid: process.ppid })] });
    }
  });
}
else if (mode === 'cwd') {
  process.on('message', (d) => {
    if (d?.type === 'run') {
      done({ ...empty, tests: [{ name: 'cwd', passed: true }], logs: [JSON.stringify({ cwd: process.cwd(), tmpdir: (process.env.TMPDIR ?? '') })] });
    }
  });
}
else if (mode === 'hang') {
  // 永不回复（超时 kill 树锁）
}
else if (mode === 'boom') {
  process.on('message', (d) => {
    if (d?.type === 'run') {
      process.exit(1);
    }

    // 崩溃承载锁
  });
}
else if (mode === 'outbox') {
  process.on('message', (d) => {
    if (d?.type !== 'run') {
      return;
    }

    post({ type: 'sendRequest', nonce: d.nonce, reqId: 1, spec: { url: 'http://fixture.test/x', method: 'GET' } });
    process.on('message', (m) => {
      if (m?.type === 'sendResponse') {
        done({ ...empty, tests: [{ name: 'outbox', passed: true }], sendRequests: [{ url: 'http://fixture.test/x', method: 'GET' }] });
      }
    });
  });
}
else if (mode === 'memory') {
  process.on('message', (d) => {
    if (d?.type === 'run') {
      const chunks = [];
      for (let i = 0; i < 96; i++) {
        chunks.push(Buffer.alloc(1024 * 1024));
      } // ~96MiB 同步膨胀并**持有**（挂起不回复——宿主 rss 轮询口径下必须判红 kill）
      // 故意不 done：内存持有面由宿主轮询判据证明（done 即假绿）
    }
  });
}
// 其他模式=静默（负控）
