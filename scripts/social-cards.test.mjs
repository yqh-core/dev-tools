import { describe, expect, it } from 'vitest';
import {
  createSocialCardPng,
  socialImagePath,
  socialImageSlug,
} from './social-cards.mjs';

describe('route-specific Open Graph cards', () => {
  it('maps canonical routes to safe, unique image paths', () => {
    expect(socialImageSlug('/')).toBe('home');
    expect(socialImagePath('/')).toBe('/og/home.png');
    expect(socialImagePath('/ipv6-ula-generator/')).toBe('/og/ipv6-ula-generator.png');
    expect(socialImagePath('/eta-calculator/')).toBe('/og/eta-calculator.png');
    expect(socialImagePath('/guides/eta-calculator/')).toBe('/og/guides--eta-calculator.png');
    expect(socialImagePath('/eta-calculator/')).not.toBe(socialImagePath('/guides/eta-calculator/'));
    expect(new Set([
      socialImagePath('/'),
      socialImagePath('/eta-calculator/'),
      socialImagePath('/guides/eta-calculator/'),
    ]).size).toBe(3);
  });

  it('creates valid 1200x630 PNG data', () => {
    const png = createSocialCardPng({
      title: 'Text Statistics — Word & Character Counter',
      description: 'Inspect top term frequency and estimate reading and speaking time locally.',
      path: '/text-statistics/',
      kind: 'tool',
    });

    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(png.length).toBeGreaterThan(1000);
    expect(png.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('creates distinct content for different routes rather than reusing one generic logo', () => {
    const first = createSocialCardPng({
      title: 'IPv6 ULA Generator',
      description: 'Generate secure random or manual private IPv6 prefixes.',
      path: '/ipv6-ula-generator/',
      kind: 'tool',
    });
    const second = createSocialCardPng({
      title: 'Text Statistics',
      description: 'Count words, inspect term frequency and estimate speaking time.',
      path: '/text-statistics/',
      kind: 'tool',
    });

    expect(first.equals(second)).toBe(false);
  });
});
