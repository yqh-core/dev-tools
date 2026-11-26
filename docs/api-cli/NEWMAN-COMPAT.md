# Newman 常见参数兼容矩阵（API Studio CLI v2026.01.22-v2）

任务书 §8 C2：兼容必须真实可用并有测试，不做无效别名。C5：支持矩阵明确。
状态词：`SUPPORTED`（真实映射引擎参数+实测）/ `UNSUPPORTED`（fail-closed 提示或明确不做，不假装兼容）。

## SUPPORTED（真实映射）

| Newman 参数 | API Studio CLI | 映射语义 | 测试锚点 |
|---|---|---|---|
| `newman run <col>` | `api-studio run <col\|目录>` | 位置参数；目录=按文件名排序合并 | cli E2E S1/S10 |
| `-e <env.json>` / `--environment` | 同名 | Postman environment v2.1 或扁平表解析；命名环境 fail-closed（CLI 无本地存储） | env-file.test / E2E S1/S12 |
| `-d <file>` / `--iteration-data` | 同名 | CSV/JSON 严格解析，每行一轮（pm.iterationData） | datafiles.test / E2E S1 |
| `-n <N>` / `--iteration-count` | 同名 | 显式轮数（默认=行数；轮数>行数行循环） | data-driven.test / E2E S1(-n 3)/S7 口径 |
| `--bail` | `--bail` | 断言失败即停整个运行（引擎 stopOnFailure） | data-driven.test / E2E S1 |
| `--timeout-request <ms>` | 同名 | 单请求 AbortController 超时 → request_error | E2E S7 |
| `--delay-request <ms>` | `--delay-request` | 请求间隔（轮内+轮间） | args.test / 引擎 delayMs |
| `--reporters cli,json,junit` | 同名 | cli=stdout 文本；json/junit=落盘 | E2E S1/S5 |
| `--report-json <path>` | 同名 | version=1 schema JSON 落盘 | E2E S1 |
| `--report-junit <path>` | 同名 | JUnit XML 落盘（CI 可解析） | E2E S1 |
| `--suppress-exit-code` 的反面 | （退出码即契约） | 失败必非零，不提供抑制 | E2E S3-S7 |

## UNSUPPORTED（明确不做，fail-closed 或文档化边界）

| Newman 参数 | 状态 | 口径 |
|---|---|---|
| `-g/--global <var>` / `--global-var` | UNSUPPORTED | CLI 无 globals 存储；用环境文件（任务书 C2 环境文件口径） |
| `--folder <name>` / `--group` / `--request` / `--request-name` | UNSUPPORTED | v1 运行整个集合；不选子集（不做无效别名） |
| `--collection <col>` 长标志形式 | UNSUPPORTED | 位置参数口径（--help 文档化） |
| `--export-collection/--export-environment/--export-report` | UNSUPPORTED | 导出在浏览器侧已支持；CLI v1 不做 |
| `--disable-unicode` / `--color` / `--quiet` / `--silent` | UNSUPPORTED | 进度固定紧凑格式走 stderr |
| `--insecure` / `--ssl-client-cert` 等 TLS 选项 | UNSUPPORTED | Node fetch 默认 CA 口径；需求出现再增量补 |
| `--cwd` / `--config` | UNSUPPORTED | 路径参数直接传 |
| Postman CLI 云端功能（云端集合/监控/模拟） | UNSUPPORTED | 本 CLI 是本地执行入口，不声称兼容 Postman CLI 云端功能（C1 明文边界） |

## 一致性保证（C3）

同一 Collection + Environment + 数据文件在浏览器 Runner 与 CLI 下：变量优先级（local>iterationData>environment>collection>globals）、脚本顺序契约 v1.1、请求顺序、断言结果、数据迭代、错误分类（五态映射）、报告计数**一致**——双方调用同一 `runCollection`/`importCollection`/`parseDataFile`/`buildRunReport`/`toJUnitXml`。差异仅：传输层（CLI 直连 fetch；浏览器同源 relay）与交互形式（stdout/stderr；无 UI）。
