/**
 * API-008 · OpenAPI 3.x 导入（对标 Postman「Import OpenAPI spec」招牌能力）。
 *
 * 把 OpenAPI 3.x 规范（JSON 或 YAML）转成可发送的请求集合：
 *   servers[0].url + path（{param} → {{param}} 占位）+ query/header 参数 + 示例 body。
 *
 * 设计边界（诚实声明，不夸大）：
 *  · 只导入 OpenAPI 3.x；Swagger 2.0 提示先转换；
 *  · 不解析 $ref（遇到含 $ref 的 schema 留空 body 并告警）；
 *  · body 取 requestBody 的 example，否则按 schema 生成浅层骨架（深度上限 5，防循环）；
 *  · 非法/空输入不崩溃，转为 warnings。
 */
import { parse as parseYaml } from 'yaml';
import type { ApiRequestState, KV } from './engine';
import { buildUrlWithQuery } from './query';

export interface ImportedRequest { name: string; request: ApiRequestState }
export interface OpenApiImportResult { requests: ImportedRequest[]; warnings: string[]; source: 'json' | 'yaml' | 'unknown' }

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

/** 按 schema 生成浅层示例骨架；$ref 不解析（返回 undefined 由调用方留空）。 */
export function schemaSkeleton(schema: any, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 5) {
    return undefined;
  }
  if (schema.$ref) {
    return undefined;
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'object' || schema.properties) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) {
      const s = schemaSkeleton(v, depth + 1);
      out[k] = s === undefined ? null : s;
    }
    return out;
  }
  if (type === 'array') {
    const item = schemaSkeleton(schema.items, depth + 1);
    return item === undefined ? [] : [item];
  }
  if (type === 'string') {
    return schema.enum?.[0] ?? '';
  }
  if (type === 'integer' || type === 'number') {
    return 0;
  }
  if (type === 'boolean') {
    return false;
  }
  return undefined;
}

export function importOpenApi(text: string): OpenApiImportResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { requests: [], warnings: ['Empty input.'], source: 'unknown' };
  }
  let doc: any;
  let source: 'json' | 'yaml';
  try {
    doc = JSON.parse(trimmed);
    source = 'json';
  }
  catch {
    try {
      doc = parseYaml(trimmed);
      source = 'yaml';
    }
    catch (e) {
      return { requests: [], warnings: [`Not valid JSON or YAML: ${String(e).slice(0, 100)}`], source: 'unknown' };
    }
  }
  if (!doc || typeof doc !== 'object') {
    return { requests: [], warnings: ['Spec is not an object.'], source };
  }
  const warnings: string[] = [];
  const version = String(doc.openapi ?? doc.swagger ?? '');
  if (!version.startsWith('3')) {
    if (version.startsWith('2')) {
      warnings.push('Swagger 2.0 detected; only OpenAPI 3.x is imported. Convert the spec first.');
    }
    else {
      warnings.push('No openapi 3.x version field found; nothing imported.');
    }
    return { requests: [], warnings, source };
  }
  const servers = Array.isArray(doc.servers) ? doc.servers : [];
  const base = String(servers[0]?.url ?? '').replace(/\/+$/, '');
  if (!base) {
    warnings.push('No servers[0].url; requests use relative paths.');
  }
  const paths = doc.paths ?? {};
  const requests: ImportedRequest[] = [];
  let sawRef = false;
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }
    const item = pathItem as Record<string, any>;
    const pathParams = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const op = item[method];
      if (!op || typeof op !== 'object') {
        continue;
      }
      const params = [...pathParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];
      const urlPath = path.replace(/\{([^}]+)\}/g, '{{$1}}');
      const query: KV[] = [];
      const headers: KV[] = [{ name: 'Accept', value: 'application/json' }];
      for (const p of params) {
        if (!p || typeof p !== 'object' || !p.name) {
          continue;
        }
        if (p.in === 'query') {
          query.push({ name: String(p.name), value: `{{${p.name}}}` });
        }
        else if (p.in === 'header') {
          headers.push({ name: String(p.name), value: `{{${p.name}}}` });
        }
      }
      const url = buildUrlWithQuery(base + urlPath, query);
      let body = '';
      const jsonContent = op.requestBody?.content?.['application/json'];
      if (jsonContent?.example !== undefined) {
        body = typeof jsonContent.example === 'string' ? jsonContent.example : JSON.stringify(jsonContent.example, null, 2);
      }
      else if (jsonContent?.schema) {
        if (JSON.stringify(jsonContent.schema).includes('$ref')) {
          sawRef = true;
        }
        const sk = schemaSkeleton(jsonContent.schema);
        if (sk !== undefined) {
          body = JSON.stringify(sk, null, 2);
        }
      }
      const name = String(op.operationId ?? `${method.toUpperCase()} ${path}`);
      requests.push({ name, request: { method: method.toUpperCase(), url, headers, body } });
    }
  }
  if (sawRef) {
    warnings.push('Some request bodies use $ref schemas, which are not resolved; those bodies are empty.');
  }
  if (requests.length === 0) {
    warnings.push('No operations found under paths.');
  }
  return { requests, warnings, source };
}
