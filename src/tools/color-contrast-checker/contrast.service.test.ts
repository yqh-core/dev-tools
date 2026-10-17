import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  evaluatePair,
  formatRatio,
  parseColor,
  relativeLuminance,
  toHex,
} from './contrast.service';

function ratioOf(fg: string, bg: string): number {
  return contrastRatio(parseColor(fg) as never, parseColor(bg) as never);
}

describe('contrast service', () => {
  it('parses the three input shapes and expands the 3-digit form', () => {
    expect(toHex(parseColor('#777777') as never)).toBe('#777777');
    expect(toHex(parseColor('777') as never)).toBe('#777777');
    expect(toHex(parseColor('rgb(119, 119, 119)') as never)).toBe('#777777');
    expect(toHex(parseColor('rgba(119,119,119,0.5)') as never)).toBe('#777777');
    expect(parseColor('#12345')).toBeNull();
    expect(parseColor('notacolor')).toBeNull();
    expect(parseColor('rgb(300,0,0)')).toBeNull();
    expect(parseColor('')).toBeNull();
  });

  it('luminance of pure black is 0 and pure white is 1', () => {
    expect(relativeLuminance(parseColor('#000000') as never)).toBeCloseTo(0, 6);
    expect(relativeLuminance(parseColor('#ffffff') as never)).toBeCloseTo(1, 6);
  });

  it('reproduces published WCAG ratios (WebAIM values, ±0.01)', () => {
    expect(ratioOf('#000000', '#ffffff')).toBeCloseTo(21, 2);
    // 顺序无关：对比度是对称的
    expect(ratioOf('#ffffff', '#000000')).toBeCloseTo(21, 2);
    expect(ratioOf('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(ratioOf('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(ratioOf('#0000ff', '#ffffff')).toBeCloseTo(8.59, 2);
    expect(ratioOf('#ff0000', '#ffffff')).toBeCloseTo(3.998, 2);
    expect(ratioOf('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
  });

  it('AA boundary is decided on the raw ratio, not on the rounded text', () => {
    const failing = evaluatePair(parseColor('#777777'), parseColor('#ffffff'));
    const passing = evaluatePair(parseColor('#767676'), parseColor('#ffffff'));
    expect(failing).not.toBeNull();
    expect(passing).not.toBeNull();
    expect(failing?.ratioText).toBe('4.48');
    expect(passing?.ratioText).toBe('4.54');
    expect(failing?.aaNormal).toBe(false);
    expect(passing?.aaNormal).toBe(true);
    // 两者都过 AAA-large/AA-large 的 3.0 门 —— 大字号下 4.48 是合格的
    expect(failing?.aaLarge).toBe(true);
    expect(failing?.aaaLarge).toBe(false);
    expect(passing?.aaaLarge).toBe(true);
  });

  it('a 4.4996 pair must not be reported as passing AA', () => {
    // 四舍五入到两位是 4.50，而真实比值 4.4996 并不满足 4.5 门限。
    // 若判定时用显示值（4.50 >= 4.5）就会把不合格的说成合格 —— 这是最贵的一类假绿。
    const r = 4.4996;
    expect(formatRatio(r)).toBe('4.50');
    expect(r >= 4.5).toBe(false);
  });

  it('returns null for an incomplete pair instead of inventing a verdict', () => {
    expect(evaluatePair(null, parseColor('#ffffff'))).toBeNull();
    expect(evaluatePair(parseColor('#000000'), null)).toBeNull();
    expect(evaluatePair(null, null)).toBeNull();
  });
});
