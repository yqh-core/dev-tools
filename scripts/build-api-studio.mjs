import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const productRoot = resolve(repoRoot, 'product-api-studio');

process.env.API_STUDIO_PRODUCT_BUILD = '1';

const { build } = await import('vite');

await build({
  configFile: resolve(repoRoot, 'vite.config.ts'),
  root: productRoot,
  base: '/',
  publicDir: resolve(productRoot, 'public'),
  build: {
    outDir: resolve(repoRoot, 'dist-api-studio'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(productRoot, 'index.html'),
        app: resolve(productRoot, 'app/index.html'),
        docs: resolve(productRoot, 'docs/index.html'),
        firstRequest: resolve(productRoot, 'docs/first-request/index.html'),
        collections: resolve(productRoot, 'docs/collections/index.html'),
        scriptsAndAssertions: resolve(productRoot, 'docs/scripts-and-assertions/index.html'),
        privacy: resolve(productRoot, 'docs/privacy/index.html'),
      },
    },
  },
});

console.log('API Studio product site built to dist-api-studio/.');
