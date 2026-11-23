import { describe, expect, it } from 'vitest';
import { percentageBatchToCsv, percentageBatchToTsv, runPercentageBatch } from './percentage-calculator.batch';
import type { PercentageBatchRow } from './percentage-calculator.batch';

describe('percentage batch calculations', () => {
  it('calculates percent of a number for multiple labelled rows', () => {
    const rows = runPercentageBatch('Groceries\t20\t150\nTaxi\t10\t40', 'percent-of');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ label: 'Groceries', result: '30', error: '' });
    expect(rows[0].formula).toContain('(20 ÷ 100) × 150 = 30');
    expect(rows[1]).toMatchObject({ label: 'Taxi', result: '4', error: '' });
  });

  it('calculates part-to-whole percentages', () => {
    const [row] = runPercentageBatch('30\t120', 'part-to-whole');

    expect(row.result).toBe('25%');
    expect(row.formula).toContain('(30 ÷ 120) × 100 = 25%');
  });

  it('calculates directional percentage change, including decreases', () => {
    const rows = runPercentageBatch('80\t92\n80\t68', 'percentage-change');

    expect(rows.map(row => row.result)).toEqual(['15%', '-15%']);
  });

  it('calculates both increase and decrease adjustments', () => {
    const [row] = runPercentageBatch('Price\t100\t15', 'adjustment');

    expect(row.result).toBe('Increase: 115 | Decrease: 85');
    expect(row.formula).toContain('100 × (1 + 15 ÷ 100) = 115');
    expect(row.formula).toContain('100 × (1 − 15 ÷ 100) = 85');
  });

  it('reverses percentage increases and decreases', () => {
    const [row] = runPercentageBatch('120\t20', 'reverse');

    expect(row.result).toBe('Before increase: 100 | Before decrease: 150');
    expect(row.formula).toContain('120 ÷ (1 + 20 ÷ 100) = 100');
  });

  it('marks only the mathematically impossible reverse direction as N/A', () => {
    const [afterFullDiscount] = runPercentageBatch('80\t100', 'reverse');
    const [afterNegativeOneHundred] = runPercentageBatch('80\t-100', 'reverse');

    expect(afterFullDiscount.result).toBe('Before increase: 40 | Before decrease: N/A');
    expect(afterNegativeOneHundred.result).toBe('Before increase: N/A | Before decrease: 40');
    expect(afterFullDiscount.error).toBe('');
    expect(afterNegativeOneHundred.error).toBe('');
  });

  it('calculates symmetric percentage difference regardless of input order', () => {
    const rows = runPercentageBatch('100\t150\n150\t100', 'percentage-difference');

    expect(rows.map(row => row.result)).toEqual(['40%', '40%']);
  });

  it('calculates percentage-point movement separately from relative change', () => {
    const rows = runPercentageBatch('5\t7\n7\t5', 'percentage-points');

    expect(rows.map(row => row.result)).toEqual(['2 percentage points', '-2 percentage points']);
  });

  it('supports negative and decimal values without rounding away precision', () => {
    const rows = runPercentageBatch('-5\t100\n7.5\t200', 'percent-of');

    expect(rows.map(row => row.result)).toEqual(['-5', '15']);
  });

  it('ignores blank lines but keeps malformed and invalid rows visible', () => {
    const rows = runPercentageBatch('20\t150\n\nbad\t150\n20\n30\t0', 'part-to-whole');

    expect(rows).toHaveLength(4);
    expect(rows[0].result).toBe('13.333333333333334%');
    expect(rows[1].error).toContain('finite numbers');
    expect(rows[2].error).toContain('two numeric columns');
    expect(rows[3].error).toContain('cannot be zero');
    expect(rows.map(row => row.lineNumber)).toEqual([1, 3, 4, 5]);
  });

  it('rejects undefined zero denominators with a row-level error', () => {
    const partToWhole = runPercentageBatch('30\t0', 'part-to-whole')[0];
    const percentageChange = runPercentageBatch('0\t100', 'percentage-change')[0];
    const percentageDifference = runPercentageBatch('0\t0', 'percentage-difference')[0];

    expect(partToWhole.error).toContain('whole value cannot be zero');
    expect(percentageChange.error).toContain('starting value cannot be zero');
    expect(percentageDifference.error).toContain('both values are zero');
  });

  it('returns no rows for empty or whitespace-only input', () => {
    expect(runPercentageBatch('', 'percent-of')).toEqual([]);
    expect(runPercentageBatch(' \n\t\n', 'percent-of')).toEqual([]);
  });


  it('exports TSV with tab/newline/quote escaping and spreadsheet formula protection', () => {
    const rows: PercentageBatchRow[] = [{
      lineNumber: 1,
      label: 'Line\\tbreak\\n"label"',
      inputs: ['1', '2'],
      formula: '1 + 2 = 3',
      result: '3',
      error: '',
    }];
    const tsv = percentageBatchToTsv(rows);
    expect(tsv.split('\\r\\n')[0]).toBe('Row\\tInput A\\tInput B\\tFormula\\tResult\\tError');
    expect(tsv).toContain('"Line\\tbreak\\n""label"""\\t1\\t2');
    const formulaRows = runPercentageBatch('=SUM(1,2)\\t20\\t150', 'percent-of');
    expect(percentageBatchToTsv(formulaRows)).toContain("'=SUM(1,2)\\t20\\t150");
  });

  it('exports every result to quoted CSV and protects labels from formula injection', () => {
    const rows = runPercentageBatch('=HYPERLINK("https://example.com")\t20\t150\nTaxi\t10\t40', 'percent-of');
    const csv = percentageBatchToCsv(rows);

    expect(csv).toContain('\'=HYPERLINK(""https://example.com"")');
    expect(csv).toContain('"Taxi","10","40"');
    expect(csv).toContain('"Formula","Result","Error"');
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});
