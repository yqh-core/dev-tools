export type PercentageBatchMode = 'part' | 'ratio' | 'change' | 'adjust' | 'reverse' | 'difference' | 'points';

export interface PercentageBatchRow {
  rowNumber: number;
  raw: string;
  formula: string;
  result: string;
  error: string;
}

export interface PercentageBatchHistoryEntry {
  id: string;
  createdAt: string;
  mode: PercentageBatchMode;
  input: string;
  rows: PercentageBatchRow[];
}

const modeLabels: Record<PercentageBatchMode, string> = {
  part: 'Percent of a number',
  ratio: 'What percent is X of Y?',
  change: 'Percentage change',
  adjust: 'Increase and decrease by a percent',
  reverse: 'Reverse an increase and a decrease',
  difference: 'Symmetric percentage difference',
  points: 'Percentage-point change',
};

function numberText(value: number): string {
  return Number.isFinite(value) ? String(value) : '';
}

function calculate(mode: PercentageBatchMode, a: number, b: number): { formula: string; result: string } {
  switch (mode) {
    case 'part':
      return { formula: `(${a} ÷ 100) × ${b}`, result: numberText(a / 100 * b) };
    case 'ratio':
      return b === 0
        ? { formula: `(${a} ÷ ${b}) × 100`, result: '' }
        : { formula: `(${a} ÷ ${b}) × 100`, result: numberText(a / b * 100) };
    case 'change':
      return a === 0
        ? { formula: `((${b} − ${a}) ÷ ${a}) × 100`, result: '' }
        : { formula: `((${b} − ${a}) ÷ ${a}) × 100`, result: numberText((b - a) / a * 100) };
    case 'adjust': {
      const increased = a * (1 + b / 100);
      const decreased = a * (1 - b / 100);
      return {
        formula: `Increase: ${a} × (1 + ${b} ÷ 100); decrease: ${a} × (1 − ${b} ÷ 100)`,
        result: `Increase: ${numberText(increased)}; decrease: ${numberText(decreased)}`,
      };
    }
    case 'reverse': {
      const increaseFactor = 1 + b / 100;
      const decreaseFactor = 1 - b / 100;
      const beforeIncrease = increaseFactor === 0 ? '' : numberText(a / increaseFactor);
      const beforeDecrease = decreaseFactor === 0 ? '' : numberText(a / decreaseFactor);
      return {
        formula: `Before increase: ${a} ÷ (1 + ${b} ÷ 100); before decrease: ${a} ÷ (1 − ${b} ÷ 100)`,
        result: `Before increase: ${beforeIncrease || 'undefined'}; before decrease: ${beforeDecrease || 'undefined'}`,
      };
    }
    case 'difference': {
      const averageMagnitude = (Math.abs(a) + Math.abs(b)) / 2;
      return {
        formula: `(|${a} − ${b}| ÷ ((|${a}| + |${b}|) ÷ 2)) × 100`,
        result: averageMagnitude === 0 ? '' : numberText(Math.abs(a - b) / averageMagnitude * 100),
      };
    }
    case 'points':
      return { formula: `${b} − ${a}`, result: numberText(b - a) };
  }
}

export function getPercentageBatchModeLabel(mode: PercentageBatchMode): string {
  return modeLabels[mode];
}

export function calculatePercentageBatch(input: string, mode: PercentageBatchMode): PercentageBatchRow[] {
  const lines = input.replace(/\r/g, '').split('\n');
  const rows: PercentageBatchRow[] = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    if (cells.length !== 2 || !cells.every(cell => cell.trim() !== '')) {
      rows.push({ rowNumber: index + 1, raw: line, formula: '', result: '', error: 'columns' });
      return;
    }
    const values = cells.map(cell => Number(cell.trim()));
    if (!values.every(Number.isFinite)) {
      rows.push({ rowNumber: index + 1, raw: line, formula: '', result: '', error: 'numbers' });
      return;
    }
    const calculation = calculate(mode, values[0], values[1]);
    const undefinedResult = calculation.result === '' || calculation.result.includes('undefined');
    rows.push({
      rowNumber: index + 1,
      raw: line,
      formula: calculation.formula,
      result: calculation.result,
      error: undefinedResult ? 'undefined' : '',
    });
  });
  return rows;
}

function csvCell(value: string): string {
  return /[",\t\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function exportPercentageBatch(rows: PercentageBatchRow[], delimiter: ',' | '\t' = ','): string {
  const header = ['Row', 'Input', 'Formula', 'Result', 'Error'];
  const lines = [header, ...rows.map(row => [
    String(row.rowNumber), row.raw, row.formula, row.result, row.error,
  ])];
  return lines.map(line => line.map(csvCell).join(delimiter)).join('\r\n');
}
