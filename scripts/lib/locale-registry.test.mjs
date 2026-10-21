/**
 * G1 门禁的证伪测试（G7 的一部分）。
 *
 * 原则：不只测"正常情况能过"，必须逐条证明**注入缺陷后门禁会红**：
 * 空文件 / 缺文件 / 孤儿文件 / 默认语言未注册 / 顶层区块缺失 / YAML 解析失败。
 * 这些用例全部是内存 fixture，不碰仓库文件系统。
 */
import { describe, expect, it } from 'vitest';
import { auditRegistry, countLeafStrings, parseRegistry } from './locale-registry.mjs';

const SOURCE = `
export const ENABLED_LOCALES = [
  { code: 'en', bcp47: 'en', ogLocale: 'en_US', hreflang: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'zh', bcp47: 'zh-CN', ogLocale: 'zh_CN', hreflang: 'zh', nativeName: '中文', englishName: 'Chinese' },
] as const satisfies readonly LocaleDef[];
export const DEFAULT_LOCALE: LocaleCode = 'en';
export const FALLBACK_LOCALE: LocaleCode = 'en';
`;

const REG = parseRegistry(SOURCE);

const goodLocales = () => ({
  en: { raw: 'nav:\n  home: Home\n', data: { nav: { home: 'Home' } }, parseError: null },
  zh: { raw: 'nav:\n  home: 首页\n', data: { nav: { home: '首页' } }, parseError: null },
});

const run = (locales, over = {}) => auditRegistry({
  enabled: REG.enabled,
  defaultLocale: REG.defaultLocale,
  fallbackLocale: REG.fallbackLocale,
  locales,
  ...over,
});

describe('parseRegistry', () => {
  it('从源码里取到 enabled/default/fallback', () => {
    expect(REG).toEqual({ enabled: ['en', 'zh'], defaultLocale: 'en', fallbackLocale: 'en' });
  });

  it('源码结构变了就抛错，而不是静默返回空表', () => {
    expect(() => parseRegistry('export const X = 1;')).toThrow(/ENABLED_LOCALES/);
  });
});

describe('auditRegistry', () => {
  it('干净输入 → 零 failure', () => {
    expect(run(goodLocales()).failures).toEqual([]);
  });

  it('证伪①：已注册但 yml 是空文件 → 必须红（K6 的核心）', () => {
    const l = goodLocales();
    l.zh = { raw: '   \n\n', data: null, parseError: null };
    const r = run(l);
    expect(r.failures.join('\n')).toMatch(/空文件/);
    // 且不能被算进 stats（不能"存在即通过"）
    expect(r.stats.map(s => s.code)).toEqual(['en']);
  });

  it('证伪②：已注册但完全没有文件 → 红', () => {
    const l = goodLocales();
    delete l.zh;
    expect(run(l).failures.join('\n')).toMatch(/缺少 locales\/zh\.yml/);
  });

  it('证伪③：有文件但未注册（孤儿） → 红', () => {
    const l = goodLocales();
    l.ja = { raw: 'nav:\n  home: ホーム\n', data: { nav: { home: 'ホーム' } }, parseError: null };
    expect(run(l).failures.join('\n')).toMatch(/未在 ENABLED_LOCALES 注册/);
  });

  it('证伪④：DEFAULT_LOCALE 不在 enabled → 红', () => {
    expect(run(goodLocales(), { defaultLocale: 'ja' }).failures.join('\n')).toMatch(/DEFAULT_LOCALE='ja'/);
  });

  it('证伪⑤：非默认语言缺一级区块 → 红', () => {
    const l = goodLocales();
    l.zh = { raw: 'tools:\n  a: b\n', data: { tools: { a: 'b' } }, parseError: null };
    expect(run(l).failures.join('\n')).toMatch(/缺少一级区块：nav/);
  });

  it('证伪⑥：YAML 解析失败 → 红且带原因', () => {
    const l = goodLocales();
    l.zh = { raw: 'nav: [unclosed', data: null, parseError: 'unexpected end of the stream' };
    expect(run(l).failures.join('\n')).toMatch(/解析失败/);
  });

  it('对照组：空串叶子不算词条（countLeafStrings 只数字符串，但空文件已单独判红）', () => {
    expect(countLeafStrings({ a: { b: '', c: 'x' }, d: 'y' })).toBe(3);
  });
});
