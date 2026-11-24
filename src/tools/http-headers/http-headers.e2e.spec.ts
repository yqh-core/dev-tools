import { expect, test } from '@playwright/test';

test.describe('Tool - local HTTP response header analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-headers');
  });

  test('loads a sample and renders a transparent coverage report', async ({ page }) => {
    await page.getByTestId('header-analyzer').getByRole('button', { name: 'Load sample' }).click();

    await expect(page.getByTestId('analysis-results')).toBeVisible();
    await expect(page.getByTestId('coverage-score')).toContainText('100');
    await expect(page.getByTestId('csp-directives')).toContainText('frame-ancestors');
    await expect(page.getByTestId('header-checks')).toContainText('MIME sniffing protection');
  });

  test('identifies weak policies, cookie gaps, CORS conflict and noindex', async ({ page }) => {
    await page.getByTestId('raw-response-headers').locator('textarea').fill([
      'HTTP/2 200 OK',
      'content-security-policy: default-src *; script-src \'unsafe-inline\' \'unsafe-eval\'',
      'access-control-allow-origin: *',
      'access-control-allow-credentials: true',
      'set-cookie: session=abc',
      'x-robots-tag: noindex',
    ].join('\n'));

    await expect(page.getByTestId('header-findings')).toContainText('Weak CSP source expressions');
    await expect(page.getByTestId('header-findings')).toContainText('Conflicting CORS credentials configuration');
    await expect(page.getByTestId('header-findings')).toContainText('X-Robots-Tag prevents indexing');
    await expect(page.getByTestId('analysis-results')).toContainText('SameSite is not explicit');
  });

  test('uses the final response in a redirect chain and preserves repeated cookies', async ({ page }) => {
    await page.getByTestId('raw-response-headers').locator('textarea').fill([
      'HTTP/2 301 Moved Permanently',
      'location: /final',
      '',
      'HTTP/2 200 OK',
      'set-cookie: a=1; Secure; HttpOnly; SameSite=Lax',
      'set-cookie: b=2; Secure; HttpOnly; SameSite=Lax',
    ].join('\n'));

    await expect(page.getByTestId('analysis-results')).toContainText('HTTP/2 200 OK');
    await expect(page.getByTestId('analysis-results')).toContainText('2 response blocks');
  });

  test('clears the analysis and explains invalid pasted data', async ({ page }) => {
    await page.getByTestId('raw-response-headers').locator('textarea').fill('not a response header');
    await expect(page.getByTestId('parse-empty')).toBeVisible();

    await page.getByTestId('header-analyzer').getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByTestId('analysis-results')).toHaveCount(0);
  });
});
