import { describe, expect, it } from 'vitest';
import { CLUSTER_KEYWORD_ENTRIES } from '@/seo/keyword-map';

describe('evidence-backed SEO keyword targets', () => {
  it.each([
    [
      '/basic-auth-generator',
      'basic auth generator',
      'Basic Auth Header Generator — Create Authorization Header',
    ],
    [
      '/safelink-decoder',
      'outlook safelink decoder',
      'Outlook Safe Links Decoder — Reveal the Original URL',
    ],
    [
      '/percentage-calculator',
      'percentage calculator',
      'Percentage Calculator — Percent of a Number & Percent Change',
    ],
  ])('keeps %s mapped to its measured primary intent and current title', (path, keyword, title) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P0');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(title);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
