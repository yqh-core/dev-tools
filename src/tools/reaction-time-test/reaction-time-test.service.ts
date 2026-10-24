/**
 * reaction-time-test 纯逻辑层（无 DOM 依赖，可单测）。
 *
 * 为什么计时起点不在 setTimeout 回调里：定时器到期只说明「浏览器决定画」，
 * 真正可见要等到下一帧提交。计时锚定在 green 帧实际绘制（double rAF 之后），
 * 系统性误差小一帧；这是可测试的口径，也是 guides 里写明的限制之一。
 */

export interface RandomRange {
  minMs: number
  maxMs: number
}

export const DEFAULT_RANGE: RandomRange = { minMs: 1200, maxMs: 4500 };

/**
 * 测试钩子：`?rtmin=300&rtmax=420` 缩短随机区间，供真机冒烟走确定性时序。
 * 非法值（非数字、min<0、min>max、上限 >60s）一律回退默认区间——静默宽容会让
 * 冒烟假通过，所以宁可回退也不接受半截参数。
 */
export function parseRangeFromSearch(search: string, fallback: RandomRange = DEFAULT_RANGE): RandomRange {
  try {
    const p = new URLSearchParams(search);
    const min = Number(p.get('rtmin'));
    const max = Number(p.get('rtmax'));
    if (Number.isFinite(min) && Number.isFinite(max) && min >= 0 && max > min && max <= 60_000) {
      return { minMs: min, maxMs: max };
    }
  }
  catch { /* 非法 query 回退默认，页面永远可玩 */ }
  return fallback;
}

/** 均匀随机等待时长（ms，含小数）。注入 rng 保证可测。 */
export function pickWaitMs(range: RandomRange, rng: () => number = Math.random): number {
  const clamped = Math.min(Math.max(rng(), 0), 1);
  return range.minMs + clamped * (range.maxMs - range.minMs);
}

export type Reaction = number;

/** 非恒真断言用：只保留合理窗口内的读数（0 < ms ≤ 30s），异常读数丢弃不统计。 */
export function isValidReaction(ms: number): boolean {
  return Number.isFinite(ms) && ms > 0 && ms <= 30_000;
}

export interface ReactionStats {
  count: number
  bestMs: number | null
  meanMs: number | null
  medianMs: number | null
}

export function computeStats(rounds: readonly Reaction[]): ReactionStats {
  if (rounds.length === 0) {
    return { count: 0, bestMs: null, meanMs: null, medianMs: null };
  }
  const sorted = [...rounds].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  const median = sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid] + sorted[mid + 1]) / 2;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    count: rounds.length,
    bestMs: sorted[0],
    meanMs: Math.round(mean),
    medianMs: Math.round(median),
  };
}

/** 读数展示：一位小数足够诚实（更细的小数位会制造不存在的精确感） */
export function formatReaction(ms: number): string {
  return `${(Math.round(ms * 10) / 10).toFixed(1)} ms`;
}
