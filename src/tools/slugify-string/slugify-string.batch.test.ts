import { describe, expect, it } from 'vitest';
import {
  MAX_SLUG_BATCH_ROWS,
  MAX_SLUG_INPUT_LENGTH,
  runSlugifyBatch,
  slugifyBatchToCsv,
  slugifyBatchToText,
} from './slugify-string.batch';

const defaults = {
  separator: '-' as const,
  lowercase: true,
  decamelize: true,
  removeEnglishStopWords: false,
  unique: false,
  maxLength: 0,
};

describe('slugify batch conversion', () => {
  it('converts multiple lines and keeps original line numbers when blank rows are skipped', () => {
    const rows = runSlugifyBatch('Hello World\n\nMyFileName', defaults);

    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.slug)).toEqual(['hello-world', 'my-file-name']);
    expect(rows.map(row => row.lineNumber)).toEqual([1, 3]);
  });

  it('supports configurable separators and case preservation', () => {
    const rows = runSlugifyBatch('Hello World\nHello There', {
      ...defaults,
      separator: '_',
      lowercase: false,
    });

    expect(rows.map(row => row.slug)).toEqual(['Hello_World', 'Hello_There']);
  });

  it('supports dots as a separator', () => {
    const [row] = runSlugifyBatch('Hello World', { ...defaults, separator: '.' });
    expect(row.slug).toBe('hello.world');
  });

  it('transliterates accented and non-Latin text using the pinned slugify dependency', () => {
    const rows = runSlugifyBatch('Déjà Vu\nя люблю единорогов', defaults);
    expect(rows.map(row => row.slug)).toEqual(['deja-vu', 'ya-lyublyu-edinorogov']);
  });

  it('removes only the built-in English stop words when explicitly enabled', () => {
    const rows = runSlugifyBatch('The Guide to the API\nA Tale of Two Cities', {
      ...defaults,
      removeEnglishStopWords: true,
    });

    expect(rows.map(row => row.slug)).toEqual(['guide-api', 'tale-two-cities']);
  });

  it('does not return an empty result if all words are stop words', () => {
    const [row] = runSlugifyBatch('The A', {
      ...defaults,
      removeEnglishStopWords: true,
    });

    expect(row.slug).toBe('the-a');
  });

  it('adds duplicate-safe numeric suffixes and respects the configured maximum length', () => {
    const rows = runSlugifyBatch('A longer title for guides\nA longer title for guides\nA longer title for guides', {
      ...defaults,
      unique: true,
      maxLength: 20,
    });

    expect(rows.map(row => row.slug)).toEqual([
      'a-longer-title-for',
      'a-longer-title-for-2',
      'a-longer-title-for-3',
    ]);
    expect(rows.every(row => row.outputLength <= 20)).toBe(true);
  });

  it('keeps generated suffixes unique when an input already looks like a numbered slug', () => {
    const rows = runSlugifyBatch('Guide\nGuide\nGuide-2', {
      ...defaults,
      unique: true,
    });

    expect(rows.map(row => row.slug)).toEqual(['guide', 'guide-2', 'guide-2-2']);
  });

  it('trims at a word boundary rather than cutting through a word', () => {
    const [row] = runSlugifyBatch('hello extraordinarilylongword again', {
      ...defaults,
      maxLength: 10,
    });

    expect(row.slug).toBe('hello');
    expect(row.truncated).toBe(true);
  });

  it('reserves the numeric suffix within a strict maximum length', () => {
    const rows = runSlugifyBatch('A\nA', {
      ...defaults,
      unique: true,
      maxLength: 2,
    });

    expect(rows[0].slug).toBe('a');
    expect(rows[1].slug).toBe('');
    expect(rows[0].error).toBe('');
    expect(rows[1].error).toContain('complete word');
  });

  it('returns a row-level error when no full word fits the maximum length', () => {
    const [row] = runSlugifyBatch('extraordinarilylongword', {
      ...defaults,
      maxLength: 5,
    });

    expect(row.slug).toBe('');
    expect(row.error).toContain('complete word');
  });

  it('protects spreadsheet formula cells in CSV output', () => {
    const rows = runSlugifyBatch('=HYPERLINK("https://example.com")\nTaxi', defaults);
    const csv = slugifyBatchToCsv(rows);

    expect(csv).toContain(`'=HYPERLINK(""https://example.com"")`);
    expect(csv).toContain('"Taxi","taxi"');
  });

  it('exports text as tab-separated original and slug pairs', () => {
    const rows = runSlugifyBatch('Hello World\nA Second Page', defaults);
    expect(slugifyBatchToText(rows)).toBe('Hello World\thello-world\nA Second Page\ta-second-page');
  });

  it('rejects inputs over the shared main-thread safety guard', () => {
    expect(() => runSlugifyBatch('a'.repeat(MAX_SLUG_INPUT_LENGTH + 1), defaults)).toThrow(RangeError);
  });

  it('rejects batches with too many non-empty rows rather than silently dropping input', () => {
    const input = Array.from({ length: MAX_SLUG_BATCH_ROWS + 1 }, () => 'title').join('\n');
    expect(() => runSlugifyBatch(input, defaults)).toThrow(RangeError);
  });

  it('returns no rows for empty or whitespace-only input', () => {
    expect(runSlugifyBatch('', defaults)).toEqual([]);
    expect(runSlugifyBatch(' \n\t\n', defaults)).toEqual([]);
  });
});
