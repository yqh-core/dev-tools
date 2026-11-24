import { describe, expect, it } from 'vitest';
import {
  emailNormalizeRowsToCsv,
  getCleanedEmailList,
  MAX_EMAIL_INPUT_LENGTH,
  MAX_EMAIL_ROWS,
  normalizeEmailList,
} from './email-normalizer.service';

const conservative = {
  mode: 'conservative' as const,
  removeDuplicates: false,
};

describe('email list normalization', () => {
  it('preserves the local part and only lowercases the domain in conservative mode', () => {
    const [row] = normalizeEmailList('First.Last+News@EXAMPLE.COM', conservative);

    expect(row).toMatchObject({
      lineNumber: 1,
      address: 'First.Last+News@EXAMPLE.COM',
      normalized: 'First.Last+News@example.com',
      status: 'normalized',
      error: '',
    });
  });

  it('retains provider-aware Gmail alias normalization as an explicit mode', () => {
    const rows = normalizeEmailList('First.Last+News@GoogleMail.com\nfirstlast@gmail.com', {
      mode: 'provider-aware',
      removeDuplicates: false,
    });

    expect(rows.map(row => row.normalized)).toEqual([
      'firstlast@gmail.com',
      'firstlast@gmail.com',
    ]);
  });

  it('extracts mailto and display-name wrappers before normalization', () => {
    const rows = normalizeEmailList('mailto:User@EXAMPLE.COM\nJane Doe <jane@example.com>', conservative);

    expect(rows.map(row => row.normalized)).toEqual([
      'User@example.com',
      'Jane Doe <jane@example.com>',
    ]);
    expect(rows[1]).toMatchObject({
      status: 'invalid',
      normalized: '',
    });
  });

  it('removes duplicates after normalization and keeps the first occurrence', () => {
    const rows = normalizeEmailList('User+news@gmail.com\nuser@gmail.com\nother@example.com', {
      mode: 'provider-aware',
      removeDuplicates: true,
    });

    expect(rows.map(row => row.status)).toEqual(['normalized', 'duplicate', 'normalized']);
    expect(getCleanedEmailList(rows)).toBe('user@gmail.com\nother@example.com');
  });

  it('preserves repeated addresses when duplicate removal is disabled', () => {
    const rows = normalizeEmailList('user@example.com\nuser@example.com', conservative);

    expect(rows.map(row => row.status)).toEqual(['normalized', 'normalized']);
    expect(getCleanedEmailList(rows)).toBe('user@example.com\nuser@example.com');
  });

  it('isolates invalid rows and preserves original line numbers', () => {
    const rows = normalizeEmailList('first@example.com\nnot-an-email\n\nsecond@example.com', conservative);

    expect(rows.map(row => row.lineNumber)).toEqual([1, 2, 4]);
    expect(rows.map(row => row.status)).toEqual(['normalized', 'invalid', 'normalized']);
    expect(rows[1].error).toContain('Invalid');
    expect(getCleanedEmailList(rows)).toBe('first@example.com\nsecond@example.com');
  });

  it('exports a row-level CSV report and protects spreadsheet formula cells', () => {
    const rows = normalizeEmailList('=formula@example.com\nuser@example.com', conservative);
    const csv = emailNormalizeRowsToCsv(rows);

    expect(csv).toContain("'=formula@example.com");
    expect(csv).toContain('"user@example.com","user@example.com"');
    expect(csv).toContain('"Line","Original input","Email address","Normalized address","Status","Note"');
  });

  it('rejects inputs beyond the main-thread safety limit', () => {
    expect(() => normalizeEmailList('a'.repeat(MAX_EMAIL_INPUT_LENGTH + 1), conservative)).toThrow(RangeError);
  });

  it('rejects batches with too many non-empty rows', () => {
    const input = Array.from({ length: MAX_EMAIL_ROWS + 1 }, () => 'user@example.com').join('\n');
    expect(() => normalizeEmailList(input, conservative)).toThrow(RangeError);
  });

  it('returns no rows for empty or whitespace-only input', () => {
    expect(normalizeEmailList('', conservative)).toEqual([]);
    expect(normalizeEmailList(' \n\t\n ', conservative)).toEqual([]);
  });
});
