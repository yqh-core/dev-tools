import slugify from '@sindresorhus/slugify';

export type SlugSeparator = '-' | '_' | '.';

export interface SlugifyBatchOptions {
  separator: SlugSeparator
  lowercase: boolean
  decamelize: boolean
  removeEnglishStopWords: boolean
  unique: boolean
  maxLength: number
}

export interface SlugifyBatchRow {
  lineNumber: number
  source: string
  slug: string
  outputLength: number
  truncated: boolean
  error: string
}

export const MAX_SLUG_INPUT_LENGTH = 100_000;
export const MAX_SLUG_BATCH_ROWS = 1_000;

const ENGLISH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with',
]);

function removeStopWords(value: string, separator: SlugSeparator): string {
  const words = value.split(separator);
  const filtered = words.filter(word => !ENGLISH_STOP_WORDS.has(word.toLowerCase()));

  // Do not turn a title such as "The A" into an empty slug.
  return filtered.length > 0 ? filtered.join(separator) : value;
}

function trimAtWordBoundary(
  value: string,
  maxLength: number,
  separator: SlugSeparator,
): { value: string; truncated: boolean } {
  if (maxLength <= 0 || value.length <= maxLength) {
    return { value, truncated: false };
  }

  const words = value.split(separator);
  const kept: string[] = [];

  for (const word of words) {
    const candidate = [...kept, word].join(separator);
    if (candidate.length > maxLength) {
      break;
    }
    kept.push(word);
  }

  return {
    value: kept.join(separator),
    truncated: true,
  };
}

function uniqueSlug(
  value: string,
  used: Map<string, number>,
  options: SlugifyBatchOptions,
): { value: string; truncated: boolean } {
  const key = value.toLowerCase();
  const nextOccurrence = (used.get(key) ?? 0) + 1;
  const suffix = nextOccurrence > 1 ? `${options.separator}${nextOccurrence}` : '';
  const baseLimit = options.maxLength > 0
    ? Math.max(0, options.maxLength - suffix.length)
    : 0;
  const trimmed = trimAtWordBoundary(value, baseLimit, options.separator);

  return {
    value: `${trimmed.value}${suffix}`,
    truncated: trimmed.truncated,
  };
}

/**
 * Convert one non-empty input line per slug. The default is intentionally conservative:
 * separator/lowercase/camel-case options come from the installed slugify v2 API;
 * stop-word removal is optional and only uses a small English list.
 */
export function runSlugifyBatch(
  input: string,
  options: SlugifyBatchOptions,
): SlugifyBatchRow[] {
  if (input.length > MAX_SLUG_INPUT_LENGTH) {
    throw new RangeError(`Input must be ${MAX_SLUG_INPUT_LENGTH.toLocaleString()} characters or fewer.`);
  }

  const lines = input.split(/\r?\n/);
  const nonEmptyLines = lines
    .map((source, index) => ({ source: source.trim(), lineNumber: index + 1 }))
    .filter(row => row.source.length > 0);

  if (nonEmptyLines.length > MAX_SLUG_BATCH_ROWS) {
    throw new RangeError(`Enter ${MAX_SLUG_BATCH_ROWS.toLocaleString()} lines or fewer.`);
  }

  const used = new Map<string, number>();

  return nonEmptyLines.map(({ source, lineNumber }) => {
    const generated = slugify(source, {
      separator: options.separator,
      lowercase: options.lowercase,
      decamelize: options.decamelize,
    });
    const withoutStopWords = options.removeEnglishStopWords
      ? removeStopWords(generated, options.separator)
      : generated;

    if (!withoutStopWords) {
      return {
        lineNumber,
        source,
        slug: '',
        outputLength: 0,
        truncated: false,
        error: 'No URL-safe characters remain after conversion.',
      };
    }

    let slug = withoutStopWords;
    let truncated = false;

    if (options.unique) {
      const result = uniqueSlug(withoutStopWords, used, options);
      slug = result.value;
      truncated = result.truncated;
      if (slug) {
        const key = withoutStopWords.toLowerCase();
        used.set(key, (used.get(key) ?? 0) + 1);
      }
    }
    else {
      const result = trimAtWordBoundary(withoutStopWords, options.maxLength, options.separator);
      slug = result.value;
      truncated = result.truncated;
    }

    if (!slug) {
      return {
        lineNumber,
        source,
        slug: '',
        outputLength: 0,
        truncated,
        error: 'The maximum length is too short to keep a complete word.',
      };
    }

    return {
      lineNumber,
      source,
      slug,
      outputLength: slug.length,
      truncated,
      error: '',
    };
  });
}

function protectSpreadsheetFormula(value: string): string {
  return /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string): string {
  const safe = protectSpreadsheetFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export function slugifyBatchToCsv(rows: SlugifyBatchRow[]): string {
  const header = ['Line', 'Original text', 'Slug', 'Characters', 'Truncated', 'Error'];
  const values = rows.map(row => [
    String(row.lineNumber),
    row.source,
    row.slug,
    String(row.outputLength),
    row.truncated ? 'Yes' : 'No',
    row.error,
  ]);
  return [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function slugifyBatchToText(rows: SlugifyBatchRow[]): string {
  return rows.map(row => `${row.source}\t${row.slug}`).join('\n');
}
