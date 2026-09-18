// 标准 ASCII 码表（0–127），从 dev-toolbox src/data/reference.ts 同步的生成逻辑。
// 这里刻意保留「算法生成」而不是写死 128 行：改任何一列格式只需改一处。

export interface AsciiEntry {
  dec: string
  hex: string
  oct: string
  bin: string
  char: string
  zh: string
}

const CONTROL_NAMES: Record<number, string> = {
  0: 'NUL 空字符', 1: 'SOH 标题开始', 2: 'STX 正文开始', 3: 'ETX 正文结束',
  4: 'EOT 传输结束', 5: 'ENQ 请求', 6: 'ACK 确认', 7: 'BEL 响铃',
  8: 'BS 退格', 9: 'HT 水平制表', 10: 'LF 换行', 11: 'VT 垂直制表',
  12: 'FF 换页', 13: 'CR 回车', 14: 'SO 移出', 15: 'SI 移入',
  16: 'DLE 数据链接转义', 17: 'DC1 设备控制1', 18: 'DC2 设备控制2', 19: 'DC3 设备控制3',
  20: 'DC4 设备控制4', 21: 'NAK 否认', 22: 'SYN 同步空闲', 23: 'ETB 传输块结束',
  24: 'CAN 取消', 25: 'EM 介质结束', 26: 'SUB 替换', 27: 'ESC 转义',
  28: 'FS 文件分隔符', 29: 'GS 分组分隔符', 30: 'RS 记录分隔符', 31: 'US 单元分隔符',
  127: 'DEL 删除',
};

export const asciiEntries: AsciiEntry[] = Array.from({ length: 128 }, (_, i) => {
  const char = i === 32 ? '空格' : i < 33 || i === 127 ? '(不可打印)' : String.fromCharCode(i);

  let zh = CONTROL_NAMES[i] ?? '';
  if (i === 32) {
    zh = '空格';
  }
  else if (i === 48) {
    zh = '数字 0 起始';
  }
  else if (i === 65) {
    zh = '大写字母 A 起始';
  }
  else if (i === 97) {
    zh = '小写字母 a 起始';
  }
  else if (i >= 48 && i <= 57) {
    zh = `数字 ${String.fromCharCode(i)}`;
  }
  else if (i >= 65 && i <= 90) {
    zh = `大写字母 ${String.fromCharCode(i)}`;
  }
  else if (i >= 97 && i <= 122) {
    zh = `小写字母 ${String.fromCharCode(i)}`;
  }
  else if (!zh) {
    zh = '标点符号';
  }

  return {
    dec: String(i),
    hex: `0x${i.toString(16).toUpperCase().padStart(2, '0')}`,
    oct: `0${i.toString(8).padStart(3, '0')}`,
    bin: i.toString(2).padStart(8, '0'),
    char,
    zh,
  };
});
