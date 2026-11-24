import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test.describe('Tool - bulk redirect generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/redirect-generator');
  });

  test('loads the tool, analyzes sample mappings and generates Apache exact-path rules', async ({ page }) => {
    await expect(page).toHaveTitle(/Bulk 301 Redirect Generator/);
    await expect(page.getByTestId('redirect-generator')).toBeVisible();
    await page.getByRole('button', { name: 'Load sample' }).click();

    await expect(page.getByTestId('redirect-analysis')).toContainText('3');
    const output = page.getByTestId('redirect-output').locator('textarea');
    await expect(output).toHaveValue(/RedirectMatch 301/);
    expect(await output.inputValue()).toContain('^/old-product$');
  });

  test('shows duplicate, self-redirect and loop errors before export', async ({ page }) => {
    await page.getByTestId('redirect-mappings').locator('textarea').fill([
      '/old,/new',
      '/old,/another',
      '/same,/same',
      '/a,/b',
      '/b,/a',
    ].join('\n'));

    const report = page.getByTestId('redirect-analysis');
    await expect(report).toContainText('already used by another mapping');
    await expect(report).toContainText('same path');
    await expect(report).toContainText('part of a redirect loop');
    const output = await page.getByTestId('redirect-output').locator('textarea').inputValue();
    expect(output).not.toContain('/same');
    expect(output).not.toContain('/a');
  });

  test('generates Cloudflare CSV after a site origin is supplied', async ({ page }) => {
    await page.getByTestId('redirect-mappings').locator('textarea').fill('/old,/new');
    await page.getByTestId('redirect-format').click();
    await page.getByText('Cloudflare Bulk Redirect CSV', { exact: true }).click();

    await expect(page.getByTestId('redirect-output-card')).toContainText('Enter a site origin');
    await page.locator('[data-test-id="redirect-origin-input"] input').fill('https://example.com');
    const output = page.getByTestId('redirect-output').locator('textarea');
    await expect(output).toHaveValue(/"example\.com\/old"/);
    expect(await output.inputValue()).toContain('"example.com/old","https://example.com/new","301"');
  });

  test('generates Netlify _redirects and explains unsupported method-preserving statuses', async ({ page }) => {
    await page.getByTestId('redirect-mappings').locator('textarea').fill('/old,/new');
    await page.getByTestId('redirect-format').click();
    await page.getByText('Netlify _redirects file', { exact: true }).click();
    const output = page.getByTestId('redirect-output').locator('textarea');
    expect(await output.inputValue()).toContain('/old /new 301');

    await page.getByTestId('redirect-status').click();
    await page.getByText('307 — Temporary (preserve method)', { exact: true }).click();
    await expect(page.getByTestId('redirect-output-card')).toContainText('Netlify _redirects supports 301 and 302 redirects only');
  });

  test('generates Vercel JSON and Cloudflare advanced match settings', async ({ page }) => {
    await page.getByTestId('redirect-mappings').locator('textarea').fill('/old,/new');
    await page.getByTestId('redirect-format').click();
    await page.getByText('Vercel vercel.json', { exact: true }).click();
    await page.getByTestId('redirect-preserve-query').click();
    const vercelOutput = page.getByTestId('redirect-output').locator('textarea');
    const vercel = JSON.parse(await vercelOutput.inputValue());
    expect(vercel.redirects[0]).toMatchObject({ source: '/old', destination: '/new', statusCode: 301, preserveQueryParams: true });

    await page.getByTestId('redirect-format').click();
    await page.getByText('Cloudflare Bulk Redirect CSV', { exact: true }).click();
    await page.locator('[data-test-id="redirect-origin-input"] input').fill('https://example.com');
    await page.getByTestId('redirect-include-subdomains').click();
    await page.getByTestId('redirect-subpath-matching').click();
    await page.getByTestId('redirect-preserve-path-suffix').click();
    const cloudflare = await page.getByTestId('redirect-output').locator('textarea').inputValue();
    expect(cloudflare.split('\n')[0].split(',').slice(-3)).toEqual(['"TRUE"', '"TRUE"', '"TRUE"']);
  });

  test('imports a CSV file in the browser', async ({ page }) => {
    await page.getByTestId('redirect-file-import').setInputFiles({
      name: 'redirects.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Source URL,Target URL\n/old,/new'),
    });

    await expect(page.getByTestId('redirect-analysis')).toContainText('1');
    await expect(page.getByTestId('redirect-output').locator('textarea')).toHaveValue(/RedirectMatch 301/);
  });
});
