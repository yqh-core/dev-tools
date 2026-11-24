import { expect, test } from '@playwright/test';

test.describe('Tool - batch URL slug generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slugify-string');
  });

  test('loads the URL slug generation page with the batch workflow', async ({ page }) => {
    await expect(page).toHaveTitle(/URL Slug Generator/);
    await expect(page.getByTestId('slugify-batch')).toBeVisible();
    await expect(page.getByText('Bulk URL slug generator')).toBeVisible();
  });

  test('generates one slug per title and prevents duplicates within the batch', async ({ page }) => {
    const titles = page.getByTestId('slug-titles-input').locator('textarea');
    await titles.fill('How to Build a Better API\nHow to Build a Better API');

    const results = page.getByTestId('slug-results');
    await expect(results).toContainText('how-to-build-a-better-api');
    await expect(results).toContainText('how-to-build-a-better-api-2');
    await expect(results).toContainText('2 slugs generated');
  });

  test('previews a normalized base URL without a duplicate slash', async ({ page }) => {
    const titles = page.getByTestId('slug-titles-input').locator('textarea');
    await titles.fill('API Design Guide');

    await page.locator('#slug-base-url').fill('https://example.com/blog/');
    await expect(page.getByTestId('slug-results')).toContainText('https://example.com/blog/api-design-guide');
  });

  test('downloads the batch as CSV with source and slug columns', async ({ page }) => {
    const titles = page.getByTestId('slug-titles-input').locator('textarea');
    await titles.fill('Alpha Guide\nBeta Guide');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('slug-results.csv');
  });
});
