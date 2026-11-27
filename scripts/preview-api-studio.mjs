import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const productRoot = resolve(repoRoot, 'product-api-studio');

process.env.API_STUDIO_PRODUCT_BUILD = '1';

const { preview } = await import('vite');
const server = await preview({
  configFile: resolve(repoRoot, 'vite.config.ts'),
  root: productRoot,
  preview: {
    host: '127.0.0.1',
    port: 5051,
    strictPort: true,
  },
  build: {
    outDir: resolve(repoRoot, 'dist-api-studio'),
  },
});

server.printUrls();
