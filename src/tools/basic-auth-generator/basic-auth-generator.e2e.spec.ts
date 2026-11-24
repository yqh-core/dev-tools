import { expect, test } from '@playwright/test';

test.describe('Tool - Basic Auth generator', () => {
  test('explains the header format and generates the expected sample value', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    const guide = page.getByTestId('basic-auth-guide');
    await expect(guide).toContainText('Base64 is encoding, not encryption');
    await expect(guide).toContainText('Use HTTPS');

    await page.getByPlaceholder('Your username...').fill('demo');
    await page.getByPlaceholder('Your password...').fill('example');
    await expect(page.getByTestId('basic-auth-generated-header')).toContainText(
      'Authorization: Basic ZGVtbzpleGFtcGxl',
    );
    await expect(page.getByTestId('basic-auth-curl-example')).toContainText(
      '$BASIC_AUTH_USERNAME:$BASIC_AUTH_PASSWORD',
    );
    await expect(page.getByRole('link', { name: 'Base64 String Converter' })).toHaveAttribute('href', '/base64-string-converter/');
    await expect(page.getByRole('link', { name: 'API Debugger' })).toHaveAttribute('href', '/api-debugger/');
  });

  test('decodes a Basic Auth header locally and preserves colons in the password', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    await page.getByPlaceholder('Paste Authorization: Basic ...').fill(
      'Authorization: Basic c3ZjOnBhc3M6d29yZA==',
    );
    await expect(page.getByTestId('basic-auth-decoded-username')).toHaveText('svc');

    const decodedPassword = page.getByTestId('basic-auth-decoded-password');
    const togglePassword = page.getByTestId('basic-auth-toggle-password');
    await expect(decodedPassword).toHaveText('••••••••');
    await expect(togglePassword).toHaveText('Show decoded password');
    await expect(togglePassword).toHaveAttribute('aria-pressed', 'false');

    await togglePassword.click();
    await expect(decodedPassword).toHaveText('pass:word');
    await expect(togglePassword).toHaveText('Hide decoded password');
    await expect(togglePassword).toHaveAttribute('aria-pressed', 'true');

    // A new credential must return to the safe hidden state.
    await page.getByPlaceholder('Paste Authorization: Basic ...').fill(
      'Authorization: Basic ZGVtbzpleGFtcGxl',
    );
    await expect(decodedPassword).toHaveText('••••••••');
    await expect(togglePassword).toHaveAttribute('aria-pressed', 'false');

    await togglePassword.click();
    await expect(decodedPassword).toHaveText('example');
  });

  test('creates copy-ready cURL, Node.js and Python examples for a validated request URL', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    const requestUrl = page.getByTestId('basic-auth-request-url').locator('input');
    await expect(page.getByTestId('basic-auth-curl-example')).toContainText('https://api.example.com/v1/resource');
    await expect(page.getByTestId('basic-auth-node-fetch-example')).toContainText('Buffer.from(credentials, \'utf8\')');
    await expect(page.getByTestId('basic-auth-python-requests-example')).toContainText('requests.get');

    await requestUrl.fill('https://api.example.com/v2/users?q=1&role=admin');
    await expect(page.getByTestId('basic-auth-curl-example')).toContainText('\'https://api.example.com/v2/users?q=1&role=admin\'');
    await expect(page.getByTestId('basic-auth-node-fetch-example')).toContainText('https://api.example.com/v2/users?q=1&role=admin');
    await expect(page.getByTestId('basic-auth-python-requests-example')).toContainText('https://api.example.com/v2/users?q=1&role=admin');

    await requestUrl.fill('javascript:alert(1)');
    await expect(page.getByTestId('basic-auth-request-url-error')).toBeVisible();
    await expect(page.getByTestId('basic-auth-curl-example')).toHaveCount(0);
  });

  test('shows a useful error for an invalid Basic Auth token', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    await page.getByPlaceholder('Paste Authorization: Basic ...').fill('not-base64');
    await expect(page.getByTestId('basic-auth-decode-error')).toContainText('valid Basic Authorization header');
  });

  test('rejects a colon in the username and never generates a malformed credential', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    await page.getByPlaceholder('Your username...').fill('svc:admin');
    await page.getByPlaceholder('Your password...').fill('secret');
    await expect(page.getByTestId('basic-auth-username-error')).toHaveText(
      'A Basic Authentication username cannot contain a colon.',
    );
    await expect(page.getByTestId('basic-auth-generated-header')).toBeEmpty();
  });
});
