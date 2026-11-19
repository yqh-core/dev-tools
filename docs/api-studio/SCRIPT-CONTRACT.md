# API Studio 脚本执行顺序契约 v1.2（2026-11-19：G3 树模型运行期链计算）

本文件是**版本化产品契约**（任务书 A3 要求：顺序不凭记忆臆造，写成契约并用真实样例测试）。
实现（G3 起双路径）：
- **树路径（标准模型）**：`src/tools/api-debugger/collection-tree.ts`（`scriptChain`/`chainSources`/`executablesFromTree` 运行期从树计算执行链）+ `runner.ts`（`runCollectionTree`）；脚本文本保留在树节点（collection/folder/request）的 `scripts` 上，**不在导入期拼接**。
- **flat 遗留路径**：`collection.ts`（`importCollection` 的 preChain/testChain 导入期合并）+ `runner.ts`（`runCollection`）——口径与 v1.1 逐字一致，供 API-006/010/011 回归锁与历史调用方。

测试：`collection-tree.test.ts`（树执行链顺序、兄弟隔离、合并双侧保脚本等正负例）、`collection-scripts.test.ts`（flat 同序拼接负控）、`runner-collection-scripts.test.ts`（层叠）。

## 变更记录

- v1.2（2026-11-19，G3 / 终审 P1-05 + 修复指令 #9）：树模型——脚本作为节点属性持久化，执行链**运行期从树结构计算**（不把合并文本写进请求作唯一模型）。**执行顺序本体不变**（pre 外→内 / test 内→外）。新增「树模型运行期链计算」节；导入/导出规则拆分 flat（展平）与 tree（保形）双路径。
- v1.1（2026-11-18，终审 P1-04/E5）：增补「异步脚本生命周期」节——pm.test 回调 Promise、
  顶层 await、outbox 完成等待、单一终态。执行顺序本体不变。
- v1（2026-11-17）：初始版本。

## 执行顺序（对标 Postman 官方执行序，核验日 2026-11-17）

对每个请求，一次 Collection Run 中脚本执行顺序为：

1. **pre-request**：由外到内 —— `Collection 级 → Folder 级 → Request 级`（外层先跑）。
2. 发送请求（含 pre-request 的变量写入与请求级 mutation）。
3. **test**：由内到外 —— `Request 级 → Folder 级 → Collection 级`（内层先跑）。

同层多段事件按 Postman 文件内出现顺序拼接（以 `\n` 连接）。

## 树模型运行期链计算（v1.2）

标准内部模型 = 有稳定 ID 的 Collection/Folder/Request 树（`collection-tree.ts`）。脚本是**节点属性**，
执行链在运行期由 `scriptChain(tree, requestId)` 计算，**不把拼接文本持久化到请求节点**（终审 P1-05 判据）：

- `pre = [集合脚本.prerequest, ...祖先 folder.prerequest(外→内), 请求.prerequest]`，按 `\n` 连接（空段不进）。
- `test = [请求.test, ...祖先 folder.test(内→外), 集合脚本.test]`，按 `\n` 连接。
- 与 v1.1 flat 导入期合并**逐字等价**（同序、同 `\n` 连接），故双路径执行结果一致（`consistency.test.ts` 锁）。

语义要点（`collection-tree.test.ts` 直接锁）：
- **兄弟隔离**：folder 的脚本只作用于其**后代**，不影响同级兄弟 folder 的子请求。
- **空 folder 不贡献执行单元**：`executablesFromTree` 深度优先展开时跳过无请求的 folder。
- **继承来源可视化**：`chainSources(tree, id)` 返回 pre/test 两列 `{level, name, hasScripts}`，
  供 UI 标注「本请求会执行哪些层级脚本」（`/api-studio` 脚本面板 + E2E `api-studio.e2e.ts`）。
- **集合/folder 脚本不被选项重复叠加**：树路径集合层=根节点 `scripts`，`runCollectionTree` 不再经
  `collectionScripts` 选项叠加（避免双层重复执行）；`collectionScripts` 选项仅 flat 遗留路径使用。

## 导入规则（Postman Collection v2.1）

`event[].listen` 只认 `prerequest` 与 `test`；`script.exec` 接受字符串数组或单字符串。两条导入路径并存：

**flat 路径 `importCollection`（遗留）**
- 集合级（`doc.event`）事件并入**每个**请求的执行链；warning 如实提示合并事实，不静默改写。
- Folder 级事件对其全部子请求（含嵌套 folder）继承；请求名以「父 / 子」展平拼接。
- 结果 `scriptEvents` 只有 `prerequest`/`test` 两键；空段不写键。

**tree 路径 `importCollectionTree`（标准）**
- 嵌套 folder 保留为结构化节点（稳定 ID：`_postman_id ?? id ?? 路径确定性哈希`，重导入幂等）；
  folder 级事件留在 folder 节点 `scripts` 上，**不导入期展平/拼接**。
- `doc.event` = 根（collection）节点 `scripts`；warning 提示「保留为集合节点脚本，运行期作用于每个请求」。
- 执行链交给上面的「运行期链计算」，导入产物只含各节点自身脚本。

## 导出规则（往返不丢）

- flat `exportCollection`：`scriptEvents.prerequest`/`test` 按 `\n` 拆成 `exec` 数组，生成
  `event: [{listen, script:{exec}}]`；无脚本请求不生成 `event` 键。
- tree `exportCollectionTree`：folder/request 递归嵌套 `item`，节点 `_postman_id` 写回，事件按层级
  形态写回 —— **导出 → 导入 → 再导出 round-trip 保留嵌套结构与节点 ID**
  （`collection-tree.test.ts` 树互操作 round-trip 断言锚定）。
- 两路径默认都剔除认证头（分享脱敏边界，可关）。

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
