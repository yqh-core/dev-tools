import { expect, test } from '@playwright/test';

test('ETA Calculator explains the remaining-work formula and steady-rate assumption', async ({ page }) => {
  await page.goto('/eta-calculator');
  const example = page.getByTestId('eta-calculator-example');
  await expect(example).toContainText('completed amount');
  await expect(example).toContainText('300 remaining');
  await expect(example).toContainText('180 minutes');
  await expect(example).toContainText('steady processing rate');
});

test('ETA Calculator projects remaining work and adds an optional buffer', async ({ page }) => {
  await page.goto('/eta-calculator');
  const fill = async (id: string, value: string) => {
    await page.getByTestId(id).locator('input').fill(value);
  };

  await fill('eta-total', '500');
  await fill('eta-completed', '200');
  await fill('eta-rate', '5');
  await fill('eta-interval', '3');
  await fill('eta-buffer', '10');

  await expect(page.getByTestId('eta-remaining')).toContainText('300');
  await expect(page.getByTestId('eta-duration')).toContainText('3 hours 18 minutes');
  await expect(page.getByTestId('eta-buffer-time')).toContainText('18 minutes');
  await expect(page.getByTestId('eta-progress-label')).toContainText('40%');
});

test('ETA Calculator clearly reports a completed workload', async ({ page }) => {
  await page.goto('/eta-calculator');
  const fill = async (id: string, value: string) => {
    await page.getByTestId(id).locator('input').fill(value);
  };

  await fill('eta-total', '500');
  await fill('eta-completed', '500');
  await expect(page.getByTestId('eta-remaining')).toContainText('0');
  await expect(page.getByTestId('eta-duration')).toContainText('0 seconds');
  await expect(page.getByTestId('eta-complete')).toContainText('All work items are complete');
  await expect(page.getByTestId('eta-finish')).toHaveCount(0);
});
