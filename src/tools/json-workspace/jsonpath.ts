/**
 * JSONPath 子集引擎（零依赖，WP-002 JSON Developer Workspace 的 Query 能力）。
 *
 * 支持：$ 根、.key / ['key'] / ["key"] 子节点、.* / [*] 通配、
 *       [n] 数组下标（含负数）、[start:end:step] 切片、..key / ..* / ..[..] 递归下降。
 * 返回匹配值数组（JSONPath 语义）。不支持过滤表达式 ?() 与脚本表达式（明确边界，不假装支持）。
 *
 * 纪律：解析失败抛错（不静默返回空冒充"无匹配"）；空匹配返回 [] 是合法结果。
 */

type Step =
  | { kind: 'child'; key: string }
  | { kind: 'wildcard' }
  | { kind: 'index'; index: number }
  | { kind: 'slice'; start: number | null; end: number | null; step: number }
  | { kind: 'recursive'; selector: Step };

export class JsonPathError extends Error {}

function isIdentChar(c: string): boolean {
  return /[A-Za-z0-9_$\-]/.test(c);
}

/** 把 JSONPath 字符串解析成步骤序列。 */
export function parsePath(path: string): Step[] {
  const p = path.trim();
  if (!p.startsWith('$')) {
    throw new JsonPathError('JSONPath must start with $');
  }
  const steps: Step[] = [];
  let i = 1;
  const n = p.length;

  const expect = (c: string) => {
    if (p[i] !== c) {
      throw new JsonPathError(`Expected ${c}, got ${p[i] ?? 'EOF'}`);
    }
    i++;
  };

  const readBracket = (): Step => {
    i++; // skip [
    if (p[i] === '*') {
      i++;
      expect(']');
      return { kind: 'wildcard' };
    }
    if (p[i] === '\'' || p[i] === '"') {
      const q = p[i];
      i++;
      let key = '';
      while (i < n && p[i] !== q) {
        if (p[i] === '\\') {
          i++;
          if (i < n) {
            key += p[i];
            i++;
          }
          continue;
        }
        key += p[i];
        i++;
      }
      if (p[i] !== q) {
        throw new JsonPathError('Unclosed quote');
      }
      i++;
      expect(']');
      return { kind: 'child', key };
    }
    let inner = '';
    while (i < n && p[i] !== ']') {
      inner += p[i];
      i++;
    }
    expect(']');
    if (inner.includes(':')) {
      const parts = inner.split(':');
      if (parts.length > 3) {
        throw new JsonPathError('Slice accepts at most start:end:step');
      }
      const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
      const start = num(parts[0]);
      const end = num(parts[1] ?? '');
      const step = parts[2] !== undefined && parts[2].trim() !== '' ? Number(parts[2]) : 1;
      const badStart = start !== null && !Number.isInteger(start);
      const badEnd = end !== null && !Number.isInteger(end);
      if (badStart || badEnd || !Number.isInteger(step) || step === 0) {
        throw new JsonPathError('Invalid slice parameters');
      }
      return { kind: 'slice', start, end, step };
    }
    const idx = Number(inner);
    if (!Number.isInteger(idx)) {
      throw new JsonPathError(`Invalid index ${inner}`);
    }
    return { kind: 'index', index: idx };
  };

  while (i < n) {
    if (p[i] === '.') {
      i++;
      if (p[i] === '.') {
        i++;
        let sel: Step;
        if (p[i] === '[') {
          sel = readBracket();
        }
        else if (p[i] === '*') {
          i++;
          sel = { kind: 'wildcard' };
        }
        else {
          let key = '';
          while (i < n && isIdentChar(p[i])) {
            key += p[i];
            i++;
          }
          if (!key) {
            throw new JsonPathError('Missing selector after ..');
          }
          sel = { kind: 'child', key };
        }
        steps.push({ kind: 'recursive', selector: sel });
      }
      else if (p[i] === '*') {
        i++;
        steps.push({ kind: 'wildcard' });
      }
      else {
        let key = '';
        while (i < n && isIdentChar(p[i])) {
          key += p[i];
          i++;
        }
        if (!key) {
          throw new JsonPathError('Missing key after .');
        }
        steps.push({ kind: 'child', key });
      }
    }
    else if (p[i] === '[') {
      steps.push(readBracket());
    }
    else {
      throw new JsonPathError(`Unexpected character ${p[i]} at position ${i}`);
    }
  }
  return steps;
}

function children(node: unknown): unknown[] {
  if (Array.isArray(node)) {
    return node;
  }
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>);
  }
  return [];
}

function applySelector(node: unknown, sel: Step): unknown[] {
  switch (sel.kind) {
    case 'child': {
      if (node && typeof node === 'object' && !Array.isArray(node) && sel.key in (node as Record<string, unknown>)) {
        return [(node as Record<string, unknown>)[sel.key]];
      }
      if (Array.isArray(node) && /^\d+$/.test(sel.key)) {
        const idx = Number(sel.key);
        return idx < node.length ? [node[idx]] : [];
      }
      return [];
    }
    case 'wildcard':
      return children(node);
    case 'index': {
      if (!Array.isArray(node)) {
        return [];
      }
      const idx = sel.index < 0 ? node.length + sel.index : sel.index;
      return idx >= 0 && idx < node.length ? [node[idx]] : [];
    }
    case 'slice': {
      if (!Array.isArray(node)) {
        return [];
      }
      const len = node.length;
      const step = sel.step;
      const norm = (v: number | null, dflt: number) => {
        if (v === null) {
          return dflt;
        }
        return v < 0 ? Math.max(0, len + v) : Math.min(len, v);
      };
      const start = norm(sel.start, step > 0 ? 0 : len - 1);
      const end = norm(sel.end, step > 0 ? len : -1);
      const out: unknown[] = [];
      if (step > 0) {
        for (let k = start; k < end; k += step) {
          out.push(node[k]);
        }
      }
      else {
        for (let k = start; k > end; k += step) {
          if (k >= 0 && k < len) {
            out.push(node[k]);
          }
        }
      }
      return out;
    }
    case 'recursive':
      return [];
  }
}

function collectRecursive(node: unknown, sel: Step, acc: unknown[]): void {
  acc.push(...applySelector(node, sel));
  for (const c of children(node)) {
    collectRecursive(c, sel, acc);
  }
}

/** 求值：返回匹配值数组。解析失败抛 JsonPathError。 */
export function jsonPath(obj: unknown, path: string): unknown[] {
  const steps = parsePath(path);
  let current: unknown[] = [obj];
  for (const step of steps) {
    const next: unknown[] = [];
    for (const node of current) {
      if (step.kind === 'recursive') {
        collectRecursive(node, step.selector, next);
      }
      else {
        next.push(...applySelector(node, step));
      }
    }
    current = next;
  }
  return current;
}
