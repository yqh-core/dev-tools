import { compareSync } from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { buildHtpasswdLines, hashHtpasswdPassword } from './htpasswd-generator.service';

describe('hashHtpasswdPassword', () => {
  it('creates an Apache-compatible bcrypt hash with the locked bcryptjs prefix', () => {
    const hash = hashHtpasswdPassword('secret', 'bcrypt', 4);
    expect(hash).toMatch(/^\$2a\$04\$/);
    expect(compareSync('secret', hash)).toBe(true);
    expect(compareSync('wrong', hash)).toBe(false);
  });

  it('matches the published OpenSSL apr1 reference vector', () => {
    expect(hashHtpasswdPassword('myPassword', 'apr1', 10, 'qHDFfhPC'))
      .toBe('$apr1$qHDFfhPC$nITSVHgYbDAK1Y0acGRnY0');
  });

  it('creates the RFC-compatible SHA-1 htpasswd representation and labels it as legacy', () => {
    expect(hashHtpasswdPassword('password', 'sha1'))
      .toBe('{SHA}W6ph5Mm5Pz8GgiULbPgzG37mj9g=');
  });

  it('keeps plain-text output available only as the explicit debug format', () => {
    expect(hashHtpasswdPassword('debug-only', 'plain')).toBe('debug-only');
  });

  it('requires a salt for apr1 instead of silently using a predictable value', () => {
    expect(() => hashHtpasswdPassword('secret', 'apr1')).toThrow('salt is required');
  });
});

describe('buildHtpasswdLines', () => {
  it('serializes multiple users in input order and hashes each password independently', () => {
    const hash = vi.fn((password: string, index: number) => `hash-${index}-${password}`);
    expect(buildHtpasswdLines([
      { username: 'alice', password: 'one' },
      { username: 'bob', password: 'two' },
    ], hash)).toEqual(['alice:hash-0-one', 'bob:hash-1-two']);
    expect(hash).toHaveBeenNthCalledWith(1, 'one', 0);
    expect(hash).toHaveBeenNthCalledWith(2, 'two', 1);
  });

  it('rejects empty usernames, unsafe delimiters and line breaks', () => {
    for (const username of ['', '   ', 'bad:name', 'bad\nname', 'bad\rname']) {
      expect(() => buildHtpasswdLines([{ username, password: 'pw' }], () => 'hash')).toThrow();
    }
  });

  it('rejects duplicate usernames case-insensitively rather than overwriting', () => {
    expect(() => buildHtpasswdLines([
      { username: 'Admin', password: 'one' },
      { username: 'admin', password: 'two' },
    ], () => 'hash')).toThrow('Duplicate username: admin');
  });

  it('rejects empty passwords and empty entry lists', () => {
    expect(() => buildHtpasswdLines([], () => 'hash')).toThrow('Add at least one user');
    expect(() => buildHtpasswdLines([{ username: 'alice', password: '' }], () => 'hash')).toThrow('password is required');
  });
});
