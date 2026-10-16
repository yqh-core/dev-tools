import { describe, expect, it } from 'vitest';
import { asciiEntries } from './ascii-table.constants';

const HAN = /[㐀-䶿一-鿿豈-﫿]/;

describe('ascii-table 数据层', () => {
  it('128 条，编号与三种进制表示都正确', () => {
    expect(asciiEntries).toHaveLength(128);
    expect(asciiEntries.map(e => e.dec)).toEqual(Array.from({ length: 128 }, (_, i) => String(i)));
    const a = asciiEntries[65];
    expect(a.hex).toBe('0x41');
    expect(a.oct).toBe('0101');
    expect(a.bin).toBe('01000001');
    expect(a.char).toBe('A');
  });

  it('不可打印码位与空格的 char 有明确标注', () => {
    expect(asciiEntries[0].char).toBe('(non-printable)');
    expect(asciiEntries[127].char).toBe('(non-printable)');
    expect(asciiEntries[31].char).toBe('(non-printable)');
    expect(asciiEntries[32].char).toBe('Space');
    expect(asciiEntries[33].char).toBe('!');
  });

  it('33 个控制码都给出「缩写 – 全称」，不只剩缩写', () => {
    // 控制码是 0–31 加 127，共 33 个。32 是空格、不是控制码，
    // 把它圈进来会得到 34 条，且它的 name 是 'Space'、不符合下面的形状断言。
    const controls = asciiEntries.filter((_, i) => i < 32 || i === 127);
    expect(controls).toHaveLength(33);
    for (const c of controls) {
      // 缩写可以带数字（DC1–DC4）。第一版写成 "^[A-Z]{2,3} –"，把 DC1 判成不合法；
      // 我当时还把这条红误判成"工具把短横写坏了"，实测常量里就是 U+2013 —— 是我规则写窄了。
      expect(c.name).toMatch(/^[A-Z]{2,3}[0-9]? – .+/);
    }
    expect(asciiEntries[0].name).toBe('NUL – Null character');
    expect(asciiEntries[9].name).toBe('HT – Horizontal Tab');
    expect(asciiEntries[17].name).toBe('DC1 – Device Control 1');
    expect(asciiEntries[127].name).toBe('DEL – Delete');
  });

  it('字母与数字区的分段说明按区间断言，不是逐条硬写', () => {
    expect(asciiEntries[48].name).toBe('Start of digits 0-9');
    expect(asciiEntries[57].name).toBe('Digit 9');
    expect(asciiEntries[65].name).toBe('Start of uppercase A-Z');
    expect(asciiEntries[90].name).toBe('Uppercase letter Z');
    expect(asciiEntries[97].name).toBe('Start of lowercase a-z');
    expect(asciiEntries[122].name).toBe('Lowercase letter z');
    expect(asciiEntries[44].name).toBe('Punctuation / symbol');
  });

  // 这条是本次改动的回归锁：字段改名 + 文案转英文之后，整表不许再出现汉字。
  // 只测「已知几条」的话，漏改某一行是查不出来的，所以遍历全表。
  it('整表不含汉字（L10N 回归锁）', () => {
    // 先自证这把尺子没坏：尺子坏掉时"零命中"和"真的干净"长得一模一样。
    expect(HAN.test('空格')).toBe(true);
    expect(HAN.test('标点符号')).toBe(true);
    expect(HAN.test('Null character')).toBe(false);

    const dirty = asciiEntries.filter(e => HAN.test(`${e.char}${e.name}`));
    expect(dirty.map(e => `${e.dec}:${e.name}`)).toEqual([]);
  });

  it('每条都有非空 name，且字段名已从 zh 换成 name', () => {
    expect(asciiEntries.every(e => e.name.length > 0)).toBe(true);
    expect('zh' in asciiEntries[0]).toBe(false);
    expect(Object.keys(asciiEntries[0]).sort()).toEqual(
      ['bin', 'char', 'dec', 'hex', 'name', 'oct'],
    );
  });
});
