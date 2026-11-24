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
    expect(await page.getByTestId('numeronym').inputValue()).toEqual('i18n');
    await expect(page.getByTestId('single-letter-count')).toContainText('20 letters counted');
  });

  test('converts multiple words with free-text separators and provides copyable results', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('internationalization, accessibility; Kubernetes\nmultilingualization');
    await expect(page.getByTestId('batch-numeronyms').locator('textarea')).toHaveValue('i18n\na11y\nK8s\nm17n');
    await expect(page.getByTestId('numeronym-batch-table')).toContainText('internationalization');
    await expect(page.getByTestId('numeronym-batch-table')).toContainText('20');
  });

  test('handles Unicode words and compound words in one batch', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('JavaScript, Über; café\ncross-platform\ndon\'t\nこんにちは');
    await expect(page.getByTestId('batch-numeronyms').locator('textarea')).toHaveValue('J8t\nÜ2r\nc2é\nc11m\nd2t\nこ3は');
  });

  test('looks up established terms and leaves unsupported forms visible', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('o11y p13n e2e');
    const table = page.getByTestId('numeronym-batch-table');
    await expect(table).toContainText('observability');
    await expect(table).toContainText('personalization');
    await expect(table).toContainText('Not in the reference list');
    await expect(page.getByTestId('batch-numeronyms').locator('textarea')).toHaveValue('observability\npersonalization');
  });

  test('explains why short single words remain unchanged', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('abc');
    expect(await page.getByTestId('numeronym').inputValue()).toEqual('abc');
    await expect(page.getByTestId('short-word-note')).toContainText('three letters or fewer');
  });

  test('marks short batch terms and excludes unchanged words from Copy All', async ({ page }) => {
    await page.getByTestId('word-input').locator('textarea').fill('internationalization, fox, accessibility, k8s, api');
    const table = page.getByTestId('numeronym-batch-table');
    await expect(table).toContainText('Too short — unchanged');
    await expect(page.getByTestId('batch-numeronyms').locator('textarea')).toHaveValue('i18n\na11y\nKubernetes');
  });

  test('shows a useful reference table when empty', async ({ page }) => {
    const examples = page.getByTestId('numeronym-examples');
    await expect(examples).toContainText('internationalization');
    await expect(examples).toContainText('accessibility');
    await expect(examples).toContainText('Kubernetes');
    await expect(examples).toContainText('personalization');
    await expect(examples).toContainText('observability');
    await expect(page.getByTestId('numeronym-reference').locator('tbody tr')).toHaveCount(11);
  });
});
