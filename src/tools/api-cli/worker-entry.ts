/**
 * API Studio CLI · 沙箱 worker 入口（worker_threads 传输；任务书 §5「CLI 沙箱独立设计」）。
 *
 * 静态导入链：worker-shim（垫片 self/postMessage/onmessage）先求值 →
 * script-worker（浏览器侧同一份 pm 语义与守卫逻辑）后求值。vite ssr bundle 构建期
 * 内联全部导入——产物零运行时扩展名解析（干净环境硬保证）。
 *
 * 传输层差异如实声明：浏览器=专用 module Worker；CLI=worker_threads。
 * 单元层用无导入协议夹具验证传输（本链含浏览器源码扩展名省略导入，Node 原生 loader
 * 不解析——任务书 §10.2 测试分层：真实执行链由 CLI E2E 对本产物 bundle 验证）。
 */
/// <reference types="node" />
import './worker-shim';
import '../api-debugger/script-worker';
