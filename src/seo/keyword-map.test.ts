import { describe, expect, it } from 'vitest';
import { CLUSTER_KEYWORD_ENTRIES } from '@/seo/keyword-map';

describe('evidence-backed SEO keyword targets', () => {
  it.each([
    [
      '/basic-auth-generator',
      'basic auth generator',
      'Basic Auth Generator & Decoder — HTTP Header',
    ],
    [
      '/safelink-decoder',
      'outlook safelink decoder',
      'Outlook Safe Links Decoder — Reveal the Original URL',
    ],
    [
      '/percentage-calculator',
      'percentage calculator',
      'Percentage Calculator — Percent & Change',
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
    ['/text-statistics', 'text statistics', 'P1', 'Text Statistics — Word & Character Counter'],
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
    ['/htpasswd-generator', 'htpasswd generator', 'htpasswd Generator & Checker — bcrypt & apr1'],
    ['/url-parser', 'url parser online', 'URL Parser — Inspect Query Parameters and UTM Tags'],
    ['/ipv4-range-expander', 'IP range to CIDR', 'IP Range to CIDR Converter — Convert IPv4 Ranges Online'],
    ['/pdf-merge', 'merge PDF files online', 'PDF Merge — Combine PDF Files Online'],
    ['/user-agent-parser', 'user agent parser', 'User Agent Parser — Browser, OS & Device Detection'],
    ['/xml-to-json', 'XML to JSON converter', 'XML to JSON Converter — Convert XML Online'],
    ['/markdown-to-html', 'Markdown to HTML converter', 'Markdown to HTML Converter — Live Preview & HTML Output'],
    ['/pdf-split', 'split PDF pages online', 'PDF Split — Split PDF Pages or Extract a Range'],
    ['/pdf-watermark', 'add watermark to PDF', 'PDF Watermark — Add Text Watermarks to PDF'],
    ['/pdf-compress', 'compress PDF online', 'PDF Compressor — Reduce PDF File Size Online'],
    ['/image-resize', 'resize image online', 'Image Resizer — Resize Images to Exact Dimensions'],
    ['/image-compress', 'compress image online', 'Image Compressor — Reduce JPEG & WebP File Size'],
    ['/image-crop', 'crop image online', 'Image Cropper — Crop Photos to Any Aspect Ratio'],
    ['/favicon-generator', 'favicon generator', 'Favicon Generator — Create ICO & PNG Icons'],
    ['/image-to-pdf', 'convert images to PDF', 'Images to PDF Converter — Combine JPG & PNG Online'],
    ['/yaml-to-json-converter', 'YAML to JSON converter', 'YAML to JSON Converter — Convert YAML Online'],
    ['/case-converter', 'text case converter', 'Text Case Converter — camelCase, snake_case & More'],
    ['/list-converter', 'list converter', 'List Converter — Sort, Deduplicate & Format Lines'],
    ['/image-color-picker', 'image color picker', 'Image Color Picker — Get HEX, RGB & HSL from Any Image'],
  ])('locks the landed metadata for %s', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/ipv4-range-expander', 'IP range to CIDR', 'convert'],
    ['/pdf-merge', 'merge PDF files online', 'convert'],
    ['/user-agent-parser', 'user agent parser', 'parse'],
    ['/xml-to-json', 'XML to JSON converter', 'convert'],
    ['/markdown-to-html', 'Markdown to HTML converter', 'convert'],
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
    ['/pdf-split', 'split PDF pages online', 'convert'],
    ['/pdf-watermark', 'add watermark to PDF', 'convert'],
    ['/pdf-compress', 'compress PDF online', 'convert'],
    ['/image-resize', 'resize image online', 'convert'],
  ])('keeps newly landed %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.landed).toBe(true);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
    expect(entry?.note).toContain('provisional');
  });

  it.each([
    ['/image-compress', 'compress image online', 'convert'],
    ['/image-crop', 'crop image online', 'convert'],
    ['/favicon-generator', 'favicon generator', 'generate'],
    ['/image-to-pdf', 'convert images to PDF', 'convert'],
    ['/yaml-to-json-converter', 'YAML to JSON converter', 'convert'],
    ['/case-converter', 'text case converter', 'convert'],
    ['/list-converter', 'list converter', 'convert'],
    ['/image-color-picker', 'image color picker', 'inspect'],
  ])('keeps newly landed P1 route %s capability-matched', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBeDefined();
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['/ipv6-ula-generator', 'IPv6 ULA generator', 'generate'],

    ['/phone-parser-and-formatter', 'international phone number parser', 'parse'],
  ])('keeps %s mapped to an existing capability-matched route', (path, keyword, intent) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.intent).toBe(intent);
    if (path === '/phone-parser-and-formatter') {
      expect(entry?.landed).toBe(true);
      expect(entry?.lockedTitle).toBe('International Phone Number Parser & Formatter — E.164');
      expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(7);
      expect(entry?.note).toContain('batch processing');
    }
    else {
      expect(entry?.landed).toBe(false);
      expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
      expect(entry?.note).toContain('provisional');
    }
  });

  it.each([
    ['/slugify-string', 'URL slug generator', 'generate'],
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
    ['/ipv4-address-converter', 'IPv4 address converter', 'convert'],
    ['/keycode-info', 'JavaScript keycode checker', 'inspect'],
    ['/math-evaluator', 'math expression evaluator', 'compute'],
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
    ['/toml-to-yaml', 'TOML to YAML converter', 'convert'],
    ['/yaml-to-toml', 'YAML to TOML converter', 'convert'],
    ['/mac-address-lookup', 'MAC address vendor lookup', 'lookup'],
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
    ['/json-to-toml', 'JSON to TOML converter', 'JSON to TOML Converter'],
    ['/toml-to-json', 'TOML to JSON converter', 'TOML to JSON Converter — Convert TOML Config to JSON'],
    ['/json-to-get-params', 'JSON to query string converter', 'JSON to Query String Converter'],
    ['/password-strength-analyser', 'password strength checker', 'Password Strength Checker — Entropy & Crack-Time Estimate'],
  ])('locks newly landed P1 route %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
    expect((entry?.keywords ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['/roman-numeral-converter', 'Roman numeral converter', 'convert'],
    ['/svg-placeholder-generator', 'SVG placeholder generator', 'generate'],
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
    ['/mac-address-generator', 'random MAC address generator', 'generate'],
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
    ['/bip39-generator', 'BIP39 mnemonic generator', 'generate'],
    ['/chronometer', 'online stopwatch', 'compute'],
    ['/device-information', 'browser device information checker', 'inspect'],
    ['/encryption', 'text encryption and decryption tool', 'convert'],
    ['/fullwidth-converter', 'full-width half-width converter', 'convert'],
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

  it.each([
    ['/html-entities', 'HTML entities encoder and decoder', 'HTML Entity Encoder & Decoder'],
    ['/base-converter', 'number base converter', 'Number Base Converter — Bases 2–64'],
    ['/color-converter', 'color format converter', 'Color Converter — HEX, RGB, HSL, HWB, LCH and CMYK'],
    ['/px-rem-converter', 'px to rem converter', 'PX to REM Converter — Batch Conversion with Root Font Size'],
  ])('locks newly landed P1 utility %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/qrcode-generator', 'QR code generator', 'QR Code Generator — Create & Download Custom QR Codes'],
    ['/text-to-unicode', 'text to Unicode converter', 'Text to Unicode Converter — Decimal HTML References & Code Points'],
    ['/pdf-signature-checker', 'PDF digital signature checker', 'PDF Signature Checker — Verify PDF Signatures & Certificates'],
    ['/text-to-binary', 'text to binary converter', 'Text to Binary Converter — ASCII 8-Bit Encoder & Decoder'],
  ])('locks newly landed P1 utility %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/og-meta-generator', 'Open Graph meta tag generator', 'Open Graph & Twitter Meta Tag Generator — Create Social Share Tags'],
    ['/whois-lookup', 'domain WHOIS lookup', 'Domain WHOIS & RDAP Lookup — Check Registration Details'],
    ['/rsa-key-pair-generator', 'RSA key pair generator', 'RSA Key Pair Generator — Create Public & Private PEM Keys'],
    ['/html-wysiwyg-editor', 'HTML WYSIWYG editor', 'HTML WYSIWYG Editor — Format Text & Copy HTML'],
  ])('locks newly landed P1 utility %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/otp-generator', 'TOTP generator online', 'TOTP Code Generator — 6-Digit Codes & QR'],
    ['/token-generator', 'random token generator', 'Random Token Generator — Custom Length & Character Sets'],
    ['/bcrypt', 'bcrypt hash generator and checker', 'Bcrypt Hash Generator & Checker — Hash and Compare Passwords'],
    ['/iban-validator-and-parser', 'IBAN validator and parser', 'IBAN Validator & Parser — Check Format, Country & BBAN'],
  ])('locks newly landed P1 utility %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });

  it.each([
    ['/wifi-qrcode-generator', 'WiFi QR code generator', 'WiFi QR Code Generator — Create Network Login QR Codes'],
    ['/git-memo', 'Git commands cheat sheet', 'Git Commands Cheat Sheet — Common Commands & Undo'],
    ['/temperature-converter', 'temperature converter', 'Temperature Converter — Celsius, Fahrenheit, Kelvin & More'],
  ])('locks newly landed P1 utility %s to its capability-matched title', (path, keyword, lockedTitle) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe(keyword);
    expect(entry?.priority).toBe('P1');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(lockedTitle);
  });
  it.each([
    ['/api-debugger', 'REST API Tester — cURL, Tests & Collections'],
    ['/json-prettify', 'JSON Formatter — Format, Validate & Diff'],
    ['/json-workspace', 'JSON Workspace — JSONPath, Tree & Schema'],
    ['/base-converter', 'Number Base Converter — Bases 2–64'],
    ['/html-entities', 'HTML Entity Encoder & Decoder'],
    ['/json-to-get-params', 'JSON to Query String Converter'],
    ['/docker-run-to-docker-compose-converter', 'Docker Run to Compose Converter'],
    ['/otp-generator', 'TOTP Code Generator — 6-Digit Codes & QR'],
    ['/htpasswd-generator', 'htpasswd Generator & Checker — bcrypt & apr1'],
    ['/json-to-toml', 'JSON to TOML Converter'],
    ['/text-statistics', 'Text Statistics — Word & Character Counter'],
  ])('keeps %s rendered title within the 60-character guideline', (path, title) => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === path);
    expect(entry).toBeDefined();
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe(title);
    expect((title as string).length + ' - DigDevBox'.length).toBeLessThanOrEqual(60);
  });

  it('locks JSON Diff Checker to its distinct structural comparison intent', () => {
    const entry = CLUSTER_KEYWORD_ENTRIES.find(item => item.path === '/json-diff');

    expect(entry).toBeDefined();
    expect(entry?.keyword).toBe('json diff checker');
    expect(entry?.priority).toBe('P1');
    expect(entry?.intent).toBe('debug');
    expect(entry?.landed).toBe(true);
    expect(entry?.lockedTitle).toBe('JSON Diff Checker — Compare JSON Online');
    expect(entry?.note).toContain('structural JSON comparison intent');
  });
});
