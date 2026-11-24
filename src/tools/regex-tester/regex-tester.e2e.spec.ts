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

  test('runs named positive and negative test cases with an aggregate summary', async ({ page }) => {
    await page.getByLabel('Regex to test:').fill('^ORD-[0-9]{4}$');
    await page.getByRole('button', { name: 'Add test case' }).click();
    await page.getByLabel('Test case name').last().locator('input').fill('Valid order');
    await page.getByLabel('Test case input').last().locator('textarea').fill('ORD-0042');

    await page.getByRole('button', { name: 'Add test case' }).click();
    await page.getByLabel('Test case name').last().locator('input').fill('Too short');
    await page.getByLabel('Test case input').last().locator('textarea').fill('ORD-42');
    await page.getByLabel('Expected to match').last().uncheck();

    await expect(page.getByText('2 / 2 test cases passed')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('PASS', { exact: true })).toHaveCount(2);
    await page.getByLabel('Test case input').first().locator('textarea').fill('ORD-42');
    await expect(page.getByText('1 / 2 test cases passed')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('FAIL', { exact: true })).toHaveCount(1);
  });
});
