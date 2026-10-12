/**
 * 密码学安全随机整数 [0, max)。
 * 与 token-generator 的普通随机源（Math.random 系）不同：
 * 这里用 Web Crypto（crypto.getRandomValues），适合生成真实密码。
 * 拒绝采样消除模偏差（rejection sampling）。
 */
function secureRandomInt(max: number): number {
  const range = 4294967296; // 2^32
  const limit = range - (range % max);
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

export function createPassword({
  withUppercase = true,
  withLowercase = true,
  withNumbers = true,
  withSymbols = false,
  withAmbiguous = false,
  length = 20,
  alphabet,
}: {
  withUppercase?: boolean
  withLowercase?: boolean
  withNumbers?: boolean
  withSymbols?: boolean
  withAmbiguous?: boolean
  length?: number
  alphabet?: string
}) {
  // 视觉易混淆字符（Il1O0o）在密码里容易看错，默认排除
  const ambiguous = 'Il1O0o';
  const strip = (set: string) => (withAmbiguous ? set : [...set].filter(c => !ambiguous.includes(c)).join(''));

  const allAlphabet = alphabet ?? [
    withUppercase ? strip('ABCDEFGHIJKLMNOPQRSTUVWXYZ') : '',
    withLowercase ? strip('abcdefghijklmnopqrsuvwxyz') : '',
    withNumbers ? strip('0123456789') : '',
    withSymbols ? strip('.,;:!?./-"\'#{([-|\\@)]=}*+') : '',
  ].join('');

  if (allAlphabet.length === 0) {
    return '';
  }

  return shuffleStringSecure(allAlphabet.repeat(Math.ceil(length / allAlphabet.length) * 2)).substring(0, length);
}

/** 与 shuffleString 相同的洗牌逻辑，但用密码学安全随机源 */
function shuffleStringSecure(input: string): string {
  const chars = [...input];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
