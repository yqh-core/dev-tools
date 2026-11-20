import { describe, expect, it } from 'vitest';
import { GUIDE_ARTICLE_PAGES, buildGuideSections } from '@/seo/guide-articles';
import { loadGuides } from '@/tools/guides';

describe('article-only guide content', () => {
  it('adds unique percentage examples to the standalone guide and makes its shape indexable', () => {
    const page = GUIDE_ARTICLE_PAGES.find(item => item.toolPath === '/percentage-calculator');
    expect(page).toBeDefined();
    expect(page?.indexable).toBe(true);
    expect(page?.sections.filter(section => section.id.startsWith('article-only-'))).toHaveLength(2);
    expect(page?.sections.map(section => section.title)).toContain('Choose the denominator before you calculate');
  });

  it('adds original numeronym explanations to its standalone guide', () => {
    const page = GUIDE_ARTICLE_PAGES.find(item => item.toolPath === '/numeronym-generator');
    expect(page).toBeDefined();
    expect(page?.indexable).toBe(true);
    expect(page?.sections.filter(section => section.id.startsWith('article-only-'))).toHaveLength(2);
    expect(page?.sections.map(section => section.title)).toContain('How the omitted-letter count is formed');
  });

  it('keeps article-only sections paired across English and Chinese', async () => {
    const [en, zh] = await Promise.all([loadGuides('en'), loadGuides('zh')]);
    const english = en['/percentage-calculator'].articleOnlySections ?? [];
    const chinese = zh['/percentage-calculator'].articleOnlySections ?? [];

    expect(english).toHaveLength(2);
    expect(chinese).toHaveLength(english.length);
    expect(english[0].title).toBe('Choose the denominator before you calculate');
    expect(chinese[0].title).toBe('计算前先确定分母');
    expect(english[0].text).toMatch(/100%/);
    expect(chinese[0].text).toMatch(/100%/);

    const englishNumeronym = en['/numeronym-generator'].articleOnlySections ?? [];
    const chineseNumeronym = zh['/numeronym-generator'].articleOnlySections ?? [];
    expect(englishNumeronym).toHaveLength(2);
    expect(chineseNumeronym).toHaveLength(englishNumeronym.length);
    expect(englishNumeronym[0].title).toBe('How the omitted-letter count is formed');
    expect(chineseNumeronym[0].title).toBe('省略字母的数量是怎样计算的');
  });

  it('does not lose the original tool guide sections when article-only sections are added', async () => {
    const guides = await loadGuides('en');
    const sections = buildGuideSections(guides['/percentage-calculator']);
    expect(sections.some(section => section.id === 'how-to-use')).toBe(true);
    expect(sections.some(section => section.id === 'faq')).toBe(true);
    expect(sections.some(section => section.id === 'article-only-1')).toBe(true);
  });
});
