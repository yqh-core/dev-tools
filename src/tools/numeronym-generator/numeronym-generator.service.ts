/**
 * A numeronym keeps the first and last letters and replaces the middle
 * letters with their count. Unicode letters are counted as base-letter
 * clusters so decomposed accents do not inflate the count.
 */
const LETTER_CLUSTERS = /\p{L}\p{M}*/gu;

export function countLetters(value: string): number {
  return (value.normalize('NFC').match(LETTER_CLUSTERS) ?? []).length;
}

export function generateNumeronym(word: string): string {
  const letters = word.normalize('NFC').match(LETTER_CLUSTERS) ?? [];

  if (letters.length <= 3) {
    return word;
  }

  return `${letters[0]}${letters.length - 2}${letters.at(-1)}`;
}

/**
 * Only established, checked forms are expanded. A pattern-shaped string is
 * not sufficient evidence for a meaning, so unknown forms stay unmatched.
 */
export const ESTABLISHED_NUMERONYMS: Record<string, string[]> = {
  i18n: ['internationalization'],
  l10n: ['localization'],
  a11y: ['accessibility'],
  k8s: ['Kubernetes'],
  g11n: ['globalization'],
  c14n: ['canonicalization'],
  n7m: ['numeronym'],
  t9n: ['translation'],
  m17n: ['multilingualization'],
  p13n: ['personalization'],
  o11y: ['observability'],
};

/** Short context notes help distinguish related abbreviations. */
export const NUMERONYM_CONTEXT: Record<string, string> = {
  i18n: 'Software and product internationalization',
  l10n: 'Adapting software or content to a locale',
  a11y: 'Accessibility',
  k8s: 'Kubernetes container orchestration',
  g11n: 'Globalization',
  c14n: 'XML canonicalization',
  n7m: 'Numeronym (the abbreviation form itself)',
  t9n: 'Translation',
  m17n: 'Multilingualization',
  p13n: 'Personalization',
  o11y: 'Observability',
};

export interface NumeronymResult {
  mode: 'encode' | 'decode' | 'invalid'
  output: string
  matches?: string[]
  ambiguous?: boolean
  reason?: 'empty' | 'not-in-dictionary' | 'mixed'
}

/** A known-looking letter/number/letter form, including Unicode letters. */
const NUMERONYM_SHAPE = /^[\p{L}]\d+[\p{L}]$/u;
/** One word or a hyphen/apostrophe compound; only letters are counted. */
const PLAIN_WORD = /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u;
/**
 * Extract words and numeronym-shaped tokens from free text. Separators such
 * as spaces, commas, semicolons and newlines are ignored. Malformed mixed
 * tokens such as "v2" are retained so they can be shown as unsupported.
 */
const INPUT_TOKENS = /[\p{L}\p{M}]+\d+[\p{L}\p{M}]+|[\p{L}\p{M}]+\d+|[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*/gu;

export function tokenizeNumeronymInput(input: string): string[] {
  return input.normalize('NFC').match(INPUT_TOKENS) ?? [];
}

export function evaluate(input: string): NumeronymResult {
  const trimmed = input.trim().normalize('NFC');

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
