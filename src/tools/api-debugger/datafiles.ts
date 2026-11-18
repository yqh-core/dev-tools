/**
 * API-012 · 数据文件严格解析（B1）。Postman Data Files 的兼容子集。
 *
 * 纪律（任务书 B1 硬要求）：
 *  · CSV 按 RFC 4180 状态机解析——禁 split(',')；支持引号字段、转义引号（""）、
 *    字段内逗号/换行、UTF-8 BOM；
 *  · 异常 fail-closed：空文件、空头、重复列名、字段数多于表头、JSON 非顶层数组、
 *    非对象元素、嵌套值 → 执行前报错，不静默修补数据；
 *  · 数据安全：解析结果只在内存；日志/报告默认不打印完整数据行（脱敏见 report.ts）。
 */

export interface DataFile { columns: string[]; rows: Record<string, string>[] }

/** 终审 P1-02 资源上限（fail-closed：超限明确报错，不静默截断/修补；解析仍在主线程，
 *  增量/Worker 化解析登记为后续项——上限先把无界输入挡在门外）。 */
export const DATA_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB（整个文件）
export const DATA_MAX_ROWS = 5000;                  // 数据行数上限
export const DATA_MAX_COLUMNS = 50;                 // 列数上限
export const DATA_MAX_FIELD_BYTES = 1024 * 1024;    // 单字段 1 MiB
const te = new TextEncoder();
const utf8Len = (s: string): number => te.encode(s).byteLength;
const overLimit = (what: string, limit: number): string =>
  `Data file rejected: ${what} exceeds the fail-closed limit (${limit}). Split the file or raise the limit deliberately — no silent truncation.`;
export type DataParseResult = { ok: true; data: DataFile } | { ok: false; error: string }

/** RFC 4180 状态机（引号/转义/内嵌逗号与换行）。不依赖任何第三方 CSV 库。 */
export function parseCsvData(text: string): DataParseResult {
  if (typeof text !== 'string') return { ok: false, error: 'Data file content must be text.' };
  if (utf8Len(text) > DATA_FILE_MAX_BYTES) return { ok: false, error: overLimit('file size', DATA_FILE_MAX_BYTES) };
  const src = text.replace(/^\uFEFF/, ''); // UTF-8 BOM
  if (!src.trim()) return { ok: false, error: 'Data file is empty.' };

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let quotedClosed = false; // 引用字段已闭合（闭合后只允许 , / 换行 / EOF——RFC 4180 严格口径）
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; } // 转义引号
        inQuotes = false; quotedClosed = true; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === ',') { pushField(); quotedClosed = false; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      pushRow(); quotedClosed = false; i++; continue;
    }
    // 引用字段闭合后的多余字符 → fail-closed（不静默拼接）
    if (quotedClosed) {
      return { ok: false, error: `Row ${rows.length + 1}: characters after a closed quoted field (RFC 4180: a quoted field must end at a field boundary).` };
    }
    if (c === '"') {
      // 裸引号（非引用字段中间/引号已闭合后再开引号）→ fail-closed
      if (field.length > 0) {
        return { ok: false, error: `Row ${rows.length + 1}: bare quote inside an unquoted field (RFC 4180: a field containing quotes must be fully quoted).` };
      }
      inQuotes = true; i++; continue;
    }
    field += c; i++;
  }
  if (inQuotes) {
    return { ok: false, error: 'Unterminated quoted field (RFC 4180): CSV ends inside a quoted field.' };
  }
  if (field.length || row.length) pushRow(); // 末行无换行

  const nonEmpty = rows.filter(r => r.some(f => f.trim() !== ''));
  if (!nonEmpty.length) return { ok: false, error: 'Data file has no data rows.' };
  if (nonEmpty.length - 1 > DATA_MAX_ROWS) return { ok: false, error: overLimit(`row count ${nonEmpty.length - 1}`, DATA_MAX_ROWS) };

  const columns = nonEmpty[0].map(c => c.trim());
  if (!columns.length || columns.some(c => c === '')) {
    return { ok: false, error: 'Header row must contain non-empty column names.' };
  }
  if (columns.length > DATA_MAX_COLUMNS) return { ok: false, error: overLimit(`column count ${columns.length}`, DATA_MAX_COLUMNS) };
  const seen = new Set<string>();
  for (const c of columns) {
    if (seen.has(c)) return { ok: false, error: `Duplicate column name: ${c}` };
    seen.add(c);
  }

  const data: Record<string, string>[] = [];
  for (let r = 1; r < nonEmpty.length; r++) {
    const raw = nonEmpty[r];
    if (raw.length > columns.length) {
      return { ok: false, error: `Row ${r} has more fields than the header (${raw.length} > ${columns.length}).` };
    }
    const rowObj: Record<string, string> = {};
    for (let c = 0; c < columns.length; c++) {
      const v = raw[c] ?? '';
      if (utf8Len(v) > DATA_MAX_FIELD_BYTES) return { ok: false, error: overLimit(`field bytes in row ${r} column "${columns[c]}"`, DATA_MAX_FIELD_BYTES) };
      rowObj[columns[c]] = v;
    }
    data.push(rowObj);
  }
  if (!data.length) return { ok: false, error: 'Data file has a header but no data rows.' };
  return { ok: true, data: { columns, rows: data } };
}

/** JSON 数据文件：顶层数组、元素全对象、值仅原始类型（嵌套 fail-closed）。 */
export function parseJsonData(text: string): DataParseResult {
  if (typeof text !== 'string') return { ok: false, error: 'Data file content must be text.' };
  if (utf8Len(text) > DATA_FILE_MAX_BYTES) return { ok: false, error: overLimit('file size', DATA_FILE_MAX_BYTES) };
  let doc: unknown;
  try {
    doc = JSON.parse(text.replace(/^\uFEFF/, ''));
  }
  catch (e) {
    return { ok: false, error: 'Not valid JSON: ' + String(e instanceof Error ? e.message : e).slice(0, 120) };
  }
  if (!Array.isArray(doc)) return { ok: false, error: 'JSON data file must be a top-level array of objects.' };
  if (!doc.length) return { ok: false, error: 'Data file has no data rows.' };
  if (doc.length > DATA_MAX_ROWS) return { ok: false, error: overLimit(`row count ${doc.length}`, DATA_MAX_ROWS) };

  // 先行校验：元素对象性 + 值原始性（不静默强制转换）
  const columns: string[] = [];
  const seen = new Set<string>();
  for (let idx = 0; idx < doc.length; idx++) {
    const row = doc[idx];
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { ok: false, error: `Row ${idx + 1}: every element must be an object.` };
    }
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (!seen.has(k)) { seen.add(k); columns.push(k); }
      if (v !== null && v !== undefined && !['string', 'number', 'boolean'].includes(typeof v)) {
        return { ok: false, error: `Row ${idx + 1} column "${k}": nested values are not supported — stringify before import.` };
      }
      if (typeof v === 'string' && utf8Len(v) > DATA_MAX_FIELD_BYTES) {
        return { ok: false, error: overLimit(`field bytes in row ${idx + 1} column "${k}"`, DATA_MAX_FIELD_BYTES) };
      }
    }
  }
  if (!columns.length) return { ok: false, error: 'No columns found (all objects are empty).' };
  if (columns.length > DATA_MAX_COLUMNS) return { ok: false, error: overLimit(`column count ${columns.length}`, DATA_MAX_COLUMNS) };

  const rows = (doc as Record<string, unknown>[]).map(row => {
    const out: Record<string, string> = {};
    for (const c of columns) {
      const v = row[c];
      out[c] = v === null || v === undefined ? '' : String(v);
    }
    return out;
  });
  return { ok: true, data: { columns, rows } };
}

/** 按扩展名分发；未知扩展名 fail-closed。 */
export function parseDataFile(filename: string, text: string): DataParseResult {
  const lower = String(filename ?? '').toLowerCase();
  if (lower.endsWith('.csv')) return parseCsvData(text);
  if (lower.endsWith('.json')) return parseJsonData(text);
  return { ok: false, error: 'Unsupported data file type. Use .csv or .json (Postman-compatible).' };
}

/** 报告/日志用安全摘要：只有类型、行数、列数——绝无内容、绝无文件名敏感部分。 */
export function dataFileSummary(parsed: DataFile, type: 'csv' | 'json'): { type: string; rows: number; columnsCount: number } {
  return { type, rows: parsed.rows.length, columnsCount: parsed.columns.length };
}

/** UI 预览用脱敏行：值默认不完整打印（长值截断），预览是本地显示但仍按最小暴露原则。 */
export function previewRows(parsed: DataFile, maxRows = 5, maxValueChars = 40): { columns: string[]; rows: string[][] } {
  return {
    columns: parsed.columns,
    rows: parsed.rows.slice(0, maxRows).map(r => parsed.columns.map(c => {
      const v = r[c] ?? '';
      return v.length > maxValueChars ? v.slice(0, maxValueChars) + '…' : v;
    })),
  };
}
