import { expect, test } from '@playwright/test';

test.describe('Tool - multi-user htpasswd generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/htpasswd-generator');
  });

  test('adds users and generates independently salted apr1 entries', async ({ page }) => {
    await page.getByLabel('Username:').nth(0).fill('alice');
    await page.getByLabel('Password:').nth(0).fill('alice-secret');
    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('Username:').nth(1).fill('bob');
    await page.getByLabel('Password:').nth(1).fill('bob-secret');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();

    const output = page.locator('pre');
    await expect(output).toContainText(/^alice:\$apr1\$/);
    await expect(output).toContainText(/\nbob:\$apr1\$/);
    const lines = (await output.innerText()).split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].split('$')[2]).not.toEqual(lines[1].split('$')[2]);
  });

  test('rejects duplicate usernames and empty passwords', async ({ page }) => {
    await page.getByLabel('Username:').nth(0).fill('Admin');
    await page.getByLabel('Password:').nth(0).fill('one');
    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('Username:').nth(1).fill('admin');
    await page.getByLabel('Password:').nth(1).fill('two');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();
    await expect(page.getByText('Duplicate username: admin')).toBeVisible();

    await page.getByLabel('Username:').nth(1).fill('bob');
    await page.getByLabel('Password:').nth(1).fill('');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();
    await expect(page.getByText('User 2: password is required')).toBeVisible();
  });

  test('downloads the generated file and retains first-line verification', async ({ page }) => {
    await page.getByLabel('Username:').nth(0).fill('alice');
    await page.getByLabel('Password:').nth(0).fill('secret');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .htpasswd' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('.htpasswd');

    await page.getByRole('button', { name: 'Verify first entry' }).click();
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(page.getByText('Password matches')).toBeVisible();
  });

  test('keeps the user workflow within a 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Add user' }).click();
    await page.getByLabel('Username:').nth(1).fill('mobile-user');
    await page.getByLabel('Password:').nth(1).fill('secret');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();
    await expect(page.locator('pre')).toContainText('mobile-user:');
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
});
