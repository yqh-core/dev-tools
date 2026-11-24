import { expect, test } from '@playwright/test';

test.describe('Tool - JSON diff', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/json-diff');
  });

  test('Has the intended JSON diff search title and description', async ({ page }) => {
    await expect(page).toHaveTitle('JSON Diff Checker — Compare JSON Online - DigDevBox');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Compare two JSON objects online. Find added, removed and changed values in nested data; object key order is ignored, and arrays compare by position.',
    );
    await expect(page.locator('h1')).toHaveText('JSON Diff Checker');
  });

  test('Identical JSONs have a custom result message', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"foo":"bar"}');
    await page.getByTestId('rightJson').fill('{   "foo":  "bar" }  ');

    const result = await page.getByTestId('diff-result').innerText();

    expect(result).toContain('The provided JSONs are the same');
  });

  test('Different JSONs have differences listed', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"foo":"bar"}');
    await page.getByTestId('rightJson').fill('{"foo":"buz","baz":"qux"}');

    const result = await page.getByTestId('diff-result').innerText();

    expect(result).toContain('{\nfoo: "bar""buz",\nbaz: "qux",\n},');
  });

  test('Different JSONs have only differences listed when "Only show differences" is checked', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"foo":"bar"}');
    await page.getByTestId('rightJson').fill('{"foo":"bar","baz":"qux"}');
    await page.getByRole('switch').click();

    const result = await page.getByTestId('diff-result').innerText();

    expect(result).toContain('{\nbaz: "qux",\n},');
  });
});
