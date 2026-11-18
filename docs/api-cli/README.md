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

产物审计判据：构建脚本 fail-closed 验证**零外置 npm 导入**（静态 import/export-from、require()、**副作用裸导入** `import "pkg"`、动态 import() 四种形态全覆盖；json5/iarna-toml-esm 等全部内联；Node 内置模块除外），并**在干净临时目录真实 spawn `node api-studio-cli.mjs --version` 实弹冒烟**（终审 P1-07：旧审计正则曾漏掉副作用裸导入形态，交付产物在干净目录 ERR_MODULE_NOT_FOUND yaml——静态审计 + 实弹冒烟双门禁补齐；`yaml/xml-js/lodash` 经 json-workspace 图手术从 CLI 图中剔除）。

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

## 沙箱边界（终审 P0-01/P1-09 后如实定位，不上调）

- `pm.*` 脚本在**独立 worker_threads 沙箱**执行（传输层与浏览器 module Worker 独立实现，pm 语义与守卫共用同一 `script-runtime`/`script-worker` 源码）；
- **定位 = 开发工具的脚本执行环境 + fail-closed 守卫，不是恶意代码安全边界**。对恶意代码的完整闭环需 OS 边界隔离（独立低权限子进程/容器、默认 deny 网络、进程组 kill、配额）——路线已登记为产品决策项；
- 执行前**静态模块护栏**：脚本文本含 `import(`/`require(` → 明文拒绝（Postman 沙箱同口径：用户脚本无模块系统）。已知局限：正则扫描，混淆构造可绕过文本层；
- **运行时中和**（读取即抛）：fetch/XHR/WebSocket/EventSource/importScripts/Worker/BroadcastChannel/caches/indexedDB/Notification/open/sendBeacon/**Function 构造器/eval**；CLI 侧额外中和 `process`（环境变量/进程/文件逃逸面）——CI Secret 不经沙箱可执行面：secret 经环境文件由**宿主侧**加载与替换，脚本只能经 pm.* 变量层读到用户自己声明的值；
- WebAssembly 不列入守卫（实证：worker_threads 引导期存在原生 WebAssembly 读，列入反而破坏沙箱自身启动；无宿主导入即无 fs/net 能力，内存面由 resourceLimits 兜底）；
- **资源限额**：5s 墙钟 terminate 整个 worker 并重建；`resourceLimits` 堆 512MiB/64MiB（超限 V8 杀 worker，宿主如实承载）；outbox 累计发送 100/脚本运行、单 spec 1MB（UTF-8 字节）、宿主桥响应体 1MB 字节级截断、console 捕获 256KB/轮；
- **如实登记的残余**（实弹探针 P11 实证可达）：原型链混淆（`''.constructor.constructor` + 拆分字符串）在 worker_threads 下仍可构造动态 import——进程内 JS 沙箱无法对恶意代码闭环，Node 官方 Permission Model 同样实证不拦模块加载。部署建议：CI 中以独立低权限身份/容器运行 CLI，CI Secret 只经宿主侧环境文件注入；
- 网络唯一路径 = `pm.sendRequest` outbox → 宿主 CLI 直连发送（浏览器侧走同源 apiproxy relay；**传输层差异，执行语义一致**——C3 口径）。沙箱守卫面内"仅 outbox 可联网"成立，不对恶意代码作边界承诺；
- 不支持的 pm API fail-closed 显式抛错（见 [PM_SUPPORT_MATRIX](../api-studio/PM_SUPPORT_MATRIX.md)）；
- 报告默认不含 Secret/Authorization/Cookie/API Key/环境变量值/数据行值/请求响应体/响应头值；**已标记 secret 的值**在 JSON/JUnit/stdout 三面值级替换（含 URL 面），未标记任意值不假装全知扫描（三层口径见 report.ts）。

## 文档

- Newman 参数支持矩阵：[NEWMAN-COMPAT.md](./NEWMAN-COMPAT.md)
- GitHub Actions CI 示例：[github-actions.example.yml](./github-actions.example.yml)
- 执行语义契约（变量优先级/脚本顺序/迭代）：[SCRIPT-CONTRACT.md](../api-studio/SCRIPT-CONTRACT.md)
