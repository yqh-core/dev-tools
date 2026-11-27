import { describe, expect, it } from 'vitest';
import { JwtDecodeError, decodeJwt } from './jwt-parser.service';

const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('JWT decode-only contract', () => {
  it('decodes the JOSE Header and Claims Payload and preserves the signature segment unchanged', () => {
    const result = decodeJwt({ jwt: validToken });

    expect(result.header.map(item => item.claim)).toContain('alg');
    expect(result.payload.map(item => item.claim)).toContain('sub');
    expect(result.signatureSegment).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('accepts an empty third segment without treating it as a verified signature', () => {
    const [header, payload] = validToken.split('.');
    const result = decodeJwt({ jwt: `${header}.${payload}.` });

    expect(result.signatureSegment).toBe('');
    expect(result.header.map(item => item.claim)).toContain('alg');
  });

  it.each([
    ['', 'empty'],
    ['token', 'segments'],
    ['one.two', 'segments'],
    ['one.two.three.four', 'segments'],
    [` ${validToken}`, 'whitespace'],
    [`${validToken}\n`, 'whitespace'],
    [`${validToken}=`, 'base64url'],
  ] as const)('rejects malformed compact input (%s)', (jwt, code) => {
    try {
      decodeJwt({ jwt });
      throw new Error('Expected decodeJwt to reject the input');
    }
    catch (error) {
      expect(error).toBeInstanceOf(JwtDecodeError);
      expect((error as JwtDecodeError).code).toBe(code);
    }
  });

  it('reports invalid Base64URL JSON as a decode error', () => {
    try {
      decodeJwt({ jwt: 'bm90LWpzb24.eyJzdWIiOiIxMjMifQ.signature' });
      throw new Error('Expected decodeJwt to reject invalid JSON');
    }
    catch (error) {
      expect(error).toBeInstanceOf(JwtDecodeError);
      expect((error as JwtDecodeError).code).toBe('decode');
    }
  });
});
