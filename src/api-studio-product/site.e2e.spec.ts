import { expect, test } from '@playwright/test';

test('product homepage explains the task and shows one primary workspace action', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toHaveAttribute('href', '/app/');
  await expect(page.getByText(/GUIDED PREVIEW · SAMPLE DATA/i)).toBeVisible();
  await expect(page.getByText(/not a live API call/i)).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
  await page.screenshot({ path: testInfo.outputPath('homepage-desktop-first-fold.png') });
});

test('homepage remains usable at 390px without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: /API work/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open API Studio/i }).first()).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await page.screenshot({ path: testInfo.outputPath('homepage-mobile-first-fold.png') });
});

test('workspace opens at /app and keeps the app shell out of search indexing', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/');

  await expect(page.getByRole('link', { name: 'API Studio overview' })).toHaveAttribute('href', '/');
  await expect(page.getByRole('link', { name: 'Guides' })).toHaveAttribute('href', '/docs/');
  await expect(page.getByText('No requests yet')).toBeVisible();
  await expect(page.locator('.api-editor-note')).toHaveText('Saved collections and environment values stay in this browser. Requests pass through our first-party API relay.');

  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toBe('noindex,nofollow');
  const dimensions = await page.evaluate(() => {
    const shell = document.querySelector('.api-studio-shell')?.getBoundingClientRect();
    const workspace = document.querySelector('.api-shell-body')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      shellBottom: shell?.bottom ?? 0,
      shellHeight: shell?.height ?? 0,
      workspaceBottom: workspace?.bottom ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.shellBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  expect(dimensions.shellHeight).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  expect(dimensions.workspaceBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  await page.screenshot({ path: testInfo.outputPath('workspace-desktop-first-fold.png') });
});

test('task guides are directly addressable and link back to the workspace', async ({ page }) => {
  await page.goto('/docs/first-request/');

  await expect(page.getByRole('heading', { level: 1, name: 'Send your first request' })).toBeVisible();
  await expect(page.getByRole('link', { name: /workspace/i })).toHaveAttribute('href', '/app/');
  await expect(page.getByRole('link', { name: /All guides/i })).toHaveAttribute('href', '/docs/');
});

test('all task guides are directly addressable and have a clear task heading', async ({ page }) => {
  const guides = [
    ['/docs/', 'Get from first request to repeatable tests.'],
    ['/docs/first-request/', 'Send your first request'],
    ['/docs/collections/', 'Organize requests and environments'],
    ['/docs/scripts-and-assertions/', 'Turn a response into a test'],
    ['/docs/privacy/', 'Know where your API data goes'],
  ] as const;

  for (const [route, heading] of guides) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole('link', { name: /API Studio/i }).first()).toHaveAttribute('href', '/');
  }
});

test('workspace remains within the mobile viewport and theme control works', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');

  const dimensions = await page.evaluate(() => {
    const shell = document.querySelector('.api-studio-shell')?.getBoundingClientRect();
    const workspace = document.querySelector('.api-shell-body')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      shellBottom: shell?.bottom ?? 0,
      shellHeight: shell?.height ?? 0,
      workspaceBottom: workspace?.bottom ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.shellBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  expect(dimensions.shellHeight).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  expect(dimensions.workspaceBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  await page.screenshot({ path: testInfo.outputPath('workspace-mobile-first-fold.png') });

  const themeToggle = page.getByRole('button', { name: 'Switch to light theme' });
  await expect(themeToggle).toBeVisible();
  await themeToggle.click();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
  await expect(page.locator('.api-studio-shell')).toHaveAttribute('data-api-theme', 'light');
});

test('first request CTA creates one blank request without sending a network call on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const outbound: string[] = [];
  page.on('request', (request) => {
    if (/\/api\//i.test(request.url()) || /apiproxy/i.test(request.url())) {
      outbound.push(request.url());
    }
  });

  await page.goto('/app/');
  const cta = page.getByTestId('create-first-request');
  await expect(cta).toBeVisible();
  await cta.click();

  await expect(page.getByTestId('tree-row')).toHaveCount(1);
  await expect(page.getByText('Start with your first request')).toHaveCount(0);
  await expect(page.getByTestId('editor-url')).toBeVisible();
  expect(outbound).toEqual([]);
});

test('first request CTA is usable on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');

  const cta = page.getByTestId('create-first-request');
  await expect(cta).toBeVisible();
  await cta.click();

  await expect(page.getByTestId('tree-row')).toHaveCount(1);
  await expect(page.getByTestId('editor-url')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});


test('homepage guided walkthrough is keyboard-operable and updates its step copy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const steps = page.getByRole('group', { name: 'Guided demo steps' });
  const assertions = steps.getByRole('button', { name: '03 Assertions' });
  await expect(steps.getByRole('button')).toHaveCount(4);
  await expect(steps.getByRole('button', { name: '01 Request' })).toHaveAttribute('aria-pressed', 'true');

  await assertions.focus();
  await page.keyboard.press('Enter');

  await expect(assertions).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#guided-demo-detail')).toContainText('Check the response');
  await expect(page.locator('#guided-demo-detail')).toContainText('does not send a request').not.toBeVisible();
  await expect(page.locator('#guided-demo-detail')).toContainText('review which checks passed');
});

test('homepage guided walkthrough stays usable on a 390px screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const steps = page.getByRole('group', { name: 'Guided demo steps' });
  const collectionRun = steps.getByRole('button', { name: '04 Collection run' });
  await expect(collectionRun).toBeVisible();
  await collectionRun.click();
  await expect(collectionRun).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#guided-demo-detail')).toContainText('Repeat the whole flow');

  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
