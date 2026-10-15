import { describe, expect, it } from 'vitest';
import { MD5, enc } from 'crypto-js';
import { applyDigestCase, convertHexToBin, md5HexTo16 } from './hash-text.service';

describe('hash text', () => {
  describe('convertHexToBin', () => {
    it('convert hex to bin', () => {
      expect(convertHexToBin('')).toEqual('');
      expect(convertHexToBin('FF')).toEqual('11111111');
      expect(convertHexToBin('F'.repeat(200))).toEqual('1111'.repeat(200));
      expect(convertHexToBin('2123006AD00F694CE120')).toEqual(
        '00100001001000110000000001101010110100000000111101101001010011001110000100100000',
      );
    });
  });

  describe('md5HexTo16', () => {
    it('取 32 位结果的中间 16 位（中文工具圈既有的 16 位 MD5 约定）', () => {
      // MD5("abc") 是全库公认的 900150983cd24fb0d6963f7d28e17f72
      expect(md5HexTo16('900150983cd24fb0d6963f7d28e17f72')).toEqual('3cd24fb0d6963f7d');
    });

    it('与 crypto-js 的真实 MD5 交叉校验，而不是只对自己的切片函数自证', () => {
      const hex32 = MD5('abc').toString(enc.Hex);
      expect(hex32).toEqual('900150983cd24fb0d6963f7d28e17f72');
      expect(md5HexTo16(hex32)).toEqual(hex32.slice(8, 24));
      expect(md5HexTo16(hex32)).toHaveLength(16);
    });

    it('非 32 位输入原样返回（避免把 Base64/Bin 摘要错切成半截）', () => {
      expect(md5HexTo16('')).toEqual('');
      expect(md5HexTo16('YWJjMTIz')).toEqual('YWJjMTIz');
      expect(md5HexTo16('0123456789abcdef0123456789abcdef0')).toEqual('0123456789abcdef0123456789abcdef0');
    });
  });

  describe('applyDigestCase', () => {
    it('十六进制下切换大小写', () => {
      expect(applyDigestCase('900150983cd24fb0', 'upper', true)).toEqual('900150983CD24FB0');
      expect(applyDigestCase('900150983CD24FB0', 'lower', true)).toEqual('900150983cd24fb0');
    });

    it('非十六进制编码一律不动 —— Base64 改大小写会改变值', () => {
      expect(applyDigestCase('kGH+9/abc=', 'upper', false)).toEqual('kGH+9/abc=');
    });
  });
});
