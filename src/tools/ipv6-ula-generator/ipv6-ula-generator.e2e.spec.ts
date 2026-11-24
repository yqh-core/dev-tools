import { expect, test } from '@playwright/test';

test.describe('Tool - IPv6 ULA generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ipv6-ula-generator');
  });

  test('generates a cryptographically random ULA prefix and subnet examples', async ({ page }) => {
    await expect(page.getByTestId('ula-result-1')).toBeVisible();
    await expect(page.getByTestId('ula-prefix-1')).toHaveText(/^fd[0-9a-f]{2}:[0-9a-f]{4}:[0-9a-f]{4}::\/48$/);
    await expect(page.getByTestId('ula-global-id-1')).toHaveText(/^[0-9a-f]{10}$/);
    await expect(page.getByTestId('ula-first-subnet-1')).toContainText(':0::/64');
    await expect(page.getByTestId('ula-last-subnet-1')).toContainText(':ffff::/64');
    await expect(page.getByText('65,536')).toBeVisible();
  });

  test('generates a unique batch and respects the requested quantity', async ({ page }) => {
    await page.getByTestId('ula-quantity').locator('input').fill('3');
    await page.getByTestId('ula-generate').click();
    const ids = await page.locator('[data-test-id^="ula-global-id-"]').allTextContents();
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  test('accepts a reproducible manual 40-bit Global ID', async ({ page }) => {
    await page.getByTestId('ula-mode-manual').click();
    await page.getByTestId('ula-manual-global-id').fill('0123456789');
    await page.getByTestId('ula-generate').click();
    await expect(page.getByTestId('ula-prefix-1')).toHaveText('fd01:2345:6789::/48');
    await expect(page.getByTestId('ula-global-id-1')).toHaveText('0123456789');
  });

  test('shows a clear error for a malformed manual Global ID', async ({ page }) => {
    await page.getByTestId('ula-mode-manual').click();
    await page.getByTestId('ula-manual-global-id').fill('not-40-bit');
    await page.getByTestId('ula-generate').click();
    await expect(page.getByTestId('ula-error')).toBeVisible();
    await expect(page.getByTestId('ula-result-1')).toHaveCount(0);
  });

  test('supports English and Chinese tool copy', async ({ page }) => {
    await expect(page.getByTestId('ula-generate')).toHaveText('Generate');
    await page.getByRole('button', { name: /中文|Chinese/i }).click();
    await expect(page.getByTestId('ula-generate')).toHaveText('生成');
  });
});
