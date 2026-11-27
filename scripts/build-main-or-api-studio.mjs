import { spawnSync } from 'node:child_process';

const productPreviewBranch = 'feat/api-studio-independent-site-20261127';
const isProductPreview = process.env.CF_PAGES === '1'
  && process.env.CF_PAGES_BRANCH === productPreviewBranch;

if (isProductPreview) {
  // Render the independent product at the existing Cloudflare PR Preview URL only.
  // This does not change the Pages project, custom domains or main-branch production output.
  process.env.API_STUDIO_PRODUCT_BUILD = '1';
  process.env.API_STUDIO_PRODUCT_OUTPUT = 'dist';
  process.env.API_STUDIO_PREVIEW = '1';

  await import('./build-api-studio.mjs');
  await import('./check-api-studio-build.mjs');
}
else {
  const result = spawnSync('pnpm', ['run', 'build:main'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}
