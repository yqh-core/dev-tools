import { describe, expect, it } from 'vitest';
import { shouldBuildApiStudioPreview } from './api-studio-preview-routing.mjs';

describe('API Studio Cloudflare Preview routing', () => {
  it('uses the independent product output for API Studio feature branches', () => {
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'feat/api-studio-independent-site-20261127',
    })).toBe(true);
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'feat/api-studio-visual-task-demo-20261128',
    })).toBe(true);
  });

  it('keeps Main production and unrelated feature previews on the Main build', () => {
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'main',
    })).toBe(false);
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'feat/home-task-story-demo-20261128',
    })).toBe(false);
  });

  it('does not select product output outside Cloudflare Pages', () => {
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '0',
      CF_PAGES_BRANCH: 'feat/api-studio-visual-task-demo-20261128',
    })).toBe(false);
    expect(shouldBuildApiStudioPreview({
      CF_PAGES_BRANCH: 'feat/api-studio-visual-task-demo-20261128',
    })).toBe(false);
  });

  it('rejects an empty API Studio prefix with no feature name', () => {
    expect(shouldBuildApiStudioPreview({
      CF_PAGES: '1',
      CF_PAGES_BRANCH: 'feat/api-studio-',
    })).toBe(false);
  });
});
