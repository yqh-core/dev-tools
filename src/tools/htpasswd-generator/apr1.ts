/**
 * Apache apr1（MD5-crypt 的 Apache 变体）—— 供 .htpasswd 的 `$apr1$` 格式使用。
 * 移植自 dev-toolbox（其实现源自 APR 的 apr_md5.c，已用 openssl 权威向量对拍）。
 *
 * 三处极易写错的地方（改这段代码前务必读完）：
 *  1. 「weird loop」里奇数位追加的是**零字节 0x00**、偶数位追加的是**密码首字节**
 *     （网上不少二手资料写成「补盐首字节」，实测不成立）。
 *  2. 中间摘要必须按**原始字节**参与后续 MD5。crypto-js 的 `MD5(string)` 按 UTF-8
 *     编码字符串，摘要中 >=0x80 的字节会被膨胀成 2 个字节，导致结果错误。
 *     因此这里全程用字节数组 + WordArray 的写法。
 *  3. 最终 24 字节摘要按 `(0,6,12) (1,7,13) (2,8,14) (3,9,15) (4,10,5) 11` 的顺序
 *     取 6 位一组（最后两位），不是顺序切片。
 *
 * 校验向量（`openssl passwd -apr1 -salt <salt> <pw>` 实测）：
 *   apr1('myPassword', 'qHDFfhPC') === '$apr1$qHDFfhPC$nITSVHgYbDAK1Y0acGRnY0'
 *   apr1('hello',      '12345678') === '$apr1$12345678$kzoHOftq37ZwNAhx94tKu.'
 * 传 '$1$' 魔数可复现经典 md5-crypt：
 *   apr1With('myPassword', 'qHDFfhPC', '$1$') === '$1$qHDFfhPC$X9/GkmaNbtqfnnQAC5ksc/'
 */
import CryptoJS from 'crypto-js';

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MAGIC = '$apr1$';

function to64(v: number, n: number): string {
  let s = '';
  while (n-- > 0) {
    s += ITOA64.charAt(v & 0x3f);
    v >>>= 6;
  }
  return s;
}

function toBytes(wa: CryptoJS.lib.WordArray): number[] {
  const out: number[] = [];
  for (let i = 0; i < wa.sigBytes; i++) {
    out.push((wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff);
  }
  return out;
}

function utf8Bytes(s: string): number[] {
  return toBytes(CryptoJS.enc.Utf8.parse(s));
}

function md5Bytes(bytes: number[]): number[] {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  const wa = CryptoJS.lib.WordArray.create(words, bytes.length);
  return toBytes(CryptoJS.MD5(wa));
}

/** 核心实现；magic 传 '$apr1$' 得 apr1，传 '$1$' 得经典 md5-crypt（便于对拍验证） */
export function apr1With(password: string, salt: string, magic = MAGIC): string {
  const sp = String(salt ?? '').split('$')[0].slice(0, 8);
  const pwB = utf8Bytes(password);
  const spB = utf8Bytes(sp);
  const pwFirst = pwB.length ? pwB[0] : 0;

  // ctx = 密码 + magic + 盐
  const msg = [...pwB, ...utf8Bytes(magic), ...spB];

  // 追加 长度(密码) 个字节的 MD5(密码 + 盐 + 密码)
  const mix = md5Bytes([...pwB, ...spB, ...pwB]);
  for (let pl = pwB.length; pl > 0; pl -= 16) {
    msg.push(...mix.slice(0, Math.min(pl, 16)));
  }

  // weird loop：按密码长度的二进制位，奇数位补零字节、偶数位补密码首字节
  for (let i = pwB.length; i !== 0; i >>= 1) {
    msg.push(i & 1 ? 0 : pwFirst);
  }

  let final = md5Bytes(msg);

  // 1000 轮迭代
  for (let i = 0; i < 1000; i++) {
    const c: number[] = [];
    if (i & 1) {
      c.push(...pwB);
    }
    else {
      c.push(...final);
    }
    if (i % 3) {
      c.push(...spB);
    }
    if (i % 7) {
      c.push(...pwB);
    }
    if (i & 1) {
      c.push(...final);
    }
    else {
      c.push(...pwB);
    }
    final = md5Bytes(c);
  }

  const g = (a: number, b: number, c: number) => (final[a] << 16) | (final[b] << 8) | final[c];
  let hash = '';
  hash += to64(g(0, 6, 12), 4);
  hash += to64(g(1, 7, 13), 4);
  hash += to64(g(2, 8, 14), 4);
  hash += to64(g(3, 9, 15), 4);
  hash += to64(g(4, 10, 5), 4);
  hash += to64(final[11], 2);

  return `${magic}${sp}$${hash}`;
}

/** 生成 `$apr1$<salt>$<hash>`；salt 取 '$' 前最多 8 个字符 */
export function apr1(password: string, salt: string): string {
  return apr1With(password, salt, MAGIC);
}

/** 校验密码是否匹配给定的 apr1 哈希串 */
export function apr1Verify(password: string, hash: string): boolean {
  const m = /^\$apr1\$([^$]*)\$/.exec(String(hash ?? ''));
  if (!m) {
    return false;
  }
  return apr1(password, m[1]) === hash;
}
