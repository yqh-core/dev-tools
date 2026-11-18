# Postman Collection v2.1 导入字段矩阵（终审 P1-06）

实现：`src/tools/api-debugger/collection.ts` `importCollection`。状态词与 pm.* 矩阵一致：
`SUPPORTED`（有实现+测试）/ `PARTIAL`（子集，边界注明）/ `UNSUPPORTED`（不导入，**必须进 warning 列表**——未知条目不静默跳过）。

## Collection 层

| 字段 | 状态 | 处理 |
|---|---|---|
| `info.name` / `info.schema` | PARTIAL | 不校验 schema；名称不进内部模型（导入标签用文件名），UI 导入结果可见 |
| `item[]`（请求/folder 递归） | SUPPORTED | 递归展平，folder 名以「父 / 子」路径拼接 |
| `event[]`（集合级 prerequest/test） | SUPPORTED | 并入**每个**请求执行链（契约 v1.1），warning 提示合并事实 |
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
| `event[]`（请求级 prerequest/test） | SUPPORTED | 契约 v1.1 顺序（folder 继承 + 集合叠加） |
| `auth`（请求级） | UNSUPPORTED | **warning** 提示声明头显式化（不应用） |
| `description` | PARTIAL | 丢弃（无 warning——噪声控制；矩阵此处如实声明） |
| folder `event[]`/嵌套 folder | SUPPORTED | 继承链按契约 v1.1 拼接 |

## 导出（往返）

`exportCollection`：请求 → Postman v2.1 item；scriptEvents → `event[{listen,script:{exec}}]`；
默认剔除认证头（分享脱敏边界，可关）。导入 → 导出 → 再导入逐字节一致（`a1-closure.test.ts` 锚定）。

## v3 适配

Postman v3 Collection 适配作为独立层预留（任务书口径）；本矩阵不把内部模型写死 v2.1——
内部模型 = SavedRequest + ScriptEvents，导入/导出是适配层。

## UI 呈现

导入 warning 列表在 API Studio 页面导入区展示（`postmanWarnings`），与 OpenAPI 导入
warning 同一展示面；未知条目不静默跳过（本矩阵每行即判据）。
