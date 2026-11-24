import { describe, expect, it } from 'vitest';
import { GUIDE_ARTICLE_PAGES, buildGuideSections } from '@/seo/guide-articles';
import { loadGuides } from '@/tools/guides';

describe('article-only guide content', () => {
  it('adds an original API tester workflow to the standalone guide', async () => {
    const page = GUIDE_ARTICLE_PAGES.find(item => item.toolPath === '/api-debugger');
    expect(page).toBeDefined();
    expect(page?.indexable).toBe(true);
    expect(page?.sections.filter(section => section.id.startsWith('article-only-'))).toHaveLength(3);

    const [en, zh] = await Promise.all([loadGuides('en'), loadGuides('zh')]);
    expect(en['/api-debugger'].steps).toHaveLength(5);
    expect(zh['/api-debugger'].steps).toHaveLength(en['/api-debugger'].steps.length);
    expect(en['/api-debugger'].faqs).toHaveLength(3);
    expect(zh['/api-debugger'].faqs).toHaveLength(en['/api-debugger'].faqs!.length);
    expect(en['/api-debugger'].articleOnlySections).toHaveLength(3);
    expect(zh['/api-debugger'].articleOnlySections).toHaveLength(en['/api-debugger'].articleOnlySections!.length);
  });

  it('adds unique percentage examples to the standalone guide and makes its shape indexable', () => {
    const page = GUIDE_ARTICLE_PAGES.find(item => item.toolPath === '/percentage-calculator');
    expect(page).toBeDefined();
    expect(page?.indexable).toBe(true);
    expect(page?.sections.filter(section => section.id.startsWith('article-only-'))).toHaveLength(3);
    expect(page?.sections.map(section => section.title)).toContain('Choose the denominator before you calculate');
    expect(page?.sections.map(section => section.title)).toContain('Reverse a change and choose the right comparison');
  });

  it('adds original numeronym explanations to its standalone guide', () => {
    const page = GUIDE_ARTICLE_PAGES.find(item => item.toolPath === '/numeronym-generator');
    expect(page).toBeDefined();
    expect(page?.indexable).toBe(true);
    expect(page?.sections.filter(section => section.id.startsWith('article-only-'))).toHaveLength(2);
    expect(page?.sections.map(section => section.title)).toContain('Batch mode is line-based, not phrase-based');
  });

  it('keeps article-only sections paired across English and Chinese', async () => {
    const [en, zh] = await Promise.all([loadGuides('en'), loadGuides('zh')]);
    const english = en['/percentage-calculator'].articleOnlySections ?? [];
    const chinese = zh['/percentage-calculator'].articleOnlySections ?? [];

    expect(en['/json-diff'].intro).toContain('Compare JSON documents structurally');
    expect(zh['/json-diff'].intro).toContain('结构化比较 JSON 文档');
    expect(english).toHaveLength(3);
    expect(chinese).toHaveLength(english.length);
    expect(english.map(section => section.title)).toContain('Reverse a change and choose the right comparison');
    expect(chinese.map(section => section.title)).toContain('反推变化前的数值，并选对比较基数');
    expect(english[0].title).toBe('Choose the denominator before you calculate');
    expect(chinese[0].title).toBe('计算前先确定分母');
    expect(english[0].text).toMatch(/100%/);
    expect(chinese[0].text).toMatch(/100%/);

    const englishNumeronym = en['/numeronym-generator'].articleOnlySections ?? [];
    const chineseNumeronym = zh['/numeronym-generator'].articleOnlySections ?? [];
    expect(englishNumeronym).toHaveLength(2);
    expect(chineseNumeronym).toHaveLength(englishNumeronym.length);
    expect(englishNumeronym[0].title).toBe('Batch mode is line-based, not phrase-based');
    expect(chineseNumeronym[0].title).toBe('批量模式按行处理，不按短语处理');
  });

  it('adds distinct JSON Diff guidance in both locales without claiming unsupported competitor features', async () => {
    const [en, zh] = await Promise.all([loadGuides('en'), loadGuides('zh')]);
    const english = en['/json-diff'].articleOnlySections ?? [];
    const chinese = zh['/json-diff'].articleOnlySections ?? [];

    expect(english).toHaveLength(3);
    expect(chinese).toHaveLength(english.length);
    expect(english.map(section => section.title)).toContain('Choose the right array comparison mode');
    expect(chinese.map(section => section.title)).toContain('选择适合的数组比较模式');
    expect(english[1].text).toContain('unique, non-empty string or finite numeric ID');
    expect(chinese[1].text).toContain('唯一、非空的字符串或有限数字 ID');
    expect(english[2].text).toContain('2^53 - 1');
    expect(chinese[2].text).toContain('2^53 - 1');

    const sections = buildGuideSections(en['/json-diff']);
    expect(sections.some(section => section.id === 'article-only-1')).toBe(true);
    expect(sections.some(section => section.id === 'article-only-3')).toBe(true);
  });

  it('does not lose the original tool guide sections when article-only sections are added', async () => {
    const guides = await loadGuides('en');
    const sections = buildGuideSections(guides['/percentage-calculator']);
    expect(sections.some(section => section.id === 'how-to-use')).toBe(true);
    expect(sections.some(section => section.id === 'faq')).toBe(true);
    expect(sections.some(section => section.id === 'article-only-1')).toBe(true);
  });
});
