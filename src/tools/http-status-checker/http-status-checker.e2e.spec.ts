import { expect, test } from '@playwright/test';

test.describe('Tool - HTTP status checker edge response semantics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-status-checker');
  });

  test('shows a received 404 separately from the lookup outcome and includes the final URL', async ({ page }) => {
    let requestedUrl = '';
    await page.route('**/api/webstatus?*', async (route) => {
      requestedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.com/final-page',
          status: 404,
          headers: { 'content-type': 'text/html', 'x-edge-result': 'received' },
        }),
      });
    });

    await page.getByTestId('status-url').locator('input').fill('example.com/start');
    await expect(page.getByText('HTTPS is used when no scheme is entered.')).toBeVisible();
    await page.getByTestId('check-url').click();
    await expect.poll(() => requestedUrl ? new URL(requestedUrl).searchParams.get('url') : '').toBe('https://example.com/start');

    await expect(page.getByTestId('lookup-success')).toBeVisible();
    await expect(page.getByTestId('lookup-success')).toContainText('HTTP response received');
    await expect(page.getByTestId('upstream-status')).toHaveText('404');
    await expect(page.getByTestId('final-url')).toHaveText('https://example.com/final-page');
    await expect(page.getByTestId('copy-final-url')).toBeVisible();
    await expect(page.getByTestId('response-headers')).toContainText('x-edge-result');
    await expect(page.getByTestId('lookup-error')).toHaveCount(0);
  });

  test('keeps partial headers visible when the service has no numeric status', async ({ page }) => {
    await page.route('**/api/webstatus?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://example.com/partial',
          status: null,
          headers: { 'x-partial-result': 'available' },
          error: 'The service returned no upstream HTTP status.',
        }),
      });
    });

    await page.getByTestId('status-url').locator('input').fill('example.com');
    await page.getByTestId('check-url').click();

    await expect(page.getByTestId('lookup-error')).toContainText('no upstream HTTP status');
    await expect(page.getByTestId('response-headers')).toContainText('x-partial-result');
    await expect(page.getByTestId('lookup-success')).toHaveCount(0);
  });

  test('shows a transport failure as a lookup error rather than an upstream status', async ({ page }) => {
    await page.route('**/api/webstatus?*', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unable to connect to the target site.' }),
      });
    });

    await page.getByTestId('status-url').locator('input').fill('example.com');
    await page.getByTestId('check-url').click();

    await expect(page.getByTestId('lookup-error')).toContainText('Unable to connect');
    await expect(page.getByTestId('lookup-success')).toHaveCount(0);
    await expect(page.getByTestId('upstream-status')).toHaveCount(0);
  });
});
