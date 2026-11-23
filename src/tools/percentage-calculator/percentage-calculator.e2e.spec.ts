import { expect, test } from '@playwright/test';

test.describe('Tool - Percentage calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/percentage-calculator');
  });

  test('Has the intended search title, description and H1', async ({ page }) => {
    await expect(page).toHaveTitle('Percentage Calculator — Percent & Change - DigDevBox');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Calculate a percentage, reverse an increase or discount, compare two values, and find percentage-point changes. Seven free calculator modes in your browser.',
    );
    await expect(page.locator('h1')).toHaveText('Percentage Calculator');
  });

  test('Explains all seven supported percentage tasks with correct formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('seven common percentage problems');
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
  test('calculates labelled batch rows, copies formulas and CSV, and clears local history', async ({ page }) => {
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            document.documentElement.setAttribute('data-test-clipboard', text);
          },
        },
      });
    });

    await page.getByTestId('percentage-batch-panel').locator('summary').click();
    await page.getByTestId('percentage-batch-mode').selectOption('percent-of');
    await page.getByTestId('percentage-batch-input').fill('Groceries\t20\t150\nTaxi\t10\t40');
    await page.getByTestId('percentage-batch-run').click();

    const groceries = page.getByTestId('percentage-batch-result-1');
    const taxi = page.getByTestId('percentage-batch-result-2');
    await expect(groceries).toContainText('Groceries');
    await expect(groceries).toContainText('(20 ÷ 100) × 150 = 30');
    await expect(groceries).toContainText('30');
    await expect(taxi).toContainText('4');
    await expect(page.getByTestId('percentage-batch-history-item')).toHaveCount(1);

    await groceries.getByRole('button', { name: 'Copy row' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /Groceries/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /30/);

    await page.getByTestId('percentage-batch-copy-csv').click();
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /"Groceries","20","150"/);
    await expect(page.locator('html')).toHaveAttribute('data-test-clipboard', /"Taxi","10","40"/);

    await page.getByTestId('percentage-batch-history-item').getByRole('button', { name: 'Restore' }).click();
    await expect(page.getByTestId('percentage-batch-input')).toHaveValue('Groceries\t20\t150\nTaxi\t10\t40');

    await page.getByTestId('percentage-batch-clear-history').click();
    await expect(page.getByTestId('percentage-batch-history-item')).toHaveCount(0);
    await expect(page.getByTestId('percentage-batch-status')).toContainText('Local history cleared');
  });

  test('isolates invalid rows and keeps valid batch results available', async ({ page }) => {
    await page.getByTestId('percentage-batch-panel').locator('summary').click();
    await page.getByTestId('percentage-batch-mode').selectOption('part-to-whole');
    await page.getByTestId('percentage-batch-input').fill('Invalid\t30\t0\nValid\t30\t120');
    await page.getByTestId('percentage-batch-run').click();

    await expect(page.getByTestId('percentage-batch-result-1')).toContainText('whole value cannot be zero');
    await expect(page.getByTestId('percentage-batch-result-2')).toContainText('25%');
    await expect(page.getByTestId('percentage-batch-status')).toContainText('1 of 2 rows calculated');
  });

});
