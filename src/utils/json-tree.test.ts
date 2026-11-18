import { describe, expect, it } from 'vitest';
import { buildJsonTree, countJsonNodes } from './json-tree';

describe('buildJsonTree', () => {
  it('keeps object keys, array indexes and primitive previews', () => {
    const tree = buildJsonTree({
      hello: 'world',
      n: 1,
      ok: false,
      empty: null,
      list: ['a'],
    });

    expect(tree.kind).toBe('object');
    expect(tree.preview).toBe('{5}');
    expect(tree.children.map(child => child.key)).toEqual(['hello', 'n', 'ok', 'empty', 'list']);
    expect(tree.children[0]).toMatchObject({ kind: 'string', preview: '"world"' });
    expect(tree.children[4].children[0]).toMatchObject({ key: '0', kind: 'string', preview: '"a"' });
    expect(countJsonNodes(tree)).toBe(7);
  });
});
