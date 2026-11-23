import { expect, test } from '@playwright/test';

test.describe('Tool - text statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-statistics');
  });

  test('shows a worked example with transparent counting rules', async ({ page }) => {
    const example = page.getByTestId('text-statistics-example');
    await expect(example).toContainText('Hello, world!');
    await expect(example).toContainText('29');
    await expect(example).toContainText('6');
    await expect(example).toContainText('UTF-8 bytes');
    await expect(example).toContainText('JavaScript string length');
  });

  test('updates character, word, line and UTF-8 byte counts', async ({ page }) => {
    await page.getByPlaceholder('Your text...').fill('Hello, world!\nThis is a test.');
    await expect(page.getByTestId('character-count')).toContainText('29');
    await expect(page.getByTestId('word-count')).toContainText('6');
    await expect(page.getByTestId('line-count')).toContainText('2');
    await expect(page.getByTestId('byte-size')).toContainText('29 B');
  });

  test('counts non-ASCII text by UTF-8 bytes', async ({ page }) => {
    await page.getByPlaceholder('Your text...').fill('你好');
    await expect(page.getByTestId('character-count')).toContainText('2');
    await expect(page.getByTestId('byte-size')).toContainText('6 B');
  });
});
