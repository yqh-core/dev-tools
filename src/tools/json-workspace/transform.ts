/**
 * JSON → CSV（零依赖，WP-002 Transform 能力）。
 * 仅支持"对象数组"→CSV（表头=各行键的并集）；非数组/非对象数组抛错（不静默产出错误 CSV）。
 * YAML 转换复用项目已有的 yaml 库，不在此重复实现。
 */

export class TransformError extends Error {}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) {
    return '';
  }
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(value: unknown): string {
  if (!Array.isArray(value)) {
    throw new TransformError('CSV 导出需要对象数组（[{...}, {...}]）');
  }
  if (value.length === 0) {
    return '';
  }
  if (!value.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
    throw new TransformError('CSV 导出要求每个元素都是对象');
  }
  const rows = value as Record<string, unknown>[];
  const headers: string[] = [];
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!headers.includes(k)) {
        headers.push(k);
      }
    }
  }
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) {
    lines.push(headers.map(h => csvCell(r[h])).join(','));
  }
  return lines.join('\n');
}
