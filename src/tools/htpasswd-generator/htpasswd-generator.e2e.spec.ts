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

  test('generates an Apache bcrypt hash and explains the Nginx format choice', async ({ page }) => {
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'bcrypt ($2a$, Apache)' }).click();
    await page.getByLabel('Username:').nth(0).fill('apache-user');
    await page.getByLabel('Password:').nth(0).fill('secret');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();
    await expect(page.locator('pre')).toContainText(/^apache-user:\$2a\$10\$/);
    await expect(page.getByText(/Nginx delegates to system crypt/)).toBeVisible();
  });

  test('removes an added user row', async ({ page }) => {
    await page.getByRole('button', { name: 'Add user' }).click();
    await expect(page.getByText('2 users')).toBeVisible();
    await page.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('1 user', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Username:')).toHaveCount(1);
  });

  test('copies the complete generated file', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByLabel('Username:').nth(0).fill('alice');
    await page.getByLabel('Password:').nth(0).fill('secret');
    await page.getByRole('button', { name: 'Generate .htpasswd' }).click();
    await page.getByRole('button', { name: 'Copy file' }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/^alice:\\$apr1\\$/);
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
