import { expect, test } from '@playwright/test';

test('ETA Calculator explains the remaining-work formula and steady-rate assumption', async ({ page }) => {
  await page.goto('/eta-calculator');
  const example = page.getByTestId('eta-calculator-example');
  await expect(example).toContainText('completed amount');
  await expect(example).toContainText('300 remaining');
  await expect(example).toContainText('180 minutes');
  await expect(example).toContainText('steady processing rate');
});

test('ETA Calculator leads with task samples and loads the matching inputs', async ({ page }) => {
  await page.goto('/eta-calculator');

  const intro = page.getByTestId('eta-first-screen-intro');
  await expect(intro).toBeVisible();
  await expect(intro).toContainText('Estimate when your work will finish');
  await expect(page.locator('[data-testid^="eta-scenario-"]')).toHaveCount(4);

  await page.getByTestId('eta-scenario-build').click();
  await expect(page.getByTestId('eta-total').locator('input')).toHaveValue('240');
  await expect(page.getByTestId('eta-completed').locator('input')).toHaveValue('90');
  await expect(page.getByTestId('eta-elapsed-hours').locator('input')).toHaveValue('1');
  await expect(page.getByTestId('eta-observed-rate')).toBeVisible();

  await page.getByTestId('eta-scenario-migration').click();
  await expect(page.getByTestId('eta-total').locator('input')).toHaveValue('12000');
  await expect(page.getByTestId('eta-schedule-weekdays')).toBeVisible();
  await expect(page.getByTestId('eta-working-start')).toBeVisible();

  await page.getByTestId('eta-scenario-batch').click();
  await expect(page.getByTestId('eta-total').locator('input')).toHaveValue('10000');
  await expect(page.getByTestId('eta-completed').locator('input')).toHaveValue('3600');
  await expect(page.getByTestId('eta-rate').locator('input')).toHaveValue('500');
  await expect(page.getByTestId('eta-interval').locator('input')).toHaveValue('10');
  await expect(page.getByTestId('eta-working-start')).toHaveCount(0);
  await expect(page.getByTestId('eta-duration')).toBeVisible();
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

test('ETA Calculator compares the current pace with the rate needed for a deadline', async ({ page }) => {
  await page.goto('/eta-calculator');
  const fill = async (id: string, value: string) => {
    await page.getByTestId(id).locator('input').fill(value);
  };
  const localDateTime = (offsetMs: number) => page.evaluate((offset) => {
    // Build datetime-local in the browser's timezone, which is also where
    // the component parses it. The Node runner may use a different TZ.
    const date = new Date(Date.now() + offset);
    const pad = (value: number) => String(value).padStart(2, '0');
    const datePart = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
    const timePart = [pad(date.getHours()), pad(date.getMinutes())].join(':');
    return `${datePart}T${timePart}`;
  }, offsetMs);

  await fill('eta-total', '180');
  await fill('eta-completed', '60');
  await fill('eta-rate', '3');
  await fill('eta-interval', '5');
  const deadline = page.getByTestId('eta-deadline-input');
  await deadline.fill(await localDateTime(4 * 60 * 60 * 1000));
  const requiredPace = page.getByTestId('eta-required-pace');
  const readRequiredPace = async () => {
    const text = (await requiredPace.textContent()) ?? '';
    const value = Number(text.match(/([\d,.]+)\s+units\/hour/)?.[1]?.replace(/,/g, ''));
    expect(Number.isFinite(value)).toBe(true);
    return value;
  };
  expect(await readRequiredPace()).toBeGreaterThan(29);
  expect(await readRequiredPace()).toBeLessThan(31);
  await expect(page.getByTestId('eta-deadline-result')).toContainText('sufficient to meet this deadline');

  await deadline.fill(await localDateTime(3 * 60 * 60 * 1000));
  expect(await readRequiredPace()).toBeGreaterThan(39);
  expect(await readRequiredPace()).toBeLessThan(41);
  await expect(page.getByTestId('eta-deadline-result')).toContainText('Increase your pace');

  await fill('eta-buffer', '20');
  await fill('eta-pause-minutes', '30');
  expect(await readRequiredPace()).toBeGreaterThan(55);
  expect(await readRequiredPace()).toBeLessThan(60);

  await deadline.fill(await localDateTime(-60 * 60 * 1000));
  await expect(page.getByTestId('eta-deadline-error')).toContainText('must be later than the estimate start time');
});

test.describe('ETA Calculator weekday schedule in the device timezone', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('counts a same-day weekday window and moves after-hours work to the next opening', async ({ page }) => {
    const fill = async (id: string, value: string) => {
      await page.getByTestId(id).locator('input').fill(value);
    };

    await page.addInitScript((fixedNow) => {
      Date.now = () => fixedNow;
    }, Date.parse('2026-11-23T15:00:00Z'));
    await page.goto('/eta-calculator');
    await fill('eta-total', '6');
    await fill('eta-completed', '0');
    await page.getByTestId('eta-schedule-weekdays').click();

    await expect(page.getByTestId('eta-working-window-counted')).toContainText('10 minutes');
    await expect(page.getByTestId('eta-finish-local')).toContainText('23 Nov 2026');
    await expect(page.getByTestId('eta-finish-local')).toContainText('10:10');
    await expect(page.getByTestId('eta-working-schedule-help')).toContainText('America/New_York');

    await page.addInitScript((fixedNow) => {
      Date.now = () => fixedNow;
    }, Date.parse('2026-11-23T23:00:00Z'));
    await page.reload();
    await fill('eta-total', '6');
    await fill('eta-completed', '0');
    await page.getByTestId('eta-schedule-weekdays').click();
    await expect(page.getByTestId('eta-finish-local')).toContainText('24 Nov 2026');
    await expect(page.getByTestId('eta-finish-local')).toContainText('09:10');

    await page.getByTestId('eta-schedule-calendar').click();
    await expect(page.getByTestId('eta-finish-local')).toContainText('23 Nov 2026');
    await expect(page.getByTestId('eta-finish-local')).toContainText('18:10');
  });

  test('carries Friday work over a DST weekend while keeping local work hours stable', async ({ page }) => {
    await page.addInitScript((fixedNow) => {
      Date.now = () => fixedNow;
    }, Date.parse('2026-03-06T21:00:00Z'));
    await page.goto('/eta-calculator');

    const fill = async (id: string, value: string) => {
      await page.getByTestId(id).locator('input').fill(value);
    };
    await fill('eta-total', '72');
    await fill('eta-completed', '0');
    await page.getByTestId('eta-schedule-weekdays').click();

    await expect(page.getByTestId('eta-working-window-counted')).toContainText('2 hours');
    await expect(page.getByTestId('eta-finish-local')).toContainText('9 Mar 2026');
    await expect(page.getByTestId('eta-finish-local')).toContainText('10:00');
    await expect(page.getByTestId('eta-finish-local')).toContainText('America/New_York');
  });

  test('rejects deadlines before the estimate start and deadlines with no weekday window', async ({ page }) => {
    await page.addInitScript((fixedNow) => {
      Date.now = () => fixedNow;
    }, Date.parse('2026-11-23T23:00:00Z'));
    await page.goto('/eta-calculator');
    await page.getByTestId('eta-schedule-weekdays').click();

    const deadline = page.getByTestId('eta-deadline-input');
    await deadline.fill('2026-11-23T17:30');
    await expect(page.getByTestId('eta-deadline-error')).toBeVisible();

    await deadline.fill('2026-11-24T08:30');
    await expect(page.getByTestId('eta-deadline-error')).toBeVisible();
  });

  test('keeps the first-screen scenarios and working-hours controls within a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/eta-calculator');
    await expect(page.getByTestId('eta-first-screen-intro')).toBeVisible();
    for (const scenario of ['build', 'migration', 'batch', 'conversion']) {
      await expect(page.getByTestId(`eta-scenario-${scenario}`)).toBeVisible();
    }
    await page.getByTestId('eta-schedule-weekdays').click();

    await expect(page.getByTestId('eta-working-start')).toBeVisible();
    await expect(page.getByTestId('eta-working-end')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});
