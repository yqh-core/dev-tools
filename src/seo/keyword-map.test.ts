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

  it.each([
    ['/ipv4-subnet-calculator', 'IPv4 subnet calculator', 'compute'],
    ['/ipv4-range-expander', 'IP range to CIDR', 'convert'],
    ['/text-diff', 'text diff checker', 'inspect'],
    ['/text-replacer', 'find and replace text online', 'convert'],
    ['/htpasswd-generator', 'htpasswd generator', 'generate'],
  ])('keeps %s mapped to an existing capability-matched route', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('provisional');
  });

  it.each([
    ['/csv-to-json', 'CSV to JSON converter', 'convert'],
    ['/pdf-merge', 'merge PDF files online', 'convert'],
    ['/ipv6-ula-generator', 'IPv6 ULA generator', 'generate'],
    ['/user-agent-parser', 'user agent parser', 'parse'],
    ['/phone-parser-and-formatter', 'international phone number parser', 'parse'],
  ])('keeps %s mapped to an existing capability-matched route', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('provisional');
  });

  it.each([
    ['/xml-to-json', 'XML to JSON converter', 'convert'],
    ['/markdown-to-html', 'Markdown to HTML converter', 'convert'],
    ['/yaml-to-json-converter', 'YAML to JSON converter', 'convert'],
    ['/slugify-string', 'URL slug generator', 'generate'],
    ['/case-converter', 'text case converter', 'convert'],
  ])('keeps %s mapped to an existing capability-matched route', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('provisional');
  });

  it.each([
    ['/pdf-split', 'split PDF pages online', 'convert'],
    ['/pdf-watermark', 'add watermark to PDF', 'convert'],
    ['/pdf-compress', 'compress PDF online', 'convert'],
    ['/image-resize', 'resize image online', 'convert'],
    ['/image-compress', 'compress image online', 'convert'],
    ['/image-crop', 'crop image online', 'convert'],
    ['/favicon-generator', 'favicon generator', 'generate'],
    ['/image-to-pdf', 'convert images to PDF', 'convert'],
  ])('keeps %s mapped to an existing capability-matched route', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('provisional');
  });
});
