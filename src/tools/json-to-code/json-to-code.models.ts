/**
 * json-to-code 纯逻辑核心（WP-003 阶段 A 从 json-to-code.vue 抽出，行为逐字保留）。
 * 抽出动机：Work with Data 工作台的 Types 步骤复用同一套生成器，
 * 避免第二份实现漂移；原组件改为导入本模块，挂载式测试不变。
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
export type Lang = 'ts' | 'cs' | 'java' | 'go';

export interface Field { key: string; type: string; optional: boolean }
export interface Model { name: string; fields: Field[] }

export const LANGS: { label: string; value: Lang }[] = [
  { label: 'TypeScript', value: 'ts' },
  { label: 'C#', value: 'cs' },
  { label: 'Java', value: 'java' },
  { label: 'Go', value: 'go' },
];

export function pascal(s: string): string {
  const parts = s.replace(/[^0-9a-zA-Z]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'Field';
  }
  return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

export function safeIdent(s: string): string {
  const cleaned = s.replace(/[^0-9a-zA-Z_]/g, '_');
  return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned || 'field';
}

export function isPlainObject(v: JsonValue): v is { [k: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 从 JSON 文本推断模型列表。纯函数，不抛错：解析/形状失败返回 error 文案。
 * 注意：这里用 JSON.parse（与原组件一致），不是 JSON5——类型生成面向严格 JSON。
 */
export function inferModels(raw: string, rootName: string): { models: Model[]; error: string } {
  const models: Model[] = [];

  // 这三个函数互相递归（infer → buildModel/mergeModel → infer），
  // 所以必须用会被提升的 function 声明：
  // 若保持 const 箭头函数，箭头函数不提升，彼此互调会直接撞 TDZ（运行时 ReferenceError）。
  // eslint 的 no-use-before-define 在本项目配置为 functions:false，即允许函数声明前向引用。
  function infer(v: JsonValue, key: string, parent: string): string {
    if (v === null) {
      return 'any';
    }
    if (typeof v === 'boolean') {
      return 'boolean';
    }
    if (typeof v === 'number') {
      return 'number';
    }
    if (typeof v === 'string') {
      return 'string';
    }
    if (Array.isArray(v)) {
      if (v.length === 0) {
        return 'any[]';
      }
      if (v.every(isPlainObject)) {
        const name = parent + pascal(key);
        mergeModel(v as { [k: string]: JsonValue }[], name);
        return `${name}[]`;
      }
      return `${infer(v[0], key, parent)}[]`;
    }
    const name = parent + pascal(key);
    buildModel(v, name);
    return name;
  }

  function buildModel(obj: { [k: string]: JsonValue }, name: string): void {
    if (models.some(m => m.name === name)) {
      return;
    }
    const model: Model = { name, fields: [] };
    models.push(model);
    for (const [k, val] of Object.entries(obj)) {
      model.fields.push({ key: k, type: infer(val, k, name), optional: val === null });
    }
  }

  /** 数组合并：取所有元素键的并集，缺失或为 null 的键标记为可选 */
  function mergeModel(elements: { [k: string]: JsonValue }[], name: string): void {
    if (models.some(m => m.name === name)) {
      return;
    }
    const model: Model = { name, fields: [] };
    models.push(model);
    const keys: string[] = [];
    for (const el of elements) {
      for (const k of Object.keys(el)) {
        if (!keys.includes(k)) {
          keys.push(k);
        }
      }
    }
    for (const k of keys) {
      const present = elements.filter(el => k in el).map(el => el[k]);
      const nonNull = present.filter((x): x is JsonValue => x !== null);
      const optional = present.length < elements.length || present.includes(null);
      const type = nonNull.length
        ? [...new Set(nonNull.map(val => infer(val, k, name)))].join(' | ')
        : 'any';
      model.fields.push({ key: k, type, optional });
    }
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { models: [], error: '' };
  }

  try {
    const obj = JSON.parse(trimmed) as JsonValue;
    const root = pascal(rootName || 'Root');
    if (Array.isArray(obj)) {
      if (obj.length && obj.every(isPlainObject)) {
        mergeModel(obj as { [k: string]: JsonValue }[], root);
      }
      else {
        return { models: [], error: 'The items of the top-level array are not objects, so no class can be generated' };
      }
    }
    else if (isPlainObject(obj)) {
      buildModel(obj, root);
    }
    else {
      return { models: [], error: 'The top level must be a JSON object or an array of objects' };
    }
  }
  catch (e) {
    return { models: [], error: `JSON parse failed: ${(e as Error).message}` };
  }

  return { models, error: '' };
}

/** 把内部 TS 风格类型（支持 [] 与 A | B）映射到目标语言 */
export function mapType(ts: string, target: Lang): string {
  if (ts.includes(' | ')) {
    return target === 'cs' ? 'object' : target === 'java' ? 'Object' : 'interface{}';
  }
  let depth = 0;
  let base = ts;
  while (base.endsWith('[]')) {
    depth++;
    base = base.slice(0, -2);
  }
  let mapped: string;
  if (target === 'ts') {
    mapped = base;
  }
  else if (target === 'cs') {
    mapped = base === 'string' ? 'string' : base === 'number' ? 'double' : base === 'boolean' ? 'bool' : base === 'any' ? 'object' : base;
  }
  else if (target === 'java') {
    mapped = base === 'string' ? 'String' : base === 'number' ? 'Double' : base === 'boolean' ? 'Boolean' : base === 'any' ? 'Object' : base;
  }
  else {
    mapped = base === 'string' ? 'string' : base === 'number' ? 'float64' : base === 'boolean' ? 'bool' : base === 'any' ? 'interface{}' : base;
  }
  for (let i = 0; i < depth; i++) {
    mapped = target === 'go' ? `[]${mapped}` : target === 'ts' ? `${mapped}[]` : `List<${mapped}>`;
  }
  return mapped;
}

/** 渲染目标语言代码。与原组件 computed 逐字一致。 */
export function renderCode(models: Model[], lang: Lang): string {
  if (!models.length) {
    return '';
  }
  const out: string[] = [];

  if (lang === 'ts') {
    for (const m of models) {
      out.push(`export interface ${m.name} {`);
      for (const f of m.fields) {
        out.push(`  ${safeIdent(f.key)}${f.optional ? '?' : ''}: ${mapType(f.type, 'ts')}`);
      }
      out.push('}', '');
    }
  }
  else if (lang === 'cs') {
    out.push('using System.Collections.Generic;', 'using System.Text.Json.Serialization;', '');
    for (const m of models) {
      out.push(`public class ${m.name}`, '{');
      for (const f of m.fields) {
        out.push(`    [JsonPropertyName("${f.key}")]`);
        out.push(`    public ${mapType(f.type, 'cs')} ${pascal(f.key)} { get; set; }`);
      }
      out.push('}', '');
    }
  }
  else if (lang === 'java') {
    out.push('import java.util.List;', '');
    for (const m of models) {
      out.push(`public class ${m.name} {`);
      for (const f of m.fields) {
        out.push(`    private ${mapType(f.type, 'java')} ${safeIdent(f.key)};`);
      }
      out.push('');
      for (const f of m.fields) {
        const t = mapType(f.type, 'java');
        const n = safeIdent(f.key);
        const cap = n.charAt(0).toUpperCase() + n.slice(1);
        out.push(`    public ${t} get${cap}() { return ${n}; }`);
        out.push(`    public void set${cap}(${t} ${n}) { this.${n} = ${n}; }`);
        out.push('');
      }
      out.push('}', '');
    }
  }
  else {
    for (const m of models) {
      out.push(`type ${m.name} struct {`);
      for (const f of m.fields) {
        out.push(`\t${pascal(f.key)} ${mapType(f.type, 'go')} \`json:"${f.key}"\``);
      }
      out.push('}', '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
