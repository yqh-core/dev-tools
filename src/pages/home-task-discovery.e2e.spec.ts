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

  test('surfaces API Studio in the mobile hero before the long workflow preview', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const studioLink = page.locator('.hero-cta-workspace');
    await expect(studioLink).toBeVisible();
    await expect(studioLink).toHaveAttribute('href', '/api-studio/');

    const box = await studioLink.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);

    await studioLink.click();
    await expect(page).toHaveURL(/api-studio/);
    await expect(page.getByRole('complementary', { name: 'Collections' })).toBeVisible();
    await expect(page.getByTestId('add-request')).toBeVisible();
  });

  test('promotes API Studio from the homepage into the full API workspace', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const apiCard = page.locator('#home-featured .featured-task-card').first();
    const studioLink = apiCard.getByRole('link', { name: 'Open API Studio' });
    await expect(studioLink).toBeVisible();
    await expect(studioLink).toHaveAttribute('href', '/api-studio/');

    await studioLink.click();
    await expect(page).toHaveURL(/api-studio/);
    await expect(page.getByRole('complementary', { name: 'Collections' })).toBeVisible();
    await expect(page.getByTestId('add-request')).toBeVisible();
    await expect(page.getByTestId('import-collection')).toBeHidden();
    await page.getByTestId('data-tools-disclosure').locator('summary').click();
    await expect(page.getByTestId('import-collection')).toBeVisible();
  });

  test('keeps the API Studio entry easy to tap on mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const apiCard = page.locator('#home-featured .featured-task-card').first();
    const studioLink = apiCard.getByRole('link', { name: 'Open API Studio' });
    await expect(studioLink).toBeVisible();

    const box = await studioLink.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);
  });

  test('switches between truthful JSON, JWT and Regex workflow previews', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const preview = page.locator('.home-hero-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('SAMPLE DATA · NO REQUEST SENT');
    await expect(preview.getByTestId('home-demo-tab-json')).toHaveAttribute('aria-pressed', 'true');
    await expect(preview.locator('pre code')).toContainText('"ok":true');
    await expect(preview.locator('a.hero-preview-link')).toHaveAttribute('href', '/json-workspace/');

    const jwtTab = preview.getByTestId('home-demo-tab-jwt');
    await jwtTab.click();
    await expect(jwtTab).toHaveAttribute('aria-pressed', 'true');
    await expect(preview.locator('pre code')).toContainText('NOT VERIFIED');
    await expect(preview.locator('a.hero-preview-link')).toHaveAttribute('href', '/jwt-parser/');

    const regexTab = preview.getByTestId('home-demo-tab-regex');
    await regexTab.focus();
    await expect(regexTab).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(regexTab).toHaveAttribute('aria-pressed', 'true');
    await expect(preview.locator('pre code')).toContainText('2 matches');
    await expect(preview.locator('a.hero-preview-link')).toHaveAttribute('href', '/regex-tester/');
  });

  test('keeps the selectable preview usable within the mobile first fold', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const preview = page.locator('.home-hero-preview');
    await expect(preview).toBeVisible();
    const tabs = preview.locator('.hero-preview-tab');
    await expect(tabs).toHaveCount(3);

    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      await expect(tab).toBeVisible();
    }

    const cta = await preview.locator('a.hero-preview-link').boundingBox();
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(cta).not.toBeNull();
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(844);
    expect(documentWidth).toBeLessThanOrEqual(390);
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

  test('routes device and browser queries to the matching information tools', async ({ page }) => {
    await page.goto('/');
    const firstResult = page.locator('div.grid a.decoration-none').first();

    for (const [query, expectedPath] of [
      ['device info', '/device-information/'],
      ['screen resolution', '/device-information/'],
      ['browser info', '/device-information/'],
      ['user agent', '/user-agent-parser/'],
    ]) {
      await page.getByRole('searchbox').fill(query);
      await expect(firstResult).toHaveAttribute('href', expectedPath);
      await page.getByRole('searchbox').fill('');
    }
  });

  test('starts common tool searches from the first-screen quick actions', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const quickSearch = page.getByRole('group', { name: 'Quick task searches' });
    await expect(quickSearch).toBeVisible();
    await expect(page.getByRole('searchbox')).toBeVisible();

    for (const [testId, query, expectedPath] of [
      ['home-quick-search-json', 'json formatter', '/json-prettify/'],
      ['home-quick-search-jwt', 'jwt decoder', '/jwt-parser/'],
      ['home-quick-search-regex', 'regex tester', '/regex-tester/'],
    ] as const) {
      await page.getByTestId(testId).click();
      await expect(page.getByRole('searchbox')).toHaveValue(query);
      await expect(page.locator('div.grid a.decoration-none').first()).toHaveAttribute('href', expectedPath);
      await page.getByRole('searchbox').fill('');
    }

    const buttons = page.locator('.hero-quick-search-button');
    await expect(buttons).toHaveCount(3);
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);
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

  test('explains browser-local processing, API relay traffic and external lookups accurately', async ({ page }) => {
    await page.goto('/');
    const privacy = page.locator('#home-privacy');

    await expect(privacy).toBeVisible();
    await expect(privacy.getByTestId('home-privacy-local')).toContainText('Most tools process your input in your browser');
    await expect(privacy.getByTestId('home-privacy-local')).toContainText('network request');
    await expect(privacy.getByTestId('home-privacy-storage')).toContainText('localStorage');
    await expect(privacy.getByTestId('home-privacy-storage')).toContainText('not encrypted storage');
    await expect(privacy.getByTestId('home-privacy-relay')).toContainText('API Debugger and API Studio');
    await expect(privacy.getByTestId('home-privacy-relay')).toContainText('first-party relay');
    await expect(privacy.getByText('These lookup tools must query an external service to return a result:')).toBeVisible();
    await expect(privacy.getByRole('link', { name: 'HTTP Status Checker' })).toBeVisible();
    await expect(page.locator('.home-hero-subtitle')).toContainText('Most tasks run in your browser; network-backed tasks use the required service or relay.');
    await expect(page.locator('.home-why-list')).toContainText('Fast: local tasks run in your browser without a server round trip; network-backed tasks connect only when needed.');
  });

  test('features API Studio in the full tools directory', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tools/');

    const flagship = page.locator('a.catalog-flagship');
    await expect(flagship).toBeVisible();
    await expect(flagship).toHaveAttribute('href', '/api-studio/');
    await expect(flagship).toContainText('API Studio');
    await expect(flagship).toContainText('Build requests');
    await flagship.click();

    await expect(page).toHaveURL(/api-studio/);
    await expect(page.getByRole('complementary', { name: 'Collections' })).toBeVisible();
    await expect(page.getByTestId('add-request')).toBeVisible();
  });

  test('features the GSC priority calculators in the Calculate & Convert task', async ({ page }) => {
    await page.goto('/');

    const calculateTask = page.locator('#home-featured .featured-task-card').nth(3);
    await expect(calculateTask.locator('.featured-task-primary')).toHaveAttribute(
      'href',
      '/percentage-calculator/',
    );
    await expect(calculateTask.locator('.featured-task-primary')).toHaveAttribute(
      'aria-label',
      'Open tool Percentage Calculator — 7 Modes',
    );
    await expect(calculateTask.locator('a[href="/eta-calculator/"]')).toBeVisible();
  });
});
