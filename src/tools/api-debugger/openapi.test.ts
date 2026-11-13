import { describe, expect, it } from 'vitest';
import { importOpenApi, schemaSkeleton } from './openapi';

const SPEC = {
  openapi: '3.0.3',
  servers: [{ url: 'https://api.x.test/v1/' }],
  paths: {
    '/users/{id}': {
      parameters: [{ name: 'id', in: 'path' }],
      get: {
        operationId: 'getUser',
        parameters: [{ name: 'verbose', in: 'query' }, { name: 'X-Trace', in: 'header' }],
      },
      delete: { summary: 'no operationId' },
    },
    '/pets': {
      post: {
        requestBody: { content: { 'application/json': { example: { name: 'Rex' } } } },
      },
    },
  },
};

describe('importOpenApi (JSON)', () => {
  const r = importOpenApi(JSON.stringify(SPEC));
  it('imports one request per path×method, named by operationId or METHOD path', () => {
    expect(r.source).toBe('json');
    expect(r.requests.map(x => x.name)).toEqual(['getUser', 'DELETE /users/{id}', 'POST /pets']);
  });
  it('builds url from server + path with {{param}} and query placeholder', () => {
    const get = r.requests[0].request;
    expect(get.method).toBe('GET');
    expect(get.url).toBe('https://api.x.test/v1/users/{{id}}?verbose={{verbose}}');
  });
  it('maps header params and keeps Accept', () => {
    const headers = r.requests[0].request.headers;
    expect(headers).toContainEqual({ name: 'X-Trace', value: '{{X-Trace}}' });
    expect(headers).toContainEqual({ name: 'Accept', value: 'application/json' });
  });
  it('uses requestBody example as body', () => {
    expect(JSON.parse(r.requests[2].request.body)).toEqual({ name: 'Rex' });
  });
});

describe('importOpenApi (YAML)', () => {
  it('parses YAML spec equivalently', () => {
    const yaml = 'openapi: 3.0.0\nservers:\n  - url: https://y.test\npaths:\n  /ping:\n    get:\n      operationId: ping\n';
    const r = importOpenApi(yaml);
    expect(r.source).toBe('yaml');
    expect(r.requests[0].name).toBe('ping');
    expect(r.requests[0].request.url).toBe('https://y.test/ping');
  });
});

describe('schemaSkeleton', () => {
  it('builds object/array/scalar skeleton', () => {
    expect(schemaSkeleton({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' }, c: { type: 'array', items: { type: 'boolean' } } } }))
      .toEqual({ a: '', b: 0, c: [false] });
  });
  it('uses enum first value and example', () => {
    expect(schemaSkeleton({ type: 'string', enum: ['x', 'y'] })).toBe('x');
    expect(schemaSkeleton({ example: 42 })).toBe(42);
  });
  it('$ref → undefined (not resolved, paired)', () => {
    expect(schemaSkeleton({ $ref: '#/components/schemas/Pet' })).toBeUndefined();
  });
  it('depth cap prevents runaway recursion', () => {
    const deep = { type: 'object', properties: {} as any };
    deep.properties.self = deep;
    expect(() => schemaSkeleton(deep)).not.toThrow();
  });
});

describe('negative controls (never crash, honest warnings)', () => {
  it('empty input → warning, no requests', () => {
    const r = importOpenApi('   ');
    expect(r.requests).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('invalid JSON/YAML → warning', () => {
    const r = importOpenApi('{not: valid: yaml: [');
    expect(r.requests).toHaveLength(0);
    expect(r.source).toBe('unknown');
  });
  it('Swagger 2.0 → refused with conversion hint', () => {
    const r = importOpenApi(JSON.stringify({ swagger: '2.0', paths: {} }));
    expect(r.requests).toHaveLength(0);
    expect(r.warnings.join(' ')).toContain('Swagger 2.0');
  });
  it('no version → nothing imported', () => {
    const r = importOpenApi(JSON.stringify({ paths: { '/x': { get: {} } } }));
    expect(r.requests).toHaveLength(0);
  });
  it('valid 3.x but empty paths → warning', () => {
    const r = importOpenApi(JSON.stringify({ openapi: '3.0.0', paths: {} }));
    expect(r.requests).toHaveLength(0);
    expect(r.warnings.join(' ')).toContain('No operations');
  });
  it('$ref body → empty body + warning (not silent)', () => {
    const r = importOpenApi(JSON.stringify({
      openapi: '3.0.0',
      paths: { '/p': { post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/x' } } } } } } },
    }));
    expect(r.requests[0].request.body).toBe('');
    expect(r.warnings.join(' ')).toContain('$ref');
  });
  it('missing servers → relative path + warning', () => {
    const r = importOpenApi(JSON.stringify({ openapi: '3.0.0', paths: { '/p': { get: {} } } }));
    expect(r.requests[0].request.url).toBe('/p');
    expect(r.warnings.join(' ')).toContain('servers');
  });
});
