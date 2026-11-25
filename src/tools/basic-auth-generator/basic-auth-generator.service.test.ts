import { describe, expect, it } from 'vitest';
import { buildBasicAuthExamples, decodeBasicAuthHeader, hasBasicAuthControlCharacters } from './basic-auth-generator.service';
import { textToBase64 } from '@/utils/base64';

describe('decodeBasicAuthHeader', () => {
  it('decodes a complete Authorization header', () => {
    expect(decodeBasicAuthHeader('Authorization: Basic ZGVtbzpleGFtcGxl'))
      .toEqual({ username: 'demo', password: 'example' });
  });

  it('decodes a Base64 token without the scheme prefix', () => {
    expect(decodeBasicAuthHeader('ZGVtbzpleGFtcGxl'))
      .toEqual({ username: 'demo', password: 'example' });
  });

  it('preserves additional colons in the password', () => {
    expect(decodeBasicAuthHeader(`Basic ${textToBase64('service:pass:word')}`))
      .toEqual({ username: 'service', password: 'pass:word' });
  });

  it('round-trips UTF-8 credentials', () => {
    expect(decodeBasicAuthHeader(`Basic ${textToBase64('münchen:pässword')}`))
      .toEqual({ username: 'münchen', password: 'pässword' });
  });

  it('rejects decoded credentials containing control characters', () => {
    expect(() => decodeBasicAuthHeader(`Basic ${textToBase64('svc:pass\\r\\nX-Test: injected')}`))
      .toThrow('cannot contain control characters');
  });

  it('detects control characters without rejecting ordinary UTF-8', () => {
    expect(hasBasicAuthControlCharacters('münchen:pässword')).toBe(false);
    expect(hasBasicAuthControlCharacters('svc\\u0001admin')).toBe(true);
  });

  it('rejects malformed Base64', () => {
    expect(() => decodeBasicAuthHeader('Authorization: Basic not-base64'))
      .toThrow('valid Basic Authorization header');
  });

  it('rejects decoded values without a colon separator', () => {
    expect(() => decodeBasicAuthHeader(`Basic ${textToBase64('no-separator')}`))
      .toThrow('username/password separator');
  });
});

describe('buildBasicAuthExamples', () => {
  it('builds cURL, Node.js fetch and Python requests examples for a valid URL', () => {
    const examples = buildBasicAuthExamples('https://api.example.com/v1/users?active=true#client-only');

    expect(examples.url).toBe('https://api.example.com/v1/users?active=true');
    expect(examples.curl).toContain('--user "$BASIC_AUTH_USERNAME:$BASIC_AUTH_PASSWORD"');
    expect(examples.curl).toContain('\'https://api.example.com/v1/users?active=true\'');
    expect(examples.nodeFetch).toContain('Buffer.from(credentials, \'utf8\').toString(\'base64\')');
    expect(examples.nodeFetch).toContain('headers: { Authorization: \'Basic \' + token }');
    expect(examples.pythonRequests).toContain('auth=(');
    expect(examples.pythonRequests).toContain('os.environ["BASIC_AUTH_USERNAME"]');
    expect(examples.pythonRequests).toContain('timeout=30');
  });

  it('safely quotes a URL containing a single quote for a POSIX shell', () => {
    const examples = buildBasicAuthExamples('https://api.example.com/a\'b');
    expect(examples.curl).toContain(String.raw`'https://api.example.com/a'\''b'`);
  });

  it('rejects invalid URLs and non-HTTP schemes', () => {
    expect(() => buildBasicAuthExamples('not a URL')).toThrow('valid absolute HTTP or HTTPS');
    expect(() => buildBasicAuthExamples('javascript:alert(1)')).toThrow('HTTP or HTTPS');
    expect(() => buildBasicAuthExamples('ftp://files.example.com/file')).toThrow('HTTP or HTTPS');
  });

  it('rejects credentials embedded in the request URL', () => {
    expect(() => buildBasicAuthExamples('https://user:secret@example.com/'))
      .toThrow('Do not embed credentials');
  });
});
