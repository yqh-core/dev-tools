import xmlFormat, { type XMLFormatterOptions } from 'xml-formatter';
import { withDefaultOnError } from '@/utils/defaults';

export { formatXml, isValidXML, minifyXml };

/**
 * XML 压缩。legacy /legacy/formatxml/ 对外承诺过「xml压缩工具」，本页此前只有美化。
 *
 * 走解析器而不是自己切空白：用空缩进 + 空换行符 + collapseContent 调 xml-formatter，
 * 这样**元素内部的文本空白一定不被改动**（实测 `foo   bar`、`  hi  `、文本里的换行都原样保留），
 * 属性之间多余空白会被规范化。
 * 唯一已知边界：mixed content 里**相邻标签之间**的空白会被折掉
 * （`<a>foo <b>x</b> </a>` → `<a>foo <b>x</b></a>`）—— 这一条是 xml-formatter 的行为，
 * 不是我们的实现缺陷；对以 XML 承载有意义空白的场景（如 SVG 文本、pre 内容混排）要留意。
 */
function minifyXml(rawXml: string): string {
  return withDefaultOnError(
    () => xmlFormat(cleanRawXml(rawXml), {
      indentation: '',
      collapseContent: true,
      lineSeparator: '',
    }) ?? '',
    '',
  );
}

function cleanRawXml(rawXml: string): string {
  return rawXml.trim();
}

function formatXml(rawXml: string, options?: XMLFormatterOptions): string {
  return withDefaultOnError(() => xmlFormat(cleanRawXml(rawXml), options) ?? '', '');
}

function isValidXML(rawXml: string): boolean {
  const cleanedRawXml = cleanRawXml(rawXml);

  if (cleanedRawXml === '') {
    return true;
  }

  try {
    xmlFormat(cleanedRawXml);
    return true;
  }
  catch (e) {
    return false;
  }
}
