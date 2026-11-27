import { expect, test } from '@playwright/test';

test('product homepage explains the task and shows one primary workspace action', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toHaveAttribute('href', '/app/');
  await expect(page.getByText(/GUIDED PREVIEW · SAMPLE DATA/i)).toBeVisible();
  await expect(page.getByText(/not a live API call/i)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
  await page.screenshot({ path: testInfo.outputPath('homepage-desktop-first-fold.png') });
});

test('homepage remains usable at 390px without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('homepage-mobile-first-fold.png') });
});

test('workspace opens at /app and keeps the app shell out of search indexing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/');

  await expect(page.getByRole('link', { name: 'API Studio overview' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
  await expect(page.getByText('No requests yet')).toBeVisible();

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toBe('noindex,nofollow');
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('workspace-desktop-first-fold.png') });
});

test('task guides are directly addressable and link back to the workspace', async ({ page }) => {
  await page.goto('/docs/first-request/');

  await expect(page.getByRole('heading', { level: 1, name: 'Send your first request' })).toBeVisible();
  await expect(page.getByRole('link', { name: /workspace/i })).toHaveAttribute('href', '/app/');
  await expect(page.getByRole('link', { name: /All guides/i })).toHaveAttribute('href', '/docs/');
});

test('all task guides are directly addressable and have a clear task heading', async ({ page }) => {
  const guides = [
    ['/docs/', 'Get from first request to repeatable tests.'],
    ['/docs/first-request/', 'Send your first request'],
    ['/docs/collections/', 'Organize requests and environments'],
    ['/docs/scripts-and-assertions/', 'Turn a response into a test'],
    ['/docs/privacy/', 'Know where your API data goes'],
  ] as const;

  for (const [route, heading] of guides) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('link', { name: /API Studio/i }).first()).toHaveAttribute('href', '/');
  }
});

test('workspace remains within the mobile viewport and theme control works', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('workspace-mobile-first-fold.png') });

  const themeToggle = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  await expect(page.locator('.api-studio-shell')).toHaveAttribute('data-api-theme', 'light');
});
