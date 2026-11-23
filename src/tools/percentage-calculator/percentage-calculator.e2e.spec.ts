import { expect, test } from '@playwright/test';

test.describe('Tool - Percentage calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/percentage-calculator');
  });

  test('Has the intended search title, description and H1', async ({ page }) => {
    await expect(page).toHaveTitle('Percentage Calculator — Percent & Change - DigDevBox');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Calculate percentages, reverse discounts, compare values and rates, or batch rows with copyable formulas and CSV/TSV export. Seven free modes in your browser.',
    );
    await expect(page.locator('h1')).toHaveText('Percentage Calculator');
  });

  test('Explains all seven supported percentage tasks with correct formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('seven common percentage problems');
    await expect(guide).toContainText('Batch percentage calculations for lists and spreadsheets');
    await expect(guide).toContainText('export the full result set as CSV or TSV');
    await expect(guide).toContainText('15% of 80 is 12');
    await expect(guide).toContainText('30 is 25% of 120');
    await expect(guide).toContainText('a 15% increase');
    await expect(guide).toContainText('reducing 80 by 15% gives 68');
    await expect(guide).toContainText('120 after a 20% increase came from 120 ÷ 1.20 = 100');
    await expect(guide).toContainText('the symmetric difference is 40%');
    await expect(guide).toContainText('5% to 7% is +2 percentage points');
    await expect(guide).toContainText('An original value of zero makes percentage change undefined');
  });

  test('Answers common percentage questions with supported formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('How do I calculate a percentage of a number?');
    await expect(guide).toContainText('18% of 250 is');
    await expect(guide).toContainText('How do I find what percentage one number is of another?');
    await expect(guide).toContainText('The total cannot be zero');
    await expect(guide).toContainText('How do I calculate percentage increase or decrease?');
    await expect(guide).toContainText('An original value of zero makes percentage change undefined');
    await expect(guide).toContainText('How do I find the original value before a discount or increase?');
    await expect(guide).toContainText('What is the difference between percentage change and percentage difference?');
    await expect(guide).toContainText('What is a percentage-point change?');
    await expect(guide).toContainText('How do I calculate a discount or add sales tax?');
    await expect(guide).toContainText('actual tax rules depend on the product and location');
  });

  test('Correctly works out all seven percentage calculations', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('123');
    await page.getByTestId('percentageY').locator('input').fill('456');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('560.88');

    await page.getByTestId('numberX').locator('input').fill('123');
    await page.getByTestId('numberY').locator('input').fill('456');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('26.973684210526315');

    await page.getByTestId('numberFrom').locator('input').fill('123');
    await page.getByTestId('numberTo').locator('input').fill('456');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('270.7317073170732');

    await page.getByTestId('adjustmentValue').locator('input').fill('80');
    await page.getByTestId('adjustmentPercent').locator('input').fill('15');
    await expect(page.getByTestId('increasedValue').locator('input')).toHaveValue('92');
    await expect(page.getByTestId('decreasedValue').locator('input')).toHaveValue('68');

    await page.getByTestId('reverseFinalValue').locator('input').fill('120');
    await page.getByTestId('reversePercent').locator('input').fill('20');
    await expect(page.getByTestId('originalBeforeIncrease').locator('input')).toHaveValue('100');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('150');

    await page.getByTestId('reverseFinalValue').locator('input').fill('80');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('100');

    await page.getByTestId('differenceA').locator('input').fill('100');
    await page.getByTestId('differenceB').locator('input').fill('150');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('40');

    await page.getByTestId('differenceA').locator('input').fill('150');
    await page.getByTestId('differenceB').locator('input').fill('100');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('40');

    await page.getByTestId('rateFrom').locator('input').fill('5');
    await page.getByTestId('rateTo').locator('input').fill('7');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('2');
    await page.getByTestId('rateFrom').locator('input').fill('7');
    await page.getByTestId('rateTo').locator('input').fill('5');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('-2');
  });

  test('Handles incomplete input and mathematically undefined cases safely', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('123');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('');

    await page.getByTestId('numberX').locator('input').fill('45');
    await page.getByTestId('numberY').locator('input').fill('0');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('');

    await page.getByTestId('numberFrom').locator('input').fill('0');
    await page.getByTestId('numberTo').locator('input').fill('100');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('');

    await page.getByTestId('reverseFinalValue').locator('input').fill('120');
    await page.getByTestId('reversePercent').locator('input').fill('-100');
    await expect(page.getByTestId('originalBeforeIncrease').locator('input')).toHaveValue('');

    await page.getByTestId('reverseFinalValue').locator('input').fill('80');
    await page.getByTestId('reversePercent').locator('input').fill('100');
    await expect(page.getByTestId('originalBeforeDecrease').locator('input')).toHaveValue('');

    await page.getByTestId('differenceA').locator('input').fill('0');
    await page.getByTestId('differenceB').locator('input').fill('0');
    await expect(page.getByTestId('percentageDifference').locator('input')).toHaveValue('');

    await page.getByTestId('rateFrom').locator('input').fill('5');
    await expect(page.getByTestId('percentagePointChange').locator('input')).toHaveValue('');
  });

  test('Runs pasted batch rows, shows formulas and keeps a local-only history', async ({ page }) => {
    const input = page.getByTestId('percentageBatchInput');
    await input.fill('15\t80\n20\t50');
    await page.getByTestId('runPercentageBatch').click();

    const rows = page.getByTestId('percentageBatchResults').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('(15 ÷ 100) × 80');
    await expect(rows.nth(0)).toContainText('12');
    await expect(rows.nth(1)).toContainText('10');
    await expect(page.getByTestId('percentageBatchStatus')).toContainText('2 row(s) calculated');

    await input.fill('25\t100');
    await page.getByTestId('runPercentageBatch').click();
    await expect(page.getByTestId('percentageBatchHistory').locator('li')).toHaveCount(2);
    await page.reload();
    await expect(page.getByTestId('percentageBatchHistory')).toBeVisible();
    await page.getByTestId('percentageBatchHistory').getByRole('button', { name: 'Restore' }).first().click();
    await expect(input).toHaveValue('25\t100');
    await page.getByTestId('percentageBatchHistory').getByRole('button', { name: 'Delete' }).first().click();
    await expect(page.getByTestId('percentageBatchHistory').locator('li')).toHaveCount(1);
    await page.getByTestId('clearPercentageBatchHistory').click();
    await expect(page.getByTestId('percentageBatchHistory')).toHaveCount(0);
  });

  test('Reports invalid rows and undefined calculations without hiding other rows', async ({ page }) => {
    await page.getByTestId('percentageBatchMode').selectOption('ratio');
    await page.getByTestId('percentageBatchInput').fill('20\t0\nabc\t2\n10\t20\t30');
    await page.getByTestId('runPercentageBatch').click();

    const rows = page.getByTestId('percentageBatchResults').locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('undefined');
    await expect(rows.nth(1)).toContainText('finite numbers');
    await expect(rows.nth(2)).toContainText('exactly two values');
    await expect(page.getByTestId('percentageBatchStatus')).toContainText('0 row(s) calculated; 3 row(s) need attention');
  });

  test('Copies a single row and all batch results', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('percentageBatchInput').fill('15\t80\n20\t50');
    await page.getByTestId('runPercentageBatch').click();

    await page.getByTestId('copyPercentageBatchRow-1').click();
    await expect(page.getByTestId('percentageBatchStatus')).toHaveText('Copied to clipboard.');
    const oneRow = await page.evaluate(() => navigator.clipboard.readText());
    expect(oneRow).toContain('(15 ÷ 100) × 80');
    expect(oneRow).toContain('12');

    await page.getByTestId('copyPercentageBatch').click();
    await expect(page.getByTestId('percentageBatchStatus')).toHaveText('Copied to clipboard.');
    const allRows = await page.evaluate(() => navigator.clipboard.readText());
    expect(allRows).toContain('Row');
    expect(allRows).toContain('20');
    expect(allRows).toContain('10');
  });

  test('Downloads batch results as CSV and TSV', async ({ page }) => {
    await page.getByTestId('percentageBatchInput').fill('15\t80');
    await page.getByTestId('runPercentageBatch').click();

    const csvDownload = page.waitForEvent('download');
    await page.getByTestId('downloadPercentageBatchCsv').click();
    expect((await csvDownload).suggestedFilename()).toBe('percentage-calculations.csv');

    const tsvDownload = page.waitForEvent('download');
    await page.getByTestId('downloadPercentageBatchTsv').click();
    expect((await tsvDownload).suggestedFilename()).toBe('percentage-calculations.tsv');
  });
});
