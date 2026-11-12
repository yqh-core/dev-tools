/**
 * JSON → JSON Schema（draft-07）推断（零依赖，WP-002 Generate 能力）。
 *
 * 从样本推断结构：object→properties+required，array→items（合并元素类型），
 * 标量→type。多数组元素类型不一致时用 anyOf。
 * 纪律：推断是"样本的形状"，不是"数据的契约"——UI 须标注这是从样本推断、需人工确认。
 */

export interface SchemaNode {
  type?: string | string[]
  properties?: Record<string, SchemaNode>
  required?: string[]
  items?: SchemaNode
  anyOf?: SchemaNode[]
  enum?: unknown[]
  description?: string
}

function typeOf(v: unknown): string {
  if (v === null) {
    return 'null';
  }
  if (Array.isArray(v)) {
    return 'array';
  }
  const t = typeof v;
  if (t === 'number') {
    return Number.isInteger(v) ? 'integer' : 'number';
  }
  return t; // string / boolean / object
}

function mergeSchemas(a: SchemaNode, b: SchemaNode): SchemaNode {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    return a;
  }
  if (a.type === 'object' && b.type === 'object' && a.properties && b.properties) {
    const props: Record<string, SchemaNode> = { ...a.properties };
    for (const k of Object.keys(b.properties)) {
      props[k] = props[k] ? mergeSchemas(props[k], b.properties[k]) : b.properties[k];
    }
    const reqA = a.required ?? Object.keys(a.properties);
    const reqB = b.required ?? Object.keys(b.properties);
    const required = reqA.filter(k => reqB.includes(k));
    return { type: 'object', properties: props, ...(required.length ? { required } : {}) };
  }
  if (a.type === 'array' && b.type === 'array' && a.items && b.items) {
    return { type: 'array', items: mergeSchemas(a.items, b.items) };
  }
  if ((a.type === 'integer' && b.type === 'number') || (a.type === 'number' && b.type === 'integer')) {
    return { type: 'number' };
  }
  const variants = [...(a.anyOf ?? [a]), ...(b.anyOf ?? [b])];
  const seen = new Set<string>();
  const uniq = variants.filter((v) => {
    const key = JSON.stringify(v);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return uniq.length === 1 ? uniq[0] : { anyOf: uniq };
}

export function inferSchema(value: unknown): SchemaNode {
  const t = typeOf(value);
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const properties: Record<string, SchemaNode> = {};
    for (const k of keys) {
      properties[k] = inferSchema(obj[k]);
    }
    return { type: 'object', properties, ...(keys.length ? { required: keys } : {}) };
  }
  if (t === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) {
      return { type: 'array', items: {} };
    }
    let items = inferSchema(arr[0]);
    for (let i = 1; i < arr.length; i++) {
      items = mergeSchemas(items, inferSchema(arr[i]));
    }
    return { type: 'array', items };
  }
  return { type: t };
}

/** 生成完整 draft-07 schema 文档。 */
export function inferSchemaDocument(value: unknown, title = 'Generated schema'): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title,
    ...inferSchema(value),
  };
}
