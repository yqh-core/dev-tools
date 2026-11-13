/**
 * API-007 响应查看器增强（WP-A 批1）：UTF-8 字节大小 + 正文行搜索。
 * 纯函数，可单测；不改 apiproxy 返回结构。
 */

/** UTF-8 字节数（≠ String.length；多字节字符按真实字节计）。 */
export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export interface BodySearchResult {
  /** 命中的行（保留原始行内容）；空查询返回全部行 */
  lines: string[]
  totalLines: number
  matchedLines: number
  /** 命中总次数（一行多次命中累计） */
  occurrences: number
}

/** 大小写不敏感的逐行搜索；空/纯空白查询 = 不过滤。 */
export function searchBody(body: string, query: string): BodySearchResult {
  const all = body.split('\n');
  const q = query.trim().toLowerCase();
  if (!q) {
    return { lines: all, totalLines: all.length, matchedLines: all.length, occurrences: 0 };
  }
  const lines: string[] = [];
  let occurrences = 0;
  for (const line of all) {
    const lower = line.toLowerCase();
    let count = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) {
      count += 1;
      idx = lower.indexOf(q, idx + q.length);
    }
    if (count > 0) {
      lines.push(line);
      occurrences += count;
    }
  }
  return { lines, totalLines: all.length, matchedLines: lines.length, occurrences };
}
