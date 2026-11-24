export const MIN_ULA_BATCH_COUNT = 1;
export const MAX_ULA_BATCH_COUNT = 20;
export const ULA_GLOBAL_ID_HEX_LENGTH = 10;
export const ULA_SUBNETS_PER_PREFIX = 65_536;

export interface UlaPrefix {
  globalId: string
  prefix: string
  firstSubnet: string
  lastSubnet: string
  subnetCount: number
}

export type RandomBytesSource = () => Uint8Array;

function secureRandomBytes(): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure browser randomness is unavailable.');
  }

  return globalThis.crypto.getRandomValues(new Uint8Array(5));
}

export function normalizeUlaGlobalId(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '');
  if (!new RegExp(`^[0-9a-fA-F]{${ULA_GLOBAL_ID_HEX_LENGTH}}export const MIN_ULA_BATCH_COUNT = 1;
export const MAX_ULA_BATCH_COUNT = 20;
export const ULA_GLOBAL_ID_HEX_LENGTH = 10;
export const ULA_SUBNETS_PER_PREFIX = 65_536;

export interface UlaPrefix {
  globalId: string
  prefix: string
  firstSubnet: string
  lastSubnet: string
  subnetCount: number
}

export type RandomBytesSource = () => Uint8Array;

function secureRandomBytes(): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure browser randomness is unavailable.');
  }

  return globalThis.crypto.getRandomValues(new Uint8Array(5));
}

export function normalizeUlaGlobalId(value: string): string {
  const normalized = value.trim().replace(/^0x/i, '');
  ).test(normalized)) {
    throw new Error('Enter exactly 10 hexadecimal characters (40 bits).');
  }

  return normalized.toLowerCase();
}

export function createUlaPrefix(value: string): UlaPrefix {
  const globalId = normalizeUlaGlobalId(value);
  const networkPrefix = `fd${globalId.slice(0, 2)}:${globalId.slice(2, 6)}:${globalId.slice(6, 10)}`;

  return {
    globalId,
    prefix: `${networkPrefix}::/48`,
    firstSubnet: `${networkPrefix}:0::/64`,
    lastSubnet: `${networkPrefix}:ffff::/64`,
    subnetCount: ULA_SUBNETS_PER_PREFIX,
  };
}

export function generateRandomUlaPrefixes(
  count: number,
  getRandomBytes: RandomBytesSource = secureRandomBytes,
): UlaPrefix[] {
  if (!Number.isInteger(count) || count < MIN_ULA_BATCH_COUNT || count > MAX_ULA_BATCH_COUNT) {
    throw new Error(`Choose between ${MIN_ULA_BATCH_COUNT} and ${MAX_ULA_BATCH_COUNT} prefixes.`);
  }

  const results: UlaPrefix[] = [];
  const seen = new Set<string>();
  const maxAttempts = count * 100;
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    attempts += 1;
    const bytes = getRandomBytes();
    if (!(bytes instanceof Uint8Array) || bytes.length !== 5) {
      throw new Error('The random source must return exactly five bytes.');
    }

    const globalId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    if (!seen.has(globalId)) {
      seen.add(globalId);
      results.push(createUlaPrefix(globalId));
    }
  }

  if (results.length !== count) {
    throw new Error('Could not generate a unique batch. Try again.');
  }

  return results;
}
