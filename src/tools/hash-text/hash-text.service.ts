export function convertHexToBin(hex: string) {
  return hex
    .trim()
    .split('')
    .map(byte => Number.parseInt(byte, 16).toString(2).padStart(4, '0'))
    .join('');
}

/**
 * 16 位 MD5。中文工具圈的既有约定是「取 32 位十六进制 MD5 的第 9~24 位」
 * （不是另一种算法），所以这里只切片、不重算。长度不是 32 时原样返回，
 * 免得把 Base64/Bin 摘要错切成半截。
 */
export function md5HexTo16(hex32: string): string {
  return hex32.length === 32 ? hex32.slice(8, 24) : hex32;
}

/**
 * 摘要大小写。只对十六进制有意义：Base64 / Base64url 改大小写会**改变值**，
 * Bin 全是 0/1 也没有大小写之分，所以非 Hex 编码一律原样返回。
 */
export function applyDigestCase(digest: string, mode: DigestCase, encodingIsHex: boolean): string {
  if (!encodingIsHex) {
    return digest;
  }
  return mode === 'upper' ? digest.toUpperCase() : digest.toLowerCase();
}

export type DigestCase = 'lower' | 'upper';
