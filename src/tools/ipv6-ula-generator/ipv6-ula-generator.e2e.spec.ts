import { expect, test } from '@playwright/test';

test.describe('Tool - IPv6 ULA generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ipv6-ula-generator');
  });

  test('generates a cryptographically random ULA prefix and subnet examples', async ({ page }) => {
    await expect(page.getByTestId('ula-result-1')).toBeVisible();
    await expect(page.getByTestId('ula-prefix-1').locator('input')).toHaveValue(/^fd[0-9a-f]{2}:[0-9a-f]{4}:[0-9a-f]{4}::\/48$/);
    await expect(page.getByTestId('ula-global-id-1').locator('input')).toHaveValue(/^[0-9a-f]{10}$/);
    await expect(page.getByTestId('ula-first-subnet-1').locator('input')).toHaveValue(/:0::\/64$/);
    await expect(page.getByTestId('ula-last-subnet-1').locator('input')).toHaveValue(/:ffff::\/64$/);
    await expect(page.getByText(/65,536/)).toBeVisible();
  });

  test('generates a unique batch and respects the requested quantity', async ({ page }) => {
    await page.getByTestId('ula-quantity').locator('input').fill('3');
    await page.getByTestId('ula-quantity').locator('input').press('Tab');
    await page.getByTestId('ula-generate').click();
    const ids = await page.locator('[data-test-id^="ula-global-id-"] input').evaluateAll(
      inputs => inputs.map(input => (input as HTMLInputElement).value),
    );
    expect(ids).toHaveLength(3);
    expect(ids.every(id => /^[0-9a-f]{10}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(3);
  });

  test('clears stale random output when switching to manual mode', async ({ page }) => {
    await expect(page.getByTestId('ula-result-1')).toBeVisible();
    await page.getByTestId('ula-mode-manual').click();
    await expect(page.getByTestId('ula-result-1')).toHaveCount(0);
    await page.getByTestId('ula-manual-global-id').locator('input').fill('0123456789');
    await page.getByTestId('ula-generate').click();
    await expect(page.getByTestId('ula-prefix-1').locator('input')).toHaveValue('fd01:2345:6789::/48');
  });

  test('accepts a reproducible manual 40-bit Global ID', async ({ page }) => {
    await page.getByTestId('ula-mode-manual').click();
    await page.getByTestId('ula-manual-global-id').locator('input').fill('0123456789');
    await page.getByTestId('ula-generate').click();
    await expect(page.getByTestId('ula-prefix-1').locator('input')).toHaveValue('fd01:2345:6789::/48');
    await expect(page.getByTestId('ula-global-id-1').locator('input')).toHaveValue('0123456789');
  });

  test('shows a clear error for a malformed manual Global ID', async ({ page }) => {
    await page.getByTestId('ula-mode-manual').click();
    await page.getByTestId('ula-manual-global-id').locator('input').fill('not-40-bit');
    await page.getByTestId('ula-generate').click();
    await expect(page.getByTestId('ula-error')).toBeVisible();
    await expect(page.getByTestId('ula-result-1')).toHaveCount(0);
  });
});

test.describe('IPv6 ULA generator Chinese localization', () => {
  test.use({ locale: 'zh-CN' });

  test('renders localized generation controls', async ({ page }) => {
    await page.goto('/ipv6-ula-generator');
    await expect(page.getByTestId('ula-generate')).toHaveText('生成');
    await expect(page.getByTestId('ula-mode-random')).toHaveText('安全随机生成');
    await expect(page.getByTestId('ula-routing-warning')).toBeVisible();
  });
});
