import { expect, test } from '@playwright/test';

test.describe('Tool - MIME type lookup and server config', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mime-types');
  });

  test('generates Nginx, Apache and static hosting rules for a MIME type', async ({ page }) => {
    await page.getByPlaceholder('Select your mimetype here... (ex: application/pdf)').first().click();
    await page.locator('.c-select-dropdown-option').filter({ hasText: 'application/json' }).click();

    await expect(page.getByTestId('server-config')).toBeVisible();
    await expect(page.getByTestId('nginx-snippet')).toContainText('application/json json');
    await expect(page.getByTestId('apache-snippet')).toContainText('AddType application/json .json');
    await expect(page.getByTestId('headers-snippet')).toContainText('/*.json');
    await expect(page.getByTestId('headers-snippet')).toContainText('Content-Type: application/json');
  });

  test('generates snippets from the reverse extension lookup too', async ({ page }) => {
    await page.getByPlaceholder('Select your mimetype here... (ex: application/pdf)').nth(1).click();
    await page.locator('.c-select-dropdown-option').filter({ hasText: '.svg' }).click();

    await expect(page.getByTestId('server-config')).toBeVisible();
    await expect(page.getByTestId('nginx-snippet')).toContainText('image/svg+xml svg');
    await expect(page.getByTestId('apache-snippet')).toContainText('AddType image/svg+xml .svg');
    await expect(page.getByTestId('headers-snippet')).toContainText('/*.svg');
  });
});
