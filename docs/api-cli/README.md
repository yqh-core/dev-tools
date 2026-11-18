# API Studio CLI（api-studio）

自研执行入口（任务书 §8 C1：自研执行入口 + Newman 常见参数兼容层 + 格式适配器；Newman 不是产品未来的核心运行依赖）。与浏览器 Runner **共用同一份核心执行语义**（§5：变量优先级、脚本顺序、断言、迭代、错误分类、报告计数只有一份——CLI 直接 bundle 同一批引擎模块）。

> 边界如实声明：CLI 提供**本地**集合运行能力，不能等同也不声称兼容 Postman CLI 的所有云端功能（Postman 官方路线是 Postman CLI 与 v3 Collection；本 CLI 以 Postman Collection v2.1 为迁移目标，内部模型独立，为 v3 预留 adapter）。

## 安装（干净环境）

```bash
# 仓库自举（零新增运行时依赖：产物只含 Node 内建 + 内联源码）
npm run build:cli          # → dist-cli/api-studio-cli.mjs + api-studio-cli-worker.mjs
node dist-cli/api-studio-cli.mjs --version

# 或经 package.json bin（npm install 后）
npx api-studio --help
```

产物审计判据：构建脚本 fail-closed 验证**零外置 npm 导入**（json5/iarna-toml-esm 等全部内联；Node 内置模块除外）——`node_modules` 不在场的目录也能运行。

## 运行

```bash
api-studio run ./collections/smoke.json \
  --environment ./env.json \
  --iteration-data ./data/users.csv \
  --reporters cli,json,junit \
  --report-json ./reports/run.json \
  --report-junit ./reports/junit.xml
```

- Collection 路径：Postman v2.1 JSON 文件，或目录（按文件名排序合并多集合）。
- Environment 文件：Postman environment v2.1（`{values:[{key,value,enabled,secret}]}`）或扁平键值表。**命名环境 fail-closed**（CLI 无本地变量存储；不偷退回退任何凭据——任务书 C4）。
- 数据文件：CSV（RFC 4180 严格解析）/ JSON（顶层数组对象）。异常执行前 fail-closed（退出码 2）。

## 退出码（契约）

| 码 | 语义 |
|---|---|
| 0 | 运行完成且全部通过 |
| 1 | 运行完成但存在失败（断言失败/脚本错误/请求错误/超时/取消） |
| 2 | 运行未完成（集合/环境/数据文件格式错误或加载失败——前置 fail-closed） |
| 3 | 报告写入失败（运行本身可能已通过） |
| 4 | 用法错误 |

## Newman 常见参数兼容

真实映射引擎参数（非无效别名），支持矩阵与测试锚点见 [NEWMAN-COMPAT.md](./NEWMAN-COMPAT.md)。

## 安全边界（与浏览器沙箱同契约）

- `pm.*` 脚本在**独立 worker_threads 沙箱**执行（传输层与浏览器 module Worker 独立实现，pm 语义与守卫共用同一 `script-runtime` 源码）；
- 沙箱内 `fetch/XHR/WebSocket/EventSource/importScripts/Worker/BroadcastChannel/caches/indexedDB/Notification/open/sendBeacon` 读取即抛错（Node worker 有真实 fetch——守卫中和即生效）；
- 脚本唯一网络路径 = `pm.sendRequest` outbox → 宿主 CLI 直连发送（浏览器侧走同源 apiproxy relay；**传输层差异，执行语义一致**——C3 口径）；
- 不支持的 pm API fail-closed 显式抛错（见 [PM_SUPPORT_MATRIX](../api-studio/PM_SUPPORT_MATRIX.md)）；
- 报告默认不含 Secret/Authorization/Cookie/API Key/环境变量值/数据行值/请求响应体/响应头值（列名与行计数可见）。

## 文档

- Newman 参数支持矩阵：[NEWMAN-COMPAT.md](./NEWMAN-COMPAT.md)
- GitHub Actions CI 示例：[github-actions.example.yml](./github-actions.example.yml)
- 执行语义契约（变量优先级/脚本顺序/迭代）：[SCRIPT-CONTRACT.md](../api-studio/SCRIPT-CONTRACT.md)
