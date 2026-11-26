/**
 * API Studio CLI · 沙箱子进程入口（G2：OS 级隔离传输；终审 P0-01 / yqh 裁定①）。
 * 静态导入链：sandbox-child-shim（垫片 self/postMessage/onmessage + process 中和）先求值 →
 * script-worker（浏览器侧同一份 pm 语义/守卫/协议核心）后求值。vite SSR bundle 构建期内联——
 * 产物 api-studio-cli-child.mjs 零运行时扩展名解析（干净环境硬保证，build-cli 冒烟门禁实弹验证）。
 *
 * 传输层差异如实声明：浏览器=专用 module Worker（OS 线程边界）；CLI=隔离子进程（OS 进程边界：
 * 干净 env/空 cwd/进程组 kill/内存软上限）。pm 语义与守卫共用同一 script-runtime/script-worker 源码（§5）。
 */
/// <reference types="node" />
import './sandbox-child-shim';
import '../api-debugger/script-worker';
