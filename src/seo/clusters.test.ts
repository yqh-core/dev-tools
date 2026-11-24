import { describe, expect, it } from 'vitest';

import { clusterOf, resolveRelated, resolveWorkflow } from './clusters';

type Tool = { path: string; category: string };

const tools: Tool[] = [
  { path: '/regex-tester', category: 'Development' },
  { path: '/regex-memo', category: 'Development' },
  { path: '/text-replacer', category: 'Text' },
  { path: '/case-converter', category: 'Text' },
  { path: '/fullwidth-converter', category: 'Text' },
  { path: '/list-converter', category: 'Text' },
  { path: '/string-obfuscator', category: 'Text' },
  { path: '/text-statistics', category: 'Text' },
  { path: '/date-converter', category: 'Converter' },
  { path: '/unix-timestamp-converter', category: 'Converter' },
  { path: '/jwt-parser', category: 'Development' },
  { path: '/base64-string-converter', category: 'Converter' },
  { path: '/base64-file-converter', category: 'Converter' },
  { path: '/category-only-a', category: 'Standalone' },
  { path: '/category-only-b', category: 'Standalone' },
];

describe('resolveRelated — cross-task cluster membership', () => {
  it('links Regex Tester to the actual regex replacement tool', () => {
    const related = resolveRelated({
      path: '/regex-tester',
      category: 'Development',
      tools,
    }).map(tool => tool.path);

    expect(related).toContain('/regex-memo');
    expect(related).toContain('/text-replacer');
  });

  it('links Text Replacer back to Regex Tester without changing its primary text workflow', () => {
    const related = resolveRelated({
      path: '/text-replacer',
      category: 'Text',
      tools,
    }).map(tool => tool.path);

    expect(related).toContain('/regex-tester');
    expect(related).not.toContain('/text-replacer');
    expect(clusterOf('/text-replacer')?.id).toBe('text-transform');

    const workflow = resolveWorkflow({ path: '/text-replacer', tools });
    expect(workflow.map(item => item.item.path)).toEqual([
      '/case-converter',
      '/fullwidth-converter',
      '/text-replacer',
      '/list-converter',
      '/string-obfuscator',
      '/text-statistics',
    ]);
    expect(workflow.some(item => item.item.path === '/regex-tester')).toBe(false);
  });

  it('aggregates overlapping clusters in deterministic order and removes duplicates', () => {
    const related = resolveRelated({
      path: '/base64-string-converter',
      category: 'Converter',
      tools,
      max: 6,
    }).map(tool => tool.path);

    expect(related.slice(0, 3)).toEqual([
      '/jwt-parser',
      '/date-converter',
      '/unix-timestamp-converter',
    ]);
    expect(related).toContain('/base64-file-converter');
    expect(new Set(related).size).toBe(related.length);
  });

  it('keeps category fallback when a tool does not belong to any cluster', () => {
    const related = resolveRelated({
      path: '/category-only-a',
      category: 'Standalone',
      tools,
      max: 2,
    }).map(tool => tool.path);

    expect(related).toEqual(['/category-only-b']);
  });

  it('respects the configured maximum across all cluster memberships', () => {
    const related = resolveRelated({
      path: '/text-replacer',
      category: 'Text',
      tools,
      max: 3,
    });

    expect(related).toHaveLength(3);
    expect(new Set(related.map(tool => tool.path)).size).toBe(3);
  });
});
