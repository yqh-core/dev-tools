import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUT, OP_IDS, defaultPipeline, makeNode, outputExtension, outputLanguage, runOp } from './pipeline';

describe('pipeline runOp', () => {
  it('formats with indent and optional sort', () => {
    const sorted = runOp('format', '{"b":2,"a":1}', { indent: 2, sort: true });
    expect(sorted).toEqual({ ok: true, output: '{\n  "a": 1,\n  "b": 2\n}' });
    const unsorted = runOp('format', '{"b":2,"a":1}', {});
    expect(unsorted).toEqual({ ok: true, output: '{\n  "b": 2,\n  "a": 1\n}' });
  });

  it('minifies', () => {
    expect(runOp('minify', '{ "a": 1 }', {})).toEqual({ ok: true, output: '{"a":1}' });
  });

  it('tree is a pass-through view of normalized JSON', () => {
    const r = runOp('tree', '{"a":[1,2]}', {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.output)).toEqual({ a: [1, 2] });
    }
  });

  it('queries with JSONPath and returns matches array', () => {
    const r = runOp('query', DEFAULT_INPUT, { query: '$.store.book[*].title' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.output)).toEqual(['Sayings of the Century', 'Moby Dick']);
    }
  });

  it('query: unsupported filter fails loudly (negative control)', () => {
    const r = runOp('query', DEFAULT_INPUT, { query: '$.store.book[?(@.price>1)]' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.length).toBeGreaterThan(0);
    }
  });

  it('transforms to YAML / CSV / XML / TOML', () => {
    expect(runOp('transform', '{"a":1}', { target: 'yaml' })).toEqual({ ok: true, output: 'a: 1\n' });
    const csv = runOp('transform', '[{"a":1,"b":"x,y"}]', { target: 'csv' });
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(csv.output).toContain('a,b');
      expect(csv.output).toContain('"x,y"');
    }
    const xml = runOp('transform', '{"root":{"a":"1"}}', { target: 'xml' });
    expect(xml.ok).toBe(true);
    if (xml.ok) {
      expect(xml.output).toContain('<root>');
      expect(xml.output).toContain('<a>1</a>');
    }
    const toml = runOp('transform', '{"title":"x","n":1}', { target: 'toml' });
    expect(toml.ok).toBe(true);
    if (toml.ok) {
      expect(toml.output).toContain('title = "x"');
    }
  });

  it('transform: CSV rejects non-array, TOML rejects array (negative control)', () => {
    expect(runOp('transform', '{"a":1}', { target: 'csv' }).ok).toBe(false);
    expect(runOp('transform', '[1,2]', { target: 'toml' }).ok).toBe(false);
    expect(runOp('transform', '42', { target: 'xml' }).ok).toBe(false);
  });

  it('infers draft-07 schema', () => {
    const r = runOp('schema', '{"a":1}', {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = JSON.parse(r.output);
      expect(doc.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(doc.properties.a.type).toBe('integer');
    }
  });

  it('generates TypeScript and Go types (reuses json-to-code core)', () => {
    const ts = runOp('types', '[{"id":1,"name":"x"}]', { lang: 'ts', rootName: 'User' });
    expect(ts.ok).toBe(true);
    if (ts.ok) {
      expect(ts.output).toContain('export interface User');
      expect(ts.output).toContain('id: number');
    }
    const go = runOp('types', '[{"id":1}]', { lang: 'go', rootName: 'User' });
    expect(go.ok).toBe(true);
    if (go.ok) {
      expect(go.output).toContain('type User struct');
      expect(go.output).toContain('json:"id"');
    }
  });

  it('types: scalar top level fails (negative control)', () => {
    expect(runOp('types', '42', {}).ok).toBe(false);
  });

  it('diff reports added / removed / updated paths', () => {
    const r = runOp('diff', '{"a":1,"b":2}', { other: '{"a":1,"b":3,"c":4}' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output).toContain('~ $.b: 2 -> 3');
      expect(r.output).toContain('+ $.c: 4');
    }
    const removed = runOp('diff', '{"a":1,"b":2}', { other: '{"a":1}' });
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.output).toContain('- $.b: 2');
    }
  });

  it('diff: identical inputs and missing second input', () => {
    const same = runOp('diff', '{"a":1}', { other: '{"a":1}' });
    expect(same).toEqual({ ok: true, output: 'No differences.' });
    expect(runOp('diff', '{"a":1}', {}).ok).toBe(false);
  });

  it('parses YAML / CSV / XML / TOML / env to JSON', () => {
    const yaml = runOp('parse', 'a: 1\nb:\n  - x\n', { source: 'yaml' });
    expect(yaml.ok).toBe(true);
    if (yaml.ok) {
      expect(JSON.parse(yaml.output)).toEqual({ a: 1, b: ['x'] });
    }
    const csv = runOp('parse', 'a,b\n1,2\n', { source: 'csv' });
    expect(csv.ok).toBe(true);
    if (csv.ok) {
      expect(JSON.parse(csv.output)).toEqual([{ a: '1', b: '2' }]);
    }
    const xml = runOp('parse', '<r><a>1</a></r>', { source: 'xml' });
    expect(xml.ok).toBe(true);
    if (xml.ok) {
      expect(JSON.parse(xml.output)).toHaveProperty('r');
    }
    const toml = runOp('parse', 'a = 1\n', { source: 'toml' });
    expect(toml.ok).toBe(true);
    if (toml.ok) {
      expect(JSON.parse(toml.output)).toEqual({ a: 1 });
    }
    const env = runOp('parse', 'A=1\n# comment\nexport B="two"\n', { source: 'env' });
    expect(env.ok).toBe(true);
    if (env.ok) {
      expect(JSON.parse(env.output)).toEqual({ A: '1', B: 'two' });
    }
  });

  it('parse: invalid env line reports line number (negative control)', () => {
    const r = runOp('parse', 'A=1\nbad line\n', { source: 'env' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('line 2');
    }
  });

  it('error isolation: every op returns ok:false on garbage, never throws', () => {
    for (const op of OP_IDS) {
      const r = runOp(op, '{{{not json', { other: '{{{', source: 'yaml', target: 'csv' });
      expect(r.ok, `op ${op} must fail on garbage`).toBe(false);
    }
  });

  it('empty input fails explicitly for every op', () => {
    for (const op of OP_IDS) {
      const r = runOp(op, '   ', {});
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error).toContain('Empty input');
      }
    }
  });

  it('node helpers: defaults, override semantics, extensions', () => {
    const def = defaultPipeline();
    expect(def).toHaveLength(1);
    expect(def[0].op).toBe('format');
    expect(def[0].inputOverride).toBe(DEFAULT_INPUT);
    const live = makeNode('query');
    expect(live.inputOverride).toBeUndefined();
    expect(outputExtension({ ...live, op: 'transform', params: { target: 'csv' } })).toBe('csv');
    expect(outputLanguage({ ...live, op: 'types', params: { lang: 'go' } })).toBe('go');
    expect(outputExtension({ ...live, op: 'diff', params: {} })).toBe('txt');
  });
});
