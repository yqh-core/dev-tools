import { Buffer } from 'node:buffer';
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
  test('lists nested JSON paths with before and after values', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"user":{"name":"Ada","role":"admin"}}');
    await page.getByTestId('rightJson').fill('{"user":{"name":"Grace","role":"admin","active":true}}');
    const changes = page.getByTestId('change-list');
    await expect(changes).toContainText('$["user"]["name"]');
    await expect(changes).toContainText('$["user"]["active"]');
    await expect(changes).toContainText('2 changed paths');
  });

  test('loads a local JSON file without uploading it', async ({ page }) => {
    await page.getByTestId('left-file').setInputFiles({
      name: 'before.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":1}'),
    });
    await page.getByTestId('rightJson').fill('{"version":2}');
    await expect(page.getByTestId('leftJson')).toHaveValue('{"version":1}');
    await expect(page.getByTestId('change-list')).toContainText('$["version"]');
  });

  test('rejects a local JSON file larger than the documented limit', async ({ page }) => {
    await page.getByTestId('left-file').setInputFiles({
      name: 'too-large.json',
      mimeType: 'application/json',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 32),
    });
    await expect(page.getByTestId('file-error')).toContainText('larger than 5 MB');
  });

  test('downloads a local change report', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"a":1}');
    await page.getByTestId('rightJson').fill('{"a":2}');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download change report' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('json-diff-report.json');
  });
});
