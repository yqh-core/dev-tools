import { expect, test } from '@playwright/test';

test.describe('Tool - Outlook Safe Links decoder', () => {
  test('explains the scope and extracts the destination without opening it', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const guide = page.getByTestId('safelink-guide');
    await expect(guide).toContainText('does not scan the destination');
    await expect(guide).toContainText('does not replace or bypass that protection');

    await page.getByPlaceholder('Your input Outlook SafeLink Url...').fill(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs&data=example',
    );
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });
});
