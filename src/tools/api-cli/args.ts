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

export type CliParseResult = { ok: true; args: CliArgs } | { ok: false; error: string };

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
    if (i >= argv.length) {
      throw new Error(`Missing value for ${flag} <value>`);
    }
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
          if (!isPositiveInt(v)) {
            throw new Error(`${a} must be a positive integer (received "${v}")`);
          }
          out.iterations = Number(v);
          break;
        }
        case '--timeout-request': {
          const v = needValue(a);
          if (!isPositiveInt(v)) {
            throw new Error(`${a} must be a positive integer in milliseconds (received "${v}")`);
          }
          out.requestTimeoutMs = Number(v);
          break;
        }
        case '--delay-request': {
          const v = needValue(a);
          if (!/^\d+$/.test(v)) {
            throw new Error(`${a} must be a non-negative integer in milliseconds (received "${v}")`);
          }
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
            throw new Error(`--reporters must be a comma-separated subset of ${REPORTERS.join(',')} (received "${v}")`);
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
            throw new Error(`Unknown argument: ${a} (see --help)`);
          }
          positionals.push(a);
      }
    }
  }
  catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (positionals.length !== 1) {
    return { ok: false, error: 'Exactly one positional argument is required: the collection path (a Postman v2.1 JSON file or a directory). See --help.' };
  }
  out.collectionPath = positionals[0];
  // report 路径与 reporter 选择的 fail-closed 校验（不给无效组合跑到运行结束才报）
  if (out.reportJsonPath && !out.reporters.includes('json')) {
    return { ok: false, error: '--report-json was given but --reporters does not include json.' };
  }
  if (out.reportJunitPath && !out.reporters.includes('junit')) {
    return { ok: false, error: '--report-junit was given but --reporters does not include junit.' };
  }
  if (out.reporters.includes('json') && !out.reportJsonPath) {
    return { ok: false, error: '--reporters includes json but --report-json output path was not given.' };
  }
  if (out.reporters.includes('junit') && !out.reportJunitPath) {
    return { ok: false, error: '--reporters includes junit but --report-junit output path was not given.' };
  }
  return { ok: true, args: out };
}

export const HELP_TEXT = `API Studio CLI ${CLI_VERSION} — data-driven API collection runner (one Runtime/Runner core shared with the browser Runner; task book §5/§8)

Usage:
  api-studio run <collection.json|directory> [options]
  api-studio --help | --version

Positional:
  <collection>        Postman Collection v2.1 JSON file path; or a directory (merged and run in filename order)

Environment & data:
  -e, --environment <file.json>   Environment file (Postman environment v2.1 {values:[{key,value,enabled}]} or flat {k:v}).
                                  Named environments (Newman reads them from the Postman app) are fail-closed here: the CLI has no local variable storage.
  -d, --iteration-data <file>     Data file (CSV RFC 4180 / JSON top-level array of objects); each row drives one iteration (pm.iterationData)
  -n, --iteration-count <N>       Explicit iteration count (default = row count; 1 with no data file; rows cycle when count > rows)

Execution control:
  --timeout-request <ms>          Per-request timeout (default 30000; timeouts count as request_error, exit code 1)
  --delay-request <ms>            Delay between requests (default 0)
  --stop-on-error / --no-stop-on-error   Stop the whole run on send failure (default on; matches Postman runtime)
  --bail                          Stop on assertion failure (Newman --bail semantics -> engine stopOnFailure)
  --ci                            Non-interactive CI mode (compact progress; ambiguous input always fail-closed)

Reports (all reporter output is redacted by default: Secret/Authorization/Cookie/API Key/environment values/data row values/request & response bodies/response header values never enter reports):
  --reporters <cli,json,junit>    Reporter selection (default cli, stdout only)
  --report-json <path>            JSON report on disk (requires reporters incl. json; version=1 schema)
  --report-junit <path>           JUnit XML on disk (requires reporters incl. junit; CI-parseable; failures locate to iteration/request/assertion)

Exit codes (documented contract):
  0  Run completed, all passed
  1  Run completed with failures (assertion/script/request error/timeout/cancel)
  2  Run not completed (collection/environment/data file format error or load failure - front fail-closed)
  3  Report write failed (the run itself may have passed)
  4  Usage error

Newman flag compatibility (real engine parameter mapping; support matrix: docs/api-cli/NEWMAN-COMPAT.md):
  -e ✔ · -d ✔ · -n ✔ · --bail ✔ · --timeout-request ✔ · --delay-request ✔ · --reporters ✔

Security boundary (same contract as the browser sandbox):
  pm.* scripts run in an isolated subprocess sandbox; network globals like fetch/XHR/WebSocket throw on read;
  the only network path for scripts = pm.sendRequest outbox -> the host CLI sends directly (the browser side uses the same-origin
  apiproxy relay, the CLI side connects directly - transport difference, identical execution semantics); unsupported pm APIs fail closed with explicit errors.
`.trimEnd();
