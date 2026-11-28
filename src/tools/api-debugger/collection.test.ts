import { describe, expect, it } from 'vitest';
import { POSTMAN_SCHEMA, exportCollection, exportCollectionTree, importCollection, importCollectionTree } from './collection';
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
  it('imports and exports per-request Bearer, Basic and API Key profiles; safe export omits auth', () => {
    const request = {
      method: 'GET',
      url: 'https://api.x.test/v1',
      headers: [],
      body: '',
      auth: { type: 'api-key-query' as const, key: 'client_key', value: '{{CLIENT_KEY}}' },
    };
    const source = [{ ...saved[0], request }];
    const full = exportCollection(source, 'Auth collection', false) as any;
    expect(full.item[0].request.auth.type).toBe('apikey');
    expect(full.item[0].request.auth.apikey).toContainEqual({ key: 'in', value: 'query', type: 'string' });
    const imported = importCollection(JSON.stringify(full));
    expect(imported.requests[0].request.auth).toEqual(request.auth);
    const safe = exportCollection(source, 'Auth collection', true) as any;
    expect(safe.item[0].request.auth).toBeUndefined();
    expect(JSON.stringify(safe)).not.toContain('CLIENT_KEY');
  });
  it('round-trips all supported Postman auth variants', () => {
    const profiles = [
      { type: 'bearer' as const, token: '{{ACCESS_TOKEN}}' },
      { type: 'basic' as const, username: '{{BASIC_USER}}', password: '{{BASIC_PASS}}' },
      { type: 'api-key-header' as const, key: 'X-Client-Key', value: '{{CLIENT_KEY}}' },
      { type: 'api-key-query' as const, key: 'client_key', value: '{{CLIENT_KEY}}' },
    ];
    for (const auth of profiles) {
      const request = { ...saved[0].request, auth };
      const source = [{ ...saved[0], request }];
      const full = exportCollection(source, 'Auth profiles', false);
      const imported = importCollection(JSON.stringify(full));
      expect(imported.requests[0].request.auth).toEqual(auth);
    }
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
  // 终审 P1-06：未知/不支持条目不静默跳过——全部进 warning 列表（矩阵判据见 IMPORT_FIELD_MATRIX.md）
  it('P1-06 非对象条目/无 request 无 item 条目/未知 listen/非 raw body/请求级 auth → warnings', () => {
    const col = JSON.stringify({
      item: [
        null,
        { name: 'Ghost', description: 'no request no folder' },
        { name: 'W', event: [{ listen: 'unknownListen', script: { exec: ['pm.test("t",()=>{});'] } }], request: { method: 'GET', url: 'https://x.test/w' } },
        { name: 'F', request: { method: 'GET', url: 'https://x.test/f', body: { mode: 'formdata', urlencoded: [] }, auth: { type: 'bearer' } } },
      ],
    });
    const r = importCollection(col);
    const w = r.warnings.join(' ');
    expect(r.requests.map(q => q.name)).toEqual(['W', 'F']); // 两个坏条目不进请求面
    expect(w).toContain('Non-object entry');
    expect(w).toContain('neither a folder');
    expect(w).toContain('listen "unknownListen"');
    expect(w).toContain('body mode "formdata"');
    expect(w).toContain('declares auth');
  });
  it('P1-06 集合级未知 listen 也进 warning', () => {
    const col = JSON.stringify({ event: [{ listen: 'prerequest' }, { listen: 'other', script: { exec: ['1;'] } }], item: [{ name: 'A', request: { method: 'GET', url: 'https://x.test/' } }] });
    const w = importCollection(col).warnings.join(' ');
    expect(w).toContain('Collection event listen "other"');
  });
});
