/**
 * Work with Data 管线引擎（WP-003 阶段 A，workspace-core 的数据侧）。
 *
 * 设计基石（对标 CyberChef Recipe）：每个步骤是纯函数 runOp(op, input, params)，
 * 上一步输出 = 下一步输入；**错误隔离**——runOp 永不抛错，失败返回 { ok:false, error }，
 * 不清空整条链。复用现有工具纯逻辑：formatJson / jsonPath / schema / toCsv /
 * json-diff / json-to-code / csv / xml-js / yaml / iarna-toml-esm，零新增依赖。
 *
 * 纪律：非法输入报错（不静默产出错误结果）；报错文案英文（L10N 棘轮）。
 */

import JSON5 from 'json5';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { js2xml, xml2js } from 'xml-js';
import { parse as tomlParse, stringify as tomlStringify } from 'iarna-toml-esm';
import { formatJson } from '../json-viewer/json.models';
import { diff } from '../json-diff/json-diff.models';
import type { Difference } from '../json-diff/json-diff.types';
import { type Lang, inferModels, renderCode } from '../json-to-code/json-to-code.models';
import { inferSchemaDocument } from './schema';
import { jsonPath } from './jsonpath';
import { TransformError, toCsv } from './transform';
import { csvToObjects } from '@/utils/csv';

export type OpId = 'format' | 'minify' | 'tree' | 'query' | 'transform' | 'schema' | 'types' | 'diff' | 'parse';
export type TransformTarget = 'yaml' | 'csv' | 'xml' | 'toml';
export type ParseSource = 'yaml' | 'csv' | 'xml' | 'toml' | 'env';

export const OP_IDS: OpId[] = ['format', 'minify', 'tree', 'query', 'transform', 'schema', 'types', 'diff', 'parse'];
export const TRANSFORM_TARGETS: TransformTarget[] = ['yaml', 'csv', 'xml', 'toml'];
export const PARSE_SOURCES: ParseSource[] = ['yaml', 'csv', 'xml', 'toml', 'env'];
export const TYPE_LANGS: Lang[] = ['ts', 'cs', 'java', 'go'];

export const OP_LABELS: Record<OpId, string> = {
  format: 'Format / Validate',
  minify: 'Minify',
  tree: 'Tree view',
  query: 'Query (JSONPath)',
  transform: 'Transform',
  schema: 'Infer Schema',
  types: 'Generate Types',
  diff: 'Diff (two inputs)',
  parse: 'Parse to JSON',
};

export interface NodeParams {
  indent?: number
  sort?: boolean
  query?: string
  target?: TransformTarget
  lang?: Lang
  rootName?: string
  other?: string
  source?: ParseSource
}

/**
 * 管线节点。inputOverride 有值 = 该步输入被用户钉住（脱链）；
 * 无值 = 活链，输入自动取上一步输出（node 0 永远有 override，即原始输入）。
 */
export interface PipelineNode {
  uid: string
  op: OpId
  params: NodeParams
  inputOverride?: string
}

export type NodeResult = { ok: true; output: string } | { ok: false; error: string };

export const DEFAULT_INPUT = '{\n  "store": {\n    "book": [\n      { "title": "Sayings of the Century", "price": 8.95 },\n      { "title": "Moby Dick", "price": 8.99 }\n    ],\n    "bicycle": { "color": "red", "price": 19.95 }\n  }\n}';

let uidCounter = 0;
export function makeNode(op: OpId, inputOverride?: string, params: NodeParams = {}): PipelineNode {
  uidCounter += 1;
  return { uid: `n${Date.now().toString(36)}${uidCounter}`, op, params, ...(inputOverride !== undefined ? { inputOverride } : {}) };
}

export function defaultPipeline(): PipelineNode[] {
  return [makeNode('format', DEFAULT_INPUT, { indent: 2, sort: false })];
}

/** .env 文本 → 对象。非法行报行号，不静默吞。 */
function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) {
      throw new TransformError(`Invalid .env line ${i + 1}: ${line.slice(0, 40)}`);
    }
    let v = m[2].trim();
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith('\'') && v.endsWith('\'')))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/** diff 树 → 可读文本行（+ 新增 / - 删除 / ~ 修改）。 */
function diffToText(a: unknown, b: unknown): string {
  const out: string[] = [];
  function walk(d: Difference, path: string): void {
    const here = d.key === '' ? path : (path ? `${path}.${String(d.key)}` : String(d.key));
    if (d.status === 'unchanged') {
      return;
    }
    if (d.status === 'added') {
      out.push(`+ ${here}: ${JSON.stringify(d.value)}`);
      return;
    }
    if (d.status === 'removed') {
      out.push(`- ${here}: ${JSON.stringify(d.oldValue)}`);
      return;
    }
    if (d.type === 'value' || !('children' in d) || !d.children) {
      out.push(`~ ${here}: ${JSON.stringify(d.oldValue)} -> ${JSON.stringify(d.value)}`);
      return;
    }
    for (const c of d.children) {
      walk(c, here);
    }
  }
  walk(diff(a, b), '$');
  return out.length ? out.join('\n') : 'No differences.';
}

/**
 * 单步执行。永不抛错（错误隔离）；空输入明确报错。
 * tree 是视图步骤：输出 = 输入的规范化 JSON（可继续传给下一步）。
 */
export function runOp(op: OpId, input: string, params: NodeParams = {}): NodeResult {
  if (input.trim() === '') {
    return { ok: false, error: 'Empty input — paste data or connect an upstream step.' };
  }
  try {
    switch (op) {
      case 'parse': {
        const source = params.source ?? 'yaml';
        let value: unknown;
        if (source === 'yaml') {
          value = yamlParse(input, { merge: true });
        }
        else if (source === 'csv') {
          value = csvToObjects(input).rows;
        }
        else if (source === 'xml') {
          value = xml2js(input, { compact: true });
        }
        else if (source === 'toml') {
          value = tomlParse(input);
        }
        else {
          value = parseEnv(input);
        }
        return { ok: true, output: JSON.stringify(value, null, 2) };
      }
      case 'format': {
        return { ok: true, output: formatJson({ rawJson: input, indentSize: params.indent ?? 2, sortKeys: params.sort ?? false }) };
      }
      case 'minify': {
        return { ok: true, output: JSON.stringify(JSON5.parse(input)) };
      }
      case 'tree': {
        return { ok: true, output: JSON.stringify(JSON5.parse(input), null, 2) };
      }
      case 'query': {
        const matches = jsonPath(JSON5.parse(input), params.query ?? '$');
        return { ok: true, output: JSON.stringify(matches, null, 2) };
      }
      case 'transform': {
        const value = JSON5.parse(input);
        const target = params.target ?? 'yaml';
        if (target === 'yaml') {
          return { ok: true, output: yamlStringify(value) };
        }
        if (target === 'csv') {
          return { ok: true, output: toCsv(value) };
        }
        if (target === 'xml') {
          if (value === null || typeof value !== 'object') {
            throw new TransformError('XML output requires a JSON object or array at the top level');
          }
          return { ok: true, output: js2xml(value, { compact: true, spaces: 2 }) };
        }
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new TransformError('TOML output requires a JSON object at the top level');
        }
        return { ok: true, output: tomlStringify(value as Record<string, unknown>) };
      }
      case 'schema': {
        return { ok: true, output: JSON.stringify(inferSchemaDocument(JSON5.parse(input), 'Inferred from sample'), null, 2) };
      }
      case 'types': {
        const { models, error } = inferModels(input, params.rootName ?? 'Root');
        if (error) {
          return { ok: false, error };
        }
        return { ok: true, output: renderCode(models, params.lang ?? 'ts') };
      }
      case 'diff': {
        const other = params.other ?? '';
        if (other.trim() === '') {
          return { ok: false, error: 'Diff needs a second JSON input — paste it in the "Other JSON" field.' };
        }
        return { ok: true, output: diffToText(JSON5.parse(input), JSON5.parse(other)) };
      }
    }
  }
  catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 步骤输出的语言/扩展名（下载与高亮用）。 */
export function outputLanguage(node: PipelineNode): string {
  switch (node.op) {
    case 'transform':
      return node.params.target ?? 'yaml';
    case 'types': {
      const lang = node.params.lang ?? 'ts';
      return lang === 'ts' ? 'typescript' : lang === 'cs' ? 'csharp' : lang;
    }
    case 'diff':
      return 'text';
    default:
      return 'json';
  }
}

export function outputExtension(node: PipelineNode): string {
  switch (node.op) {
    case 'transform':
      return node.params.target ?? 'yaml';
    case 'types':
      return node.params.lang ?? 'ts';
    case 'diff':
      return 'txt';
    default:
      return 'json';
  }
}
