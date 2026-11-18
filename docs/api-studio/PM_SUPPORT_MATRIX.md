# API Studio pm.* 支持矩阵（2026-11-18，增量 A+B 收口）

状态词：`SUPPORTED`（有实现+测试）/ `PARTIAL`（子集，边界注明）/ `UNSUPPORTED`（fail-closed 显式报错，不静默 no-op）。
沙箱：专用 module Worker（无 DOM）；5s 超时 terminate+重建；nonce 防陈旧回填；
网络唯一路径 = `pm.sendRequest` outbox → 宿主 apiproxy（目标策略/超时/审计在宿主）。
`fetch/XHR/WebSocket/EventSource/importScripts/Worker/BroadcastChannel/caches/indexedDB/sendBeacon`
在沙箱内读取即抛错（E2E 逃逸负控：零 evil.test 请求）。

## SUPPORTED

| API | 边界 | 测试锚点 |
|---|---|---|
| `pm.environment` get/set/unset/has/toObject/count | 写入经 envWrites 由宿主分层应用，脚本不直改存储 | script-runtime.test / script-integration.test |
| `pm.collectionVariables` | 同上（collection 层） | 同上 |
| `pm.globals` | 同上（globals 层） | 同上 |
| `pm.variables` get/set/unset/has/toObject/count/replaceIn | `set` 只写本次运行 local 层；读取优先级 local>data>environment>collection>globals（含同名负控） | script-runtime.test 作用域组 |
| `pm.iterationData` get/has/toObject/count | Runner 每轮注入数据行（CSV RFC 4180 严格解析 / JSON 顶层数组，fail-closed）；读取优先级 local>iterationData>environment>collection>globals；每轮重置不串轮 | datafiles.test / data-driven.test（默认轮数·循环·隔离）/ B 浏览器 E2E |
| `pm.request` url/method/headers(get/upsert/add/remove/all/has/count)/body(toString/update) | mutation 只作用本次发送，不回写存储 | script-integration.test |
| `pm.response` code/status/text/json/headers(get/all/has/count)/responseTime/size | prerequest 阶段为 null（与 Postman 一致）；请求失败时 test 脚本仍以 null 执行 | script-integration.test 空响应守卫 |
| `pm.info` event/iteration/counter/requestName | requestName 由 Runner 注入真实请求名 | script-integration.test |
| `pm.test(name, fn)` | fn 抛错 = 测试失败并带原因；结果进 summary 与报告 | 191/191 |
| `pm.expect` 子集 | to.be/been/is/and/has/with/that 链；equal/eql/include/match/above/below/ok/true/null/exist/lengthOf/property/oneOf/a；`not` 支持 equal/exist | script-runtime.test |
| `pm.sendRequest` | outbox → 宿主 apiproxy；Promise 与 callback 双形态；**outbox 资源上限（A-018）：待决队列 50 / 单 spec 1MB（URL+headers+body），超限 fail-closed 不静默丢** | script-runtime.test（含队列/字节上限负控 2 条） |
| `pm.*` 全矩阵（CLI 侧） | 浏览器 Worker 沙箱与 CLI worker_threads 沙箱**共用同一 script-runtime 源码**（pm 语义/守卫/超时 kill 同契约）；传输层独立实现（C 阶段）；CLI 侧额外中和 `process` 全局（环境变量/进程/文件逃逸面读取即抛——A5-CLI/C-005：worker_threads 有真 process，守卫即生效）；outbox 上限共享（队列 50/spec 1MB） | cli 单测（真 worker_threads 协议/outbox 桥/超时/崩溃承载/nonce 迟到 done 竞态负控/outbox 失败承载）+ CLI E2E（fetch 守卫负控+while(true) 5s kill+S13/S13b process 面负控） |

## PARTIAL

| API | 现状 | 收口条件 |
|---|---|---|
| `pm.expect` | 常用断言子集，非 chai 全量 | 按用户任务增量补；每补一条加正反例 |
| `pm.cookies` / `pm.cookieJar` | fail-closed 抛 unsupported | 有真实 cookie 业务需求+隔离方案后再实现 |

## UNSUPPORTED（fail-closed，调用即抛错并指明）

`pm.execution`（含 setNextRequest 流程控制）、`pm.request.authorize`、任何未列入本矩阵的 API。
未实现 API **绝不静默 no-op**——这是任务书 A4 的硬要求，也是与"假装兼容"的分界。

## 运行时边界（任务书 A5 落实）

- 逃逸通道中和：fetch/XHR/WebSocket/EventSource/importScripts/Worker/SharedWorker/
  BroadcastChannel/caches/indexedDB/Notification/open/navigator.sendBeacon 读取即抛错。
- 已知局限（如实）：中和是运行时全局替换，未来新增 Worker API 不在清单即失效；
  兜底 = outbox 唯一网络路径 + 宿主 message 类型白名单（未知消息忽略）。
- 浏览器 CSP 评估：页面级 meta CSP 无法表达 connect-src（规范限制），不做虚假声明。
- CLI 侧沙箱（C 阶段）独立设计，不复用浏览器 Worker 方案；Node `vm` 不视为不可信代码沙箱。
