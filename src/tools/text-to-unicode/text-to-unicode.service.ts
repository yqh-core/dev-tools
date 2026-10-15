function convertTextToUnicode(text: string): string {
  return text.split('').map(value => `&#${value.charCodeAt(0)};`).join('');
}

function convertUnicodeToText(unicodeStr: string): string {
  return unicodeStr.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

/**
 * 十进制码点列表（legacy /legacy/ascii/ 承诺的「Ascii码对照值」形态：裸数字 + 可指定分隔符）。
 *
 * 与上面那对函数的关键差别：这里按**码点**走（`[...text]` + codePointAt），
 * 所以非 BMP 字符如 emoji 得到单个 128512，而不是两个孤立代理项。
 * 上面那对维持原样 —— 改它会把既有输出形状换掉，那是另一件事，不夹带在本次补能力里。
 */
function convertTextToDecimalList(text: string, separator: string = ', '): string {
  return [...text].map(char => String(char.codePointAt(0))).join(separator);
}

/**
 * 十进制码点列表 → 文本。按「非数字」切，所以逗号/空格/换行/混用都能吃。
 * 越界值（>0x10FFFF）跳过而不是抛断整段。
 */
function convertDecimalListToText(decimalStr: string): string {
  return decimalStr
    .split(/[^0-9]+/)
    .filter(part => part !== '')
    .map((part) => {
      const code = Number.parseInt(part, 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10FFFF) {
        return '';
      }
      try {
        return String.fromCodePoint(code);
      }
      catch {
        return '';
      }
    })
    .join('');
}

export {
  convertDecimalListToText,
  convertTextToDecimalList,
  convertTextToUnicode,
  convertUnicodeToText,
};
