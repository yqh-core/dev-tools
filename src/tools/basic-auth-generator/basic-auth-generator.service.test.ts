import { describe, expect, it } from 'vitest';
import { decodeBasicAuthHeader } from './basic-auth-generator.service';
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

  it('rejects malformed Base64', () => {
    expect(() => decodeBasicAuthHeader('Authorization: Basic not-base64'))
      .toThrow('valid Basic Authorization header');
  });

  it('rejects decoded values without a colon separator', () => {
    expect(() => decodeBasicAuthHeader(`Basic ${textToBase64('no-separator')}`))
      .toThrow('username/password separator');
  });
});
