import { expect, test } from '@playwright/test';

test.describe('Tool - Numeronym generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/numeronym-generator');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Numeronym Generator — i18n, a11y & k8s - DigDevBox');
  });

  test('a numeronym is generated when a word is entered', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('internationalization');
    const numeronym = await page.getByTestId('numeronym').locator('input').inputValue();

    expect(numeronym).toEqual('i18n');
  });

  test('converts multiple words one per line and provides copyable results', async ({ page }) => {
    await page.getByTestId('word-input').fill('internationalization\naccessibility\nkubernetes');
    await expect(page.getByTestId('batch-numeronyms').locator('textarea')).toHaveValue('i18n\na11y\nk8s');
  });

  test('when a word has 3 letters or less, the numeronym is the word itself', async ({ page }) => {
    await page.getByTestId('word-input').fill('abc');
    const numeronym = await page.getByTestId('numeronym').inputValue();

    expect(numeronym).toEqual('abc');
  });
});
