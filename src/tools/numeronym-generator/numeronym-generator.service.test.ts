import { describe, expect, it } from 'vitest';
import {
  ESTABLISHED_NUMERONYMS,
  evaluate,
  generateNumeronym,
} from './numeronym-generator.service';

describe('numeronym-generator service', () => {
  describe('generateNumeronym', () => {
    it('a numeronym of a word is the first letter, the number of letters between the first and the last letter, and the last letter', () => {
      expect(generateNumeronym('internationalization')).toBe('i18n');
      expect(generateNumeronym('accessibility')).toBe('a11y');
      expect(generateNumeronym('localization')).toBe('l10n');
    });
    it('a numeronym of a word with 3 letters is the word itself', () => {
      expect(generateNumeronym('abc')).toBe('abc');
    });
  });

  describe('验收点 1 · 词典覆盖范围', () => {
    it('词典非空且每个键自身都能被反查（承诺=能力，逐条兑现）', () => {
      const keys = Object.keys(ESTABLISHED_NUMERONYMS);
      expect(keys.length).toBeGreaterThanOrEqual(8);
      for (const key of keys) {
        const r = evaluate(key);
        expect(r.mode, key).toBe('decode');
        expect(r.matches?.length, key).toBeGreaterThan(0);
        for (const m of r.matches ?? []) {
          expect(m.length, `${key}→${m}`).toBeGreaterThan(1);
        }
      }
    });

    it('未收录的 numeronym 形态串 → not-in-dictionary，绝不编造释义', () => {
      const r = evaluate('e18n');
      expect(r.mode).toBe('invalid');
      expect(r.reason).toBe('not-in-dictionary');
      expect(r.matches).toBeUndefined();
      expect(r.output).toBe('');
    });
  });

  describe('验收点 2 · 歧义处理', () => {
    it('t11n 存在真实歧义：返回全部候选并显式 ambiguous，不伪装唯一答案', () => {
      const r = evaluate('t11n');
      expect(r.mode).toBe('decode');
      expect(r.matches).toEqual(['translation', 'transcription']);
      expect(r.ambiguous).toBe(true);
    });

    it('无歧义词条 ambiguous=false（非恒真对照：若实现恒报 true 此条必红）', () => {
      expect(evaluate('k8s').ambiguous).toBe(false);
      expect(evaluate('k8s').matches).toEqual(['Kubernetes']);
    });
  });

  describe('验收点 3 · 方向识别', () => {
    it('普通单词输入 → encode', () => {
      const r = evaluate('internationalization');
      expect(r.mode).toBe('encode');
      expect(r.output).toBe('i18n');
    });

    it('词典键输入 → decode 优先（k8s 不被当成“再生成一遍”）', () => {
      expect(evaluate('k8s').mode).toBe('decode');
    });

    it('大小写不敏感命中词典', () => {
      expect(evaluate('K8S').mode).toBe('decode');
      expect(evaluate('A11y').matches).toEqual(['accessibility']);
    });

    it('≤3 纯字母走 encode 原样返回（既有语义不变）', () => {
      const r = evaluate('abc');
      expect(r.mode).toBe('encode');
      expect(r.output).toBe('abc');
    });

    it('空/混排输入 → invalid 带原因码', () => {
      expect(evaluate('   ').reason).toBe('empty');
      expect(evaluate('kubernetes 2024').reason).toBe('mixed');
      expect(evaluate('12345').reason).toBe('mixed');
    });

    it('前后空白不影响判定', () => {
      expect(evaluate('  i18n  ').mode).toBe('decode');
      expect(evaluate(' accessibility ').output).toBe('a11y');
    });
  });
});
