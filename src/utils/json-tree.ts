export type JsonTreeKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonTreeNode {
  key: string
  kind: JsonTreeKind
  preview: string
  children: JsonTreeNode[]
}

export function buildJsonTree(value: unknown, key = 'root'): JsonTreeNode {
  if (Array.isArray(value)) {
    return {
      key,
      kind: 'array',
      preview: `[${value.length}]`,
      children: value.map((item, index) => buildJsonTree(item, String(index))),
    };
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return {
      key,
      kind: 'object',
      preview: `{${entries.length}}`,
      children: entries.map(([childKey, childValue]) => buildJsonTree(childValue, childKey)),
    };
  }

  if (typeof value === 'string') {
    return { key, kind: 'string', preview: JSON.stringify(value), children: [] };
  }
  if (typeof value === 'number') {
    return { key, kind: 'number', preview: String(value), children: [] };
  }
  if (typeof value === 'boolean') {
    return { key, kind: 'boolean', preview: String(value), children: [] };
  }
  return { key, kind: 'null', preview: 'null', children: [] };
}

export function countJsonNodes(node: JsonTreeNode): number {
  return 1 + node.children.reduce((total, child) => total + countJsonNodes(child), 0);
}
