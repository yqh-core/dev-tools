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
    await expect(page.getByTestId('redirect-output').locator('textarea')).toHaveValue(/RedirectMatch 301/);
    await expect(page.getByTestId('redirect-output').locator('textarea')).toHaveValue(/\\^\\/old-product\\\$/);
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
    await expect(report).toContainText('duplicates line');
    await expect(report).toContainText('same path');
    await expect(report).toContainText('part of a loop');
    const generated = await page.getByTestId('redirect-output').locator('textarea').inputValue();
    expect(generated).not.toContain('/same');
    expect(generated).not.toContain('/a');
  });

  test('generates Cloudflare CSV after a site origin is supplied', async ({ page }) => {
    await page.getByTestId('redirect-mappings').locator('textarea').fill('/old,/new');
    await page.getByTestId('redirect-format').click();
    await page.getByText('Cloudflare Bulk Redirect CSV', { exact: true }).click();

    await expect(page.getByTestId('redirect-output-card')).toContainText('Enter a site origin');
    await page.locator('[data-test-id="redirect-origin-input"] input').fill('https://example.com');
    await expect(page.getByTestId('redirect-output').locator('textarea')).toHaveValue(/https:\/\/example\\.com\\\/old/);
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
