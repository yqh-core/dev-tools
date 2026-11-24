import { expect, test } from '@playwright/test';

test.describe('Tool - HTTP response header security analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-headers');
  });

  test('analyzes a response locally and recognizes the secure baseline example', async ({ page }) => {
    await page.getByRole('button', { name: 'Load secure example' }).click();

    await expect(page.getByTestId('header-analysis')).toBeVisible();
    await expect(page.getByTestId('header-coverage')).toHaveText('6 / 6 checks present');
    await expect(page.getByTestId('baseline-header-check').filter({ hasText: 'Strict-Transport-Security' })).toContainText('present');
    await expect(page.getByTestId('baseline-header-check').filter({ hasText: 'Content-Security-Policy' })).toContainText('present');
  });

  test('flags weak policies, credentialed wildcard CORS and insecure cookies', async ({ page }) => {
    await page.getByTestId('http-response-headers-input').fill([
      'HTTP/1.1 200 OK',
      'Strict-Transport-Security: max-age=60',
      "Content-Security-Policy: default-src *; script-src 'unsafe-inline'; frame-ancestors *",
      'X-Content-Type-Options: nosniffplease',
      'Referrer-Policy: unsafe-url',
      'Permissions-Policy: camera=*',
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Credentials: true',
      'Set-Cookie: session=abc; SameSite=None; HttpOnly',
    ].join('\n'));

    await expect(page.getByTestId('header-analysis')).toBeVisible();
    await expect(page.getByTestId('baseline-header-check').filter({ hasText: 'Strict-Transport-Security' })).toContainText('review');
    await expect(page.getByTestId('additional-header-finding').filter({ hasText: 'CORS wildcard with credentials' })).toBeVisible();
    await expect(page.getByTestId('additional-header-finding').filter({ hasText: 'SameSite=None cookie without Secure' })).toBeVisible();
  });

  test('reports malformed text and oversized input without making a request', async ({ page }) => {
    const input = page.getByTestId('http-response-headers-input');
    await input.fill('this is not an HTTP header');
    await expect(page.getByTestId('header-analysis-error')).toContainText('No valid HTTP response headers');

    await input.fill('A'.repeat(65537));
    await expect(page.getByTestId('header-analysis-error')).toContainText('64 KB');
  });

  test('clears pasted response headers on request', async ({ page }) => {
    await page.getByRole('button', { name: 'Load secure example' }).click();
    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.getByTestId('http-response-headers-input')).toHaveValue('');
    await expect(page.getByTestId('header-analysis')).toHaveCount(0);
  });
});
