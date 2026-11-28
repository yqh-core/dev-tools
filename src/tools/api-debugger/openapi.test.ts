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

describe('importOpenApi server selection and unsupported constructs', () => {
  const multiServerSpec = JSON.stringify({
    openapi: '3.1.0',
    servers: [
      { url: 'https://api.example.test/v1' },
      { url: 'https://staging.example.test/v1' },
    ],
    paths: {
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          parameters: [
            { name: 'id', in: 'path' },
            { name: 'verbose', in: 'query' },
          ],
        },
      },
    },
  });

  it('exposes declared servers and builds URLs from an explicitly selected server', () => {
    const initial = importOpenApi(multiServerSpec);
    const staging = importOpenApi(multiServerSpec, { serverUrl: 'https://staging.example.test/v1' });
    expect(initial.servers).toEqual([
      'https://api.example.test/v1',
      'https://staging.example.test/v1',
    ]);
    expect(initial.requests[0].request.url).toBe('https://api.example.test/v1/users/{{id}}?verbose={{verbose}}');
    expect(staging.requests[0].request.url).toBe('https://staging.example.test/v1/users/{{id}}?verbose={{verbose}}');
  });

  it('does not silently accept a server URL absent from the spec', () => {
    const parsed = importOpenApi(multiServerSpec, { serverUrl: 'https://untrusted.example.test' });
    expect(parsed.requests[0].request.url).toContain('https://api.example.test/v1/');
    expect(parsed.warnings.join(' ')).toContain('not declared by this spec');
  });

  it('converts server variables into environment placeholders with a warning', () => {
    const parsed = importOpenApi(JSON.stringify({
      openapi: '3.0.3',
      servers: [{ url: 'https://{region}.example.test/{basePath}' }],
      paths: { '/ping': { get: {} } },
    }));
    expect(parsed.requests[0].request.url).toBe('https://{{region}}.example.test/{{basePath}}/ping');
    expect(parsed.warnings.join(' ')).toContain('Server URL variables');
  });

  it('warns when security schemes or non-JSON request bodies are not imported', () => {
    const parsed = importOpenApi(JSON.stringify({
      openapi: '3.0.3',
      security: [{ bearerAuth: [] }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
      paths: {
        '/upload': {
          post: {
            requestBody: { content: { 'multipart/form-data': { schema: { type: 'object' } } } },
          },
        },
      },
    }));
    expect(parsed.warnings.join(' ')).toContain('security schemes are not imported');
    expect(parsed.warnings.join(' ')).toContain('media types other than application/json');
  });

  it('warns for path-level and operation-level servers rather than silently claiming support', () => {
    const parsed = importOpenApi(JSON.stringify({
      openapi: '3.0.3',
      servers: [{ url: 'https://api.example.test' }],
      paths: {
        '/special': {
          servers: [{ url: 'https://other.example.test' }],
          get: { servers: [{ url: 'https://operation.example.test' }] },
        },
      },
    }));
    expect(parsed.warnings.join(' ')).toContain('Path-level or operation-level servers');
    expect(parsed.requests[0].request.url).toBe('https://api.example.test/special');
  });
});

describe('importOpenApi reference limits', () => {
  it('warns when path items and request bodies contain unresolved refs', () => {
    const parsed = importOpenApi(JSON.stringify({
      openapi: '3.0.3',
      paths: {
        '/referenced-path': {
          $ref: '#/components/pathItems/Shared',
        },
        '/referenced-body': {
          post: {
            requestBody: { $ref: '#/components/requestBodies/Shared' },
          },
        },
      },
    }));
    expect(parsed.warnings.join(' ')).toContain('OpenAPI $ref pointers were not resolved');
    expect(parsed.requests).toHaveLength(1);
    expect(parsed.requests[0].request.body).toBe('');
  });
});
