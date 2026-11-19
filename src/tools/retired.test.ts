import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RETIRED_REDIRECTS } from './retired';
import { tools } from './index';

describe('retired tools', () => {
  const live = new Set(tools.map(tool => tool.path));
  const redirects = readFileSync(resolve(__dirname, '../../public/_redirects'), 'utf8');

  it('points each retired path at a tool that is still registered', () => {
    expect(Object.keys(RETIRED_REDIRECTS).length).toBeGreaterThan(10);
    for (const [from, to] of Object.entries(RETIRED_REDIRECTS)) {
      expect(live.has(from), from).toBe(false);
      const target = to.replace(/\/$/, '');
      expect(live.has(target), `${from} -> ${to}`).toBe(true);
    }
  });

  it('has a 301 for the tool and its guide, with and without a trailing slash', () => {
    for (const [from, to] of Object.entries(RETIRED_REDIRECTS)) {
      expect(redirects).toContain(`${from}    ${to}    301`);
      expect(redirects).toContain(`${from}/    ${to}    301`);
      expect(redirects).toContain(`/guides${from}    ${to}    301`);
      expect(redirects).toContain(`/guides${from}/    ${to}    301`);
    }
  });
});
