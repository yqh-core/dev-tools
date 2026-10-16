import { objectsToCsv, serializeCsv } from '@/utils/csv';

export { getHeaders, convertArrayToCsv };

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
