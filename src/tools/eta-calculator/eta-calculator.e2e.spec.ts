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

test('ETA Calculator offers copyable remaining duration and an exact local finish timestamp', async ({ page }) => {
  await page.goto('/eta-calculator');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  const fill = async (id: string, value: string) => {
    await page.getByTestId(id).locator('input').fill(value);
  };
  await fill('eta-total', '500');
  await fill('eta-completed', '200');
  await fill('eta-rate', '5');
  await fill('eta-interval', '3');
  await fill('eta-buffer', '10');
  await fill('eta-pause-minutes', '15');

  await expect(page.getByTestId('eta-pause-time')).toContainText('15 minutes');
  await expect(page.getByTestId('eta-duration')).toContainText('3 hours 33 minutes');
  await expect(page.getByTestId('eta-finish-local')).toContainText(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );

  await page.getByTestId('eta-copy-remaining').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('3 hours 33 minutes');

  await page.getByTestId('eta-copy-finish').click();
  const copiedFinish = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedFinish).toContain('(');
  expect(copiedFinish).toContain(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
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
  await expect(page.getByTestId('eta-observed-rate')).toHaveCount(0);
  await expect(page.getByTestId('eta-complete')).toContainText('All work items are complete');
  await expect(page.getByTestId('eta-finish')).toHaveCount(0);
});

test('ETA Calculator derives a remaining estimate from observed pace and preserves known-rate mode', async ({ page }) => {
  await page.goto('/eta-calculator');
  await page.getByTestId('eta-mode-observed').click();

  const fill = async (id: string, value: string) => {
    await page.getByTestId(id).locator('input').fill(value);
  };
  await fill('eta-total', '500');
  await fill('eta-completed', '200');
  await fill('eta-elapsed-hours', '2');
  await fill('eta-elapsed-minutes', '0');
  await fill('eta-elapsed-seconds', '0');

  await expect(page.getByTestId('eta-observed-rate')).toContainText('100');
  await expect(page.getByTestId('eta-remaining')).toContainText('300');
  await expect(page.getByTestId('eta-duration')).toContainText('3 hours');
  await expect(page.getByTestId('eta-progress-label')).toContainText('40%');
  await expect(page.getByTestId('eta-finish')).toBeVisible();

  await fill('eta-buffer', '10');
  await expect(page.getByTestId('eta-duration')).toContainText('3 hours 18 minutes');
  await expect(page.getByTestId('eta-buffer-time')).toContainText('18 minutes');

  await page.getByTestId('eta-mode-rate').click();
  await expect(page.getByTestId('eta-rate')).toBeVisible();
  await expect(page.getByTestId('eta-start-time')).toBeVisible();
});

test('ETA Calculator reports missing progress and invalid elapsed pace, then handles completion', async ({ page }) => {
  await page.goto('/eta-calculator');
  await page.getByTestId('eta-mode-observed').click();

  const field = (id: string) => page.getByTestId(id).locator('input');
  const fill = async (id: string, value: string) => {
    await field(id).fill(value);
    await field(id).press('Tab');
  };

  // The observed mode should explain why a rate cannot be derived before any work is complete.
  await expect(page.getByTestId('eta-observed-error')).toBeVisible();

  await fill('eta-total', '500');
  await fill('eta-completed', '200');
  await expect(page.getByTestId('eta-duration')).toBeVisible();

  await fill('eta-elapsed-hours', '0');
  await expect(field('eta-elapsed-hours')).toHaveValue('0');
  await expect(page.getByTestId('eta-duration')).toHaveCount(0);
  await expect(page.getByTestId('eta-observed-error')).toBeVisible();

  await fill('eta-completed', '500');
  await expect(page.getByTestId('eta-remaining')).toContainText('0');
  await expect(page.getByTestId('eta-duration')).toContainText('0 seconds');
  await expect(page.getByTestId('eta-complete')).toContainText('All work items are complete');
  await expect(page.getByTestId('eta-observed-error')).toHaveCount(0);
  await expect(page.getByTestId('eta-finish')).toHaveCount(0);
});

test.describe('ETA Calculator observed pace Chinese localization', () => {
  test.use({ locale: 'zh-CN' });

  test('renders the observed-pace controls and derived rate in Chinese', async ({ page }) => {
    await page.goto('/eta-calculator');
    await expect(page.getByTestId('eta-mode-observed')).toContainText('\u6839\u636E\u5DF2\u8017\u65F6\u95F4\u8BA1\u7B97');
    await page.getByTestId('eta-mode-observed').click();

    const fill = async (id: string, value: string) => {
      await page.getByTestId(id).locator('input').fill(value);
    };
    await fill('eta-total', '500');
    await fill('eta-completed', '200');
    await fill('eta-elapsed-hours', '2');

    await expect(page.getByTestId('eta-observed-rate')).toContainText('100');
    await expect(page.getByTestId('eta-observed-rate')).toContainText('\u5355\u4F4D/\u5C0F\u65F6');
  });
});
