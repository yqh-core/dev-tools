import { expect, test } from '@playwright/test';

test.describe('Unix timestamp converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/unix-timestamp-converter');
  });

  test('Format is auto detected from a unix timestamp and the date is correctly converted', async ({ page }) => {
    const initialFormat = await page.getByTestId('unix-timestamp-converter-format-select').innerText();
    expect(initialFormat.trim()).toEqual('Unix timestamp');

    await page.getByTestId('unix-timestamp-converter-input').fill('1681333824');

    const detectedFormat = await page.getByTestId('unix-timestamp-converter-format-select').innerText();
    expect(detectedFormat.trim()).toEqual('Unix timestamp');

    expect((await page.getByTestId('Unix timestamp').inputValue()).trim()).toEqual('1681333824');
    expect((await page.getByTestId('Timestamp').inputValue()).trim()).toEqual('1681333824000');
    expect((await page.getByTestId('UTC format').inputValue()).trim()).toEqual('Wed, 12 Apr 2023 21:10:24 GMT');
  });
});
