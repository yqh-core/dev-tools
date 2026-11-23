export type PercentageBatchMode =
  | 'percent-of'
  | 'part-to-whole'
  | 'percentage-change'
  | 'adjustment'
  | 'reverse'
  | 'percentage-difference'
  | 'percentage-points';

export interface PercentageBatchRow {
  lineNumber: number
  label: string
  inputs: string[]
  formula: string
  result: string
  error: string
}

function isNumericCell(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

function numberText(value: number): string {
  return Object.is(value, -0) ? '0' : String(value);
}

function csvCell(value: string, protectFormula = false): string {
  const safe = protectFormula && /^[\s]*[=+\-@]/.test(value) ? \`'\${value}\` : value;
  return \`"\${safe.replace(/"/g, '""')}"\`;
}

function makeError(
  lineNumber: number,
  label: string,
  inputs: string[],
  error: string,
): PercentageBatchRow {
  return { lineNumber, label, inputs, formula: '', result: '', error };
}

/**
 * Calculates line-delimited rows locally. Each non-empty line accepts two
 * numeric columns separated by a tab or comma. An optional first text column
 * is treated as a row label: label<TAB>value A<TAB>value B.
 */
export function runPercentageBatch(
  source: string,
  mode: PercentageBatchMode,
): PercentageBatchRow[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const rows: PercentageBatchRow[] = [];

  lines.forEach((line, index) => {
    if (!line.trim()) {
      return;
    }

    const lineNumber = index + 1;
    const delimiter = line.includes('\t') ? '\t' : line.includes(',') ? ',' : null;
    const parsedCells = delimiter
      ? line.split(delimiter).map(cell => cell.trim())
      : line.trim().split(/\s+/);
    const hasLabel = parsedCells.length === 3 && Boolean(parsedCells[0]) && !isNumericCell(parsedCells[0]);
    const label = hasLabel ? parsedCells[0] : \`Row \${lineNumber}\`;
    const cells = hasLabel ? parsedCells.slice(1) : parsedCells;

    if (cells.length !== 2) {
      rows.push(makeError(
        lineNumber,
        label,
        cells,
        'Expected two numeric columns. Separate values with a tab or comma; an optional text label may come first.',
      ));
      return;
    }

    if (!cells.every(isNumericCell)) {
      rows.push(makeError(lineNumber, label, cells, 'Both input columns must contain finite numbers.'));
      return;
    }

    const [a, b] = cells.map(Number);
    let formula = '';
    let result = '';
    let error = '';

    switch (mode) {
      case 'percent-of': {
        const value = a / 100 * b;
        formula = \`(\${numberText(a)} ÷ 100) × \${numberText(b)} = \${numberText(value)}\`;
        result = numberText(value);
        break;
      }
      case 'part-to-whole': {
        if (b === 0) {
          error = 'The whole value cannot be zero.';
          break;
        }
        const value = a / b * 100;
        formula = \`(\${numberText(a)} ÷ \${numberText(b)}) × 100 = \${numberText(value)}%\`;
        result = \`\${numberText(value)}%\`;
        break;
      }
      case 'percentage-change': {
        if (a === 0) {
          error = 'The starting value cannot be zero for percentage change.';
          break;
        }
        const value = (b - a) / a * 100;
        formula = \`(\${numberText(b)} − \${numberText(a)}) ÷ \${numberText(a)} × 100 = \${numberText(value)}%\`;
        result = \`\${numberText(value)}%\`;
        break;
      }
      case 'adjustment': {
        const increased = a * (1 + b / 100);
        const decreased = a * (1 - b / 100);
        formula = \`Increase: \${numberText(a)} × (1 + \${numberText(b)} ÷ 100) = \${numberText(increased)}; Decrease: \${numberText(a)} × (1 − \${numberText(b)} ÷ 100) = \${numberText(decreased)}\`;
        result = \`Increase: \${numberText(increased)} | Decrease: \${numberText(decreased)}\`;
        break;
      }
      case 'reverse': {
        const increaseFactor = 1 + b / 100;
        const decreaseFactor = 1 - b / 100;
        const beforeIncrease = increaseFactor === 0 ? null : a / increaseFactor;
        const beforeDecrease = decreaseFactor === 0 ? null : a / decreaseFactor;
        const increaseText = beforeIncrease === null ? 'N/A' : numberText(beforeIncrease);
        const decreaseText = beforeDecrease === null ? 'N/A' : numberText(beforeDecrease);
        formula = \`Before increase: \${numberText(a)} ÷ (1 + \${numberText(b)} ÷ 100) = \${increaseText}; Before decrease: \${numberText(a)} ÷ (1 − \${numberText(b)} ÷ 100) = \${decreaseText}\`;
        result = \`Before increase: \${increaseText} | Before decrease: \${decreaseText}\`;
        break;
      }
      case 'percentage-difference': {
        const averageMagnitude = (Math.abs(a) + Math.abs(b)) / 2;
        if (averageMagnitude === 0) {
          error = 'Percentage difference is undefined when both values are zero.';
          break;
        }
        const value = Math.abs(a - b) / averageMagnitude * 100;
        formula = \`|\${numberText(a)} − \${numberText(b)}| ÷ (\${numberText(averageMagnitude)}) × 100 = \${numberText(value)}%\`;
        result = \`\${numberText(value)}%\`;
        break;
      }
      case 'percentage-points': {
        const value = b - a;
        formula = \`\${numberText(b)} − \${numberText(a)} = \${numberText(value)} percentage points\`;
        result = \`\${numberText(value)} percentage points\`;
        break;
      }
    }

    rows.push({ lineNumber, label, inputs: cells, formula, result, error });
  });

  return rows;
}

export function percentageBatchToCsv(rows: PercentageBatchRow[]): string {
  const header = ['Row', 'Input A', 'Input B', 'Formula', 'Result', 'Error'];
  const lines = rows.map(row => [
    csvCell(row.label, true),
    csvCell(row.inputs[0] || ''),
    csvCell(row.inputs[1] || ''),
    csvCell(row.formula),
    csvCell(row.result),
    csvCell(row.error),
  ].join(','));
  return [header.map(cell => csvCell(cell)).join(','), ...lines].join('\r\n');
}
