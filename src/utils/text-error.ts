export interface TextProblem {
  message: string
  start: number
  end: number
}

/** 把 1-based 行/列换成字符串下标。列按 UTF-16 码元计，和 textarea 的 selection 一致。 */
export function offsetAt(text: string, line: number, column: number): number {
  let index = 0;
  let current = 1;
  while (index < text.length && current < line) {
    if (text[index] === '\n') {
      current += 1;
    }
    index += 1;
  }
  return Math.min(text.length, index + Math.max(0, column - 1));
}

/**
 * JSON / JSON5 解析失败时的位置。
 * JSON5 的报错是 `at line:column`，JSON.parse 是 `at position N`。
 */
export function describeJsonProblem(raw: string, error: unknown): TextProblem {
  const message = error instanceof Error ? error.message : 'Invalid JSON';
  const lineCol = /at (\d+):(\d+)/.exec(message);
  if (lineCol) {
    const start = offsetAt(raw, Number(lineCol[1]), Number(lineCol[2]));
    return { message, start, end: Math.min(raw.length, start + 1) };
  }
  const position = /position (\d+)/.exec(message);
  if (position) {
    const start = Math.min(raw.length, Number(position[1]));
    return { message, start, end: Math.min(raw.length, start + 1) };
  }
  return { message, start: 0, end: 0 };
}
