import { describe, expect, it, vi } from 'vitest';
import { buildHtpasswdLines } from './htpasswd-generator.service';

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
