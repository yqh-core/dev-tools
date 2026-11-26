/**
 * API Studio CLI · run 编排（任务书 §8 C2/C3 + §5 层 8 CLI Adapter）。
 *
 * 一致性硬约束（C3）：集合/环境/数据文件在 Browser 与 CLI 下核心执行结果一致——
 * 本模块直接复用浏览器侧同一批引擎模块（importCollection/runCollection/
 * parseDataFile/buildRunReport/toJUnitXml/formatCollectionReportText），
 * 不重新实现变量规则、脚本顺序、断言、迭代、错误分类。允许差异仅在传输层
 * （CLI 直连 fetch；浏览器走同源 apiproxy relay）与交互形式（stdout 进度）。
 *
 * 退出码（exit-code.ts 分类，main 翻译）：0 全过 / 1 有失败 / 2 前置 fail-closed /
 * 3 报告写入失败 / 4 用法错误。
 */
/// <reference types="node" />
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { importCollection } from '../api-debugger/collection';
import type { ImportedRequest } from '../api-debugger/openapi';
import { type DataFile, parseDataFile } from '../api-debugger/datafiles';
import { type CollectionRunSummary, type RequestRunResult, type RunnerResponse, type SendFn, formatCollectionReportText, runCollection } from '../api-debugger/runner';
import { type RunReportMeta, buildRunReport, toJUnitXml } from '../api-debugger/report';
import type { SavedRequest } from '../api-debugger/store';
import { parseEnvironmentFile } from './env-file';
import { classifyCliExit } from './exit-code';
import { type CliRunScriptFn, createSandboxRunScript } from './sandbox';
import { API_STUDIO_CLI_VERSION } from './version';
import type { CliArgs } from './args';

/** 运行未完成的前置/意外错误（kind 决定退出码 2；写失败 kind 决定 3）。 */
export class CliRunError extends Error {
  constructor(message: string, public readonly kind: 'load' | 'run' | 'write') {
    super(message);
  }
}

export interface ExecuteRunResult {
  exit: number
  label: string
  summary: CollectionRunSummary | null
  reportWriteError?: string
}

export interface ExecuteRunOptions {
  /** 单测注入 stub；缺省=真实沙箱执行器 */
  runScript?: CliRunScriptFn
  /** 单测注入 send stub；缺省=真实直连 fetch（buildCliSend） */
  send?: SendFn
  /** G2 沙箱入口 URL（缺省=隔离子进程 bundle api-studio-cli-child.mjs：进程边界+干净 env+空 cwd+组 kill+内存软上限）。 */
  sandboxUrl?: URL
}

/** 集合加载：文件=Postman v2.1 JSON；目录=按文件名排序合并多集合（C2 示例口径）。 */
export function loadCollectionRequests(collectionPath: string): { requests: SavedRequest[]; warnings: string[]; label: string } {
  let st;
  try {
    st = statSync(collectionPath);
  }
  catch {
    throw new CliRunError(`Collection path not found: ${collectionPath}`, 'load');
  }
  const imported: ImportedRequest[] = [];
  const warnings: string[] = [];
  let label: string;
  if (st.isDirectory()) {
    const files = readdirSync(collectionPath).filter(f => f.toLowerCase().endsWith('.json')).sort();
    if (!files.length) {
      throw new CliRunError(`Collection directory contains no .json files: ${collectionPath}`, 'load');
    }
    for (const f of files) {
      const r = importCollection(readFileSync(join(collectionPath, f), 'utf8'));
      imported.push(...r.requests);
      warnings.push(...r.warnings.map(w => `${f}: ${w}`));
    }
    label = `${basename(collectionPath)} (${files.length} file(s))`;
  }
  else {
    const r = importCollection(readFileSync(collectionPath, 'utf8'));
    imported.push(...r.requests);
    warnings.push(...r.warnings);
    label = basename(collectionPath).replace(/\.json$/i, '');
  }
  if (!imported.length) {
    throw new CliRunError(`No runnable requests imported from "${collectionPath}" (empty collection or missing item array).`, 'load');
  }
  const now = Date.now();
  const requests: SavedRequest[] = imported.map((r, i) => ({
    id: `cli-${i + 1}`,
    name: r.name,
    request: r.request,
    createdAt: now,
    updatedAt: now,
    ...(r.scriptEvents ? { scriptEvents: r.scriptEvents } : {}),
  }));
  return { requests, warnings, label };
}

/** 环境加载：-e 文件（Postman environment v2.1 或扁平表）；命名环境 fail-closed（CLI 无本地存储）。 */
export function loadEnvironment(environmentFile: string | undefined): { env: Record<string, string>; name?: string; secretNames: string[] } {
  if (!environmentFile) {
    return { env: {}, secretNames: [] };
  }

  let text: string;
  try {
    text = readFileSync(environmentFile, 'utf8');
  }
  catch {
    throw new CliRunError(`Environment file not readable: ${environmentFile}`, 'load');
  }
  const r = parseEnvironmentFile(text, environmentFile);
  if (!r.ok) {
    throw new CliRunError(r.error, 'load');
  }
  return { env: r.env, name: r.name, secretNames: r.secretNames };
}

/** 数据文件加载：严格解析 fail-closed（与浏览器同引擎）。 */
export function loadIterationData(iterationDataFile: string | undefined): { dataFile: DataFile; dataFileType: 'csv' | 'json' } | null {
  if (!iterationDataFile) {
    return null;
  }

  let text: string;
  try {
    text = readFileSync(iterationDataFile, 'utf8');
  }
  catch {
    throw new CliRunError(`Iteration data file not readable: ${iterationDataFile}`, 'load');
  }
  const r = parseDataFile(iterationDataFile, text);
  if (!r.ok) {
    throw new CliRunError(`Iteration data file error: ${r.error}`, 'load');
  }
  const dataFileType = iterationDataFile.toLowerCase().endsWith('.json') ? 'json' : 'csv';
  return { dataFile: r.data, dataFileType };
}

/** CLI 请求执行器：宿主直连 fetch（浏览器侧走同源 apiproxy relay——传输层差异，执行语义一致）。
 *  单请求超时AbortController；超时计为 request_error（退出码 1，C5）。 */
export function buildCliSend(requestTimeoutMs: number): SendFn {
  return async (payload) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const started = Date.now();
    try {
      const resp = await fetch(payload.url, {
        method: payload.method,
        headers: Object.fromEntries(payload.headers.map(h => [h.name, h.value])),
        body: payload.method === 'GET' || payload.method === 'HEAD' ? undefined : payload.body,
        signal: controller.signal,
        redirect: 'follow',
      });
      const body = await resp.text();
      const headers: Record<string, string> = {};
      resp.headers.forEach((v, k) => {
        headers[k] = v;
      });
      const response: RunnerResponse = {
        url: resp.url,
        status: resp.status,
        statusText: resp.statusText,
        headers,
        body,
        elapsedMs: Date.now() - started,
        ...(resp.url !== payload.url ? { followed: true, redirect: resp.url } : {}),
      };
      return response;
    }
    catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`Request timed out after ${requestTimeoutMs} ms.`);
      }
      throw e;
    }
    finally {
      clearTimeout(timer);
    }
  };
}

function writeReportFile(path: string, content: string): void {
  try {
    writeFileSync(path, content, 'utf8');
  }
  catch (e) {
    throw new CliRunError(`Report write failed: ${path} — ${e instanceof Error ? e.message : String(e)}`, 'write');
  }
}

/** run 命令编排。返回退出分类结果；所有失败路径可识别（C5）。 */
export async function executeRun(args: CliArgs, opts: ExecuteRunOptions = {}): Promise<ExecuteRunResult> {
  const { requests, warnings, label } = loadCollectionRequests(args.collectionPath);
  const { env, name: envName, secretNames } = loadEnvironment(args.environmentFile);
  // E3 终审 P0-2：已标记 secret 的环境变量**值**收集（报告 redact 用；CLI env 文件 secret:true 标记）
  const secretValues = secretNames.filter(n => env[n] !== undefined).map(n => env[n]);
  const iteration = loadIterationData(args.iterationDataFile);
  for (const w of warnings) {
    process.stderr.write(`[collection warning] ${w}\n`);
  }
  if (envName === undefined && args.environmentFile) {
    process.stderr.write(`[environment] ${basename(args.environmentFile)}\n`);
  }

  const send = opts.send ?? buildCliSend(args.requestTimeoutMs);
  // G2：缺省=隔离子进程沙箱（api-studio-cli-child.mjs，与 main 注入同产物布局）
  const runScript = opts.runScript ?? createSandboxRunScript(opts.sandboxUrl ?? new URL('./api-studio-cli-child.mjs', import.meta.url));
  let progress = 0;
  const summary = await runCollection(requests, env, send, {
    stopOnError: args.stopOnError,
    stopOnFailure: args.stopOnFailure,
    delayMs: args.delayMs,
    dataFile: iteration?.dataFile,
    dataFileType: iteration?.dataFileType,
    iterations: args.iterations,
    runScript,
    onProgress: (r: RequestRunResult) => {
      progress++;
      const line = `[${progress}] ${r.passed ? 'PASS' : 'FAIL'} ${r.method} ${r.name}${r.sent ? ` → ${r.status} (${r.elapsedMs} ms)` : ' → NOT SENT'}${r.scriptError ? ' [script error]' : ''}`;
      process.stderr.write(`${line}\n`);
    },
  });

  const meta: RunReportMeta = {
    runId: `cli-${summary.startedAt.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    apiStudioVersion: API_STUDIO_CLI_VERSION,
    collectionName: label,
    ...(envName ? { environmentName: envName } : args.environmentFile ? { environmentName: basename(args.environmentFile).replace(/\.json$/i, '') } : {}),
    startedAt: new Date(summary.startedAt).toISOString(),
    finishedAt: new Date(summary.finishedAt).toISOString(),
  };
  const report = buildRunReport(summary, meta, { secretValues });

  let reportWriteFailed = false;
  let firstWriteError: string | undefined;
  const tryWrite = (path: string | undefined, content: string, kind: string) => {
    if (!path) {
      return;
    }

    try {
      // 终审 07 指令 C-006：报告父目录自动创建（干净 runner 上 writeFileSync 不建父目录→exit 3 与断言失败混淆；
      // GA 示例 mkdir -p 与本口径双保险。父路径是文件时 mkdir 抛错→如实 exit 3，S5 锁口径不变）。
      mkdirSync(dirname(path), { recursive: true });
      writeReportFile(path, content);
      process.stderr.write(`[report] ${kind} written: ${path}\n`);
    }
    catch (e) {
      reportWriteFailed = true;
      const msg = e instanceof CliRunError ? e.message : (e instanceof Error ? e.message : String(e));
      firstWriteError = firstWriteError ?? msg;
      process.stderr.write(`[report error] ${msg}\n`);
    }
  };
  // cli reporter：stdout 仅放最终文本报告（进度在 stderr），CI 日志可完整重定向
  if (args.reporters.includes('cli')) {
    process.stdout.write(`${formatCollectionReportText(summary, { secretValues })}\n`);
  }
  tryWrite(args.reportJsonPath, JSON.stringify(report, null, 2), 'json');
  tryWrite(args.reportJunitPath, toJUnitXml(report), 'junit');

  const kind = classifyCliExit({ completed: true, allPassed: summary.allPassed, reportWriteFailed });
  return { exit: kind.code, label: kind.label, summary, ...(firstWriteError ? { reportWriteError: firstWriteError } : {}) };
}
