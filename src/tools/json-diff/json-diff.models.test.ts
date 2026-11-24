import { describe, expect, it } from 'vitest';
import { diff, flattenDifferences, hasValidArrayIds, parseIgnorePaths } from './json-diff.models';

describe('json-diff models', () => {
  describe('diff', () => {
    it('list object differences', () => {
      const obj = { a: 1, b: 2 };
      const newObj = { a: 1, b: 2, c: 3 };
      const result = diff(obj, newObj);

      expect(result).toEqual({
        key: '',
        type: 'object',
        children: [
          {
            key: 'a',
            type: 'value',
            value: 1,
            oldValue: 1,
            status: 'unchanged',
          },
          {
            key: 'b',
            type: 'value',
            value: 2,
            oldValue: 2,
            status: 'unchanged',
          },
          {
            key: 'c',
            type: 'value',
            value: 3,
            oldValue: undefined,
            status: 'added',
          },
        ],
        oldValue: { a: 1, b: 2 },
        value: { a: 1, b: 2, c: 3 },
        status: 'children-updated',
      });
    });

    it('list array differences', () => {
      const obj = [1, 2];
      const newObj = [1, 2, 3];
      const result = diff(obj, newObj);

      expect(result).toEqual({
        key: '',
        type: 'array',
        children: [
          {
            key: 0,
            type: 'value',
            value: 1,
            oldValue: 1,
            status: 'unchanged',
          },
          {
            key: 1,
            type: 'value',
            value: 2,
            oldValue: 2,
            status: 'unchanged',
          },
          {
            key: 2,
            type: 'value',
            value: 3,
            oldValue: undefined,
            status: 'added',
          },
        ],
        oldValue: [1, 2],
        value: [1, 2, 3],
        status: 'children-updated',
      });
    });
  });

  it('flattens nested changes into JSON path rows', () => {
    const result = flattenDifferences(diff(
      { user: { name: 'Ada', role: 'admin' } },
      { user: { name: 'Grace', role: 'admin', active: true } },
      { onlyShowDifferences: true },
    ));

    expect(result.map(item => item.path)).toEqual(['$[\"user\"][\"name\"]', '$[\"user\"][\"active\"]']);
    expect(result.map(item => item.status)).toEqual(['updated', 'added']);
  });
  describe('JSON Pointer ignore paths', () => {
    it('parses exact JSON Pointer paths and removes duplicates', () => {
      expect(parseIgnorePaths('/meta/requestId\n/meta/requestId\n/items/0/updatedAt')).toEqual({
        paths: ['/meta/requestId', '/items/0/updatedAt'],
      });
    });

    it('requires a leading slash and valid RFC 6901 escapes', () => {
      expect(parseIgnorePaths('meta/requestId').error).toContain('must start with /');
      expect(parseIgnorePaths('/meta/~2key').error).toContain('escape ~ as ~0');
      expect(parseIgnorePaths('/meta/~').error).toContain('escape ~ as ~0');
    });

    it('enforces the 100-path and 8 KB limits', () => {
      expect(parseIgnorePaths(Array.from({ length: 101 }, (_, index) => '/field' + index).join('\n')).error)
        .toContain('no more than 100');
      expect(parseIgnorePaths('/' + 'a'.repeat(8192)).error)
        .toContain('8192 characters or fewer');
    });

    it('ignores an exact nested subtree while preserving sibling differences', () => {
      const changes = flattenDifferences(diff(
        { meta: { requestId: 'old', status: 200 }, user: { name: 'Ada' } },
        { meta: { requestId: 'new', status: 500 }, user: { name: 'Grace' } },
        { onlyShowDifferences: true, ignorePaths: ['/meta/requestId'] },
      ));
      expect(changes.map(item => item.path)).toEqual(['$["meta"]["status"]', '$["user"]["name"]']);
    });

    it('escapes slash and tilde in object keys and matches numeric array positions', () => {
      const changes = flattenDifferences(diff(
        { 'a/b~c': { items: [{ updatedAt: 'old', value: 1 }] } },
        { 'a/b~c': { items: [{ updatedAt: 'new', value: 2 }] } },
        { onlyShowDifferences: true, ignorePaths: ['/a~1b~0c/items/0/updatedAt'] },
      ));
      expect(changes.map(item => item.path)).toEqual(['$["a/b~c"]["items"][0]["value"]']);
    });
  });

  describe('array comparison modes', () => {
    it('ignores order while preserving duplicate multiplicity', () => {
      const reordered = flattenDifferences(diff(
        [1, 2, 1],
        [1, 1, 2],
        { onlyShowDifferences: true, arrayMode: 'ignore-order' },
      ));
      expect(reordered).toEqual([]);

      const duplicates = flattenDifferences(diff(
        [1, 1, 2],
        [1, 2, 2],
        { onlyShowDifferences: true, arrayMode: 'ignore-order' },
      ));
      expect(duplicates).toHaveLength(2);
      expect(duplicates.map(item => item.status).sort()).toEqual(['added', 'removed']);
    });

    it('ignores order in nested arrays as well as top-level arrays', () => {
      const result = flattenDifferences(diff(
        [{ id: 1, tags: ['a', 'b'] }],
        [{ id: 1, tags: ['b', 'a'] }],
        { onlyShowDifferences: true, arrayMode: 'ignore-order' },
      ));
      expect(result).toEqual([]);
    });

    it('ignores selected nested fields when matching reordered arrays by value', () => {
      const changes = flattenDifferences(diff(
        { items: [{ id: 1, updatedAt: 'old', name: 'Ada' }, { id: 2, name: 'Grace' }] },
        { items: [{ id: 2, name: 'Grace' }, { id: 1, updatedAt: 'new', name: 'Ada' }] },
        { onlyShowDifferences: true, arrayMode: 'ignore-order', ignorePaths: ['/items/0/updatedAt'] },
      ));
      expect(changes).toEqual([]);
    });

    it('matches objects by a stable ID rather than array position', () => {
      const changes = flattenDifferences(diff(
        [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }],
        [{ id: 2, name: 'Grace Hopper' }, { id: 1, name: 'Ada' }],
        { onlyShowDifferences: true, arrayMode: 'id', arrayIdKey: 'id' },
      ));
      expect(changes).toEqual([{
        path: '$[1]["name"]',
        status: 'updated',
        oldValue: 'Grace',
        value: 'Grace Hopper',
      }]);
    });

    it('falls back to index mode when IDs are missing or duplicated', () => {
      expect(hasValidArrayIds(
        [{ id: 1 }, { id: 1 }],
        [{ id: 1 }],
        'id',
      )).toBe(false);
      expect(hasValidArrayIds(
        [{ name: 'Ada' }],
        [{ id: 1 }],
        'id',
      )).toBe(false);
      const fallback = flattenDifferences(diff(
        [{ id: 1, name: 'Ada' }, { id: 1, name: 'Grace' }],
        [{ id: 1, name: 'Grace' }, { id: 1, name: 'Ada' }],
        { onlyShowDifferences: true, arrayMode: 'id', arrayIdKey: 'id' },
      ));
      expect(fallback.length).toBeGreaterThan(0);
    });
  });
});
