import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test.describe('Tool - local HTTP response header analyzer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/http-headers');
  });

  test('Has the capability-matched title', async ({ page }) => {
    await expect(page).toHaveTitle('HTTP Header Analyzer — HAR Import & Security Score - DigDevBox');
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

  test('imports a HAR locally and lets the user choose a response entry', async ({ page }) => {
    const har = {
      log: {
        entries: [
          {
            request: { method: 'GET', url: 'https://example.com/page' },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2',
              headers: [
                { name: 'content-type', value: 'text/html' },
                { name: 'set-cookie', value: 'session=example; Secure' },
              ],
            },
          },
          {
            request: { method: 'GET', url: 'https://api.example.com/items' },
            response: {
              status: 204,
              statusText: 'No Content',
              httpVersion: 'HTTP/2',
              headers: [
                { name: 'x-content-type-options', value: 'nosniff' },
                { name: 'referrer-policy', value: 'no-referrer' },
              ],
            },
          },
        ],
      },
    };

    await page.getByTestId('har-file-input').setInputFiles({
      name: 'capture.har',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(har)),
    });

    await expect(page.getByTestId('analysis-results')).toContainText('HTTP/2 200 OK');
    await expect(page.getByTestId('analysis-results')).toContainText('Cookie session');
    await expect(page.getByTestId('har-entry-select')).toBeVisible();

    await page.getByTestId('har-entry-select').click();
    await page.getByText('GET https://api.example.com/items — 204 No Content').click();
    await expect(page.getByTestId('analysis-results')).toContainText('HTTP/2 204 No Content');
    await expect(page.getByTestId('header-checks')).toContainText('MIME sniffing protection');
  });

  test('imports a plain-text response header file locally', async ({ page }) => {
    await page.getByTestId('har-file-input').setInputFiles({
      name: 'response.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('HTTP/2 200 OK\\nX-Content-Type-Options: nosniff'),
    });
    await expect(page.getByTestId('analysis-results')).toContainText('HTTP/2 200 OK');
    await expect(page.getByTestId('header-checks')).toContainText('MIME sniffing protection');
  });

  test('rejects local captures larger than the 10 MiB limit before reading them', async ({ page }) => {
    await expect(page.getByText('Maximum file size: 10 MiB.')).toBeVisible();

    // Start each capture from a fresh page at its target viewport; resizing a
    // mounted desktop page can leave the responsive navigation mid-transition.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByText('Maximum file size: 10 MiB.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({
      path: 'test-results/http-status-checker/headers-analyzer-mobile-390x844.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await expect(page.getByText('Maximum file size: 10 MiB.')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    await page.screenshot({
      path: 'test-results/http-status-checker/headers-analyzer-desktop-1440x900.png',
      fullPage: true,
    });

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    await page.getByTestId('har-file-input').setInputFiles({
      name: 'oversized.har',
      mimeType: 'application/json',
      buffer: oversized,
    });

    await expect(page.getByTestId('har-import-error')).toContainText('10 MiB');
    await expect(page.getByTestId('analysis-results')).toHaveCount(0);
  });

  test('rejects invalid HAR files without replacing the current analysis', async ({ page }) => {
    await page.getByTestId('raw-response-headers').locator('textarea').fill('HTTP/2 200 OK');
    await page.getByTestId('har-file-input').setInputFiles({
      name: 'invalid.har',
      mimeType: 'application/json',
      buffer: Buffer.from('{"log":{"entries":"not-an-array"}}'),
    });
    await expect(page.getByTestId('har-import-error')).toContainText('valid HAR 1.2 file');
    await expect(page.getByTestId('analysis-results')).toContainText('HTTP/2 200 OK');
  });

  test('generates copyable server-specific snippets only for missing low-context headers', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByTestId('raw-response-headers').locator('textarea').fill('HTTP/2 200 OK');

    const snippet = page.getByTestId('remediation-snippet');
    await expect(snippet).toContainText('add_header X-Content-Type-Options "nosniff" always;');
    await expect(snippet).toContainText('Strict-Transport-Security "max-age=31536000"');
    await expect(snippet).not.toContainText('Content-Security-Policy:');
    await expect(page.getByTestId('header-remediation')).toContainText('HTTPS');

    await page.getByTestId('remediation-platform').click();
    await page.getByText('Apache', { exact: true }).click();
    await expect(snippet).toContainText('Header always set X-Content-Type-Options "nosniff"');

    await page.getByTestId('remediation-platform').click();
    await page.getByText('Caddy', { exact: true }).click();
    await expect(snippet).toContainText('header {');

    await page.getByTestId('remediation-platform').click();
    await page.getByText('Vercel (vercel.json)', { exact: true }).click();
    const vercelConfig = JSON.parse(await snippet.textContent() || '{}');
    expect(vercelConfig.headers[0].headers).toContainEqual({
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    });

    await page.getByTestId('remediation-platform').click();
    await page.getByText('Cloudflare Pages', { exact: true }).click();
    await expect(snippet).toContainText('/*');

    await page.getByTestId('header-remediation').getByRole('button', { name: 'Copy config' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('X-Content-Type-Options: nosniff');
  });

  test('does not overwrite an existing referrer policy or short HSTS value', async ({ page }) => {
    await page.getByTestId('raw-response-headers').locator('textarea').fill([
      'HTTP/2 200 OK',
      'Referrer-Policy: no-referrer',
      'Strict-Transport-Security: max-age=86400',
      'X-Content-Type-Options: nosniff',
    ].join('\n'));

    await expect(page.getByTestId('remediation-snippet')).not.toContainText('Referrer-Policy');
    await expect(page.getByTestId('remediation-snippet')).not.toContainText('Strict-Transport-Security');
    await expect(page.getByTestId('remediation-snippet')).toContainText('No low-context header additions');
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
