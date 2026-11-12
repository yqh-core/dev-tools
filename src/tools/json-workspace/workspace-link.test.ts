import { describe, expect, it } from 'vitest';
import { makeNode } from './pipeline';
import { LINK_LIMIT, LinkTooLargeError, WorkspaceLinkError, decodeLink, encodeBase64Url, encodeLink, validateState } from './workspace-link';

describe('workspace deep-link', () => {
  it('round-trips unicode state through a URL hash', () => {
    const nodes = [
      makeNode('format', '{"a":"中文🚀"}', { indent: 4, sort: true }),
      makeNode('query', undefined, { query: '$.a' }),
      makeNode('transform', undefined, { target: 'csv' }),
    ];
    const url = encodeLink(nodes, 'https://x.test/json-workspace');
    expect(url.length).toBeLessThanOrEqual(LINK_LIMIT);
    const state = decodeLink(new URL(url).hash);
    expect(state.v).toBe(1);
    expect(state.nodes).toHaveLength(3);
    expect(state.nodes[0]).toEqual({ op: 'format', input: '{"a":"中文🚀"}', params: { indent: 4, sort: true } });
    expect(state.nodes[1]).toEqual({ op: 'query', params: { query: '$.a' } });
    expect(state.nodes[2]).toEqual({ op: 'transform', params: { target: 'csv' } });
  });

  it('refuses links over the 8KB limit instead of truncating (negative control)', () => {
    const nodes = [makeNode('format', 'x'.repeat(9000))];
    let caught: unknown;
    try {
      encodeLink(nodes, 'https://x.test/json-workspace');
    }
    catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LinkTooLargeError);
    expect((caught as LinkTooLargeError).size).toBeGreaterThan(LINK_LIMIT);
    expect((caught as Error).message).toContain('nothing was truncated');
  });

  it('rejects invalid base64url payload', () => {
    expect(() => decodeLink('#w=!!!not-base64!!!')).toThrow(WorkspaceLinkError);
  });

  it('rejects payload that is not JSON', () => {
    expect(() => decodeLink(`#w=${encodeBase64Url('{')}`)).toThrow(WorkspaceLinkError);
  });

  it('rejects unsupported version', () => {
    expect(() => decodeLink(`#w=${encodeBase64Url(JSON.stringify({ v: 2, nodes: [{ op: 'format' }] }))}`)).toThrow(/version/);
  });

  it('rejects unknown op (fail-closed)', () => {
    expect(() => decodeLink(`#w=${encodeBase64Url(JSON.stringify({ v: 1, nodes: [{ op: 'hack' }] }))}`)).toThrow(/unknown op/);
  });

  it('rejects empty nodes / empty payload / foreign hash', () => {
    expect(() => decodeLink(`#w=${encodeBase64Url(JSON.stringify({ v: 1, nodes: [] }))}`)).toThrow(WorkspaceLinkError);
    expect(() => decodeLink('#w=')).toThrow(WorkspaceLinkError);
    expect(() => decodeLink('#foo')).toThrow(WorkspaceLinkError);
  });

  it('sanitizes params: keeps valid keys, drops unknown and ill-typed ones', () => {
    const state = validateState({
      v: 1,
      nodes: [{ op: 'format', input: '{}', params: { indent: 99, sort: 'yes', query: '$.a', evil: 'x', target: 'csv' } }],
    });
    expect(state.nodes[0].params).toEqual({ query: '$.a', target: 'csv' });
  });

  it('validateState accepts a serialized state file (file import path)', () => {
    const nodes = [makeNode('parse', 'a: 1', { source: 'yaml' }), makeNode('format')];
    const serialized = JSON.parse(JSON.stringify({ v: 1, nodes: nodes.map(n => ({ op: n.op, input: n.inputOverride, params: n.params })) }));
    const state = validateState(serialized);
    expect(state.nodes[0]).toEqual({ op: 'parse', input: 'a: 1', params: { source: 'yaml' } });
    expect(state.nodes[1].input).toBeUndefined();
  });
});
