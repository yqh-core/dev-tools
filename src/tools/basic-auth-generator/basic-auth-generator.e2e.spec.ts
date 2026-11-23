import { expect, test } from '@playwright/test';

test.describe('Tool - Basic Auth generator', () => {
  test('explains the header format and generates the expected sample value', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    const guide = page.getByTestId('basic-auth-guide');
    await expect(guide).toContainText('Base64 is encoding, not encryption');
    await expect(guide).toContainText('Use HTTPS');

    await page.getByPlaceholder('Your username...').fill('demo');
    await page.getByPlaceholder('Your password...').fill('example');
    await expect(page.getByTestId('basic-auth-generated-header')).toContainText(
      'Authorization: Basic ZGVtbzpleGFtcGxl',
    );
  });
});
