import { expect, test } from '@playwright/test';

test.describe('Tool - Outlook Safe Links batch decoder', () => {
  test('presents batch decoding first and explains its local-only scope', async ({ page }) => {
    await page.goto('/safelink-decoder');

    await expect(page).toHaveTitle('Outlook Safe Links Batch Decoder — Local URL Unwrapper - DigDevBox');
    await expect(page.getByTestId('safelink-batch').locator('h2')).toHaveText('Batch decode Outlook Safe Links');
    await expect(page.getByTestId('safelink-single')).toBeVisible();

    const guide = page.getByTestId('safelink-guide');
    await expect(guide).toContainText('one HTTPS Outlook Safe Links wrapper per line');
    await expect(guide).toContainText('ignores blank lines');
    await expect(guide).toContainText('does not fetch or open');
    await expect(guide).toContainText('does not scan, rate or certify');
    await expect(guide).toContainText('does not replace or bypass');
    await expect(guide.getByRole('link', { name: 'Inspect URL components with URL Parser' })).toHaveAttribute('href', '/url-parser/');
    await expect(guide.getByRole('link', { name: 'Encode or decode URL components' })).toHaveAttribute('href', '/url-encoder/');
    await expect(guide.getByRole('link', { name: 'Read the Outlook Safe Links guide' })).toHaveAttribute('href', '/guides/safelink-decoder/');

    await page.getByPlaceholder('Paste one Outlook Safe Links URL...').fill(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs&data=example',
    );
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('unwraps a nested Outlook Safe Links URL in the single-link compatibility field', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

    await page.getByPlaceholder('Paste one Outlook Safe Links URL...').fill(outer);
    await expect(page.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('decodes multiple links locally, displays URL context and keeps each row independent', async ({ page }) => {
    await page.goto('/safelink-decoder');

    const valid = 'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const invalid = 'https://not-safelinks.example/?url=https%3A%2F%2Fattacker.example';
    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.org%2Fguide';
    const nested = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;
    const textarea = page.getByTestId('safelink-batch-input').locator('textarea');
    const batch = page.getByTestId('safelink-batch');
    const requestedLinks: string[] = [];
    const urlsThatMustNeverBeFetched = new Set([
      valid,
      invalid,
      nested,
      'https://example.com/docs',
      'https://example.org/guide',
      'https://attacker.example',
    ]);

    page.on('request', (request) => {
      if (urlsThatMustNeverBeFetched.has(request.url())) {
        requestedLinks.push(request.url());
      }
    });

    await textarea.fill(`${valid}\n\n${invalid}\n${nested}`);
    await page.getByTestId('safelink-batch-decode').click();

    const results = page.getByTestId('safelink-batch-result');
    await expect(results).toHaveCount(3);
    await expect(results.nth(0)).toHaveAttribute('data-test-line', '1');
    await expect(results.nth(1)).toHaveAttribute('data-test-line', '3');
    await expect(results.nth(2)).toHaveAttribute('data-test-line', '4');
    await expect(results.nth(0)).toHaveAttribute('data-test-status', 'success');
    await expect(results.nth(0).getByTestId('safelink-batch-decoded-url')).toHaveText('https://example.com/docs');
    await expect(results.nth(0).getByTestId('safelink-batch-metadata')).toContainText('Scheme: https');
    await expect(results.nth(0).getByTestId('safelink-batch-metadata')).toContainText('Destination host: example.com');
    await expect(results.nth(0).getByTestId('safelink-batch-metadata')).toContainText('Safe Links wrapper layers: 1');
    await expect(results.nth(1)).toHaveAttribute('data-test-status', 'error');
    await expect(results.nth(1)).toContainText('Invalid SafeLinks URL provided');
    await expect(results.nth(2).getByTestId('safelink-batch-decoded-url')).toHaveText('https://example.org/guide');
    await expect(results.nth(2).getByTestId('safelink-batch-metadata')).toContainText('Safe Links wrapper layers: 2');
    await expect(page.getByTestId('safelink-batch-summary')).toHaveText('2 of 3 links decoded; 1 failed.');
    await expect(batch.getByRole('link')).toHaveCount(0);
    expect(page.url()).toContain('/safelink-decoder');
    expect(requestedLinks).toEqual([]);

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
      'https://example.com/docs\nhttps://example.org/guide',
    );

    await textarea.fill(valid);
    await expect(results).toHaveCount(0);
    await expect(page.getByTestId('safelink-batch-summary')).toHaveCount(0);
    await expect(page.getByTestId('safelink-batch-copy-status')).toHaveCount(0);
  });

  test('keeps the batch workflow keyboard-usable at a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/safelink-decoder');

    const batch = page.getByTestId('safelink-batch');
    const textarea = page.getByTestId('safelink-batch-input').locator('textarea');
    const bounds = await batch.evaluate(element => element.getBoundingClientRect().toJSON());
    expect(bounds.width).toBeLessThanOrEqual(375);

    await textarea.focus();
    await expect(textarea).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('safelink-batch-decode')).toBeFocused();
  });
});
