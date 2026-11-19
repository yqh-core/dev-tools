import { describe, expect, it } from 'vitest';
import { applySearchParam, readSearchParam } from './home-search';

describe('home search query', () => {
  it('reads a string q and ignores other shapes', () => {
    expect(readSearchParam({ q: 'jwt' })).toBe('jwt');
    expect(readSearchParam({ q: ['json', 'yaml'] })).toBe('json');
    expect(readSearchParam({})).toBe('');
    expect(readSearchParam({ q: 1 })).toBe('');
  });

  it('writes a trimmed q and drops it when empty', () => {
    expect(applySearchParam({ utm: 'x' }, '  format json  ')).toEqual({ utm: 'x', q: 'format json' });
    expect(applySearchParam({ q: 'old', utm: 'x' }, '   ')).toEqual({ utm: 'x' });
  });
});
