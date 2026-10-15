import { describe, expect, it } from 'vitest';
import {
  convertDecimalListToText,
  convertTextToDecimalList,
  convertTextToUnicode,
  convertUnicodeToText,
} from './text-to-unicode.service';

describe('text-to-unicode', () => {
  describe('convertTextToUnicode', () => {
    it('a text string is converted to unicode representation', () => {
      expect(convertTextToUnicode('A')).toBe('&#65;');
      expect(convertTextToUnicode('linke the string convert to unicode')).toBe('&#108;&#105;&#110;&#107;&#101;&#32;&#116;&#104;&#101;&#32;&#115;&#116;&#114;&#105;&#110;&#103;&#32;&#99;&#111;&#110;&#118;&#101;&#114;&#116;&#32;&#116;&#111;&#32;&#117;&#110;&#105;&#99;&#111;&#100;&#101;');
      expect(convertTextToUnicode('')).toBe('');
    });
  });

  describe('convertUnicodeToText', () => {
    it('an unicode string is converted to its text representation', () => {
      expect(convertUnicodeToText('&#65;')).toBe('A');
      expect(convertUnicodeToText('&#108;&#105;&#110;&#107;&#101;&#32;&#116;&#104;&#101;&#32;&#115;&#116;&#114;&#105;&#110;&#103;&#32;&#99;&#111;&#110;&#118;&#101;&#114;&#116;&#32;&#116;&#111;&#32;&#117;&#110;&#105;&#99;&#111;&#100;&#101;')).toBe('linke the string convert to unicode');
      expect(convertUnicodeToText('')).toBe('');
    });
  });

  describe('convertTextToDecimalList', () => {
    it('中文与 ASCII 出裸数字，默认逗号分隔', () => {
      expect(convertTextToDecimalList('中文A')).toBe('20013, 25991, 65');
      expect(convertTextToDecimalList('A')).toBe('65');
      expect(convertTextToDecimalList('')).toBe('');
    });

    it('分隔符可换（空格 / 换行 / 竖线）', () => {
      expect(convertTextToDecimalList('ab', ' ')).toBe('97 98');
      expect(convertTextToDecimalList('ab', '\n')).toBe('97\n98');
      expect(convertTextToDecimalList('ab', '|')).toBe('97|98');
    });

    // 证伪组：挡住 charCodeAt + split('') 那套按码元走的写法。
    // 它会把 emoji 拆成两个孤立代理项（55357,56832），而正确形态是单个码点 128512。
    it('非 BMP 字符按码点出单个数字，不是两个孤立代理项', () => {
      expect(convertTextToDecimalList('😀')).toBe('128512');
      expect(convertTextToDecimalList('a😀b')).toBe('97, 128512, 98');
      expect(convertTextToDecimalList('😀')).not.toContain('55357');
    });

    it('往返闭合：文本→码点列表→文本等于原串（含 emoji 与空白）', () => {
      for (const src of ['中文😀 Hello 123', '\n\t 混合 ', 'A']) {
        expect(convertDecimalListToText(convertTextToDecimalList(src, ' '))).toBe(src);
      }
    });
  });

  describe('convertDecimalListToText', () => {
    it('逗号/空格/换行/混用分隔都能解析', () => {
      expect(convertDecimalListToText('20013,25991')).toBe('中文');
      expect(convertDecimalListToText('20013 25991')).toBe('中文');
      expect(convertDecimalListToText('20013\n25991')).toBe('中文');
      expect(convertDecimalListToText('65, 66|67')).toBe('ABC');
    });

    it('越界值跳过而不抛断整段', () => {
      expect(convertDecimalListToText('65, 999999999, 66')).toBe('AB');
      expect(convertDecimalListToText('')).toBe('');
      expect(convertDecimalListToText('abc')).toBe('');
    });
  });
});
