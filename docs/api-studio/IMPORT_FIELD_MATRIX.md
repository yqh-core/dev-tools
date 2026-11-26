# Postman Collection v2.1 导入字段矩阵（终审 P1-06 · G3 树模型 v1.2）

实现双路径（G3）：
- **tree 标准路径** `collection.ts` `importCollectionTree` / `exportCollectionTree` + `collection-tree.ts`：
  嵌套 folder **保形**为有稳定 ID 的结构化节点，事件留在各节点 `scripts`（不在导入期展平/拼接）。
- **flat 遗留路径** `collection.ts` `importCollection` / `exportCollection`：folder 递归**展平**为「父 / 子」名、
  事件在导入期并入每请求执行链（口径与 G3 前一致，供回归锁）。

状态词与 pm.* 矩阵一致：
`SUPPORTED`（有实现+测试）/ `PARTIAL`（子集，边界注明）/ `UNSUPPORTED`（不导入，**必须进 warning 列表**——未知条目不静默跳过）。

## Collection 层

| 字段 | 状态 | 处理 |
|---|---|---|
| `info.name` / `info.schema` | PARTIAL | 不校验 schema；tree 路径 `info.name` → 集合根节点 name（flat 路径不进模型，用导入标签） |
| `_postman_id` / `info._postman_id` | SUPPORTED | tree 路径作节点稳定 ID（缺失用「祖先路径/名」确定性哈希，重导入幂等）；导出写回 `_postman_id` |
| `item[]`（请求/folder 递归） | SUPPORTED | tree 路径**保形**嵌套 folder（有稳定 ID 的结构化节点）；flat 路径递归展平为「父 / 子」名 |
| `event[]`（集合级 prerequest/test） | SUPPORTED | tree 路径留集合根节点 `scripts`（运行期作用每个请求）；flat 路径并入每请求链；均 warning 如实提示 |
| `event[].listen` 非 prerequest/test | PARTIAL | 忽略并 warning（不静默丢弃） |
| `variable[]`（集合变量） | UNSUPPORTED | 不导入（内部模型变量层由 Runner/环境面板承载） |
| `auth`（集合级） | UNSUPPORTED | 不导入；请求级 auth 见下 |
| `protocolProfileBehavior` | UNSUPPORTED | 不导入 |
| 非对象 item 条目 | — | warning + 跳过（不静默） |
| 无 request 且无 item 的条目 | — | warning + 跳过（不静默） |

## Request 层

| 字段 | 状态 | 处理 |
|---|---|---|
| `name` | SUPPORTED | 请求名（缺失回退 'item'） |
| `method` | SUPPORTED | 缺失默认 GET（Postman 同口径） |
| `url` 字符串 / `{raw}` | SUPPORTED | raw 原样保留（含 `{{var}}` 与相对 URL） |
| `url` 结构分解（host/path/query/variable） | PARTIAL | 不分解——以 raw 字符串整体承载，语义不失 |
| `header[]`（key/value） | SUPPORTED | 描述(description)字段丢弃 |
| `body.mode=raw` + `body.raw` | SUPPORTED | 字符串体导入 |
| `body.mode=urlencoded/formdata/file/binary/graphql` | UNSUPPORTED | **不静默丢弃**：warning 提示「仅 raw 体导入，请手动重录」 |
| `event[]`（请求级 prerequest/test） | SUPPORTED | tree 路径留请求节点 `scripts`，运行期按契约 v1.2 与祖先链拼接；flat 路径导入期即拼接 |
| `auth`（请求级） | UNSUPPORTED | **warning** 提示声明头显式化（不应用） |
| `description` | PARTIAL | 丢弃（无 warning——噪声控制；矩阵此处如实声明） |
| folder `event[]`/嵌套 folder | SUPPORTED | tree 路径 folder 事件留 folder 节点、只作用后代（兄弟隔离）；flat 路径展平后按契约 v1.1 拼接 |

## 导出（往返）

- **flat `exportCollection`**：SavedRequest[] → v2.1 item（展平名）；scriptEvents → `event[{listen,script:{exec}}]`；
  手动集合脚本 → doc 级事件。默认剔除认证头（分享脱敏边界，可关）。导入 → 导出 → 再导入逐字节一致（`a1-closure.test.ts` 锚定）。
- **tree `exportCollectionTree`**：CollectionNode → 递归嵌套 item，folder 结构 + 节点 `_postman_id` + 各层事件保形写回。
  **导出 → 导入 → 再导出 round-trip 保留嵌套结构与节点 ID**（`collection-tree.test.ts` 树互操作断言锚定）。

## v3 适配

Postman v3 Collection 适配作为独立层预留（任务书口径）；本矩阵不把内部模型写死 v2.1——
G3 起内部标准模型 = **`CollectionNode` 树（有稳定 ID 的 Collection/Folder/Request）**；
flat `SavedRequest + ScriptEvents` 保留为迁移源与回归锁。导入/导出是适配层。

## UI 呈现

导入 warning 列表在 API Studio 页面导入区展示（`postmanWarnings`），与 OpenAPI 导入
warning 同一展示面；未知条目不静默跳过（本矩阵每行即判据）。
