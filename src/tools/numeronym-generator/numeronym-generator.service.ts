/**
 * 生成方向（原有契约，勿动——service/e2e 测试锁定）：
 * 首字母 + 中间字母数 + 尾字母；≤3 字符原样返回。
 */
export function generateNumeronym(word: string): string {
  const wordLength = word.length;

  if (wordLength <= 3) {
    return word;
  }

  return `${word.at(0)}${wordLength - 2}${word.at(-1)}`;
}

/**
 * 反查词典（decode 方向的完整边界——页面承诺与用户可见说明必须与此一致）：
 * 只收录公开文献/工程实践中已确立的写法；键为小写 numeronym，值为候选全称。
 * 值为数组是刻意的：t11n 等存在真实歧义，多候选不得伪装成唯一答案。
 * 未收录的输入一律走 unmatched 状态并展示支持清单——绝不编造释义。
 */
export const ESTABLISHED_NUMERONYMS: Record<string, string[]> = {
  i18n: ['internationalization'],
  l10n: ['localization'],
  a11y: ['accessibility'],
  k8s: ['Kubernetes'],
  g11n: ['globalization'],
  c11s: ['compliance'],
  n7m: ['numeronym'],
  t11n: ['translation', 'transcription'],
};

export interface NumeronymResult {
  mode: 'encode' | 'decode' | 'invalid'
  /** encode：生成的 numeronym（输出框沿用此值，向后兼容）；其余为空串 */
  output: string
  /** decode：词典候选（1..n 个） */
  matches?: string[]
  /** decode：候选 >1 即 true——歧义必须显式呈现 */
  ambiguous?: boolean
  /** invalid：机器可读原因码，UI 按码给文案 */
  reason?: 'empty' | 'not-in-dictionary' | 'mixed'
}

/** numeronym 形态：字母+数字+字母，如 k8s / a11y / i18n（大小写不敏感） */
const NUMERONYM_SHAPE = /^[A-Za-z]\d+[A-Za-z]$/;
/** 可生成的普通英文单词：纯字母 */
const PLAIN_WORD = /^[A-Za-z]+$/;

/**
 * 方向识别（验收点 3）：
 * - 词典命中（忽略大小写）→ decode，优先于生成——查 k8s 要的是全称，不是把 k8s 再生成一遍
 * - 纯字母 → encode（含 ≤3 字符原样返回的既有语义）
 * - numeronym 形态但不在词典 → invalid/not-in-dictionary（UI 展示支持清单）
 * - 其余（空格/混排等）→ invalid/mixed
 * 明确不做的：凭长度或是否含数字猜测任意串可反查——词典是唯一 decode 依据。
 */
export function evaluate(input: string): NumeronymResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { mode: 'invalid', output: '', reason: 'empty' };
  }
  const lower = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(ESTABLISHED_NUMERONYMS, lower)) {
    const matches = ESTABLISHED_NUMERONYMS[lower];
    return { mode: 'decode', output: '', matches, ambiguous: matches.length > 1 };
  }
  if (PLAIN_WORD.test(trimmed)) {
    return { mode: 'encode', output: generateNumeronym(trimmed) };
  }
  if (NUMERONYM_SHAPE.test(trimmed)) {
    return { mode: 'invalid', output: '', reason: 'not-in-dictionary' };
  }
  return { mode: 'invalid', output: '', reason: 'mixed' };
}
