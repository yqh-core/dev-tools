import { expect, test } from '@playwright/test';

test.describe('Homepage task discovery', () => {
  test('shows five task entry points and retains category browsing', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#home-featured .featured-task-card')).toHaveCount(5);
    await expect(page.locator('#home-tasks')).toBeVisible();
    const directoryLink = page.locator('#home-tasks > a.home-blog-more[href="/tools/"]');
    await expect(directoryLink).toHaveCount(1);
    await expect(directoryLink).toBeVisible();
  });

  test('uses one column without horizontal overflow at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const grid = page.locator('#home-featured .featured-task-grid');
    await expect(grid.locator('.featured-task-card')).toHaveCount(5);
    const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);

    expect(columns).toBe(1);
    expect(documentWidth).toBeLessThanOrEqual(390);
  });

  test('uses three task columns on a desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const grid = page.locator('#home-featured .featured-task-grid');
    const columns = await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);

    expect(columns).toBe(3);
  });

  test('finds API Studio from a task-intent query', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox').fill('api testing');

    await expect(page.locator('.search-result-head')).toBeVisible();
    await expect(page.locator('a[href*="/api-debugger"]').first()).toBeVisible();
  });

  test('ranks Device Information for common English device queries', async ({ page }) => {
    await page.goto('/');
    const firstResult = page.locator('div.grid a.decoration-none').first();

    for (const query of ['device info', 'screen resolution', 'browser info', 'user agent']) {
      await page.getByRole('searchbox').fill(query);
      await expect(firstResult).toHaveAttribute('href', /\\/device-information\\/?$/);
      await page.getByRole('searchbox').fill('');
    }
  });

  test('activates the API task entry with the keyboard', async ({ page }) => {
    await page.goto('/');
    const apiEntry = page.locator('#home-featured .featured-task-primary').first();
    await apiEntry.focus();
    await expect(apiEntry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/api-debugger\/?$/);
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
