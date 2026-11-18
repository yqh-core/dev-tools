/**
 * CLI 沙箱 worker 全局垫片（worker_threads 无浏览器 self/postMessage/onmessage）。
 *
 * 独立模块以保证求值顺序：worker-entry 静态导入链「本模块 → script-worker」，
 * 本模块先求值，script-worker 顶层执行 installSandboxGuards(self)/捕获 postMessage 时
 * 垫片已就位（动态 import 无法被 bundle 内联——产物会保留运行时解析，干净环境必断，
 * 故用静态导入顺序方案）。
 */
/// <reference types="node" />
import { parentPort } from 'node:worker_threads';

const g = globalThis as unknown as Record<string, any>;

if (!g.self) {
  g.self = g;
}
if (typeof g.postMessage !== 'function') {
  g.postMessage = (msg: unknown) => { parentPort?.postMessage(msg); };
}
// script-worker 赋值 self.onmessage = handler —— 映射到 parentPort 消息事件
let messageHandler: ((e: { data: any }) => void) | null = null;
Object.defineProperty(g, 'onmessage', {
  configurable: true,
  set(fn: (e: { data: any }) => void) { messageHandler = fn; },
  get() { return messageHandler; },
});
if (parentPort) {
  parentPort.on('message', (data: any) => { messageHandler?.({ data }); });
}

// CLI 沙箱进程面中和（C-005/A5-CLI 边界：限制环境变量/进程/文件）：
// Node worker 的 process 全局含 env（CI Secrets 泄露面）与 mainModule.require（进程/文件逃逸面）。
// 用户脚本无合法用途（pm.* 语义不需要 process）——读取即抛 fail-closed，与浏览器守卫同口径。
// 本 shim 只在 worker 内执行（主线程不受影响）；worker 引导自身不经 process（parentPort 已就位）。
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
