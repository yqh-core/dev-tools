/**
 * API-008 · OpenAPI 3.x import.
 *
 * Converts supported OpenAPI operations into editable request drafts. The import
 * is deliberately local-only: it never fetches a remote spec or resolves $ref.
 *
 * Supported: JSON/YAML, global servers, HTTP path operations, path/query/header
 * parameters and application/json request examples/basic schema skeletons.
 * Limitations are returned as warnings rather than silently implied support.
 */
import { parse as parseYaml } from 'yaml';
import type { ApiRequestState, KV } from './engine';
import { buildUrlWithQuery } from './query';

export interface ImportedRequest {
  name: string
  request: ApiRequestState
  /** API-011: Postman pre-request/test event text, when present. */
  scriptEvents?: { prerequest?: string; test?: string }
  /** Original OpenAPI operationId, when supplied by the source document. */
  operationId?: string
  /** Original OpenAPI path template, before parameter placeholder conversion. */
  path?: string
  /** Unique operationId key or deterministic method + normalized path fallback. */
  sourceKey?: string
}

export interface OpenApiImportResult {
  requests: ImportedRequest[]
  warnings: string[]
  source: 'json' | 'yaml' | 'unknown'
  servers: string[]
  title?: string
  openApiVersion?: string
}

export interface OpenApiImportOptions {
  /** Exact URL from the document's global servers list. Defaults to its first entry. */
  serverUrl?: string
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

function result(
  requests: ImportedRequest[] = [],
  warnings: string[] = [],
  source: OpenApiImportResult['source'] = 'unknown',
  servers: string[] = [],
  metadata: Pick<OpenApiImportResult, 'title' | 'openApiVersion'> = {},
): OpenApiImportResult {
  return { requests, warnings, source, servers, ...metadata };
}

/** Detect local, remote and circular $ref usage without traversing cyclic YAML aliases forever. */
function containsOpenApiRef(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (typeof (value as Record<string, unknown>).$ref === 'string') {
    return true;
  }
  return Object.values(value as Record<string, unknown>).some(child => containsOpenApiRef(child, seen));
}

/** Build a shallow example. $ref is intentionally not fetched or resolved. */
export function schemaSkeleton(schema: any, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 5 || schema.$ref) {
    return undefined;
  }
  if (schema.example !== undefined) {
    return schema.example;
  }
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'object' || schema.properties) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      const skeleton = schemaSkeleton(value, depth + 1);
      out[key] = skeleton === undefined ? null : skeleton;
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

export function importOpenApi(text: string, options: OpenApiImportOptions = {}): OpenApiImportResult {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return result([], ['Empty input.']);
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
    catch (error) {
      return result([], [`Not valid JSON or YAML: ${String(error).slice(0, 100)}`]);
    }
  }

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return result([], ['Spec is not an object.'], source);
  }

  const warnings: string[] = [];
  const version = String(doc.openapi ?? doc.swagger ?? '');
  const metadata = {
    openApiVersion: version,
    ...(typeof doc.info?.title === 'string' && doc.info.title.trim() ? { title: doc.info.title.trim() } : {}),
  };
  if (!version.startsWith('3')) {
    if (version.startsWith('2')) {
      warnings.push('Swagger 2.0 detected; only OpenAPI 3.x is imported. Convert the spec first.');
    }
    else {
      warnings.push('No openapi 3.x version field found; nothing imported.');
    }
    return result([], warnings, source);
  }

  const rawServers = Array.isArray(doc.servers) ? doc.servers as Array<Record<string, unknown>> : [];
  const servers: string[] = [...new Set(rawServers.flatMap((server) => {
    const url = server.url;
    return typeof url === 'string' && url.trim() ? [url.trim()] : [];
  }))];
  const selectedServer: string = options.serverUrl && servers.includes(options.serverUrl)
    ? options.serverUrl
    : servers[0] ?? '';
  if (options.serverUrl && !servers.includes(options.serverUrl)) {
    warnings.push('The selected server is not declared by this spec; the first declared server is used instead.');
  }
  if (!selectedServer) {
    warnings.push('No global servers[].url; imported requests use relative paths.');
  }
  const base = selectedServer.replace(/\/+$/, '').replace(/\{([^}]+)\}/g, '{{$1}}');
  if (/\{\{[^}]+\}\}/.test(base)) {
    warnings.push('Server URL variables were converted to {{variable}} placeholders; define them in an API Studio environment.');
  }

  const paths = doc.paths && typeof doc.paths === 'object' ? doc.paths : {};
  const requests: ImportedRequest[] = [];
  let sawRef = containsOpenApiRef(paths);
  let sawUnsupportedBody = false;
  let sawParameterRef = false;
  let sawServerOverride = false;
  let sawSecurity = !!doc.security?.length || Object.keys(doc.components?.securitySchemes ?? {}).length > 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object' || Array.isArray(pathItem)) {
      continue;
    }
    const item = pathItem as Record<string, any>;
    if (Array.isArray(item.servers) && item.servers.length) {
      sawServerOverride = true;
    }
    const pathParams = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const operation = item[method];
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        continue;
      }
      if (Array.isArray(operation.servers) && operation.servers.length) {
        sawServerOverride = true;
      }
      if (Array.isArray(operation.security) && operation.security.length) {
        sawSecurity = true;
      }

      const params = [...pathParams, ...(Array.isArray(operation.parameters) ? operation.parameters : [])];
      const query: KV[] = [];
      const headers: KV[] = [{ name: 'Accept', value: 'application/json' }];
      for (const parameter of params) {
        if (!parameter || typeof parameter !== 'object') {
          continue;
        }
        if (parameter.$ref) {
          sawParameterRef = true;
          continue;
        }
        if (!parameter.name) {
          continue;
        }
        if (parameter.in === 'query') {
          query.push({ name: String(parameter.name), value: `{{${parameter.name}}}` });
        }
        else if (parameter.in === 'header') {
          headers.push({ name: String(parameter.name), value: `{{${parameter.name}}}` });
        }
      }

      const urlPath = String(path).replace(/\{([^}]+)\}/g, '{{$1}}');
      const url = buildUrlWithQuery(base + urlPath, query);
      let body = '';
      const content = operation.requestBody?.content;
      const jsonContent = content?.['application/json'];
      if (content && typeof content === 'object' && Object.keys(content).some(mediaType => mediaType !== 'application/json')) {
        sawUnsupportedBody = true;
      }
      if (jsonContent?.example !== undefined) {
        body = typeof jsonContent.example === 'string' ? jsonContent.example : JSON.stringify(jsonContent.example, null, 2);
      }
      else if (jsonContent?.schema) {
        if (containsOpenApiRef(jsonContent.schema)) {
          sawRef = true;
        }
        const skeleton = schemaSkeleton(jsonContent.schema);
        if (skeleton !== undefined) {
          body = JSON.stringify(skeleton, null, 2);
        }
      }
      const operationId = typeof operation.operationId === 'string' && operation.operationId.trim()
        ? operation.operationId.trim()
        : undefined;
      const name = String(operationId ?? `${method.toUpperCase()} ${path}`);
      requests.push({
        name,
        request: { method: method.toUpperCase(), url, headers, body },
        ...(operationId ? { operationId } : {}),
        path: String(path),
      });
    }
  }

  if (sawSecurity) {
    warnings.push('OpenAPI authentication/security schemes are not imported. Configure authentication headers or variables manually.');
  }
  if (sawRef) {
    warnings.push('One or more OpenAPI $ref pointers were not resolved. Affected path items, parameters or request bodies may be omitted or incomplete; remote references are never fetched.');
  }
  if (sawParameterRef) {
    warnings.push('Some parameter $ref entries are not resolved and were skipped.');
  }
  if (sawUnsupportedBody) {
    warnings.push('Some request bodies use media types other than application/json; those body definitions were not imported.');
  }
  if (sawServerOverride) {
    warnings.push('Path-level or operation-level servers are not yet applied; the selected global server is used for all imported operations.');
  }
  if (requests.length === 0) {
    warnings.push('No operations found under paths.');
  }

  // operationId is the strongest identity only when unique in this document.
  // Duplicate IDs fall back to method + normalized source path and are surfaced.
  const operationIdCounts = new Map<string, number>();
  for (const request of requests) {
    if (request.operationId) {
      operationIdCounts.set(request.operationId, (operationIdCounts.get(request.operationId) ?? 0) + 1);
    }
  }
  const duplicateIds = [...operationIdCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicateIds.length) {
    warnings.push(`Duplicate operationId value(s) were found (${duplicateIds.join(', ')}); those operations use method + path identity instead.`);
  }
  const keyedRequests = requests.map((request) => {
    const method = request.request.method.trim().toUpperCase();
    const normalizedPath = String(request.path ?? '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    const uniqueOperationId = request.operationId && operationIdCounts.get(request.operationId) === 1;
    return {
      ...request,
      sourceKey: uniqueOperationId
        ? `operationId:${request.operationId}`
        : `path:${method}:${normalizedPath}`,
    };
  });
  return result(keyedRequests, warnings, source, servers, metadata);
}
