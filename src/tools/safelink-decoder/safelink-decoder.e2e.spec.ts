import { expect, test } from '@playwright/test';

test.describe('Tool - Outlook Safe Links decoder', () => {
  test('explains the scope and extracts the destination without opening it', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const guide = page.getByTestId('safelink-guide');
    await expect(guide).toContainText('does not scan the destination');
    await expect(guide).toContainText('does not replace or bypass that protection');
    await expect(guide).toContainText('unwraps nested Outlook Safe Links URLs up to five layers');
    await expect(guide.getByRole('link', { name: 'URL Parser' })).toHaveAttribute('href', '/url-parser/');
    await expect(guide.getByRole('link', { name: 'URL Encoder' })).toHaveAttribute('href', '/url-encoder/');

    await page.getByPlaceholder('Your input Outlook SafeLink Url...').fill(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs&data=example',
    );
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('unwraps a nested Outlook Safe Links URL in the browser', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

    await page.getByPlaceholder('Your input Outlook SafeLink Url...').fill(outer);
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });
});


  test('decodes multiple links locally and keeps each row independent', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const valid = 'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const invalid = 'https://not-safelinks.example/?url=https%3A%2F%2Fattacker.example';
    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.org%2Fguide';
    const nested = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;
    const textarea = page.getByTestId('safelink-batch-input').locator('textarea');
    const batch = page.getByTestId('safelink-batch');
    const requests: string[] = [];

    page.on('request', request => requests.push(request.url()));
    const requestsBeforeDecode = requests.length;

    await textarea.fill(`${valid}\\n\\n${invalid}\\n${nested}`);
    await page.getByTestId('safelink-batch-decode').click();

    const results = page.getByTestId('safelink-batch-result');
    await expect(results).toHaveCount(3);
    await expect(results.nth(0)).toHaveAttribute('data-test-line', '1');
    await expect(results.nth(1)).toHaveAttribute('data-test-line', '3');
    await expect(results.nth(2)).toHaveAttribute('data-test-line', '4');
    await expect(results.nth(0)).toHaveAttribute('data-test-status', 'success');
    await expect(results.nth(0).getByTestId('safelink-batch-decoded-url')).toHaveText('https://example.com/docs');
    await expect(results.nth(1)).toHaveAttribute('data-test-status', 'error');
    await expect(results.nth(1)).toContainText('Invalid SafeLinks URL provided');
    await expect(results.nth(2).getByTestId('safelink-batch-decoded-url')).toHaveText('https://example.org/guide');
    await expect(page.getByTestId('safelink-batch-summary')).toHaveText('2 of 3 links decoded; 1 failed.');
    await expect(batch.getByRole('link')).toHaveCount(0);
    expect(page.url()).toContain('/safelink-decoder');
    expect(requests).toHaveLength(requestsBeforeDecode);

    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            document.documentElement.setAttribute('data-copied-results', value);
          },
        },
      });
    });
    await page.getByTestId('safelink-batch-copy').click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-copied-results',
      'https://example.com/docs\\nhttps://example.org/guide',
    );

    await textarea.fill(valid);
    await expect(results).toHaveCount(0);
    await expect(page.getByTestId('safelink-batch-summary')).toHaveCount(0);
    await expect(page.getByTestId('safelink-batch-copy-status')).toHaveCount(0);
  });
