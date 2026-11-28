import { spawnSync } from 'node:child_process';
import { shouldBuildApiStudioPreview } from './api-studio-preview-routing.mjs';

const isProductPreview = shouldBuildApiStudioPreview(process.env);

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
