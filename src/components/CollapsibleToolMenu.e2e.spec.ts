import { expect, test } from '@playwright/test';

async function startWithFreshMainPreferences(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('menu-tool-option:collapsed-categories');
    localStorage.setItem('digdevbox.analytics-consent.v1', 'rejected');
  });
}

test.describe('Main sidebar tool-category disclosures', () => {
  test('starts every tool category collapsed on a fresh desktop visit without hiding homepage entry points', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWithFreshMainPreferences(page);
    await page.goto('/');

    const toggles = page.getByTestId('tool-category-toggle');
    await expect(toggles.first()).toBeVisible();
    expect(await toggles.count()).toBeGreaterThan(5);
    await expect(page.locator('[data-test-id="tool-category-toggle"][aria-expanded="true"]')).toHaveCount(0);

    const firstToggle = toggles.first();
    const panelId = await firstToggle.getAttribute('aria-controls');
    const toggleId = await firstToggle.getAttribute('id');
    expect(panelId).toBeTruthy();
    expect(toggleId).toBeTruthy();
    await expect(page.locator(`#${panelId}`)).toHaveAttribute('role', 'region');
    await expect(page.locator(`#${panelId}`)).toHaveAttribute('aria-labelledby', toggleId!);

    await expect(page.getByRole('searchbox')).toBeVisible();
    await expect(page.locator('#home-featured .featured-task-card').first()).toBeVisible();
  });

  test('supports Enter and Space and preserves an explicit expanded preference after reload', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWithFreshMainPreferences(page);
    await page.goto('/');

    const firstToggle = page.getByTestId('tool-category-toggle').first();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await firstToggle.focus();
    await expect(firstToggle).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');

    const box = await firstToggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await page.reload();
    const restoredToggle = page.getByTestId('tool-category-toggle').first();
    await expect(restoredToggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('reveals only the active category on direct tool links without saving the route override', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWithFreshMainPreferences(page);
    await page.goto('/json-prettify/');

    const expanded = page.locator('[data-test-id="tool-category-toggle"][aria-expanded="true"]');
    await expect(expanded).toHaveCount(1);
    const jsonToggle = expanded.first();
    const jsonPanelId = await jsonToggle.getAttribute('aria-controls');
    expect(jsonPanelId).toBeTruthy();
    await expect(page.locator(`#${jsonPanelId} a[href="/json-prettify/"]`)).toBeVisible();

    await page.goto('/jwt-parser/');
    const jwtExpanded = page.locator('[data-test-id="tool-category-toggle"][aria-expanded="true"]');
    await expect(jwtExpanded).toHaveCount(1);
    const jwtPanelId = await jwtExpanded.first().getAttribute('aria-controls');
    expect(jwtPanelId).toBeTruthy();
    await expect(page.locator(`#${jwtPanelId} a[href="/jwt-parser/"]`)).toBeVisible();

    await page.goto('/');
    await expect(page.locator('[data-test-id="tool-category-toggle"][aria-expanded="true"]')).toHaveCount(0);
  });

  test('keeps the mobile disclosure usable with a 44px touch target and no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startWithFreshMainPreferences(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Toggle menu' }).click();
    const firstToggle = page.getByTestId('tool-category-toggle').first();
    await expect(firstToggle).toBeVisible();

    const box = await firstToggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await firstToggle.tap();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');

    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  });
});
