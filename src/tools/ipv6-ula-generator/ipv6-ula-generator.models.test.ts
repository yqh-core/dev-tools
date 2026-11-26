import { describe, expect, it } from 'vitest';
import {
  MAX_ULA_BATCH_COUNT,
  MIN_ULA_BATCH_COUNT,
  ULA_SUBNETS_PER_PREFIX,
  createUlaPrefix,
  generateRandomUlaPrefixes,
  normalizeUlaGlobalId,
} from './ipv6-ula-generator.models';

describe('IPv6 ULA generator models', () => {
  describe('normalizeUlaGlobalId', () => {
    it('accepts exactly 40 bits and normalizes case and optional 0x prefix', () => {
      expect(normalizeUlaGlobalId('ABCDEF0123')).toBe('abcdef0123');
      expect(normalizeUlaGlobalId('0xABCDEF0123')).toBe('abcdef0123');
    });

    it.each(['', 'abcdef012', 'abcdef01234', 'zzzzzzzzzz', '1234:5678:90'])(
      'rejects invalid Global ID %s',
      (value) => {
        expect(() => normalizeUlaGlobalId(value)).toThrow(/10 hexadecimal characters/);
      },
    );
  });

  describe('createUlaPrefix', () => {
    it('builds the locally assigned fd00::/8 /48 and first/last /64 subnets', () => {
      expect(createUlaPrefix('0123456789')).toEqual({
        globalId: '0123456789',
        prefix: 'fd01:2345:6789::/48',
        firstSubnet: 'fd01:2345:6789:0::/64',
        lastSubnet: 'fd01:2345:6789:ffff::/64',
        subnetCount: ULA_SUBNETS_PER_PREFIX,
      });
    });

    it('supports the lowest and highest 40-bit identifiers', () => {
      expect(createUlaPrefix('0000000000').prefix).toBe('fd00:0000:0000::/48');
      expect(createUlaPrefix('ffffffffff').prefix).toBe('fdff:ffff:ffff::/48');
    });
  });

  describe('generateRandomUlaPrefixes', () => {
    it('generates deterministic test vectors from an injected five-byte source', () => {
      const values = [
        new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89]),
        new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD, 0xEE]),
      ];
      const source = () => values.shift()!;

      expect(generateRandomUlaPrefixes(2, source).map(item => item.prefix)).toEqual([
        'fd01:2345:6789::/48',
        'fdaa:bbcc:ddee::/48',
      ]);
    });

    it('retries duplicates inside a batch so every returned prefix is unique', () => {
      const values = [
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array([1, 2, 3, 4, 5]),
        new Uint8Array([6, 7, 8, 9, 10]),
      ];
      const result = generateRandomUlaPrefixes(2, () => values.shift()!);
      expect(new Set(result.map(item => item.globalId)).size).toBe(2);
    });

    it('rejects a count outside the supported range', () => {
      expect(() => generateRandomUlaPrefixes(0, () => new Uint8Array(5))).toThrow();
      expect(() => generateRandomUlaPrefixes(MAX_ULA_BATCH_COUNT + 1, () => new Uint8Array(5))).toThrow();
      expect(() => generateRandomUlaPrefixes(1.5, () => new Uint8Array(5))).toThrow();
      expect(MIN_ULA_BATCH_COUNT).toBe(1);
    });

    it('rejects a random source that does not return five bytes', () => {
      expect(() => generateRandomUlaPrefixes(1, () => new Uint8Array(4))).toThrow(/exactly five bytes/);
    });

    it('stops rather than looping forever if the random source repeatedly collides', () => {
      expect(() => generateRandomUlaPrefixes(2, () => new Uint8Array([1, 2, 3, 4, 5])))
        .toThrow(/unique batch/);
    });
  });
});
