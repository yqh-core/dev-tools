import { expect, test } from '@playwright/test';

test.describe('Tool - Http status codes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-status-codes');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('HTTP status codes - DigDevBox');
  });

  test('shows current RFC 9110 names for lifecycle-sensitive codes', async ({ page }) => {
    const search = page.getByPlaceholder('Search http status...');

    for (const [query, label] of [
      ['306', '306 (Unused)'],
      ['413', '413 Content Too Large'],
      ['418', '418 (Unused)'],
      ['422', '422 Unprocessable Content'],
    ] as const) {
      await search.fill(query);
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });
});
