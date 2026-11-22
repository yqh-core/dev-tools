import { expect, test } from '@playwright/test';

test.describe('Homepage task discovery', () => {
  test('shows five task entry points and retains category browsing', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#home-featured .featured-task-card')).toHaveCount(5);
    await expect(page.locator('#home-tasks')).toBeVisible();
    await expect(page.locator('a[href*="/tools"]')).toBeVisible();
  });

  test('finds API Studio from a task-intent query', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').fill('api testing');

    await expect(page.locator('.search-result-head')).toBeVisible();
    await expect(page.locator('a[href*="/api-debugger"]').first()).toBeVisible();
  });

  test('activates the API task entry with the keyboard', async ({ page }) => {
    await page.goto('/');
    const apiEntry = page.locator('#home-featured .featured-task-primary').first();
    await apiEntry.focus();
    await expect(apiEntry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\\/api-debugger\\/?$/);
  });

  test('keeps the three compact homepage controls at 44px touch size', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').fill('jwt');

    const clear = await page.locator('.search-clear').boundingBox();
    const favorite = await page.locator('.grid .c-button').first().boundingBox();
    expect(clear?.width).toBeGreaterThanOrEqual(44);
    expect(clear?.height).toBeGreaterThanOrEqual(44);
    expect(favorite?.width).toBeGreaterThanOrEqual(44);
    expect(favorite?.height).toBeGreaterThanOrEqual(44);

    await page.getByRole('searchbox').fill('');
    const categoryLink = await page.locator('#home-tasks .task-chip').first().boundingBox();
    expect(categoryLink?.width).toBeGreaterThanOrEqual(44);
    expect(categoryLink?.height).toBeGreaterThanOrEqual(44);
  });
});
