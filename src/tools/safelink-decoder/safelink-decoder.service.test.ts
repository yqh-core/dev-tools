import { describe, expect, it } from 'vitest';
import { decodeSafeLinksBatch, decodeSafeLinksURL } from './safelink-decoder.service';

describe('safelink-decoder', () => {
  describe('decodeSafeLinksURL', () => {
    it('decodes a standard Outlook Safe Links URL', () => {
      expect(decodeSafeLinksURL('https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dsafelink%26rlz%3D1&data=example'))
        .toBe('https://www.google.com/search?q=safelink&rlz=1');
    });

    it('decodes an HTML-escaped Outlook Safe Links URL', () => {
      expect(decodeSafeLinksURL('https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dsafelink%26rlz%3D1&amp;data=example'))
        .toBe('https://www.google.com/search?q=safelink&rlz=1');
    });

    it('unwraps nested Outlook Safe Links URLs', () => {
      const destination = 'https://example.com/docs';
      const inner = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(destination)}`;
      const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

      expect(decodeSafeLinksURL(outer)).toBe(destination);
    });

    it('rejects a lookalike URL whose query merely mentions the Outlook host', () => {
      expect(() => decodeSafeLinksURL('https://example.com/?next=https://nam01.safelinks.protection.outlook.com/&url=https%3A%2F%2Fattacker.example'))
        .toThrow('Invalid SafeLinks URL provided');
    });

    it('rejects a hostname that only contains the Outlook domain as a suffix-like string', () => {
      expect(() => decodeSafeLinksURL('https://safelinks.protection.outlook.com.attacker.example/?url=https%3A%2F%2Fexample.com'))
        .toThrow('Invalid SafeLinks URL provided');
    });

    it('rejects non-HTTPS wrapper URLs', () => {
      expect(() => decodeSafeLinksURL('http://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com'))
        .toThrow('Invalid SafeLinks URL provided');
    });

    it('rejects wrappers without a destination parameter', () => {
      expect(() => decodeSafeLinksURL('https://nam01.safelinks.protection.outlook.com/?data=example'))
        .toThrow('missing its destination URL');
    });

    it('rejects a nested Safe Links wrapper that uses HTTP', () => {
      const inner = 'http://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com';
      const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

      expect(() => decodeSafeLinksURL(outer))
        .toThrow('Invalid SafeLinks URL provided');
    });

    it('accepts exactly five nested Outlook wrappers', () => {
      let nested = 'https://example.com/docs';

      for (let depth = 0; depth < 5; depth++) {
        nested = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(nested)}`;
      }

      expect(decodeSafeLinksURL(nested)).toBe('https://example.com/docs');
    });

    it('rejects the bare Outlook Safe Links suffix without a regional host', () => {
      expect(() => decodeSafeLinksURL('https://safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com'))
        .toThrow('Invalid SafeLinks URL provided');
    });

    it('rejects nesting deeper than five Outlook wrappers', () => {
      let nested = 'https://example.com/docs';

      for (let depth = 0; depth < 6; depth++) {
        nested = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(nested)}`;
      }

      expect(() => decodeSafeLinksURL(nested))
        .toThrow('maximum of 5 layers');
    });

    it('rejects non-HTTP destination schemes', () => {
      expect(() => decodeSafeLinksURL('https://nam01.safelinks.protection.outlook.com/?url=javascript%3Aalert(1)'))
        .toThrow('must use HTTP or HTTPS');
    });

    it('rejects non-Outlook Safe Links URLs', () => {
      expect(() => decodeSafeLinksURL('https://google.com'))
        .toThrow('Invalid SafeLinks URL provided');
    });
  });
});


describe('decodeSafeLinksBatch', () => {
  it('ignores blank lines, preserves source line numbers, and isolates invalid rows', () => {
    const valid = 'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const invalid = 'https://not-safelinks.example/?url=https%3A%2F%2Fattacker.example';
    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.org%2Fguide';
    const nested = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

    const results = decodeSafeLinksBatch(`  \\n${valid}\\n\\n${invalid}\\n${nested}\\n`);

    expect(results).toHaveLength(3);
    expect(results.map(result => result.line)).toEqual([2, 4, 5]);
    expect(results[0]).toMatchObject({
      input: valid,
      decodedUrl: 'https://example.com/docs',
      error: null,
    });
    expect(results[1]).toMatchObject({
      input: invalid,
      decodedUrl: null,
      error: 'Invalid SafeLinks URL provided',
    });
    expect(results[2]).toMatchObject({
      input: nested,
      decodedUrl: 'https://example.org/guide',
      error: null,
    });
  });

  it('returns no rows for empty or whitespace-only input', () => {
    expect(decodeSafeLinksBatch('')).toEqual([]);
    expect(decodeSafeLinksBatch('  \\n\\n  ')).toEqual([]);
  });
});
