import { describe, expect, it } from 'vitest';
import { KNOWN_NOTE_SLUGS } from '@/seo/keyword-map';
import { GUIDES } from '@/tools/guides.en';
import { GUIDES as GUIDES_ZH } from '@/tools/guides.zh';

const expected = [
  {
    path: '/percentage-calculator',
    slug: 'percentage-change-vs-percentage-points',
    title: "Percentage Change vs Percentage Points: Which Formula Should You Use?",
    description: "Learn when to use percent change, percentage points, percent difference and reverse-percentage formulas, with worked examples for rates, prices and discounts.",
    tag: 'Percentages',
  },
  {
    path: '/eta-calculator',
    slug: 'eta-calculator-guide',
    title: "How to Calculate Task Completion Time from Processing Rate",
    description: "Estimate when a download, build or batch job will finish using total workload, processing rate and start time — with a worked example, formula and practical limits.",
    tag: 'ETA',
  },
] as const;

describe('Forge Notes acquisition cross-links', () => {
  it.each(expected)('$path links to its exact published article metadata in both locales', (item) => {
    expect(KNOWN_NOTE_SLUGS).toContain(item.slug);
    for (const guides of [GUIDES, GUIDES_ZH]) {
      const note = guides[item.path]?.relatedNotes?.find(entry => entry.slug === item.slug);
      expect(note).toEqual({
        slug: item.slug,
        title: item.title,
        description: item.description,
        url: `https://notes.digdevbox.com/posts/${item.slug}`,
        tag: item.tag,
      });
    }
  });
});
