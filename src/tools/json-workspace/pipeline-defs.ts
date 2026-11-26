/**
 * 管线纯定义叶模块（终审 P1-07 图手术产物）。
 *
 * 为什么独立：api-debugger/engine.ts 只为 responseToWorkspaceLink 用到 makeNode，
 * 原 import 自 pipeline.ts —— 连带把整条转换工具链（json5/yaml/xml-js/iarna-toml/
 * json-diff/json-to-code/json-viewer）拖进 CLI bundle 的模块图，vite SSR 把用不到的
 * 绑定摇掉后仍保留副作用裸导入（`import "yaml"` 等），干净目录运行直接
 * ERR_MODULE_NOT_FOUND。旧产物审计正则只匹配 `import … from`/`require()`，
 * 漏掉副作用裸导入形态（审计空洞，已由 build-cli.mjs 全覆盖审计 + 干净目录实弹冒烟补齐）。
 *
 * 本文件=零运行时依赖的纯类型/常量/节点工厂；pipeline.ts 全量 re-export，
 * 既有导入方（UI/测试）零改动；CLI 图（engine/workspace-link）改从这里取。
 */
import type { Lang } from '../json-to-code/json-to-code.models';

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
