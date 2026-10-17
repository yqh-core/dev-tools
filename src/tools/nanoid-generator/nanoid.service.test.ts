import { describe, expect, it } from 'vitest';

import {
  ALPHABET_PRESETS,
  DEFAULT_ALPHABET,
  clampCount,
  clampSize,
  generateId,
  generateIds,
  normalizeAlphabet,
} from './nanoid.service';

/** 造一个固定字节序列的随机源；用完还继续给 0，便于断言「越界字节必须被丢掉」。 */
function scripted(bytes: number[]) {
  let i = 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let k = 0; k < n; k++) {
      out[k] = i < bytes.length ? bytes[i++] : 0;
    }
    return out;
  };
}

describe('nanoid service', () => {
  it('the default alphabet is 64 distinct URL-safe characters', () => {
    expect(DEFAULT_ALPHABET).toBe('useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict');
    expect(DEFAULT_ALPHABET).toHaveLength(64);
    expect(new Set(DEFAULT_ALPHABET).size).toBe(64);
    expect(DEFAULT_ALPHABET).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('every preset is usable as an alphabet (>=2 chars, no duplicates)', () => {
    for (const preset of ALPHABET_PRESETS) {
      const chars = normalizeAlphabet(preset.value);
      expect(chars.length).toBeGreaterThanOrEqual(2);
      expect(chars).toBe(preset.value); // 预设本身不该带重复字符
    }
  });

  it('produces ids of the requested length from the requested alphabet only', () => {
    const alphabet = 'abc123!';
    const ids = generateIds({ size: 12, count: 40, alphabet });
    expect(ids).toHaveLength(40);
    for (const id of ids) {
      expect(id).toHaveLength(12);
      expect([...id].every(c => alphabet.includes(c))).toBe(true);
    }
  });

  it('digits-only alphabet can never emit a letter (self-proving, not just a format claim)', () => {
    const ids = generateIds({ size: 16, count: 30, alphabet: '0123456789' });
    for (const id of ids) {
      expect(/^\d{16}$/.test(id)).toBe(true);
    }
  });

  it('maps accepted bytes through the alphabet position, deterministically', () => {
    // 64 字符集 -> bits=6, mask=63：每个字节都被完整使用，不做丢弃。
    expect(generateId(3, DEFAULT_ALPHABET, scripted([0, 1, 2]))).toBe('use');
    expect(generateId(1, DEFAULT_ALPHABET, scripted([63]))).toBe(DEFAULT_ALPHABET[63]);
  });

  it('rejects out-of-range samples instead of wrapping them (no modulo bias)', () => {
    // 3 字符集 -> bits=2, mask=3。字节 3 与 255 都落在 [0,3) 之外，必须被丢弃。
    // `byte % 3` 的常见写法会把 3 变成 0、255 变成 0，第一个字符就成了 'a'。
    const alphabet = 'abc';
    const id = generateId(3, alphabet, scripted([0, 3, 1, 255, 2]));
    expect(id).toBe('abc');
  });

  it('a ten-char alphabet discards the 10..15 band rather than biasing it', () => {
    // 10 字符集 -> bits=4, mask=15；15 越界必须丢，5 与 7 正常取样。
    expect(generateId(4, '0123456789', scripted([0, 9, 15, 5, 7])))
      .toBe('0957');
  });

  it('duplicate characters in the alphabet are collapsed, order preserved', () => {
    expect(normalizeAlphabet('aab')).toBe('ab');
    expect(normalizeAlphabet('zz')).toHaveLength(1);
    expect(() => generateId(4, 'a', scripted([0]))).toThrow(/at least two distinct characters/);
  });

  it('clamps size and count into a usable range rather than emitting junk', () => {
    expect(clampSize(0)).toBe(1);
    expect(clampSize(-5)).toBe(1);
    expect(clampSize(10000)).toBe(256);
    expect(clampSize(Number.NaN)).toBe(21);
    expect(clampSize(21.9)).toBe(21);
    expect(clampCount(0)).toBe(1);
    expect(clampCount(9999)).toBe(200);
    expect(generateIds({ size: 4, count: 0, alphabet: 'abcdef' })).toHaveLength(1);
  });

  it('does not repeat ids inside one batch (clamped to the max count, which is the point)', () => {
    // count 走 clampCount：500 会被限到 200。断言按限幅后的真实数量写，
    // 而不是顺着「我要 500 个」的意愿写 —— 上一版就是这么写出过一条假失败。
    const ids = generateIds({ size: 16, count: 500, alphabet: DEFAULT_ALPHABET });
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size).toBe(200);
  });
});
