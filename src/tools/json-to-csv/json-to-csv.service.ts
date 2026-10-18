import { objectsToCsv, serializeCsv } from '@/utils/csv';

export { getHeaders, convertArrayToCsv, csvShapeError };

/**
 * 表头取所有对象键的并集（保持首次出现顺序）。
 * 与 objectsToCsv 用的是同一套并集逻辑，避免两处各写一遍、以后走偏。
 */
function getHeaders({ array }: { array: Record<string, unknown>[] }): string[] {
  const headers = new Set<string>();

  array.forEach(item => Object.keys(item).forEach(key => headers.add(key)));

  return Array.from(headers);
}

/**
 * JSON 数组 → CSV。
 *
 * 转义规则已交给 `@/utils/csv`（RFC 4180）。这里不再自己拼字符串：
 * 旧实现把 `"` 转义成 `\"`、把换行折成字面 `\n`，且只在含逗号时加引号，
 * 导致只含引号的值输出成不带引号的 `hello \"world\"`，标准读取器读不回来。
 * 现在含引号/换行/回车/分隔符的值一律加引号，内部引号双写。
 */
function convertArrayToCsv({ array }: { array: Record<string, unknown>[] }): string {
  const headers = getHeaders({ array });

  if (headers.length === 0) {
    return '';
  }

  // 空数组时旧实现会输出一行空表头；这里保持 objectsToCsv 的行为一致：只出表头行
  if (array.length === 0) {
    return serializeCsv([headers]);
  }

  return objectsToCsv(array);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function typeName(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  switch (typeof value) {
    case 'object': return 'an object';
    case 'number': return 'a number';
    case 'string': return 'a string';
    case 'boolean': return 'a boolean';
    default: return typeof value;
  }
}

/**
 * JSON → CSV 的**输入形状**校验：把「能 JSON.parse 但根本不是对象数组」这种情况
 * 讲成人话，替代旧实现里 `withDefaultOnError(..., '')` 那种「输入合法、界面无报错、
 * 结果却静默为空」的失败模式。返回空串表示形状 OK，可交给 convertArrayToCsv。
 *
 * 注意：它假设传入的**已经是解析后的值**（解析失败由校验器另一分支处理），
 * 所以这里只管「是不是对象数组」，不管「是不是合法 JSON」。
 */
function csvShapeError(parsed: unknown): string {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return '';
    }
    const badIndex = parsed.findIndex(item => !isPlainObject(item));
    if (badIndex === -1) {
      return '';
    }
    return `This CSV converter needs an array of objects, but item #${badIndex + 1} is ${typeName(parsed[badIndex])}.`;
  }
  return `This CSV converter needs an array of objects, but the input is ${typeName(parsed)}.`;
}
