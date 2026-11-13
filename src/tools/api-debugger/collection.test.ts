import { describe, expect, it } from 'vitest';
import { POSTMAN_SCHEMA, exportCollection, importCollection } from './collection';
import type { SavedRequest } from './store';

const saved: SavedRequest[] = [
  {
    id: '1',
    name: 'Get user',
    request: {
      method: 'GET',
      url: 'https://api.x.test/v1/users?id=1',
      headers: [{ name: 'Authorization', value: 'Bearer secret' }, { name: 'Accept', value: 'application/json' }],
      body: '',
    },
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('exportCollection', () => {
  it('produces valid Postman v2.1 skeleton', () => {
    const c = exportCollection(saved) as any;
    expect(c.info.schema).toBe(POSTMAN_SCHEMA);
    expect(c.item).toHaveLength(1);
    expect(c.item[0].request.method).toBe('GET');
    expect(c.item[0].request.url.host).toEqual(['api', 'x', 'test']);
    expect(c.item[0].request.url.query).toEqual([{ key: 'id', value: '1' }]);
  });
  it('strips auth headers by default, keeps them when disabled (paired)', () => {
    const stripped = exportCollection(saved) as any;
    expect(stripped.item[0].request.header.map((h: any) => h.key)).toEqual(['Accept']);
    const full = exportCollection(saved, 'C', false) as any;
    expect(full.item[0].request.header.map((h: any) => h.key)).toContain('Authorization');
  });
  it('relative / {{var}} url keeps raw (no crash)', () => {
    const c = exportCollection([{ ...saved[0], request: { ...saved[0].request, url: '/relative/{{id}}' } }]) as any;
    expect(c.item[0].request.url.raw).toBe('/relative/{{id}}');
  });
});

describe('importCollection', () => {
  it('imports url-as-object and url-as-string (paired)', () => {
    const col = JSON.stringify({
      info: { schema: POSTMAN_SCHEMA },
      item: [
        { name: 'A', request: { method: 'post', url: { raw: 'https://x.test/p' }, header: [{ key: 'X-A', value: '1' }], body: { mode: 'raw', raw: '{"k":1}' } } },
        { name: 'B', request: { method: 'GET', url: 'https://x.test/q' } },
      ],
    });
    const r = importCollection(col);
    expect(r.requests).toHaveLength(2);
    expect(r.requests[0].request.method).toBe('POST');
    expect(r.requests[0].request.headers).toEqual([{ name: 'X-A', value: '1' }]);
    expect(r.requests[0].request.body).toBe('{"k":1}');
    expect(r.requests[1].request.url).toBe('https://x.test/q');
  });
  it('flattens nested folders with joined names', () => {
    const col = JSON.stringify({
      item: [{ name: 'Folder', item: [{ name: 'Inner', request: { method: 'GET', url: 'https://x.test/' } }] }],
    });
    const r = importCollection(col);
    expect(r.requests[0].name).toBe('Folder / Inner');
  });
  it('export → import round-trip preserves method/url/headers/body', () => {
    const exported = JSON.stringify(exportCollection(saved, 'C', false));
    const back = importCollection(exported);
    expect(back.requests[0].request.method).toBe('GET');
    expect(back.requests[0].request.url).toBe('https://api.x.test/v1/users?id=1');
    expect(back.requests[0].request.headers).toContainEqual({ name: 'Accept', value: 'application/json' });
  });
});

describe('negative controls', () => {
  it('empty / invalid / non-collection → warnings, no crash', () => {
    expect(importCollection('').requests).toHaveLength(0);
    expect(importCollection('{bad').warnings.length).toBeGreaterThan(0);
    expect(importCollection('{"foo":1}').warnings.join(' ')).toContain('Postman');
    expect(importCollection(JSON.stringify({ item: [] })).warnings.join(' ')).toContain('No requests');
  });
});
