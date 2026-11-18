/**
 * API Studio CLI · 沙箱子进程垫片（G2：OS 级隔离传输；终审 P0-01 / yqh 裁定①）。
 * 普通 Node 子进程（**不是 worker_threads**——进程内 JS 沙箱不对恶意代码闭环，worker_threads 与主进程同进程同账户）。
 * 边界（默认 fail-closed）：
 *   · 干净最小 env（不继承 CI Secrets/宿主环境——逃逸后也读不到 secret 面）
 *   · 空 cwd（mkdtemp 隔离工作目录，不继承仓库/用户目录）
 *   · 进程组 kill（POSIX detached 新组；Windows taskkill /T /F）——超时/取消/崩溃整树回收
 *   · 宿主内存软上限（rss 轮询，超限 kill tree 如实标记）
 *   · 协议面不变：message 类型白名单（run/sendRequest/sendResponse/done）+ nonce 防陈旧回填
 * 求值顺序：本模块先于 script-worker（自检 self/postMessage/onmessage 映射 + process 全局中和）。
 */
/// <reference types="node" />
const g = globalThis as unknown as Record<string, any>;

if (!g.self) {
  g.self = g;
}
// 守卫前捕获 IPC send（postMessage 闭包晚期读 process 会撞 process 中和 getter——实证崩溃口径）
const rawSend = typeof process.send === 'function' ? process.send.bind(process) : undefined;
if (typeof g.postMessage !== 'function') {
  g.postMessage = (msg: unknown) => { rawSend?.(msg); };
}
// script-worker 赋值 self.onmessage = handler —— 映射到子进程 IPC 消息事件
let messageHandler: ((e: { data: any }) => void) | null = null;
Object.defineProperty(g, 'onmessage', {
  configurable: true,
  set(fn: (e: { data: any }) => void) { messageHandler = fn; },
  get() { return messageHandler; },
});
// 守卫前注册 IPC 监听（process.on 此刻读 process 合法；中和后脚本面读取即抛）
process.on('message', (data: any) => { messageHandler?.({ data }); });

// 沙箱进程面中和（与浏览器守卫/worker_threads 时代同口径）：
// 子进程内 process 仍是真实全局（env=干净但存在/进程/文件逃逸面）——用户脚本无合法用途（pm.* 语义不需要
// process）——读取即抛 fail-closed。逃逸残余的 OS 面由干净 env + 空 cwd + 进程组 kill + 同账户登记兜底。
if (!g.__apiStudioProcessGuarded) {
  try {
    Object.defineProperty(g, 'process', {
      configurable: true,
      get() {
        throw new Error('[api-studio sandbox] process is disabled inside the script sandbox. Environment, filesystem and process APIs are not accessible from user scripts (host-controlled pm.sendRequest outbox only).');
      },
    });
    g.__apiStudioProcessGuarded = true;
  }
  catch {
    // process 不可配置=中和失败：拒绝执行用户脚本（fail-closed，不带病运行）
    throw new Error('[api-studio sandbox] FATAL: cannot neutralize process global — refusing to run user scripts without the guard.');
  }
}
