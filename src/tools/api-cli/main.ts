#!/usr/bin/env node
/**
 * API Studio CLI · 进程入口（任务书 §8 C2）。
 *
 * 退出码契约（--help 同文）：
 *   0 全过 · 1 有失败 · 2 前置 fail-closed/运行未完成 · 3 报告写入失败 · 4 用法错误
 * 用法：api-studio run <collection.json|目录> [选项]；api-studio --help | --version
 */
/// <reference types="node" />
import process from 'node:process';
import { HELP_TEXT, parseArgs } from './args';
import { CliRunError, executeRun } from './run';
import { API_STUDIO_CLI_VERSION } from './version';

const argv = process.argv.slice(2);
const parsed = parseArgs(argv);

if ('help' in parsed && parsed.help) {
  process.stdout.write(`${HELP_TEXT}\n`);
  process.exit(0);
}
if ('version' in parsed && parsed.version) {
  process.stdout.write(`${API_STUDIO_CLI_VERSION}\n`);
  process.exit(0);
}
if (!('args' in parsed)) {
  process.stderr.write(`Usage error: ${'error' in parsed ? parsed.error : 'unknown argument'}\n\nSee api-studio --help\n`);
  process.exit(4);
}

try {
  // 产物布局：main 与沙箱子进程 bundle 同目录（scripts/build-cli.mjs 构建保证）。
  const sandboxUrl = new URL('./api-studio-cli-child.mjs', import.meta.url);
  const result = await executeRun(parsed.args, { sandboxUrl });
  process.exit(result.exit);
}
catch (e) {
  if (e instanceof CliRunError) {
    process.stderr.write(`CLI run failed (${e.kind}): ${e.message}\n`);
    process.exit(e.kind === 'write' ? 3 : 2);
  }
  process.stderr.write(`CLI unexpected error: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exit(2);
}
