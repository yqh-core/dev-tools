<script setup lang="ts">
type Direction = 'to-get' | 'to-json';

const input = useStorage('json-to-get-params:input', '');
const direction = ref<Direction>('to-get');

const directionOptions: { label: string, value: Direction }[] = [
  { label: 'JSON → GET 参数', value: 'to-get' },
  { label: 'GET 参数 → JSON', value: 'to-json' },
];

/** JSON → 扁平的 [路径, 值] 列表，嵌套层级用方括号表示 */
function flatten(value: unknown, prefix: string, out: [string, string][]): [string, string][] {
  if (value === null || value === undefined) {
    out.push([prefix || 'value', '']);
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      out.push([prefix || 'value', '']);
      return out;
    }
    value.forEach((v, i) => flatten(v, prefix ? `${prefix}[${i}]` : String(i), out));
    return out;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) {
      out.push([prefix || 'value', '']);
      return out;
    }
    keys.forEach(k => flatten((value as Record<string, unknown>)[k], prefix ? `${prefix}[${k}]` : k, out));
    return out;
  }
  out.push([prefix || 'value', String(value)]);
  return out;
}

/** 把 a[b][0]=c 这类路径写回嵌套结构 */
function assign(root: Record<string, unknown>, path: string, value: string): void {
  const keys = path.replace(/\]/g, '').split('[').filter((s, i) => i === 0 || s !== '');
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const nextIsIndex = /^\d+$/.test(keys[i + 1]);
    if (cursor[k] === undefined || cursor[k] === null || typeof cursor[k] !== 'object') {
      cursor[k] = nextIsIndex ? [] : {};
    }
    cursor = cursor[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (last === '') {
    (cursor as unknown as unknown[]).push(value);
  }
  else {
    cursor[last] = value;
  }
}

const result = computed(() => {
  const raw = input.value.trim();
  if (!raw) {
    return { output: '', error: '' };
  }

  if (direction.value === 'to-get') {
    try {
      const pairs = flatten(JSON.parse(raw), '', []);
      const output = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      return { output, error: '' };
    }
    catch (e) {
      return { output: '', error: `JSON 解析失败：${(e as Error).message}` };
    }
  }

  // 反向：支持完整 URL，自动截取 ? 之后的部分
  let query = raw;
  if (query.includes('://')) {
    query = query.includes('?') ? query.slice(query.indexOf('?') + 1) : '';
  }
  else if (query.startsWith('?')) {
    query = query.slice(1);
  }

  try {
    const pairs = query
      .split('&')
      .filter(Boolean)
      .map((kv) => {
        const i = kv.indexOf('=');
        const k = i === -1 ? kv : kv.slice(0, i);
        const v = i === -1 ? '' : kv.slice(i + 1);
        return [decodeURIComponent(k.replace(/\+/g, ' ')), decodeURIComponent(v.replace(/\+/g, ' '))] as [string, string];
      });
    const root: Record<string, unknown> = {};
    for (const [k, v] of pairs) {
      assign(root, k, v);
    }
    return { output: JSON.stringify(root, null, 2), error: '' };
  }
  catch {
    return { output: '', error: '查询字符串解析失败，请检查是否含非法转义' };
  }
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-buttons-select
      v-model:value="direction"
      :options="directionOptions"
      label="转换方向："
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="input"
      label="输入内容："
      placeholder="粘贴 JSON，或查询字符串，如 a=1&b[x]=2"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-alert v-if="result.error" type="warning" title="转换失败">
      {{ result.error }}
    </c-alert>

    <div v-else-if="result.output" mt-1>
      <div mb-1 op-70 text-13px>
        转换结果：
      </div>
      <TextareaCopyable :value="result.output" />
    </div>
  </div>
</template>
