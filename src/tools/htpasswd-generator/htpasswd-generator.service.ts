import { hashSync } from 'bcryptjs';
import CryptoJS from 'crypto-js';
import { apr1 } from './apr1';

export interface HtpasswdEntry {
  username: string
  password: string
}

export type HtpasswdFormat = 'bcrypt' | 'apr1' | 'sha1' | 'plain';

/** Produce one format-specific value; all work remains in the browser. */
export function hashHtpasswdPassword(
  password: string,
  format: HtpasswdFormat,
  cost = 10,
  salt = '',
): string {
  if (format === 'bcrypt') {
    // bcryptjs 2.4.3 emits the $2a$ prefix; Apache httpd 2.4 accepts it.
    return hashSync(password, cost);
  }
  if (format === 'apr1') {
    if (!salt) {
      throw new Error('A random or explicit apr1 salt is required');
    }
    return apr1(password, salt);
  }
  if (format === 'sha1') {
    return `{SHA}${CryptoJS.SHA1(password).toString(CryptoJS.enc.Base64)}`;
  }
  return password;
}

/** Validate and serialize a set of local .htpasswd entries. Hashing stays in the caller/browser. */
export function buildHtpasswdLines(
  entries: HtpasswdEntry[],
  hashPassword: (password: string, index: number) => string,
): string[] {
  if (!entries.length) {
    throw new Error('Add at least one user');
  }

  const seen = new Set<string>();
  return entries.map((entry, index) => {
    const username = entry.username.trim();
    if (!username) {
      throw new Error(`User ${index + 1}: username is required`);
    }
    if (/[\\r\\n:]/.test(username)) {
      throw new Error(`User ${index + 1}: username cannot contain colons or line breaks`);
    }

    const key = username.toLocaleLowerCase('en-US');
    if (seen.has(key)) {
      throw new Error(`Duplicate username: ${username}`);
    }
    seen.add(key);
    if (!entry.password) {
      throw new Error(`User ${index + 1}: password is required`);
    }

    return `${username}:${hashPassword(entry.password, index)}`;
  });
}
