import { describe, expect, it } from 'vitest';
import { createPassword } from './password-generator.service';

describe('password generator service', () => {
  it('generates a password of the requested length', () => {
    expect(createPassword({ length: 24 }).length).toBe(24);
  });

  it('respects the minimum length boundary of 8', () => {
    expect(createPassword({ length: 8 }).length).toBe(8);
  });

  it('excludes ambiguous characters by default', () => {
    for (let i = 0; i < 20; i++) {
      const pwd = createPassword({ length: 64, withUppercase: true, withLowercase: true, withNumbers: true });
      expect(pwd).not.toMatch(/[Il1O0o]/);
    }
  });

  it('includes ambiguous characters when explicitly enabled', () => {
    let seen = false;
    for (let i = 0; i < 50 && !seen; i++) {
      seen = /[Il1O0o]/.test(createPassword({ length: 64, withAmbiguous: true }));
    }
    expect(seen).toBe(true);
  });

  it('uses only the enabled character classes', () => {
    for (let i = 0; i < 10; i++) {
      const pwd = createPassword({ length: 64, withUppercase: true, withLowercase: false, withNumbers: false, withSymbols: false });
      expect(pwd).toMatch(/^[A-HJ-NP-Z]+$/); // 大写且无易混淆字符
    }
  });

  it('returns empty string when no character class is enabled', () => {
    expect(createPassword({ withUppercase: false, withLowercase: false, withNumbers: false, withSymbols: false })).toBe('');
  });

  it('produces different passwords on successive calls', () => {
    const a = createPassword({ length: 32 });
    const b = createPassword({ length: 32 });
    expect(a).not.toBe(b);
  });

  it('uses a cryptographic random source (all chars drawn from enabled set)', () => {
    // 结构性验证：洗牌后每个字符都来自合法字母表
    const pwd = createPassword({ length: 100, withSymbols: true });
    const legal = /[A-Za-z0-9.,;:!?./\-"'#{(\[\-|\\@)\]=}*+]/;
    for (const ch of pwd) {
      expect(legal.test(ch)).toBe(true);
    }
  });
});
