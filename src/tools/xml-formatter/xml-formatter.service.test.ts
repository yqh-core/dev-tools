import { describe, expect, it } from 'vitest';
import { formatXml, minifyXml } from './xml-formatter.service';

describe('xml-formatter service', () => {
  describe('formatXml', () => {
    it('converts XML into a human readable format', () => {
      const initString = '<hello><world>foo</world><world>bar</world></hello>';

      expect(formatXml(initString)).toMatchInlineSnapshot(`
        "<hello>
            <world>
                foo
            </world>
            <world>
                bar
            </world>
        </hello>"
      `);
    });

    it('returns an empty string if the input is not valid XML', () => {
      const initString = 'hello world';

      expect(formatXml(initString)).toEqual('');
    });
  });

  describe('minifyXml', () => {
    const pretty = '<a>\n  <b>foo</b>\n  <c>bar</c>\n</a>\n';

    it('把美化后的多行 XML 压成单行', () => {
      expect(minifyXml(pretty)).toEqual('<a><b>foo</b><c>bar</c></a>');
    });

    it('美化→压缩→美化 与直接美化等价（往返不丢结构）', () => {
      const flat = '<hello><world>foo</world><world>bar</world></hello>';
      expect(minifyXml(formatXml(flat))).toEqual(flat);
    });

    // 证伪组：挡住「把所有连续空白压成一个空格」的朴素实现。
    // 那种写法会吃掉元素内的文本空白，而这里走解析器，文本空白必须原样。
    it('元素内部的文本空白不被改动（朴素 \\s+ 实现在这两条上必须红）', () => {
      expect(minifyXml('<a>foo   bar</a>')).toEqual('<a>foo   bar</a>');
      expect(minifyXml('<a>  前导和尾随  </a>')).toEqual('<a>  前导和尾随  </a>');
      expect(minifyXml('<a>x\n  y</a>')).toEqual('<a>x\n  y</a>');
    });

    it('属性之间的多余空白被规范化', () => {
      expect(minifyXml('<a  b="1"\n  c="2">t</a>')).toEqual('<a b="1" c="2">t</a>');
    });

    it('已知边界：mixed content 里相邻标签之间的空白会被折掉（如实钉住，不假装没事）', () => {
      expect(minifyXml('<a>foo <b>x</b> </a>')).toEqual('<a>foo <b>x</b></a>');
    });

    it('空输入与非 XML 输入返回空串，不抛异常', () => {
      expect(minifyXml('')).toEqual('');
      expect(minifyXml('   ')).toEqual('');
      expect(minifyXml('hello world')).toEqual('');
    });
  });
});
