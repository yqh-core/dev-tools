import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RANGE,
  computeStats,
  isValidReaction,
  parseRangeFromSearch,
  pickWaitMs,
} from './reaction-time-test.service';

describe('reaction-time-test service', () => {
  describe('pickWaitMs', () => {
    it('落在区间内（rng 两端与中点）', () => {
      const r = { minMs: 1000, maxMs: 4000 };
      expect(pickWaitMs(r, () => 0)).toBe(1000);
      expect(pickWaitMs(r, () => 1)).toBe(4000);
      expect(pickWaitMs(r, () => 0.5)).toBe(2500);
    });

    it('rng 越界被钳制（非恒真对照：不钳则会出现负等待）', () => {
      expect(pickWaitMs(DEFAULT_RANGE, () => -3)).toBe(DEFAULT_RANGE.minMs);
      expect(pickWaitMs(DEFAULT_RANGE, () => 9)).toBeLessThanOrEqual(DEFAULT_RANGE.maxMs);
    });
  });

  describe('parseRangeFromSearch', () => {
    it('合法参数生效', () => {
      expect(parseRangeFromSearch('?rtmin=300&rtmax=420')).toEqual({ minMs: 300, maxMs: 420 });
    });

    it('非法组合一律回退默认（半截参数、倒置、负数、超上限）', () => {
      expect(parseRangeFromSearch('')).toEqual(DEFAULT_RANGE);
      expect(parseRangeFromSearch('?rtmin=300')).toEqual(DEFAULT_RANGE);
      expect(parseRangeFromSearch('?rtmin=4000&rtmax=100')).toEqual(DEFAULT_RANGE);
      expect(parseRangeFromSearch('?rtmin=-5&rtmax=100')).toEqual(DEFAULT_RANGE);
      expect(parseRangeFromSearch('?rtmin=abc&rtmax=def')).toEqual(DEFAULT_RANGE);
      expect(parseRangeFromSearch('?rtmin=0&rtmax=999999')).toEqual(DEFAULT_RANGE);
    });

    it('min=0 合法（rtmin=0 表示允许立即变绿）', () => {
      expect(parseRangeFromSearch('?rtmin=0&rtmax=100')).toEqual({ minMs: 0, maxMs: 100 });
    });
  });

  describe('computeStats', () => {
    it('空列表全 null（不是 0——0 会被当成「有人类 0ms 反应」的假数据）', () => {
      expect(computeStats([])).toEqual({ count: 0, bestMs: null, meanMs: null, medianMs: null });
    });

    it('单轮：best=median=mean=该值', () => {
      expect(computeStats([250])).toEqual({ count: 1, bestMs: 250, meanMs: 250, medianMs: 250 });
    });

    it('奇数轮 median 取中位；偶数轮取两中均值', () => {
      expect(computeStats([300, 200, 250]).medianMs).toBe(250);
      expect(computeStats([200, 201, 300, 301]).medianMs).toBe(251);
    });

    it('best 是最小值不是最后值（非恒真：写反立即露馅）', () => {
      expect(computeStats([400, 150, 300]).bestMs).toBe(150);
    });

    it('mean 四舍五入到整数 ms', () => {
      expect(computeStats([200, 201]).meanMs).toBe(201);
      expect(computeStats([200, 200.4]).meanMs).toBe(200);
    });
  });

  describe('isValidReaction', () => {
    it('拒绝 0/负/超 30s/NaN，接受正常读数', () => {
      expect(isValidReaction(0)).toBe(false);
      expect(isValidReaction(-5)).toBe(false);
      expect(isValidReaction(35000)).toBe(false);
      expect(isValidReaction(Number.NaN)).toBe(false);
      expect(isValidReaction(187.4)).toBe(true);
      expect(isValidReaction(30000)).toBe(true);
    });
  });
});
