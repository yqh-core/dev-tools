import { describe, expect, it } from 'vitest';
import { buildIco } from './image-io';

/** 最小合法 PNG（1×1 红点），只用作字节载体，测试关心的是 ICO 封装结构 */
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

describe('buildIco', () => {
  it('writes ICONDIR with type=icon and the entry count', () => {
    const ico = buildIco([{ size: 16, bytes: PNG }, { size: 32, bytes: PNG }]);
    const v = new DataView(ico.buffer);
    expect(v.getUint16(0, true)).toBe(0);
    expect(v.getUint16(2, true)).toBe(1);
    expect(v.getUint16(4, true)).toBe(2);
  });

  it('points each entry at the absolute offset where its PNG actually starts', () => {
    const ico = buildIco([{ size: 16, bytes: PNG }, { size: 32, bytes: PNG }]);
    const v = new DataView(ico.buffer);
    const off0 = v.getUint32(6 + 12, true);
    const off1 = v.getUint32(6 + 16 + 12, true);
    expect(off0).toBe(6 + 2 * 16);
    expect(off1).toBe(off0 + PNG.byteLength);
    // 偏移处必须真是 PNG 签名，否则浏览器只会看到一个坏图标
    expect(Array.from(ico.slice(off0, off0 + 8))).toEqual(Array.from(PNG.slice(0, 8)));
    expect(Array.from(ico.slice(off1, off1 + 8))).toEqual(Array.from(PNG.slice(0, 8)));
  });

  it('records byteLength per entry so total size closes', () => {
    const ico = buildIco([{ size: 16, bytes: PNG }, { size: 48, bytes: PNG }]);
    const v = new DataView(ico.buffer);
    expect(v.getUint32(6 + 8, true)).toBe(PNG.byteLength);
    expect(ico.byteLength).toBe(6 + 2 * 16 + 2 * PNG.byteLength);
  });

  it('rejects an empty set instead of emitting a zero-entry file', () => {
    expect(() => buildIco([])).toThrow(/no usable sizes/);
  });

  it('drops oversized entries rather than writing a wrong 1-byte dimension', () => {
    // 256px 必须写成 0，本实现选择直接拒绝 >128，避免静默产出错尺寸
    expect(() => buildIco([{ size: 256, bytes: PNG }])).toThrow(/no usable sizes/);
  });
});
