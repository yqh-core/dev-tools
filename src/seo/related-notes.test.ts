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
  {
    path: '/safelink-decoder',
    slug: 'outlook-safelinks-decoder-guide',
    title: "Outlook Safe Links Decoder: Reveal the Original URL Without Opening It",
    description: "Learn how Outlook Safe Links wraps email URLs, how to reveal a destination without opening it, and what decoding does not verify or replace.",
    tag: 'Safe Links',
  },
  {
    path: '/basic-auth-generator',
    slug: 'http-basic-auth-header-guide',
    title: "HTTP Basic Authentication Header: Base64 Format, HTTPS & cURL",
    description: "Understand how an Authorization: Basic header is formed, why Base64 is not encryption, how to generate or decode it, and how to send credentials safely over HTTPS.",
    tag: 'HTTP Auth',
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

describe('Safe Links security copy', () => {
  it('does not describe decoding as bypassing protection or opening the destination', () => {
    for (const guides of [GUIDES, GUIDES_ZH]) {
      const guide = guides['/safelink-decoder'];
      const copy = [guide.about ?? '', ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`)].join(' ');
      expect(copy).not.toMatch(/opens directly|直达目标|绕开跟踪跳转|选择直达目标/);
      expect(copy).toMatch(/does not replace|不会替代/);
    }
  });
});
