// 标准 ASCII 码表（0–127）。
// 刻意保留「算法生成」而不是写死 128 行：改任何一列格式只需改一处。
//
// 两处说明：
// 1) 原先注释写「从 dev-toolbox src/data/reference.ts 同步，改数据两边一起改」。
//    本次把码位名称换成英文后，这条同步关系已经断了（dev-toolbox 是已下线的旧独立站，
//    不再部署），所以删掉该约定而不是留着骗人。
// 2) 字段从 `zh` 改名为 `name`：这一列本来就是「码位名称」，不是中文专列。
//    原值形如 `NUL 空字符`，即「标准缩写 + 中文译注」，而 ASCII 控制码的标准名本身就是
//    英文术语，所以换英文是无损的。这点与 linux-commands / http-headers 不同 ——
//    那两页的 zh 是解释性正文，删列会把页面降级成纯名称表，需单独决定。

export interface AsciiEntry {
  dec: string
  hex: string
  oct: string
  bin: string
  char: string
  name: string
}

/** 控制码标准名（ECMA-48 / ANSI X3.4 的缩写与全称） */
const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL – Null character',
  1: 'SOH – Start of Heading',
  2: 'STX – Start of Text',
  3: 'ETX – End of Text',
  4: 'EOT – End of Transmission',
  5: 'ENQ – Enquiry',
  6: 'ACK – Acknowledge',
  7: 'BEL – Bell',
  8: 'BS – Backspace',
  9: 'HT – Horizontal Tab',
  10: 'LF – Line Feed',
  11: 'VT – Vertical Tab',
  12: 'FF – Form Feed',
  13: 'CR – Carriage Return',
  14: 'SO – Shift Out',
  15: 'SI – Shift In',
  16: 'DLE – Data Link Escape',
  17: 'DC1 – Device Control 1',
  18: 'DC2 – Device Control 2',
  19: 'DC3 – Device Control 3',
  20: 'DC4 – Device Control 4',
  21: 'NAK – Negative Acknowledge',
  22: 'SYN – Synchronous Idle',
  23: 'ETB – End of Transmission Block',
  24: 'CAN – Cancel',
  25: 'EM – End of Medium',
  26: 'SUB – Substitute',
  27: 'ESC – Escape',
  28: 'FS – File Separator',
  29: 'GS – Group Separator',
  30: 'RS – Record Separator',
  31: 'US – Unit Separator',
  127: 'DEL – Delete',
};

const NON_PRINTABLE = '(non-printable)';

export const asciiEntries: AsciiEntry[] = Array.from({ length: 128 }, (_, i) => {
  const char = i === 32 ? 'Space' : i < 33 || i === 127 ? NON_PRINTABLE : String.fromCharCode(i);

  let name = CONTROL_NAMES[i] ?? '';
  if (i === 32) {
    name = 'Space';
  }
  else if (i === 48) {
    name = 'Start of digits 0-9';
  }
  else if (i === 65) {
    name = 'Start of uppercase A-Z';
  }
  else if (i === 97) {
    name = 'Start of lowercase a-z';
  }
  else if (i >= 48 && i <= 57) {
    name = `Digit ${String.fromCharCode(i)}`;
  }
  else if (i >= 65 && i <= 90) {
    name = `Uppercase letter ${String.fromCharCode(i)}`;
  }
  else if (i >= 97 && i <= 122) {
    name = `Lowercase letter ${String.fromCharCode(i)}`;
  }
  else if (!name) {
    name = 'Punctuation / symbol';
  }

  return {
    dec: String(i),
    hex: `0x${i.toString(16).toUpperCase().padStart(2, '0')}`,
    oct: `0${i.toString(8).padStart(3, '0')}`,
    bin: i.toString(2).padStart(8, '0'),
    char,
    name,
  };
});
