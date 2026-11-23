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
    await expect(page.getByTestId('basic-auth-decoded-password')).toHaveText('pass:word');
  });

  test('shows a useful error for an invalid Basic Auth token', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    await page.getByPlaceholder('Paste Authorization: Basic ...').fill('not-base64');
    await expect(page.getByTestId('basic-auth-decode-error')).toContainText('valid Basic Authorization header');
  });
  test('rejects a colon in the username instead of generating an invalid Basic credential', async ({ page }) => {
    await page.goto('/basic-auth-generator');

    await page.getByPlaceholder('Your username...').fill('svc:admin');
    await page.getByPlaceholder('Your password...').fill('secret');
    await expect(page.getByTestId('basic-auth-username-error')).toHaveText(
      'A Basic Authentication username cannot contain a colon.',
    );
    await expect(page.getByTestId('basic-auth-generated-header')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Copy header' })).toBeDisabled();
  });

});
