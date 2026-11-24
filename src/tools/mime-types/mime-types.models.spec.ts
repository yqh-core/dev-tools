import { describe, expect, it } from 'vitest';
import { createMimeServerSnippets } from './mime-types.models';

describe('createMimeServerSnippets', () => {
  it('creates Nginx, Apache and static headers rules from a MIME mapping', () => {
    expect(createMimeServerSnippets('application/json', ['json', 'map'])).toEqual({
      nginx: 'types {\\n    application/json json map;\\n}',
      apache: 'AddType application/json .json .map',
      headers: '/*.json\\n  Content-Type: application/json\\n\\n/*.map\\n  Content-Type: application/json',
    });
  });

  it('normalizes leading dots and removes duplicate extensions', () => {
    expect(createMimeServerSnippets('image/svg+xml', ['.svg', 'svg', 'svgz']).apache)
      .toBe('AddType image/svg+xml .svg .svgz');
  });

  it('returns an explicit comment if the mapping has no known extensions', () => {
    expect(createMimeServerSnippets('application/x-private', [])).toEqual({
      nginx: '# No known file extensions for application/x-private',
      apache: '# No known file extensions for application/x-private',
      headers: '# No known file extensions for application/x-private',
    });
  });
});
