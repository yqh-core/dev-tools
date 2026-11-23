import { expect, test } from '@playwright/test';

test.describe('Tool - Regex Tester isolated execution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/regex-tester');
  });

  test('supports named groups and JavaScript replacement tokens', async ({ page }) => {
    await page.getByLabel('Regex to test:').fill('(?<word>hello)');
    await page.getByLabel('Text to match:').fill('hello world');
    await page.getByLabel('Replacement:').fill('$<word>!');
    await expect(page.locator('pre').first()).toContainText('hello! world');
    await expect(page.getByText(/"word" = hello \[0 - 5\]/)).toBeVisible();
  });

  test('terminates catastrophic backtracking and recovers for the next request', async ({ page }) => {
    await page.getByLabel('Regex to test:').fill('^(a+)+$');
    await page.getByLabel('Text to match:').fill(`${'a'.repeat(36)}!`);
    await expect(page.getByText(/Timed out after 300ms/)).toBeVisible({ timeout: 5000 });

    // The main thread remains responsive and a fresh worker handles the next request.
    await page.getByLabel('Regex to test:').fill('a+');
    await page.getByLabel('Text to match:').fill('aaaa');
    await expect(page.locator('tbody tr').first().locator('td').nth(1)).toContainText('aaaa', { timeout: 5000 });
    await expect(page.getByText(/Timed out after/)).toHaveCount(0);
  });

  test('shows invalid-pattern errors and recovers after correction', async ({ page }) => {
    await page.getByLabel('Regex to test:').fill('(');
    await page.getByLabel('Text to match:').fill('hello');
    await expect(page.getByText(/Invalid regex:/)).toBeVisible();

    await page.getByLabel('Regex to test:').fill('hello');
    await expect(page.locator('tbody tr').first().locator('td').nth(1)).toContainText('hello', { timeout: 5000 });
  });

  test('supports keyboard input and remains within a 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Regex to test:').focus();
    await page.keyboard.type('\\d+');
    await page.getByLabel('Text to match:').fill('Order 123');
    await page.getByLabel('Replacement:').fill('#$&');
    await expect(page.locator('pre').first()).toContainText('Order #123', { timeout: 5000 });

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });

  test('applies a verified JavaScript preset', async ({ page }) => {
    const presetField = page.getByText('Verified presets:').locator('..');
    await presetField.locator('.c-select-input').click();
    await presetField.locator('.c-select-dropdown-option').filter({ hasText: 'IPv4 address' }).click();
    await page.getByLabel('Text to match:').fill('Server: 192.168.1.42');
    await expect(page.locator('tbody tr').first().locator('td').nth(1)).toContainText('192.168.1.42', { timeout: 5000 });
  });
});
