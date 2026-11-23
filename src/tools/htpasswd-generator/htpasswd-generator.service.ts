export interface HtpasswdEntry {
  username: string
  password: string
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
    if (/[\r\n:]/.test(username)) {
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
