import { expect, test } from '@playwright/test';

async function startWithFreshMainPreferences(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    // addInitScript runs again on reload and same-origin navigation. Reset only
    // once per isolated test tab so explicit disclosure choices survive refresh.
    const resetKey = '__e2e_main_preferences_reset';
    if (sessionStorage.getItem(resetKey) !== 'done') {
      localStorage.removeItem('menu-tool-option:collapsed-categories');
      sessionStorage.setItem(resetKey, 'done');
    }
    localStorage.setItem('digdevbox.analytics-consent.v1', 'rejected');
  });
}

test.describe('Main sidebar tool-category disclosures', () => {
  test('starts every tool category collapsed on a fresh desktop visit without hiding homepage entry points', async ({ page }, testInfo) => {
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
    await page.screenshot({ path: testInfo.outputPath('tool-category-desktop-collapsed.png') });
  });

  test('supports Enter and Space and preserves an explicit expanded preference after reload', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startWithFreshMainPreferences(page);
    await page.goto('/');

    const firstToggle = page.getByTestId('tool-category-toggle').first();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await firstToggle.click();
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await firstToggle.focus();
    await expect(firstToggle).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
    await page.screenshot({ path: testInfo.outputPath('tool-category-desktop-expanded.png') });
    await page.keyboard.press('Space');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');

    const box = await firstToggle.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    const categoryName = await firstToggle.getAttribute('data-category-name');
    expect(categoryName).toBeTruthy();
    const savedPreferences = await page.evaluate(() => JSON.parse(
      localStorage.getItem('menu-tool-option:collapsed-categories') || '{}',
    ) as Record<string, boolean>);
    expect(savedPreferences[categoryName!]).toBe(false);

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

  test.describe('mobile touch', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test('keeps the mobile disclosure usable with a 44px touch target and no horizontal overflow', async ({ page }, testInfo) => {
      await startWithFreshMainPreferences(page);
      await page.goto('/');

      await page.getByRole('button', { name: 'Toggle menu' }).click();
      const firstToggle = page.getByTestId('tool-category-toggle').first();
      await expect(firstToggle).toBeVisible();

      const box = await firstToggle.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await firstToggle.tap();
      await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
      await page.screenshot({ path: testInfo.outputPath('tool-category-mobile-expanded.png') });

      const geometry = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    });
  });
});
