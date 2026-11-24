export type RedirectFormat = 'apache' | 'nginx' | 'cloudflare';
export type RedirectStatus = '301' | '302' | '307' | '308';

export interface ParsedRedirectRow {
  line: number
  source: string
  target: string
  parseError?: string
}

export interface RedirectIssue {
  severity: 'error' | 'warning'
  code: 'invalid-source' | 'invalid-target' | 'duplicate-source' | 'self-redirect' | 'redirect-chain' | 'redirect-loop' | 'parse-error'
  message: string
}

export interface RedirectRow extends ParsedRedirectRow {
  sourcePath: string
  targetPath: string
  sourceUrl: string
  targetUrl: string
  issues: RedirectIssue[]
}

export interface RedirectAnalysis {
  rows: RedirectRow[]
  total: number
  valid: number
  errors: number
  warnings: number
}

const MAX_ROWS = 1000;
const MAX_INPUT_LENGTH = 200_000;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ALLOWED_STATUS = new Set<RedirectStatus>(['301', '302', '307', '308']);

function parseCsvRecords(input: string): { values: string[]; line: number; error?: string }[] {
  const records: { values: string[]; line: number; error?: string }[] = [];
  let values: string[] = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let malformed = false;

  const finishField = () => {
    values.push(field.trim());
    field = '';
  };
  const finishRecord = () => {
    finishField();
    if (values.some(value => value.length > 0) || malformed) {
      records.push({
        values,
        line: recordLine,
        error: malformed ? 'Unclosed quoted field in CSV input.' : undefined,
      });
    }
    values = [];
    malformed = false;
    recordLine = line + 1;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        }
        else {
          quoted = false;
        }
      }
      else {
        field += character;
        if (character === '\n') {
          line += 1;
        }
      }
      continue;
    }

    if (character === '"' && field.trim() === '') {
      quoted = true;
    }
    else if (character === ',') {
      finishField();
    }
    else if (character === '\n') {
      finishRecord();
      line += 1;
    }
    else if (character !== '\r') {
      field += character;
    }
  }

  if (quoted) {
    malformed = true;
  }
  if (field.length > 0 || values.length > 0 || malformed) {
    finishRecord();
  }
  return records;
}

function hasHeader(values: string[]): boolean {
  const first = (values[0] ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  const second = (values[1] ?? '').toLowerCase().replace(/[\s_-]+/g, '');
  return ['source', 'from', 'oldurl', 'old', 'sourceurl'].includes(first)
    && ['target', 'to', 'newurl', 'destination', 'destinationurl', 'new'].includes(second);
}

/** Accept comma CSV, tab-separated pairs, or one "old -> new" pair per line. */
export function parseRedirectInput(input: string): ParsedRedirectRow[] {
  if (input.length > MAX_INPUT_LENGTH) {
    throw new RangeError(`Input must be ${MAX_INPUT_LENGTH.toLocaleString()} characters or fewer.`);
  }

  const text = input.replace(/^\uFEFF/, '');
  const nonEmpty = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (!text.includes(',') && nonEmpty.some(line => line.includes('->'))) {
    const rows = nonEmpty.map((line, index) => {
      const separator = line.indexOf('->');
      return separator < 0
        ? { line: index + 1, source: '', target: '', parseError: 'Use "old URL -> new URL" for each mapping.' }
        : { line: index + 1, source: line.slice(0, separator).trim(), target: line.slice(separator + 2).trim() };
    });
    if (rows.length > MAX_ROWS) {
      throw new RangeError(`Enter ${MAX_ROWS.toLocaleString()} redirects or fewer.`);
    }
    return rows;
  }

  const delimiter = !text.includes(',') && text.includes('\t') ? '\t' : ',';
  const records = delimiter === ','
    ? parseCsvRecords(text)
    : text.split(/\r?\n/).map((line, index) => ({ values: line.split('\t').map(value => value.trim()), line: index + 1 }));

  const filtered = records.filter(record => record.values.some(value => value.trim().length > 0));
  const firstRecord = filtered[0];
  const dataRecords = firstRecord && hasHeader(firstRecord.values) ? filtered.slice(1) : filtered;

  if (dataRecords.length > MAX_ROWS) {
    throw new RangeError(`Enter ${MAX_ROWS.toLocaleString()} redirects or fewer.`);
  }

  return dataRecords.map((record) => {
    if (record.error) {
      return { line: record.line, source: record.values[0] ?? '', target: record.values[1] ?? '', parseError: record.error };
    }
    if (record.values.length < 2 || !record.values[0] || !record.values[1]) {
      return {
        line: record.line,
        source: record.values[0] ?? '',
        target: record.values[1] ?? '',
        parseError: 'Each row needs a source URL and a destination URL.',
      };
    }
    return { line: record.line, source: record.values[0], target: record.values[1] };
  });
}

function parseHttpUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : undefined;
  }
  catch {
    return undefined;
  }
}

function normalizeSource(value: string): { path: string; url: string } {
  const source = value.trim();
  if (!source || CONTROL_CHARS.test(source) || source.includes('\\')) {
    throw new Error('Enter a valid path or an absolute HTTP/HTTPS URL.');
  }

  const absolute = parseHttpUrl(source);
  if (absolute) {
    if (absolute.search || absolute.hash) {
      throw new Error('Source URLs must not contain a query string or fragment.');
    }
    return { path: absolute.pathname || '/', url: absolute.origin + (absolute.pathname || '/') };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith('//')) {
    throw new Error('Only HTTP and HTTPS source URLs are supported.');
  }
  if (/[?#]/.test(source)) {
    throw new Error('Source paths must not contain a query string or fragment.');
  }

  const path = source.startsWith('/') ? source : `/${source}`;
  if (path === '/' || path.split('/').includes('..')) {
    throw new Error('Use a specific source path without parent-directory segments.');
  }
  return { path, url: path };
}

function normalizeTarget(value: string): { path: string; url: string } {
  const target = value.trim();
  if (!target || CONTROL_CHARS.test(target) || target.includes('\\')) {
    throw new Error('Enter a valid destination path or HTTP/HTTPS URL.');
  }

  const absolute = parseHttpUrl(target);
  if (absolute) {
    return { path: absolute.pathname || '/', url: absolute.href };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) {
    throw new Error('Only HTTP and HTTPS destination URLs are supported.');
  }
  if (target.startsWith('#') || target.startsWith('?')) {
    throw new Error('Use a destination path, not a query-only or fragment-only value.');
  }

  const path = target.startsWith('/') ? target : `/${target}`;
  if (path.split(/[?#]/, 1)[0].split('/').includes('..')) {
    throw new Error('Destination paths must not contain parent-directory segments.');
  }
  return { path: path.split(/[?#]/, 1)[0] || '/', url: path };
}

function addIssue(row: RedirectRow, severity: RedirectIssue['severity'], code: RedirectIssue['code'], message: string) {
  row.issues.push({ severity, code, message });
}

export function analyzeRedirects(input: string): RedirectAnalysis {
  const parsed = parseRedirectInput(input);
  const rows: RedirectRow[] = parsed.map((item) => {
    const row: RedirectRow = {
      ...item,
      sourcePath: '',
      targetPath: '',
      sourceUrl: '',
      targetUrl: '',
      issues: [],
    };

    if (item.parseError) {
      addIssue(row, 'error', 'parse-error', item.parseError);
      return row;
    }

    try {
      const source = normalizeSource(item.source);
      row.sourcePath = source.path;
      row.sourceUrl = source.url;
    }
    catch (error) {
      addIssue(row, 'error', 'invalid-source', error instanceof Error ? error.message : 'Invalid source URL.');
    }

    try {
      const target = normalizeTarget(item.target);
      row.targetPath = target.path;
      row.targetUrl = target.url;
    }
    catch (error) {
      addIssue(row, 'error', 'invalid-target', error instanceof Error ? error.message : 'Invalid destination URL.');
    }

    const absoluteSource = parseHttpUrl(row.sourceUrl);
    const absoluteTarget = parseHttpUrl(row.targetUrl);
    const sameOrigin = (!absoluteSource && !absoluteTarget)
      || Boolean(absoluteSource && absoluteTarget && absoluteSource.origin === absoluteTarget.origin);
    if (
      row.sourcePath
      && row.targetPath
      && row.sourcePath === row.targetPath
      && sameOrigin
      && !absoluteTarget?.search
    ) {
      addIssue(row, 'error', 'self-redirect', 'The source and destination are the same path.');
    }
    return row;
  });

  const firstBySource = new Map<string, RedirectRow>();
  for (const row of rows) {
    if (!row.sourcePath || row.issues.some(issue => issue.severity === 'error')) {
      continue;
    }
    const key = row.sourcePath;
    if (firstBySource.has(key)) {
      addIssue(row, 'error', 'duplicate-source', `This source duplicates line ${firstBySource.get(key)?.line}.`);
    }
    else {
      firstBySource.set(key, row);
    }
  }

  // Trace path-to-path redirects so avoidable chains and loops are visible before export.
  for (const row of firstBySource.values()) {
    if (row.issues.some(issue => issue.severity === 'error') || parseHttpUrl(row.targetUrl)) {
      continue;
    }

    let next = row.targetPath;
    const visited = new Set<string>([row.sourcePath]);
    let hops = 0;
    let loop = false;
    while (firstBySource.has(next) && hops <= firstBySource.size) {
      if (visited.has(next)) {
        loop = true;
        break;
      }
      visited.add(next);
      const nextRow = firstBySource.get(next);
      if (!nextRow) {
        break;
      }
      next = nextRow.targetPath;
      hops += 1;
    }

    if (loop) {
      for (const path of visited) {
        const cycleRow = firstBySource.get(path);
        if (cycleRow && !cycleRow.issues.some(issue => issue.code === 'redirect-loop')) {
          addIssue(cycleRow, 'error', 'redirect-loop', 'This redirect is part of a loop. Break the loop before exporting.');
        }
      }
    }
    else if (hops > 0) {
      addIssue(row, 'warning', 'redirect-chain', `This destination continues through ${hops} more redirect(s). Point it directly to the final destination when possible.`);
    }
  }

  const errors = rows.filter(row => row.issues.some(issue => issue.severity === 'error')).length;
  const warnings = rows.filter(row => row.issues.some(issue => issue.severity === 'warning')).length;
  return {
    rows,
    total: rows.length,
    valid: rows.length - errors,
    errors,
    warnings,
  };
}

function eligibleRows(analysis: RedirectAnalysis): RedirectRow[] {
  return analysis.rows.filter(row => row.issues.every(issue => issue.severity !== 'error'));
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function validOrigin(value: string): string {
  const url = parseHttpUrl(value.trim());
  if (!url || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter a site origin such as https://example.com (no path or query).');
  }
  return url.origin;
}

export function generateRedirectOutput(
  analysis: RedirectAnalysis,
  format: RedirectFormat,
  status: RedirectStatus,
  options: { origin?: string; preserveQueryString?: boolean } = {},
): string {
  if (!ALLOWED_STATUS.has(status)) {
    throw new Error('Choose a supported redirect status: 301, 302, 307 or 308.');
  }

  const rows = eligibleRows(analysis);
  if (rows.length === 0) {
    return '';
  }

  if (format === 'apache') {
    return [
      '# Apache mod_alias — exact-path rules. Enable mod_alias before using these directives.',
      ...rows.map(row => `RedirectMatch ${status} "^/${regexEscape(row.sourcePath.replace(/^\//, ''))}$" "${row.targetUrl}"`),
    ].join('\n');
  }

  if (format === 'nginx') {
    return [
      '# Place these exact-match locations inside the appropriate server block.',
      ...rows.map(row => `location = ${row.sourcePath} { return ${status} "${row.targetUrl}"; }`),
    ].join('\n\n');
  }

  const origin = validOrigin(options.origin ?? '');
  return rows.map((row) => {
    const source = parseHttpUrl(row.sourceUrl)
      ? row.sourceUrl
      : `${origin}${row.sourcePath}`;
    const target = parseHttpUrl(row.targetUrl)
      ? row.targetUrl
      : `${origin}${row.targetUrl}`;
    const fields = [
      source,
      target,
      status,
      options.preserveQueryString ? 'TRUE' : 'FALSE',
      'FALSE',
      'FALSE',
      'FALSE',
    ];
    return fields.map(csvCell).join(',');
  }).join('\n');
}
