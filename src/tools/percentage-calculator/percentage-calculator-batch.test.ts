import { describe, expect, it } from 'vitest'
import type { PercentageBatchMode } from './percentage-calculator-batch'
import {
  calculatePercentageBatch,
  exportPercentageBatch,
  getPercentageBatchModeLabel,
} from './percentage-calculator-batch'

describe('percentage calculator batch engine', () => {
  const cases: Array<{ mode: PercentageBatchMode; input: string; result: string }> = [
    { mode: 'part', input: '15\t80', result: '12' },
    { mode: 'ratio', input: '30,120', result: '25' },
    { mode: 'change', input: '80\t92', result: '15' },
    { mode: 'adjust', input: '80\t15', result: 'Increase: 92; decrease: 68' },
    { mode: 'reverse', input: '120\t20', result: 'Before increase: 100; before decrease: 150' },
    { mode: 'difference', input: '100\t150', result: '40' },
    { mode: 'points', input: '5\t7', result: '2' },
  ]

  it.each(cases)('calculates the $mode task and shows a substituted formula', ({ mode, input, result }) => {
    const [row] = calculatePercentageBatch(input, mode)
    expect(row.error).toBe('')
    expect(row.result).toBe(result)
    expect(row.formula).toContain(input.includes('\t') ? input.split('\t')[0] : input.split(',')[0])
  })

  it('ignores blank lines while preserving source row numbers', () => {
    const rows = calculatePercentageBatch('15\t80\n\n20\t50', 'part')
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.rowNumber)).toEqual([1, 3])
    expect(rows.map(row => row.result)).toEqual(['12', '10'])
  })

  it('reports malformed rows and non-numeric values without dropping the row', () => {
    const rows = calculatePercentageBatch('10\t20\t30\nabc\t4\n5', 'part')
    expect(rows).toHaveLength(3)
    expect(rows.every(row => row.error.length > 0)).toBe(true)
    expect(rows.every(row => row.result === '')).toBe(true)
  })

  it('handles zero denominators and mathematically undefined results', () => {
    expect(calculatePercentageBatch('10\t0', 'ratio')[0].error).not.toBe('')
    expect(calculatePercentageBatch('0\t10', 'change')[0].error).not.toBe('')
    expect(calculatePercentageBatch('0\t0', 'difference')[0].error).not.toBe('')
    expect(calculatePercentageBatch('120\t-100', 'reverse')[0].error).not.toBe('')
    expect(calculatePercentageBatch('80\t100', 'reverse')[0].error).not.toBe('')
  })

  it('supports negative inputs and keeps deterministic full-precision results', () => {
    expect(calculatePercentageBatch('-80\t15', 'adjust')[0].result)
      .toBe('Increase: -92; decrease: -68')
    expect(calculatePercentageBatch('1\t3', 'ratio')[0].result)
      .toBe('33.33333333333333')
    expect(calculatePercentageBatch('7\t5', 'points')[0].result).toBe('-2')
  })

  it('exports CSV and TSV with headers and escaped cell values', () => {
    const rows = calculatePercentageBatch('10\t20', 'part')
    expect(exportPercentageBatch(rows)).toBe(
      'Row,Input,Formula,Result,Error\r\n1,"10\t20",(10 ÷ 100) × 20,2,',
    )
    expect(exportPercentageBatch(rows, '\t').split('\r\n')[0])
      .toBe('Row\tInput\tFormula\tResult\tError')
  })

  it('provides a stable label for each supported task', () => {
    expect(getPercentageBatchModeLabel('points')).toBe('Percentage-point change')
  })
})
