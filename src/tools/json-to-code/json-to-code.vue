<script setup lang="ts">
type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
type Lang = 'ts' | 'cs' | 'java' | 'go';

interface Field { key: string, type: string, optional: boolean }
interface Model { name: string, fields: Field[] }

const input = useStorage('json-to-code:input', '');
const rootName = useStorage('json-to-code:rootName', 'Root');
const lang = ref<Lang>('ts');

const LANGS: { label: string, value: Lang }[] = [
  { label: 'TypeScript', value: 'ts' },
  { label: 'C#', value: 'cs' },
  { label: 'Java', value: 'java' },
  { label: 'Go', value: 'go' },
];

function pascal(s: string): string {
  const parts = s.replace(/[^0-9a-zA-Z]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return 'Field';
  }
  return parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function safeIdent(s: string): string {
  const cleaned = s.replace(/[^0-9a-zA-Z_]/g, '_');
  return /^\d/.test(cleaned) ? `_${cleaned}` : cleaned || 'field';
}

function isPlainObject(v: JsonValue): v is { [k: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const parseError = ref('');
const models = ref<Model[]>([]);

function build(): void {
  parseError.value = '';
  models.value = [];

  const infer = (v: JsonValue, key: string, parent: string): string => {
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
  };

  const buildModel = (obj: { [k: string]: JsonValue }, name: string): void => {
    if (models.value.some(m => m.name === name)) {
      return;
    }
    const model: Model = { name, fields: [] };
    models.value.push(model);
    for (const [k, val] of Object.entries(obj)) {
      model.fields.push({ key: k, type: infer(val, k, name), optional: val === null });
    }
  };

  /** 数组合并：取所有元素键的并集，缺失或为 null 的键标记为可选 */
  const mergeModel = (elements: { [k: string]: JsonValue }[], name: string): void => {
    if (models.value.some(m => m.name === name)) {
      return;
    }
    const model: Model = { name, fields: [] };
    models.value.push(model);
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
      const optional = present.length < elements.length || present.some(x => x === null);
      const type = nonNull.length
        ? [...new Set(nonNull.map(val => infer(val, k, name)))].join(' | ')
        : 'any';
      model.fields.push({ key: k, type, optional });
    }
  };

  const raw = input.value.trim();
  if (!raw) {
    return;
  }

  try {
    const obj = JSON.parse(raw) as JsonValue;
    const root = pascal(rootName.value || 'Root');
    if (Array.isArray(obj)) {
      if (obj.length && obj.every(isPlainObject)) {
        mergeModel(obj as { [k: string]: JsonValue }[], root);
      }
      else {
        parseError.value = '顶层数组的元素不是对象，无法生成实体类';
        models.value = [];
      }
    }
    else if (isPlainObject(obj)) {
      buildModel(obj, root);
    }
    else {
      parseError.value = '顶层必须是 JSON 对象或对象数组';
      models.value = [];
    }
  }
  catch (e) {
    parseError.value = `JSON 解析失败：${(e as Error).message}`;
    models.value = [];
  }
}

watch([input, rootName], build, { immediate: true });

/** 把内部 TS 风格类型（支持 [] 与 A | B）映射到目标语言 */
function mapType(ts: string, target: Lang): string {
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

const code = computed(() => {
  if (!models.value.length) {
    return '';
  }
  const out: string[] = [];

  if (lang.value === 'ts') {
    for (const m of models.value) {
      out.push(`export interface ${m.name} {`);
      for (const f of m.fields) {
        out.push(`  ${safeIdent(f.key)}${f.optional ? '?' : ''}: ${mapType(f.type, 'ts')}`);
      }
      out.push('}', '');
    }
  }
  else if (lang.value === 'cs') {
    out.push('using System.Collections.Generic;', 'using System.Text.Json.Serialization;', '');
    for (const m of models.value) {
      out.push(`public class ${m.name}`, '{');
      for (const f of m.fields) {
        out.push(`    [JsonPropertyName("${f.key}")]`);
        out.push(`    public ${mapType(f.type, 'cs')} ${pascal(f.key)} { get; set; }`);
      }
      out.push('}', '');
    }
  }
  else if (lang.value === 'java') {
    out.push('import java.util.List;', '');
    for (const m of models.value) {
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
    for (const m of models.value) {
      out.push(`type ${m.name} struct {`);
      for (const f of m.fields) {
        out.push(`\t${pascal(f.key)} ${mapType(f.type, 'go')} \`json:"${f.key}"\``);
      }
      out.push('}', '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="rootName"
      label="根类名："
      placeholder="Root"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-buttons-select
      v-model:value="lang"
      :options="LANGS"
      label="目标语言："
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="input"
      label="JSON："
      placeholder="粘贴 JSON 对象或对象数组，如 [{&quot;id&quot;:1,&quot;name&quot;:&quot;devbox&quot;}]"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-alert v-if="parseError" type="warning" title="解析失败">
      {{ parseError }}
    </c-alert>

    <div v-else-if="code" mt-1>
      <TextareaCopyable :value="code" />
    </div>
  </div>
</template>
