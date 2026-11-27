import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  outputDir: 'test-results/api-studio-product',
  testDir: './src/api-studio-product',
  testMatch: /site\.e2e\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5051',
    testIdAttribute: 'data-test-id',
    trace: 'on-first-retry',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node scripts/preview-api-studio.mjs',
    url: 'http://127.0.0.1:5051',
    reuseExistingServer: !isCI,
    timeout: 30_000,
  },
});
