import { expect, test } from '@playwright/test';

test.describe('Tool - Outlook Safe Links batch decoder', () => {
  test('makes batch decoding primary and explains its security boundary', async ({ page }) => {
    await page.goto('/safelink-decoder');

    await expect(page.getByRole('heading', { level: 1, name: 'Outlook Safe Links Batch Decoder' })).toBeVisible();
    await expect(page.getByTestId('safelink-batch')).toBeVisible();

    const guide = page.getByTestId('safelink-guide');
    await expect(guide).toContainText('does not fetch, open, scan or certify a destination');
    await expect(guide).toContainText('does not replace, disable or bypass that protection');
    await expect(guide).toContainText('up to five nested layers');
    await expect(guide.getByRole('link', { name: /URL Parser/ })).toHaveAttribute('href', '/url-parser/');
    await expect(guide.getByRole('link', { name: /Outlook Safe Links guide/ }))
      .toHaveAttribute('href', 'https://notes.digdevbox.com/posts/outlook-safelinks-decoder-guide');

    const single = page.getByTestId('safelink-single');
    await expect(single.locator('summary')).toContainText('Decode a single Outlook Safe Links URL');
    await single.locator('summary').click();
    await single.getByPlaceholder('Paste one Outlook Safe Links URL...').fill(
      'https://nam01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs&data=example',
    );
    await expect(single.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('unwraps a nested Outlook Safe Links URL in the optional single-link workflow', async ({ page }) => {
    await page.goto('/safelink-decoder');
    const single = page.getByTestId('safelink-single');
    await single.locator('summary').click();

    const inner = 'https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdocs';
    const outer = `https://nam01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}`;

    await single.getByPlaceholder('Paste one Outlook Safe Links URL...').fill(outer);
    await expect(single.getByTestId('area-content')).toContainText('https://example.com/docs');
  });

  test('decodes multiple links locally, shows URL context and isolates row failures', async ({ page }) => {
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
    await expect(results.nth(0).getByTestId('safelink-batch-result-details'))
      .toHaveText('Destination: https · example.com · 1 wrapper layer(s)');
    await expect(results.nth(1)).toHaveAttribute('data-test-status', 'error');
    await expect(results.nth(1)).toContainText('Invalid SafeLinks URL provided');
    await expect(results.nth(2).getByTestId('safelink-batch-decoded-url')).toHaveText('https://example.org/guide');
    await expect(results.nth(2).getByTestId('safelink-batch-result-details'))
      .toHaveText('Destination: https · example.org · 2 wrapper layer(s)');
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

  test('keeps the batch workflow usable without horizontal page overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/safelink-decoder');

    await expect(page.getByTestId('safelink-batch-input')).toBeVisible();
    await expect(page.getByTestId('safelink-batch-decode')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});
