import { expect, test } from '@playwright/test';

test.describe('Tool - Percentage calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/percentage-calculator');
  });

  test('Has the intended search title, description and H1', async ({ page }) => {
    await expect(page).toHaveTitle('Percentage Calculator — Percent & Change - DigDevBox');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Calculate a percentage of a number, find what percent one value is of another, measure percentage change, or apply a discount or sales tax. Four free calculators.',
    );
    await expect(page.locator('h1')).toHaveText('Percentage Calculator');
  });

  test('Explains the four supported percentage tasks with correct examples', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('How to calculate a percentage');
    await expect(guide).toContainText('15% of 80 is 12');
    await expect(guide).toContainText('30 is 25% of 120');
    await expect(guide).toContainText('a 15% increase');
    await expect(guide).toContainText('reducing 80 by 15% gives 68');
    await expect(guide).toContainText('original value of zero is undefined');
  });

  test('Answers common percentage questions with supported formulas', async ({ page }) => {
    const guide = page.getByTestId('percentage-calculator-guide');
    await expect(guide).toContainText('How do I calculate a percentage of a number?');
    await expect(guide).toContainText('18% of 250 is');
    await expect(guide).toContainText('How do I find what percentage one number is of another?');
    await expect(guide).toContainText('The total cannot be zero');
    await expect(guide).toContainText('How do I calculate percentage increase or decrease?');
    await expect(guide).toContainText('An original value of zero makes percentage change undefined');
    await expect(guide).toContainText('How do I calculate a discount or add sales tax?');
    await expect(guide).toContainText('actual tax rules depend on the product and location');
  });

  test('Correctly works out percentages', async ({ page }) => {
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
  });

  test('Displays empty results for incomplete input', async ({ page }) => {
    await page.getByTestId('percentageX').locator('input').fill('123');
    await expect(page.getByTestId('percentageResult').locator('input')).toHaveValue('');

    await page.getByTestId('numberY').locator('input').fill('456');
    await expect(page.getByTestId('numberResult').locator('input')).toHaveValue('');

    await page.getByTestId('numberFrom').locator('input').fill('123');
    await expect(page.getByTestId('percentageIncreaseDecrease').locator('input')).toHaveValue('');

    await page.getByTestId('adjustmentValue').locator('input').fill('80');
    await expect(page.getByTestId('increasedValue').locator('input')).toHaveValue('');
    await expect(page.getByTestId('decreasedValue').locator('input')).toHaveValue('');
  });
});
