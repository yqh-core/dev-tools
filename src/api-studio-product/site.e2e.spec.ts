import { expect, test } from '@playwright/test';

test('product homepage explains the task and shows one primary workspace action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toHaveAttribute('href', '/app/');
  await expect(page.getByText(/GUIDED PREVIEW · SAMPLE DATA/i)).toBeVisible();
  await expect(page.getByText(/not a live API call/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
});

test('homepage remains usable at 390px without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});

test('workspace opens at /app and keeps the app shell out of search indexing', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/');

  await expect(page.getByRole('link', { name: 'API Studio overview' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
  await expect(page.getByText('No requests yet')).toBeVisible();

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toBe('noindex,nofollow');
});

test('task guides are directly addressable and link back to the workspace', async ({ page }) => {
  await page.goto('/docs/first-request/');

  await expect(page.getByRole('heading', { level: 1, name: 'Send your first request' })).toBeVisible();
  await expect(page.getByRole('link', { name: /workspace/i })).toHaveAttribute('href', '/app/');
  await expect(page.getByRole('link', { name: /All guides/i })).toHaveAttribute('href', '/docs/');
});
