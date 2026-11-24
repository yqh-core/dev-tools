import { expect, test } from '@playwright/test';

test.describe('Tool - Phone parser and formatter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/phone-parser-and-formatter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('International Phone Number Parser & Formatter — E.164 - DigDevBox');
  });

  test('formats multiple international numbers and exports a local CSV', async ({ page }) => {
    await page.getByTestId('batch-phone-numbers').fill('+1 650-253-0000\\n+44 20 7031 3000\\nnot-a-number');

    const results = page.getByTestId('batch-results');
    await expect(results).toContainText('3 numbers processed');
    await expect(results).toContainText('+16502530000');
    await expect(results).toContainText('+442070313000');
    await expect(results).toContainText('Could not parse this number');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('phone-number-results.csv');
  });

  test('rejects batches above the documented 200-number limit', async ({ page }) => {
    const numbers = Array.from({ length: 201 }, () => '+1 650-253-0000').join('\\n');
    await page.getByTestId('batch-phone-numbers').fill(numbers);

    await expect(page.getByTestId('batch-limit-error')).toContainText('Maximum 200');
    await expect(page.getByTestId('batch-results')).toHaveCount(0);
  });
});
