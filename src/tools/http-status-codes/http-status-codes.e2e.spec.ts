import { expect, test } from '@playwright/test';

test.describe('Tool - HTTP status code reference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-status-codes');
  });

  test('has the localized reference title and concise protocol boundary', async ({ page }) => {
    await expect(page).toHaveTitle('HTTP Status Codes Reference - DigDevBox');
    await expect(page.getByTestId('status-response-boundary')).toContainText('DNS, TCP/TLS and timeout failures');
    await expect(page.getByTestId('status-registry-note')).toContainText('Unassigned gaps are omitted');
    await expect(page.getByTestId('status-class-guide')).toContainText('How to read status classes');
  });

  test('uses the RFC semantics for authentication and redirect responses', async ({ page }) => {
    await expect(page.getByTestId('status-code-401')).toContainText('WWW-Authenticate');
    await expect(page.getByTestId('status-code-403')).toContainText('does not by itself mean the user is authenticated');
    await expect(page.getByTestId('status-code-302')).toContainText('may change POST to GET');
    await expect(page.getByTestId('status-code-303')).toContainText('GET (or HEAD when appropriate)');
    await expect(page.getByTestId('status-code-307')).toContainText('must not change the request method');
    await expect(page.getByTestId('status-code-308')).toContainText('must not change the request method');
  });

  test('labels lifecycle and WebDAV extension entries accurately', async ({ page }) => {
    await expect(page.getByTestId('status-code-104')).toContainText('Temporary registration');
    await expect(page.getByTestId('status-code-305')).toContainText('Deprecated');
    await expect(page.getByTestId('status-code-306')).toContainText('(Unused)');
    await expect(page.getByTestId('status-code-418')).toContainText('(Unused)');
    await expect(page.getByTestId('status-code-510')).toContainText('Obsoleted');
    await expect(page.getByTestId('status-code-423')).toContainText('WebDAV extension');
    await expect(page.getByTestId('status-code-507')).toContainText('WebDAV extension');
  });

  test('searches by status code and its meaning', async ({ page }) => {
    const search = page.getByPlaceholder('Search by code, name or meaning…');
    await search.fill('401');
    await expect(page.getByTestId('status-code-401')).toBeVisible();
    await expect(page.getByTestId('status-code-200')).toHaveCount(0);

    await search.fill('Retry-After');
    await expect(page.getByTestId('status-code-429')).toBeVisible();
    await expect(page.getByTestId('status-code-503')).toBeVisible();
  });

  test('uses Chinese labels and supports searching Chinese status names', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('locale'));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zh-CN', 'zh'] });
    });
    await page.reload();

    const search = page.getByPlaceholder('按状态码、名称或含义搜索…');
    await expect(page.getByTestId('status-code-401')).toContainText('未认证');
    await expect(page.getByTestId('status-code-401')).toContainText('WWW-Authenticate');
    await search.fill('内容过大');
    await expect(page.getByTestId('status-code-413')).toBeVisible();
    await expect(page.getByTestId('status-code-401')).toHaveCount(0);
  });

  test('keeps the guide and catalogue within mobile and desktop viewport widths', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.reload();
      await expect(page.getByTestId('status-response-boundary')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.screenshot({
        path: `test-results/http-status-checker/http-status-codes-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });
});
