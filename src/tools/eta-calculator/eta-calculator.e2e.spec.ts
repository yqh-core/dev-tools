import { expect, test } from '@playwright/test';

test('ETA Calculator explains its formula and steady-rate assumption', async ({ page }) => {
  await page.goto('/eta-calculator');
  const example = page.getByTestId('eta-calculator-example');
  await expect(example).toContainText('total amount');
  await expect(example).toContainText('300 minutes');
  await expect(example).toContainText('5 hours');
  await expect(example).toContainText('steady processing rate');
});
