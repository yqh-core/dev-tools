import { describe, expect, it } from 'vitest';
import {
  ESTABLISHED_NUMERONYMS,
  countLetters,
  evaluate,
  generateNumeronym,
  tokenizeNumeronymInput,
} from './numeronym-generator.service';

describe('numeronym-generator service', () => {
  describe('generateNumeronym', () => {
    it('uses the first letter, middle-letter count and last letter', () => {
      expect(generateNumeronym('internationalization')).toBe('i18n');
      expect(generateNumeronym('accessibility')).toBe('a11y');
      expect(generateNumeronym('localization')).toBe('l10n');
      expect(generateNumeronym('canonicalization')).toBe('c14n');
    });

    it('leaves words with three letters or fewer unchanged', () => {
      expect(generateNumeronym('abc')).toBe('abc');
      expect(generateNumeronym('API')).toBe('API');
    });

    it('counts only letters in hyphenated and apostrophe compounds', () => {
      expect(generateNumeronym('cross-platform')).toBe('c11m');
      expect(generateNumeronym("don't")).toBe('d2t');
    });

    it('counts Unicode letters and preserves the original first/last letter case', () => {
      expect(generateNumeronym('JavaScript')).toBe('J8t');
      expect(generateNumeronym('Über')).toBe('Ü2r');
      expect(generateNumeronym('café')).toBe('c2é');
      expect(generateNumeronym('cafe\u0301')).toBe('c2é');
    });

    it('counts Unicode letter clusters rather than UTF-16 code units', () => {
      expect(countLetters('cafe\u0301')).toBe(4);
      expect(countLetters('cross-platform')).toBe(13);
      expect(countLetters('💻')).toBe(0);
    });
  });

  describe('dictionary accuracy', () => {
    it('every established form round-trips through the literal letter-count rule', () => {
      for (const [key, values] of Object.entries(ESTABLISHED_NUMERONYMS)) {
        const result = evaluate(key);
        expect(result.mode, key).toBe('decode');
        expect(result.matches?.length, key).toBeGreaterThan(0);
        for (const value of values) {
          expect(generateNumeronym(value).toLowerCase(), `${key} must match ${value}`).toBe(key);
        }
      }
    });

    it('includes common developer forms with exact expansions', () => {
      expect(evaluate('m17n').matches).toEqual(['multilingualization']);
      expect(evaluate('p13n').matches).toEqual(['personalization']);
      expect(evaluate('o11y').matches).toEqual(['observability']);
    });

    it('does not invent meanings for unsupported or different abbreviation patterns', () => {
      for (const value of ['e18n', 'e2e', 'b2b']) {
        const result = evaluate(value);
        expect(result.mode).toBe('invalid');
        expect(result.reason).toBe('not-in-dictionary');
        expect(result.matches).toBeUndefined();
      }
    });
  });

  describe('direction and tokenization', () => {
    it('encodes a normal word and decodes a known key first', () => {
      expect(evaluate('internationalization')).toMatchObject({ mode: 'encode', output: 'i18n' });
      expect(evaluate('K8S')).toMatchObject({ mode: 'decode', matches: ['Kubernetes'], ambiguous: false });
    });

    it('tokenizes free text across spaces, commas, semicolons and newlines', () => {
      expect(tokenizeNumeronymInput('Internationalization, accessibility; Kubernetes\nmultilingualization'))
        .toEqual(['Internationalization', 'accessibility', 'Kubernetes', 'multilingualization']);
    });

    it('keeps numeronyms, malformed mixed tokens and hyphenated words together', () => {
      expect(tokenizeNumeronymInput("i18n e2e v2 cross-platform don't"))
        .toEqual(['i18n', 'e2e', 'v2', 'cross-platform', "don't"]);
    });

    it('keeps short words unchanged and ignores surrounding punctuation', () => {
      expect(tokenizeNumeronymInput('API, a11y!')).toEqual(['API', 'a11y']);
      expect(evaluate('abc')).toMatchObject({ mode: 'encode', output: 'abc' });
    });

    it('keeps empty and malformed inputs explicit', () => {
      expect(evaluate('   ').reason).toBe('empty');
      expect(evaluate('kubernetes 2024').reason).toBe('mixed');
      expect(evaluate('12345').reason).toBe('mixed');
      expect(evaluate('x11y').reason).toBe('not-in-dictionary');
      expect(evaluate('word 123').reason).toBe('mixed');
    });
  });
});
