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
    ['/url-parser', 'url parser online', 'URL Parser — Inspect Query Parameters and UTM Tags'],
    ['/ipv4-range-expander', 'IP range to CIDR', 'IP Range to CIDR Converter — Convert IPv4 Ranges Online'],
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
    expect(entry?.landed).toBe(true);
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

  it.each([
    ['/json-to-toml', 'JSON to TOML converter', 'convert'],
    ['/toml-to-json', 'TOML to JSON converter', 'convert'],
    ['/toml-to-yaml', 'TOML to YAML converter', 'convert'],
    ['/yaml-to-toml', 'YAML to TOML converter', 'convert'],
    ['/json-to-get-params', 'JSON to query string converter', 'convert'],
    ['/whois-lookup', 'domain WHOIS lookup', 'lookup'],
    ['/mac-address-lookup', 'MAC address vendor lookup', 'lookup'],
    ['/password-strength-analyser', 'password strength checker', 'inspect'],
    ['/otp-generator', 'TOTP generator online', 'generate'],
    ['/unit-converter', 'unit converter online', 'convert'],
  ])('keeps source-audited candidates %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('Candidate mapping only');
  });

  it.each([
    ['/html-entities', 'HTML entities encoder and decoder', 'convert'],
    ['/base-converter', 'number base converter', 'convert'],
    ['/qrcode-generator', 'QR code generator', 'generate'],
    ['/wifi-qrcode-generator', 'WiFi QR code generator', 'generate'],
    ['/roman-numeral-converter', 'Roman numeral converter', 'convert'],
    ['/svg-placeholder-generator', 'SVG placeholder generator', 'generate'],
    ['/token-generator', 'random token generator', 'generate'],
    ['/ascii-table', 'ASCII table lookup', 'lookup'],
  ])('keeps source-audited utility candidate %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('Candidate mapping only');
  });

  it.each([
    ['/ascii-text-drawer', 'ASCII art text generator', 'generate'],
    ['/text-to-unicode', 'text to Unicode converter', 'convert'],
    ['/pdf-signature-checker', 'PDF digital signature checker', 'inspect'],
    ['/mac-address-generator', 'random MAC address generator', 'generate'],
    ['/text-to-binary', 'text to binary converter', 'convert'],
    ['/iban-validator-and-parser', 'IBAN validator and parser', 'inspect'],
    ['/string-obfuscator', 'string obfuscator', 'convert'],
    ['/emoji-picker', 'emoji picker and search', 'lookup'],
    ['/benchmark-builder', 'benchmark comparison calculator', 'compute'],
    ['/reaction-time-test', 'reaction time test', 'compute'],
  ])('keeps source-audited conversion candidate %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('Candidate mapping only');
  });

  it.each([
    ['/text-to-nato-alphabet', 'NATO phonetic alphabet converter', 'convert'],
    ['/bcrypt', 'bcrypt hash generator and checker', 'generate'],
    ['/bip39-generator', 'BIP39 mnemonic generator', 'generate'],
    ['/chronometer', 'online stopwatch', 'compute'],
    ['/color-converter', 'color format converter', 'convert'],
    ['/device-information', 'browser device information checker', 'inspect'],
    ['/encryption', 'text encryption and decryption tool', 'convert'],
    ['/git-memo', 'Git commands cheat sheet', 'lookup'],
    ['/temperature-converter', 'temperature converter', 'convert'],
    ['/fullwidth-converter', 'full-width half-width converter', 'convert'],
    ['/px-rem-converter', 'px to rem converter', 'convert'],
    ['/today-in-history', 'today in history', 'lookup'],
  ])('keeps final source-audited candidate %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(false);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('Candidate mapping only');
  });
});
