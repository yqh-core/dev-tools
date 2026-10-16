import { csvToObjects, parseCsv } from '@/utils/csv';

export { convertCsvToJson, countCsvRows };

interface CsvToJsonOptions {
  /** 首行是否作为列名 */
  header: boolean
}

interface CsvToJsonResult {
  /** 成功时的 JSON 文本；失败或无内容为空串 */
  json: string
  /** 阻断性错误（畸形 CSV）。空串表示没有 */
  error: string
  /** 非阻断但影响结果的说明：重名列改名、不等长行、只有表头等 */
  warnings: string[]
  rowCount: number
  columnCount: number
}

/** 只数记录条数（供界面显示"共几行"，不解析成对象，省一次全量构造） */
function countCsvRows(csv: string): number {
  const text = csv.trim();
  if (text === '') {
    return 0;
  }
  try {
    return parseCsv(text).length;
  }
  catch {
    return 0;
  }
}

/**
 * CSV → JSON 数组。
 *
 * 解析全部走 `@/utils/csv`，页面不自己写解析器。这里只负责把解析器的
 * **结构化回报翻译成用户能看懂的话**：重名列被改名、某行比表头长/短、
 * 只有表头没有数据 —— 这几种情况都不丢数据，但必须让用户知道结果不是"原样"的。
 */
function convertCsvToJson(csv: string, options: CsvToJsonOptions): CsvToJsonResult {
  const empty: CsvToJsonResult = { json: '', error: '', warnings: [], rowCount: 0, columnCount: 0 };
  const text = csv.trim();

  if (text === '') {
    return empty;
  }

  let parsed: ReturnType<typeof csvToObjects>;
  try {
    parsed = csvToObjects(csv, { header: options.header });
  }
  catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }

  const warnings: string[] = [];

  if (options.header && parsed.rows.length === 0) {
    warnings.push('Only a header row was found, so the result is an empty array.');
  }

  if (parsed.renamed.length > 0) {
    warnings.push(
      `Duplicate column names were renamed to keep every column: ${parsed.renamed
        .map(r => `"${r.from}" → "${r.to}"`)
        .join(', ')}.`,
    );
  }

  if (parsed.rowsWithExtraCells.length > 0) {
    warnings.push(
      `Row ${parsed.rowsWithExtraCells.join(', row ')} had more values than the header; `
      + 'the extra values are kept under "__extra_N" keys.',
    );
  }

  if (parsed.rowsWithMissingCells.length > 0) {
    warnings.push(
      `Row ${parsed.rowsWithMissingCells.join(', row ')} had fewer values than the header; `
      + 'the missing cells are empty strings.',
    );
  }

  return {
    json: JSON.stringify(parsed.rows, null, 2),
    error: '',
    warnings,
    rowCount: parsed.rows.length,
    columnCount: parsed.headers.length,
  };
}
