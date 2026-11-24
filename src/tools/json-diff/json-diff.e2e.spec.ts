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
      'Compare JSON files or pasted JSON online. Inspect nested changes by path, export a report, and match arrays by index, ignore-order or stable ID. Large comparisons run in a cancellable worker.',
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

  test('jumps from a changed JSON path to its nested comparison location', async ({ page }) => {
    await page.getByTestId('leftJson').fill('{"user":{"name":"Ada","role":"admin"}}');
    await page.getByTestId('rightJson').fill('{"user":{"name":"Grace","role":"admin","active":true}}');

    await page.getByRole('button', { name: 'Focus $["user"]["name"] in comparison' }).click();

    await expect(page.locator('li[data-json-path]').filter({ hasText: 'Grace' }).last()).toHaveClass(/is-focused/);
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
  test('ignores exact JSON Pointer subtrees and keeps sibling changes', async ({ page }) => {
    await page.getByTestId('ignore-paths').fill('/meta/requestId\n/items/0/updatedAt');
    await page.getByTestId('leftJson').fill('{"meta":{"requestId":"old","status":200},"items":[{"updatedAt":"old","value":1}]}');
    await page.getByTestId('rightJson').fill('{"meta":{"requestId":"new","status":500},"items":[{"updatedAt":"new","value":2}]}');

    const changes = page.getByTestId('change-list');
    await expect(changes).toContainText('$["meta"]["status"]');
    await expect(changes).toContainText('$["items"][0]["value"]');
    await expect(changes).not.toContainText('$["meta"]["requestId"]');
    await expect(changes).not.toContainText('$["items"][0]["updatedAt"]');
    await expect(changes).toContainText('2 changed paths');
  });

  test('rejects malformed JSON Pointer escape sequences', async ({ page }) => {
    await page.getByTestId('ignore-paths').fill('/meta/~2field');
    await page.getByTestId('leftJson').fill('{"meta":{"field":1}}');
    await page.getByTestId('rightJson').fill('{"meta":{"field":2}}');
    await expect(page.getByTestId('ignore-path-error')).toContainText('escape ~ as ~0');
  });

  test('ignores array order while preserving duplicate counts', async ({ page }) => {
    await page.getByTestId('array-mode-ignore-order').check();
    await page.getByTestId('leftJson').fill('{"items":[1,2,1]}');
    await page.getByTestId('rightJson').fill('{"items":[1,1,2]}');
    await expect(page.getByTestId('change-list')).toContainText('0 changed paths');
    await expect(page.getByTestId('change-list')).toContainText('No changed paths');
  });

  test('matches array objects by a selected stable ID', async ({ page }) => {
    await page.getByTestId('array-mode-id').check();
    await page.getByLabel('Array object ID key').fill('id');
    await page.getByTestId('leftJson').fill('{"users":[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]}');
    await page.getByTestId('rightJson').fill('{"users":[{"id":2,"name":"Grace Hopper"},{"id":1,"name":"Ada"}]}');
    await expect(page.getByTestId('change-list')).toContainText('$["users"][1]["name"]');
    await expect(page.getByTestId('change-list')).toContainText('1 changed paths');
  });

  test('runs large comparisons in a cancellable background worker', async ({ page }) => {
    await page.getByTestId('array-mode-ignore-order').check();
    const values = Array.from({ length: 25000 }, (_, index) => index);
    const left = JSON.stringify(values);
    const right = JSON.stringify([...values].reverse());
    await page.getByTestId('leftJson').fill(left);
    await page.getByTestId('rightJson').fill(right);

    await expect(page.getByTestId('comparison-status')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('cancel-comparison').click();
    await expect(page.getByTestId('comparison-error')).toContainText('Comparison cancelled');
    await expect(page.getByTestId('comparison-status')).toHaveCount(0);
  });
});
