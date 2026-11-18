# API Studio 脚本执行顺序契约 v1.1（2026-11-18：E5 异步生命周期增补）

本文件是**版本化产品契约**（任务书 A3 要求：顺序不凭记忆臆造，写成契约并用真实样例测试）。
实现：`src/tools/api-debugger/collection.ts`（importCollection 的 preChain/testChain 合并）。
测试：`collection-scripts.test.ts`（含同序拼接负控）。

## 变更记录

- v1.1（2026-11-18，终审 P1-04/E5）：增补「异步脚本生命周期」节——pm.test 回调 Promise、
  顶层 await、outbox 完成等待、单一终态。执行顺序本体不变。
- v1（2026-11-17）：初始版本。

## 执行顺序（对标 Postman 官方执行序，核验日 2026-11-17）

对每个请求，一次 Collection Run 中脚本执行顺序为：

1. **pre-request**：由外到内 —— `Collection 级 → Folder 级 → Request 级`（外层先跑）。
2. 发送请求（含 pre-request 的变量写入与请求级 mutation）。
3. **test**：由内到外 —— `Request 级 → Folder 级 → Collection 级`（内层先跑）。

同层多段事件按 Postman 文件内出现顺序拼接（以 `\n` 连接）。

## 导入规则（Postman Collection v2.1）

- `event[].listen` 只认 `prerequest` 与 `test`；`script.exec` 接受字符串数组或单字符串。
- 集合级（`doc.event`）事件并入**每个**请求的执行链；导入时在 warnings 如实提示
  "Collection-level scripts were merged into each request execution chain"，不静默改写。
- Folder 级事件对其全部子请求（含嵌套 folder）继承；无自身事件的请求仍继承外层链。
- 导入后 `scriptEvents` 只有 `prerequest`/`test` 两个字符串键；空段不写键（不造空对象噪音）。

## 导出规则（往返不丢）

- `exportCollection` 把 `scriptEvents.prerequest`/`test` 按 `\n` 拆成 `exec` 数组，
  生成 `event: [{listen, script:{exec}}]` —— 导入 → 导出 → 再导入逐字节一致
  （`a1-closure.test.ts` 往返断言锚定）。
- 无脚本的请求不生成 `event` 键。

## 异步脚本生命周期（v1.1 增补；终审 P1-04/E5）

对每一段脚本（prerequest/test，含集合级叠加段），沙箱执行包装为 async 函数并遵守：

1. **顶层 await 支持**：用户脚本可 `await pm.sendRequest(...)`；脚本未完成不出具结论。
2. **pm.test 回调可为 async**：回调返回 Promise 时，该 test 的成败在 **settled 后**才定
   （拒绝=该 test 失败并带原因）；同步回调路径行为不变（双模 flushTests，零回归）。
3. **outbox 完成等待**：fire-and-forget 的 `pm.sendRequest`（未 await）——其响应到达前
   不发 `done`（响应回填脚本后续逻辑）；无内部硬上限，宿主 5s 墙钟 terminate 是唯一预算口径。
4. **单一终态**：完成/超时/取消只有一种终态——`done` 消息每轮 run 至多发一次；超时由宿主
   kill 整个 worker（进行中的其他 run 如实标 timedOut，不双重预算）；nonce 防陈旧回填
   （迟到 done 不覆盖新 run）。
5. **回调与 Promise 双通道**：pm.sendRequest 的 callback 触发计入生命周期（cb 先于
   promise settle 调用）；桥失败如实 reject 传播为脚本错误（不伪造 ERROR 占位响应）。

## 变量生命周期隔离矩阵（终审 A-007 判据；F 批次增补）

| 层 | 请求内 | 请求间 | 轮间 | 取消/失败后 | 写入面 |
|---|---|---|---|---|---|
| local（pm.variables.set） | 本次请求脚本可读写 | **每请求重置**（不串请求） | 每轮重置 | 不持久 | 仅脚本运行期 |
| iterationData | 本轮可读 | 每轮由数据行重新注入 | 行循环（轮数>行数时取模循环） | 不持久 | 宿主注入，脚本只读 |
| environment | 可读写（pm.environment.set） | 宿主 env 引用跨请求持久 | 跨轮持久 | 取消/失败不影响已写入 | envWrites→宿主分层应用 |
| collection | 可读写 | 持久 | 持久 | 同上 | 同上 |
| globals | 可读写 | 持久 | 持久 | 同上 | 同上 |

- 重试语义：产品无自动重试（失败即停或继续由 stop 开关决定）——「重试后」行为=用户手动重跑，变量层按上表（local/iterationData 重置、持久层保留）。
- 取消：进行中脚本 5s terminate 整个 worker；已写入持久层保留（Postman 同口径）；取消轮剩余行标 skipped 不计入失败（B3 口径）。
- 锁：script-runtime.test 作用域组（含五层同名矩阵）、data-driven.test 跨轮持久/重置/取消、runner-collection-scripts.test 层叠、consistency.test 双端同 fixture。

## 与 Postman 的已知差异（如实登记，不冒充完整兼容）
- `pm.execution.setNextRequest` 等流程控制 API 未实现（fail-closed 显式报错，见 PM_SUPPORT_MATRIX）。
- 集合级 pre-request 在 Postman 中对每个请求执行——本实现按同样语义并入链内，行为一致。
- 样例验证方法：任务书包 `samples/api-studio-smoke.postman_collection.v2.1.json`
  （含 doc 级 prerequest 与请求级 test）可在本工具导入后逐字段核对。

## 变更纪律

修改执行序或合并规则必须：(1) 更新本文件版本号；(2) 同步 `collection-scripts.test.ts`
正反例；(3) 在总账登记。不允许静默改序。
