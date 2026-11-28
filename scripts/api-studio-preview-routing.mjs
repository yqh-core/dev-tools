export const API_STUDIO_PREVIEW_BRANCH_PREFIX = 'feat/api-studio-';

/**
 * Only Cloudflare branch previews from the API Studio feature lane render the
 * independent product output. Main and unrelated feature branches always use
 * the DigDevBox Main build, including the main Production deployment.
 */
export function shouldBuildApiStudioPreview(env = process.env) {
  const branch = env.CF_PAGES_BRANCH;
  return env.CF_PAGES === '1'
    && typeof branch === 'string'
    && branch.startsWith(API_STUDIO_PREVIEW_BRANCH_PREFIX)
    && branch.length > API_STUDIO_PREVIEW_BRANCH_PREFIX.length;
}
