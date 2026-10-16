export { parseCsv, serializeCsv, csvToObjects, objectsToCsv, needsQuoting, uniqueHeaders };

/**
 * CSV 读写共用核心（RFC 4180）。
 *
 * 为什么要有这个文件
 * ------------------------------------------------------------------
 * 原先只有 `json-to-csv.service.ts` 里的一个 `serializeValue`，它把 `"` 转义成 `\"`、
 * 把换行折成字面 `\n`，而且**只在含逗号时加引号**。那不是 RFC 4180：
 * 一个只含引号、不含逗号的值会被输出成不带引号的 `hello \"world\"`，
 * 任何标准读取器（Excel、papaparse、pandas）都会把反斜杠原样显示出来。
 * 更直接的证据是仓库自己的测试：用例标题写着
 * "escaped with another double quote"（即 `""`），断言里冻住的却是 `\"` —— 快照把 bug 固化成了预期。
 *
 * 这里按 RFC 4180 实现，读侧与写侧共用同一套转义规则，
 * 保证 `parseCsv(serializeCsv(rows))` 恒等于 `rows`（测试里有往返属性断言）。
 *
 * 一处刻意的取舍
 * ------------------------------------------------------------------
 * 记录分隔符仍用 `\n` 而不是 RFC 规定的 CRLF：现有页面的输出就是 `\n`，
 * 改成 CRLF 会把"修转义 bug"和"改行尾"两件事混在一个 diff 里，
 * 也让复制粘贴到某些输入框时多出 `^M`。解析侧对 CRLF / 裸 CR / LF 三种都兼容，
 * 所以这个偏差不影响互操作。
 */

interface ParseCsvOptions {
  /** 字段分隔符，默认逗号 */
  delimiter?: string
}

interface CsvToObjectsOptions extends ParseCsvOptions {
  /** 首行是否为表头。false 时按列生成 key */
  header?: boolean
}

const DEFAULT_DELIMITER = ',';

/** 一个值是否必须加引号：含分隔符、引号、CR 或 LF */
function needsQuoting(value: string, delimiter: string): boolean {
  return value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r');
}

function serializeField(value: string, delimiter: string): string {
  const text = value ?? '';
  return needsQuoting(text, delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 把 CSV 文本解析成二维数组。
 * 引号未闭合时抛错 —— 让调用方能把"第几行没闭合"讲清楚，而不是静默吞掉半条记录。
 */
function parseCsv(text: string, options: ParseCsvOptions = {}): string[][] {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  if (delimiter.length !== 1) {
    throw new Error('delimiter must be a single character');
  }

  // 去 BOM：Excel 导出的 UTF-8 CSV 常带，留着会污染第一列表头
  const src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let rowStart = 1; // 供报错用：当前记录的起始行号

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { // 转义的双引号
          field += '"';
          i++;
        }
        else {
          inQuotes = false;
        }
      }
      else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field === '') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      // CRLF 只算一个换行；裸 CR 也当记录分隔符
      if (ch === '\r' && src[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      rowStart++;
      continue;
    }

    field += ch;
  }

  if (inQuotes) {
    throw new Error(`Unterminated quoted field starting at line ${rowStart}`);
  }

  // 末尾换行已经收过一条记录；只有还有内容时才收尾，避免多出空行
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** 把二维数组序列化成 CSV 文本。 */
function serializeCsv(rows: string[][], options: ParseCsvOptions = {}): string {
  const delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  return rows.map(row => row.map(field => serializeField(String(field ?? ''), delimiter)).join(delimiter))
    .join('\n');
}

interface CsvToObjectsResult {
  headers: string[]
  rows: Record<string, string>[]
  /** 表头里的重名原始列（改名前的名字） */
  duplicateHeaders: string[]
  /** 重命名列：`{ from, to }`，供页面如实告诉用户"哪一列被改名了" */
  renamed: { from: string; to: string }[]
  /** 比表头长的记录（1-based 数据行号）：多出的单元格不静默丢，报给页面 */
  rowsWithExtraCells: number[]
  /** 比表头短、被补空的记录（1-based 数据行号） */
  rowsWithMissingCells: number[]
}

function normalizeHeaders(raw: string[]): string[] {
  return raw.map((h, i) => (h.trim() === '' ? `column_${String(i + 1)}` : h));
}

/**
 * 把可能重名/为空的表头变成交互式键：空列名补 `column_N`，重名列追加 `__2`、`__3`。
 *
 * 为什么改名而不是"保留第一列、丢掉后面的"：转换器静默丢数据是最坏的失败模式 ——
 * 用户看到的结果"看起来正常"，实际少了几列，且没有任何地方告诉他。
 * 改名是无损的，配合 `renamed` 回报，页面可以如实说明。
 */
function uniqueHeaders(raw: string[]): { headers: string[]; duplicates: string[]; renamed: { from: string; to: string }[] } {
  const normalized = normalizeHeaders(raw);
  const used = new Set<string>();
  const headers: string[] = [];
  const duplicates: string[] = [];
  const renamed: { from: string; to: string }[] = [];

  normalized.forEach((h) => {
    if (!used.has(h)) {
      used.add(h);
      headers.push(h);
      return;
    }
    duplicates.push(h);
    let n = 2;
    while (used.has(`${h}__${String(n)}`)) {
      n++;
    }
    const to = `${h}__${String(n)}`;
    used.add(to);
    headers.push(to);
    renamed.push({ from: h, to });
  });

  return { headers, duplicates, renamed };
}

/**
 * CSV → 对象数组。
 * 首行作表头（`header: false` 时按列号生成 key，首行也当数据）。
 * 重名列改名保序；短行补空串；长行不丢数据（多出的单元格并入 `__extra_N` 列并回报行号）。
 */
function csvToObjects(text: string, options: CsvToObjectsOptions = {}): CsvToObjectsResult {
  const { header = true } = options;
  const parsed = parseCsv(text, options);
  const empty: CsvToObjectsResult = {
    headers: [],
    rows: [],
    duplicateHeaders: [],
    renamed: [],
    rowsWithExtraCells: [],
    rowsWithMissingCells: [],
  };
  if (parsed.length === 0) {
    return empty;
  }

  const first = parsed[0];
  const body = header ? parsed.slice(1) : parsed;
  const baseHeaders = header ? first : first.map((_v, i) => `column_${String(i + 1)}`);
  const { headers, duplicates, renamed } = uniqueHeaders(baseHeaders);

  const rowsWithExtraCells: number[] = [];
  const rowsWithMissingCells: number[] = [];

  const rows = body.map((cells, idx) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, col) => {
      obj[h] = cells[col] ?? '';
    });
    if (cells.length > headers.length) {
      rowsWithExtraCells.push(idx + 1);
      cells.slice(headers.length).forEach((v, k) => {
        obj[`__extra_${String(k + 1)}`] = v;
      });
    }
    else if (cells.length < headers.length) {
      rowsWithMissingCells.push(idx + 1);
    }
    return obj;
  });

  return {
    headers,
    rows,
    duplicateHeaders: duplicates,
    renamed,
    rowsWithExtraCells,
    rowsWithMissingCells,
  };
}

/**
 * 对象数组 → CSV 文本。表头取所有对象键的并集，保持首次出现顺序。
 */
function objectsToCsv(rows: Record<string, unknown>[], options: ParseCsvOptions = {}): string {
  const headers: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    });
  });

  const body = rows.map(row => headers.map(h => stringifyCell(row[h])));
  return serializeCsv([headers, ...body], options);
}

function stringifyCell(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
