# API Studio pm.* 支持矩阵（2026-11-18，E 批次：终审 P0/P1 整改收口）

状态词：`SUPPORTED`（有实现+测试）/ `PARTIAL`（子集，边界注明）/ `UNSUPPORTED`（fail-closed 显式报错，不静默 no-op）。

## 沙箱定位（终审 P0-01/P1-09 后如实声明，不上调）

- **定位 = 开发工具的脚本执行环境 + fail-closed 守卫 + OS 进程边界（G2），不是恶意代码安全边界**。构造器链逃逸后的同账户 fs/直接网络面残余——完整闭环需容器/VM/独立账户（裁定①批准路线的第二阶段，基础设施决策）。
- 传输：浏览器 = 专用 module Worker（OS 线程边界）；CLI = **隔离子进程（G2：OS 进程边界——干净最小 env/空 cwd/进程组 kill/rss 软上限 512MiB/墙钟 5s 整树 kill）**。两边共用同一 `script-runtime`（pm 语义与守卫）与同一 `script-worker`（协议+静态护栏）源码。
- 超时：5s 墙钟 kill 整个子进程树（无法只杀一段脚本；POSIX 进程组/Windows taskkill /T）；超时/崩溃后重建；进行中其他 run 如实标 timedOut。
- CLI 侧子进程带 rss 软上限 512MiB（宿主轮询 tasklist/ps，超限整树 kill 如实标记）；CI Secret 面=边界闭合（干净 spawn env，S16b 实弹）。
- 网络唯一路径 = `pm.sendRequest` outbox → 宿主（浏览器走同源 apiproxy relay；CLI 直连；目标策略/超时/审计在宿主）。

## SUPPORTED

| API | 边界 | 测试锚点 |
|---|---|---|
| `pm.environment` get/set/unset/has/toObject/count | 写入经 envWrites 由宿主分层应用，脚本不直改存储 | script-runtime.test / script-integration.test |
| `pm.collectionVariables` | 同上（collection 层） | 同上 |
| `pm.globals` | 同上（globals 层） | 同上 |
| `pm.variables` get/set/unset/has/toObject/count/replaceIn | `set` 只写本次运行 local 层；**读取经唯一 resolver `resolveVariable`（优先级 local>iterationData>environment>collection>globals；get/has/replaceIn/toObject 同源，请求插值由五层同名矩阵一致性锁证明等价）** | script-runtime.test 作用域组 + consistency.test 矩阵 |
| `pm.iterationData` get/has/toObject/count | Runner 每轮注入数据行（CSV RFC 4180 严格四态解析 / JSON 顶层数组，fail-closed；文件/行/列/字段字节上限见数据文件节）；读取优先级同 resolver；每轮重置不串轮 | datafiles.test / data-driven.test / B 浏览器 E2E |
| `pm.request` url/method/headers(get/upsert/add/remove/all/has/count)/body(toString/update) | mutation 只作用本次发送，不回写存储 | script-integration.test |
| `pm.response` code/status/text/json/headers(get/all/has/count)/responseTime/size | prerequest 阶段为 null（与 Postman 一致）；请求失败时 test 脚本仍以 null 执行 | script-integration.test 空响应 guard |
| `pm.info` event/iteration/counter/requestName | requestName 由 Runner 注入真实请求名（G1 更正：原实现硬编码空串——矩阵声称曾领先代码，G1 闭环并加锁） | script-runtime.test（G1 requestName 锁） |
| `pm.test(name, fn)` | fn 抛错 = 测试失败并带原因；**fn 可为 async——settled 后才定成败（E5）；顶层 await 支持；未 settle 不出结论**；结果进 summary 与报告 | script-runtime.test（同步+异步双模）/ E2E S14 |
| `pm.expect` 子集 | to.be/been/is/and/has/with/that 链；equal/eql/include/match/above/below/ok/true/null/exist/lengthOf/property/oneOf/a；`not` 支持 equal/exist；**G1 严格消息口径（yqh 裁定②）：失败消息不格式化 actual/expected 原始值——只承载操作符/类型/安全字段路径/安全标量；label 与测试名承载定位** | script-runtime.test（G1 植物负控+类型正控） |
| `pm.sendRequest` | outbox → 宿主桥；Promise 与 callback 双形态；**返回 Postman 风格响应视图**（code/status/statusText/headers.get/has/all/count/text/json/responseTime/size/truncated）；桥失败如实 reject 传播为脚本错误；**资源上限（fail-closed）：累计发送 100/脚本运行、单 spec 1MB（UTF-8 字节）、宿主桥响应体 1MB 字节级截断、console 捕获 256KB/轮** | script-runtime.test（含上限负控）/ 探针矩阵 P12-P16 |
| `pm.*` 全矩阵（CLI 侧） | 浏览器=module Worker（OS 线程边界）；CLI=**隔离子进程（G2 OS 进程边界：干净最小 env/空 cwd/进程组 kill/rss 软上限/墙钟整树 kill）**；pm 语义与守卫共用同一 script-runtime/script-worker 源码；CLI 侧额外中和 process 全局（env/mainModule.require 逃逸面读取即抛）；模块加载静态护栏两边同源 | cli 单测（传输抽象分层锁：夹具 Worker + 假子进程真实 spawn）+ CLI E2E（S13/S13b/S14/S16）+ 探针矩阵（**子进程传输实弹** 15 PASS/0 FAIL/1 RESIDUAL） |

## PARTIAL

| API | 现状 | 收口条件 |
|---|---|---|
| `pm.expect` | 常用断言子集，非 chai 全量 | 按用户任务增量补；每补一条加正反例 |
| `pm.cookies` / `pm.cookieJar` | fail-closed 抛 unsupported | 有真实 cookie 业务需求+隔离方案后再实现 |

## UNSUPPORTED（fail-closed，调用即抛错并指明）

`pm.execution`（含 setNextRequest 流程控制）、`pm.request.authorize`、任何未列入本矩阵的 API。
未实现 API **绝不静默 no-op**——这是任务书 A4 的硬要求，也是与"假装兼容"的分界。

## 守卫与逃逸面（终审 P0-01/P1-09 实弹探针矩阵：15 PASS / 0 FAIL / 1 RESIDUAL）

- **静态模块护栏**：用户脚本文本含 `import(`/`require(` → 执行前明文拒绝（Postman 沙箱同口径：用户脚本无模块系统）。已知局限：正则，混淆构造可绕过文本扫描。
- **运行时全局中和**（读取即抛）：fetch/XHR/WebSocket/EventSource/importScripts/Worker/SharedWorker/BroadcastChannel/caches/indexedDB/Notification/open/navigator.sendBeacon/**Function 构造器/eval**。
- **WebAssembly 实证排除**：worker_threads 引导期存在无 JS 栈的原生 WebAssembly 读，列入守卫反而破坏沙箱自身启动（干净目录冒烟实证）——不列；WASM 无宿主导入即无 fs/net 能力，内存面由 resourceLimits 兜底。
- **Node Permission Model 实证无效**：`--experimental-permission` 下 `import('node:child_process')` 仍成功（本机探针实证）——不作为闭合路径，与官方文档口径一致。
- **如实登记的残余（RESIDUAL，探针 P11 实证可达）**：原型链混淆（`''.constructor.constructor` + 拆分字符串）在 worker_threads 下仍可构造动态 import。进程内 JS 沙箱无法对恶意代码闭环；闭合路线 = OS 边界隔离（产品决策项）。**因此所有"仅 outbox 可联网"类文案均已改为 scoped 表述**（守卫面内成立，不冒充对恶意代码的边界承诺）。
- 宿主侧兜底：worker 协议 message 类型白名单（未知消息忽略）；nonce 防陈旧回填；超时 kill 整个 worker。

## 数据文件上限（终审 P1-02，fail-closed）

文件 5MiB / 行 5000 / 列 50 / 单字段 1MiB；超限明确报错不静默截断。增量/Worker 化解析（防 UI 阻塞）登记为后续项。

## 运行时边界（任务书 A5 落实）

- 浏览器 CSP 评估：页面级 meta CSP 无法表达 connect-src（规范限制），不做虚假声明；Worker 级部署环境验证登记为后续项（终审 P1-09）。
- CLI 侧沙箱独立传输实现，pm 语义与守卫共用同一份源码（§5 硬约束）。
