# API Studio pm.* 支持矩阵（2026-11-17，增量 A 收口）

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
| `pm.iterationData` get/has/toObject/count | 语义已定义；数据文件注入在 B 阶段（CSV/JSON）接入 | 待 B 阶段测试 |
| `pm.request` url/method/headers(get/upsert/add/remove/all/has/count)/body(toString/update) | mutation 只作用本次发送，不回写存储 | script-integration.test |
| `pm.response` code/status/text/json/headers(get/all/has/count)/responseTime/size | prerequest 阶段为 null（与 Postman 一致）；请求失败时 test 脚本仍以 null 执行 | script-integration.test 空响应守卫 |
| `pm.info` event/iteration/counter/requestName | requestName 由 Runner 注入真实请求名 | script-integration.test |
| `pm.test(name, fn)` | fn 抛错 = 测试失败并带原因；结果进 summary 与报告 | 191/191 |
| `pm.expect` 子集 | to.be/been/is/and/has/with/that 链；equal/eql/include/match/above/below/ok/true/null/exist/lengthOf/property/oneOf/a；`not` 支持 equal/exist | script-runtime.test |
| `pm.sendRequest` | outbox → 宿主 apiproxy；Promise 与 callback 双形态 | script-runtime.test |

## PARTIAL

| API | 现状 | 收口条件 |
|---|---|---|
| `pm.iterationData` | 语义完整，数据注入未接 | B 阶段 CSV/JSON 迭代上线 + 跨轮隔离测试 |
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
