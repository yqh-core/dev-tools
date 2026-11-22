import { describe, expect, it } from 'vitest';
import { CLUSTER_KEYWORD_ENTRIES } from '@/seo/keyword-map';

describe('evidence-backed SEO keyword targets', () => {
  it.each([
    [
      '/basic-auth-generator',
      'basic auth generator',
      'Basic Auth Generator — Build an HTTP Authorization Header',
    ],
    [
      '/safelink-decoder',
      'outlook safelink decoder',
      'Outlook Safe Links Decoder — Reveal the Original URL',
    ],
    [
      '/percentage-calculator',
      'percentage calculator',
      'Percentage Calculator — Percent of a Number, Change & Discount',
    ],
    [
      '/numeronym-generator',
      'numeronym',
      'Numeronym Generator — i18n, a11y & k8s',
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

  it.each([
    ['/numeronym-generator', 'numeronym', 'P0', 'Numeronym Generator — i18n, a11y & k8s'],
    ['/eta-calculator', 'eta calculator', 'P1', 'ETA Calculator — Task Completion Time'],
    ['/text-statistics', 'text statistics', 'P1', 'Word & Character Counter — Text Statistics & Byte Size'],
  ])('keeps %s mapped to a capability-matched intent', (path, keyword, priority, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe(priority);
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
