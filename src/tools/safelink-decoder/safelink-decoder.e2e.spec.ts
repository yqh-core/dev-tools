import { expect, test } from '@playwright/test';

test.describe('Tool - Outlook Safe Links decoder', () => {
  test('explains the scope and extracts the destination without opening it', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const guide = page.getByTestId('safelink-guide');
    await expect(guide).toContainText('does not scan the destination');
    await expect(guide).toContainText('does not replace or bypass that protection');
    await expect(guide).toContainText('unwraps nested Outlook Safe Links URLs up to five layers');
    await expect(page.getByRole('link', { name: 'URL Parser' })).toHaveAttribute('href', '/url-parser/');
    await expect(page.getByRole('link', { name: 'URL Encoder' })).toHaveAttribute('href', '/url-encoder/');

    await page.getByPlaceholder('Your input Outlook SafeLink Url...').fill(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs&data=example',
    );
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('unwraps a nested Outlook Safe Links URL in the browser', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

    await page.getByPlaceholder('Your input Outlook SafeLink Url...').fill(outer);
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });
});
