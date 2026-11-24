import { describe, expect, it } from 'vitest';
import { getPageMeta } from './page-meta';

describe('static trust-page SEO descriptions', () => {
  it('keeps About, Contact and FAQ descriptions concise and distinct', () => {
    const paths = ['/about', '/contact', '/faq'];
    const descriptions = paths.map((path) => getPageMeta(path, 'en').description);
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThanOrEqual(50);
      expect(description.length).toBeLessThanOrEqual(160);
    }
    expect(new Set(descriptions).size).toBe(paths.length);
  });
});
