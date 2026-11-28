import { expect, test } from '@playwright/test';

test.describe('Tool - HTTP status code reference', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-status-codes');
  });

  test('has the stable title and clearly states the reference boundary', async ({ page }) => {
    await expect(page).toHaveTitle('HTTP status codes - DigDevBox');
    await expect(page.getByTestId('status-response-boundary')).toContainText('DNS, TCP/TLS and timeout failures');
    await expect(page.getByTestId('status-registry-note')).toContainText('Unassigned gaps are omitted');
    await expect(page.getByTestId('status-class-guide')).toContainText('Understand the 1xx–5xx classes');
  });

  test('uses RFC 9110 semantics for authentication and redirects', async ({ page }) => {
    await expect(page.getByTestId('status-code-401')).toContainText('WWW-Authenticate');
    await expect(page.getByTestId('status-code-403')).toContainText('does not prove that the user has authenticated');
    await expect(page.getByTestId('status-code-301')).toContainText('may change POST to GET');
    await expect(page.getByTestId('status-code-302')).toContainText('may change POST to GET');
    await expect(page.getByTestId('status-code-303')).toContainText('GET or HEAD');
    await expect(page.getByTestId('status-code-307')).toContainText('must not change the request method');
    await expect(page.getByTestId('status-code-308')).toContainText('must not change the request method');
  });

  test('uses current lifecycle-sensitive IANA names and WebDAV labels', async ({ page }) => {
    await expect(page.getByTestId('status-code-104')).toContainText('Temporary registration');
    await expect(page.getByTestId('status-code-104')).toContainText('draft-ietf-httpbis-resumable-upload-16');
    await expect(page.getByTestId('status-code-104')).toContainText('not an issued RFC');
    await expect(page.getByTestId('status-code-102')).toContainText('Legacy registration');
    await expect(page.getByTestId('status-code-102')).toContainText('RFC 4918 does not define this status code');
    await expect(page.getByTestId('status-code-305')).toContainText('Deprecated');
    await expect(page.getByTestId('status-code-306')).toContainText('(Unused)');
    await expect(page.getByTestId('status-code-402')).toContainText('Reserved');
    await expect(page.getByTestId('status-code-418')).toContainText('(Unused)');
    await expect(page.getByTestId('status-code-510')).toContainText('Obsoleted');
    await expect(page.getByTestId('status-code-423')).toContainText('WebDAV extension');
    await expect(page.getByTestId('status-code-507')).toContainText('WebDAV extension');
    await expect(page.getByTestId('status-code-413')).toContainText('Content Too Large');
    await expect(page.getByTestId('status-code-422')).toContainText('Unprocessable Content');
  });

  test('searches by status code and its meaning', async ({ page }) => {
    const search = page.getByPlaceholder('Search by code, name or meaning…');
    await search.fill('401');
    await expect(page.getByTestId('status-code-401')).toBeVisible();
    await expect(page.getByTestId('status-code-200')).toHaveCount(0);

    await search.fill('Retry-After');
    await expect(page.getByTestId('status-code-429')).toBeVisible();
    await expect(page.getByTestId('status-code-503')).toBeVisible();

    await search.fill('no-such-http-status-term');
    await expect(page.getByTestId('status-search-empty-state')).toContainText('No matching status codes');
    await expect(page.getByTestId('status-code-200')).toHaveCount(0);
  });

  test('uses Chinese labels and searches Chinese status names', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('locale'));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { configurable: true, get: () => ['zh-CN', 'zh'] });
    });
    await page.reload();

    const search = page.getByPlaceholder('按状态码、名称或含义搜索…');
    await expect(page.getByTestId('status-code-401')).toContainText('未认证');
    await expect(page.getByTestId('status-code-401')).toContainText('WWW-Authenticate');
    await search.fill('510');
    await expect(page.getByTestId('status-code-510')).toContainText('仍保留 510 Not Extended 的历史注册记录');
    await expect(page.getByTestId('status-code-510')).toContainText('OBSOLETED');
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
