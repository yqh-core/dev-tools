import { expect, test } from '@playwright/test';

test.describe('Tool - text statistics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-statistics');
  });

  test('explains the difference between visible characters and storage units', async ({ page }) => {
    await expect(page.getByTestId('counting-methodology')).toContainText('Unicode grapheme clusters');
    await expect(page.getByTestId('counting-methodology')).toContainText('UTF-16 code units');
    await expect(page.getByTestId('counting-methodology')).toContainText('UTF-8 bytes');
  });

  test('updates Unicode, word, line and paragraph metrics as text changes', async ({ page }) => {
    await page.getByTestId('text-input').locator('textarea').fill('Hello hello world.\n\nHello again!');
    await expect(page.getByTestId('words')).toContainText('5');
    await expect(page.getByTestId('unique-words')).toContainText('3');
    await expect(page.getByTestId('sentences')).toContainText('2');
    await expect(page.getByTestId('paragraphs')).toContainText('2');
    await expect(page.getByTestId('non-empty-lines')).toContainText('2');
  });

  test('distinguishes a joined emoji grapheme from code points and UTF-8 bytes', async ({ page }) => {
    await page.getByTestId('text-input').locator('textarea').fill('👨‍👩‍👧');
    await expect(page.getByTestId('graphemes')).toContainText('1');
    await expect(page.getByTestId('code-points')).toContainText('5');
    await expect(page.getByTestId('utf16')).toContainText('8');
    await expect(page.getByTestId('bytes')).toContainText('18');
  });

  test('supports a custom reading speed and exposes a complete statistics summary', async ({ page }) => {
    await page.getByTestId('text-input').locator('textarea').fill('one two three four');
    await page.getByLabel('Reading speed in words per minute').fill('2');
    await expect(page.getByTestId('reading-time')).toContainText('2 min');
    await expect(page.getByTestId('copy-statistics')).toBeVisible();
  });

  test('keeps the tool usable on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('text-input').locator('textarea').fill('Hello 👋');
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });

  test('shows zero metrics for empty input', async ({ page }) => {
    await expect(page.getByTestId('words')).toContainText('0');
    await expect(page.getByTestId('graphemes')).toContainText('0');
    await expect(page.getByTestId('bytes')).toContainText('0');
    await expect(page.getByTestId('paragraphs')).toContainText('0');
  });
  test('shows live top-term counts and updates the denominator when English stop words are excluded', async ({ page }) => {
    await page.getByTestId('text-input').locator('textarea').fill('the cat and the cat dog dog');
    await expect(page.getByTestId('term-denominator')).toContainText('7');
    await expect(page.getByTestId('top-terms')).toContainText('cat');
    await expect(page.getByTestId('top-terms')).toContainText('2');
    await page.getByTestId('exclude-stop-words').check();
    await expect(page.getByTestId('term-denominator')).toContainText('4');
    await expect(page.getByTestId('top-terms')).toContainText('50.0%');
  });

  test('estimates speaking time using an adjustable rate', async ({ page }) => {
    await page.getByTestId('text-input').locator('textarea').fill('one two three four');
    await page.getByLabel('Speaking speed in words per minute').fill('2');
    await expect(page.getByTestId('speaking-time')).toContainText('2 min');
  });
});
