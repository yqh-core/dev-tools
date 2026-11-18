/**
 * API Studio CLI · 参数解析与契约文档（任务书 §8 C2）。
 *
 * 退出码约定（C2「可预测、文档化」+ C5「非零码覆盖断言失败/格式错误/超时/写失败」）：
 *   0 = 运行完成且全部通过
 *   1 = 运行完成但存在失败（断言/脚本/请求错误/超时/取消）
 *   2 = 运行未完成（前置 fail-closed：集合/环境/数据文件格式错误、加载失败、意外运行错误）
 *   3 = 报告写入失败（运行本身可能已通过）
 *   4 = 用法错误（参数非法）
 *
 * Newman 常见参数兼容（C2：兼容必须真实可用并有测试，不做无效别名）：
 *   -e/--environment FILE · -d/--iteration-data FILE · -n/--iteration-count N ·
 *   --bail · --timeout-request MS · --delay-request MS · --reporters · --report-json · --report-junit
 */

export type ReporterKind = 'cli' | 'json' | 'junit';

export interface CliArgs {
  command: 'run'
  /** 集合路径：Postman v2.1 JSON 文件，或目录（目录=按文件名排序合并多集合，§C2 示例口径）。 */
  collectionPath: string
  /** -e/--environment：环境 JSON 文件路径（Postman environment v2.1 或扁平键值表）。 */
  environmentFile?: string
  /** -d/--iteration-data：数据文件（CSV/JSON）。 */
  iterationDataFile?: string
  /** -n/--iteration-count：显式迭代轮数（不传=数据行数；无数据文件=1）。 */
  iterations?: number
  /** --timeout-request：单请求超时 ms（AbortController）。 */
  requestTimeoutMs: number
  /** --delay-request：请求间隔 ms（轮内与轮间，对齐 Runner delayMs）。 */
  delayMs: number
  /** 发送失败即停整个运行（引擎默认 true，对齐 Postman runtime）。 */
  stopOnError: boolean
  /** --bail：断言失败即停（Newman --bail 语义）。 */
  stopOnFailure: boolean
  reporters: ReporterKind[]
  reportJsonPath?: string
  reportJunitPath?: string
  /** 非交互 CI 模式：命名环境 fail-closed、进度紧凑、无颜色。 */
  ci: boolean
}

export type CliParseResult = { ok: true; args: CliArgs } | { ok: false; error: string }

export const CLI_VERSION = '2026.01.22-v2';

const REPORTERS: ReporterKind[] = ['cli', 'json', 'junit'];

function isPositiveInt(s: string): boolean {
  return /^\d+$/.test(s) && Number(s) > 0;
}

/** 解析 argv（不含 node/script 前缀）。--help/--version 以 ok 结果携带标记交由 main 输出。 */
export function parseArgs(argv: string[]): { ok: true; args: CliArgs } | { ok: false; error: string } | { ok: true; help: true } | { ok: true; version: true } {
  const out: CliArgs = {
    command: 'run',
    collectionPath: '',
    requestTimeoutMs: 30000,
    delayMs: 0,
    stopOnError: true,
    stopOnFailure: false,
    reporters: ['cli'],
    ci: false,
  };
  const positionals: string[] = [];
  let i = 0;
  const needValue = (flag: string): string => {
    if (i >= argv.length) throw new Error(`缺少参数值：${flag} <value>`);
    return argv[i++];
  };
  try {
    while (i < argv.length) {
      const a = argv[i++];
      switch (a) {
        case '--help':
        case '-h':
          return { ok: true, help: true };
        case '--version':
        case '-v':
          return { ok: true, version: true };
        case 'run':
          out.command = 'run';
          break;
        case '-e':
        case '--environment':
          out.environmentFile = needValue(a);
          break;
        case '-d':
        case '--iteration-data':
          out.iterationDataFile = needValue(a);
          break;
        case '-n':
        case '--iteration-count': {
          const v = needValue(a);
          if (!isPositiveInt(v)) throw new Error(`${a} 必须是正整数（收到 "${v}"）`);
          out.iterations = Number(v);
          break;
        }
        case '--timeout-request': {
          const v = needValue(a);
          if (!isPositiveInt(v)) throw new Error(`${a} 必须是正整数毫秒（收到 "${v}"）`);
          out.requestTimeoutMs = Number(v);
          break;
        }
        case '--delay-request': {
          const v = needValue(a);
          if (!/^\d+$/.test(v)) throw new Error(`${a} 必须是非负整数毫秒（收到 "${v}"）`);
          out.delayMs = Number(v);
          break;
        }
        case '--bail':
          out.stopOnFailure = true;
          break;
        case '--stop-on-error':
          out.stopOnError = true;
          break;
        case '--no-stop-on-error':
          out.stopOnError = false;
          break;
        case '--reporters': {
          const v = needValue(a);
          const parts = v.split(',').map(s => s.trim()).filter(Boolean);
          if (!parts.length || parts.some(p => !REPORTERS.includes(p as ReporterKind))) {
            throw new Error(`--reporters 必须是 ${REPORTERS.join(',')} 的逗号子集（收到 "${v}"）`);
          }
          out.reporters = [...new Set(parts)] as ReporterKind[];
          break;
        }
        case '--report-json':
          out.reportJsonPath = needValue(a);
          break;
        case '--report-junit':
          out.reportJunitPath = needValue(a);
          break;
        case '--ci':
          out.ci = true;
          break;
        default:
          if (a.startsWith('-')) {
            throw new Error(`未知参数：${a}（见 --help）`);
          }
          positionals.push(a);
      }
    }
  }
  catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (positionals.length !== 1) {
    return { ok: false, error: '需要恰好一个位置参数：Collection 路径（Postman v2.1 JSON 文件或目录）。见 --help。' };
  }
  out.collectionPath = positionals[0];
  // report 路径与 reporter 选择的 fail-closed 校验（不给无效组合跑到运行结束才报）
  if (out.reportJsonPath && !out.reporters.includes('json')) {
    return { ok: false, error: '--report-json 已指定但 --reporters 不含 json。' };
  }
  if (out.reportJunitPath && !out.reporters.includes('junit')) {
    return { ok: false, error: '--report-junit 已指定但 --reporters 不含 junit。' };
  }
  if (out.reporters.includes('json') && !out.reportJsonPath) {
    return { ok: false, error: '--reporters 含 json 但未指定 --report-json 输出路径。' };
  }
  if (out.reporters.includes('junit') && !out.reportJunitPath) {
    return { ok: false, error: '--reporters 含 junit 但未指定 --report-junit 输出路径。' };
  }
  return { ok: true, args: out };
}

export const HELP_TEXT = `API Studio CLI ${CLI_VERSION} — 数据驱动 API 集合运行器（与浏览器 Runner 共用同一套 Runtime/Runner 核心语义，任务书 §5/§8）

用法：
  api-studio run <collection.json|目录> [选项]
  api-studio --help | --version

位置参数：
  <collection>        Postman Collection v2.1 JSON 文件路径；或目录（按文件名排序合并运行）

环境与数据：
  -e, --environment <file.json>   环境文件（Postman environment v2.1 {values:[{key,value,enabled}]} 或扁平 {k:v}）。
                                  命名环境（Newman 从 Postman 应用取）在本 CLI fail-closed：CLI 无本地变量存储。
  -d, --iteration-data <file>     数据文件（CSV RFC 4180 / JSON 顶层数组对象），每行一轮迭代（pm.iterationData）
  -n, --iteration-count <N>       显式迭代轮数（默认=数据行数；无数据文件=1；轮数>行数时行循环取用）

执行控制：
  --timeout-request <ms>          单请求超时（默认 30000；超时计入 request_error，退出码 1）
  --delay-request <ms>            请求间隔（默认 0）
  --stop-on-error / --no-stop-on-error   发送失败即停整个运行（默认开，对齐 Postman runtime）
  --bail                          断言失败即停（Newman --bail 语义 → 引擎 stopOnFailure）
  --ci                            非交互 CI 模式（紧凑进度；歧义输入一律 fail-closed）

报告（reporter 输出全部脱敏：Secret/Authorization/Cookie/API Key/环境变量值/数据行值/请求响应体/响应头值默认不进报告）：
  --reporters <cli,json,junit>    reporter 选择（默认 cli 仅 stdout）
  --report-json <path>            JSON 报告落盘（需 reporters 含 json；version=1 schema）
  --report-junit <path>           JUnit XML 落盘（需 reporters 含 junit；CI 可解析，失败定位到迭代/请求/断言）

退出码（文档化契约）：
  0  运行完成且全部通过
  1  运行完成但存在失败（断言失败/脚本错误/请求错误/超时/取消）
  2  运行未完成（集合/环境/数据文件格式错误或加载失败——前置 fail-closed）
  3  报告写入失败（运行本身可能已通过）
  4  用法错误

Newman 常见参数兼容（真实映射引擎参数，支持矩阵见 docs/api-cli/NEWMAN-COMPAT.md）：
  -e ✔ · -d ✔ · -n ✔ · --bail ✔ · --timeout-request ✔ · --delay-request ✔ · --reporters ✔

安全边界（与浏览器沙箱同契约）：
  pm.* 脚本在独立 worker_threads 沙箱执行；fetch/XHR/WebSocket 等网络全局读取即抛错；
  脚本唯一网络路径 = pm.sendRequest outbox → 宿主 CLI 直接发送（浏览器侧走同源 apiproxy relay，
  CLI 侧直连——传输层差异，执行语义一致）；不支持 API fail-closed 显式抛错。
`.trimEnd();
