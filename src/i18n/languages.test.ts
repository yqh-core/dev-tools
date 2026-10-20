import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  ENABLED_LOCALES,
  buildAlternateLinks,
  detectLocale,
  isLocaleCode,
  localeDef,
  normalizeLocale,
  ogLocaleTags,
} from './languages';

describe('语言注册表 normalizeLocale', () => {
  it('把任意标签归一到已启用短码', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('zh_Hant')).toBe('zh');
    expect(normalizeLocale('ZH')).toBe('zh');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('fr')).toBe(DEFAULT_LOCALE); // 未启用 → 默认
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale('')).toBe(DEFAULT_LOCALE);
  });
});

describe('语言注册表 detectLocale（首访自动切换的核心判据）', () => {
  it('返回第一个「本站已启用」的偏好语言', () => {
    expect(detectLocale(['zh-CN', 'en'])).toBe('zh');
    expect(detectLocale(['en-US', 'zh'])).toBe('en');
    // 日本用户，浏览器 ja 打头，但本站暂无 ja：应落到通用语 en（不是崩、不是返回未启用的 ja）
    expect(detectLocale(['ja-JP', 'ja', 'en'])).toBe('en');
    // 未启用语言在前也必须跳过
    expect(detectLocale(['de', 'zh'])).toBe('zh');
  });

  it('空/缺失/SSR 环境安全返回默认，不抛错', () => {
    expect(detectLocale([])).toBe(DEFAULT_LOCALE);
    expect(detectLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(detectLocale(['fr', 'es'])).toBe(DEFAULT_LOCALE);
  });

  // 对照组：证明「跳过未启用语言」这条逻辑真的在跑，而不是碰巧
  it('证伪：把 zh 加进已启用后，ja 用户不再落 en（证明是「按启用集匹配」而非「恒取列表里第一个」）', () => {
    const first = (['ja', 'zh'] as const)[0];
    expect(isLocaleCode(first)).toBe(false); // ja 未启用，若实现是「取第一个」就会错返回 ja
    expect(detectLocale(['ja', 'zh'])).toBe('zh'); // 必须跳过 ja 命中 zh
  });
});

describe('og:locale 与 hreflang 产出', () => {
  it('og:locale = 主语言，alternate = 其余已启用语言（注册表驱动）', () => {
    const tags = ogLocaleTags();
    expect(tags[0]).toEqual({ property: 'og:locale', content: localeDef(DEFAULT_LOCALE).ogLocale });
    const alts = tags.filter(t => t.property === 'og:locale:alternate').map(t => t.content);
    const expectedAlts = ENABLED_LOCALES.filter(l => l.code !== DEFAULT_LOCALE).map(l => l.ogLocale);
    expect(alts).toEqual(expectedAlts);
    expect(alts.length).toBe(ENABLED_LOCALES.length - 1);
  });

  it('单 URL 模式只发自引用 + x-default，不虚发无独立 URL 的语言', () => {
    const links = buildAlternateLinks('https://digdevbox.com/json-prettify/', () => 'IGNORED', false);
    expect(links).toHaveLength(2);
    const codes = links.map(l => l.hreflang);
    expect(codes).toContain(localeDef(DEFAULT_LOCALE).hreflang);
    expect(codes).toContain('x-default');
    expect(codes).not.toContain(localeDef('zh').hreflang); // 无 /zh/ URL 时不发 zh
    expect(links.every(l => l.href === 'https://digdevbox.com/json-prettify/')).toBe(true);
  });

  it('分语言 URL 模式为每种已启用语言发互链 + x-default', () => {
    const hrefOf = (c: string) => `https://digdevbox.com/${c}/about/`;
    const links = buildAlternateLinks('X', hrefOf, true);
    const codes = links.map(l => l.hreflang);
    for (const l of ENABLED_LOCALES) {
      expect(codes).toContain(l.hreflang);
    }
    expect(codes).toContain('x-default');
    expect(links.length).toBe(ENABLED_LOCALES.length + 1);
  });
});
