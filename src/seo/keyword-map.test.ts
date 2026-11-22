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
    ['/ipv4-subnet-calculator', 'IPv4 subnet calculator', 'IPv4 Subnet Calculator — CIDR, Netmask & Usable Hosts'],
    ['/csv-to-json', 'CSV to JSON converter', 'CSV to JSON Converter — Preview Rows & Convert Online'],
    ['/text-diff', 'text diff checker', 'Text Diff Checker — Compare Two Texts Side by Side'],
    ['/text-replacer', 'find and replace text online', 'Find and Replace Text — Plain Text & Regex Replacer'],
    ['/htpasswd-generator', 'htpasswd generator', 'htpasswd Generator & Checker — bcrypt, apr1 and SHA1'],
  ])('locks the landed metadata for %s', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/ipv4-range-expander', 'IP range to CIDR', 'convert'],
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

  it.each([
    ['/email-normalizer', 'email normalizer', 'parse'],
    ['/image-color-picker', 'image color picker', 'inspect'],
    ['/list-converter', 'list converter', 'convert'],
    ['/ipv4-address-converter', 'IPv4 address converter', 'convert'],
    ['/html-wysiwyg-editor', 'HTML WYSIWYG editor', 'format'],
    ['/rsa-key-pair-generator', 'RSA key pair generator', 'generate'],
    ['/keycode-info', 'JavaScript keycode checker', 'inspect'],
    ['/math-evaluator', 'math expression evaluator', 'compute'],
    ['/og-meta-generator', 'Open Graph meta tag generator', 'generate'],
    ['/mime-types', 'MIME type lookup', 'lookup'],
    ['/random-port-generator', 'random port generator', 'generate'],
  ])('keeps source-audited candidate %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('Candidate mapping only');
  });
});
