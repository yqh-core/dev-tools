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
