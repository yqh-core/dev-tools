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
  await expect(page.getByTestId('retry-guidance')).toContainText('400 or 401');
  await expect(page.getByTestId('retry-guidance')).toContainText('408, 425, 429 or 5xx');
  await expect(page.getByTestId('retry-guidance')).toContainText('Retry is manual');
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
  await expect(page.locator('.api-studio-shell')).toBeVisible();
  await expect(page.getByText('No requests yet')).toBeVisible();

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

test('a first-time user can create, send, validate and restore one request without automatic traffic', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('digdevbox.analytics-consent.v1', 'rejected');
  });

  const relayPayloads: { url: string; method: string; headers: { name: string; value: string }[]; body: string }[] = [];
  let relayAttempts = 0;
  await page.route('**/api/apiproxy', async (route) => {
    relayAttempts += 1;
    relayPayloads.push(route.request().postDataJSON() as typeof relayPayloads[number]);
    const status = relayAttempts === 2 ? 503 : 201;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: relayPayloads[relayPayloads.length - 1]?.url ?? '',
        status,
        statusText: status === 503 ? 'Service Unavailable' : 'Created',
        headers: { 'content-type': 'application/json', 'x-request-id': 'first-use-test' },
        body: JSON.stringify(status === 503
          ? { error: 'Temporary upstream failure' }
          : { id: 42, name: 'Sample widget', active: true }),
        elapsedMs: status === 503 ? 180 : 24,
      }),
    });
  });

  await page.goto('/app/');
  await expect(page.getByText('No requests yet')).toBeVisible();
  const emptyStorage = await page.evaluate(() => ({
    tree: localStorage.getItem('api-studio:tree'),
    environment: localStorage.getItem('api-debugger:env'),
    analyticsConsent: localStorage.getItem('digdevbox.analytics-consent.v1'),
  }));
  expect(emptyStorage.tree).toBeNull();
  expect(emptyStorage.environment).toBeNull();
  expect(emptyStorage.analyticsConsent).toBe('rejected');
  expect(relayAttempts).toBe(0);

  await page.getByTestId('create-first-request').click();
  await expect(page.getByTestId('tree-row')).toHaveCount(1);
  await expect(page.getByTestId('editor-url')).toBeVisible();
  expect(relayAttempts).toBe(0);

  await page.getByTestId('editor-name').fill('Create widget');
  await page.getByTestId('editor-name').press('Tab');

  await page.getByTestId('manage-environments').click();
  await page.getByTestId('new-environment-name').fill('Staging');
  await page.getByTestId('create-environment').click();
  await expect(page.getByTestId('env-select')).toHaveAttribute('aria-label', 'Environment: Staging');
  await page.getByTestId('new-var-name').fill('apiBase');
  await page.getByTestId('new-var-value').fill('https://api.example.test');
  await page.getByTestId('add-variable').click();
  await expect(page.locator('[data-test-id="var-row"][data-var-name="apiBase"]')).toBeVisible();
  await expect(page.getByTestId('env-count')).toHaveText('1 var(s)');
  await page.getByTestId('close-env-manager').click();

  await page.getByTestId('editor-method').click();
  await page.locator('.n-base-select-option').filter({ hasText: 'POST' }).click();

  await page.getByTestId('editor-url').fill('https://api.example.test/v1/widgets');
  await page.getByTestId('editor-url').press('Tab');
  await page.getByTestId('add-query-param').click();
  await page.getByTestId('query-name').fill('limit');
  await page.getByTestId('query-value').fill('2');
  await page.getByTestId('apply-query-params').click();

  await page.getByTestId('add-header').click();
  await page.getByTestId('header-name').fill('content-type');
  await page.getByTestId('header-value').fill('application/json');
  await page.getByTestId('header-value').press('Tab');
  await page.getByTestId('editor-body').fill(JSON.stringify({ name: 'Sample widget', active: true }));
  await page.getByTestId('editor-body').press('Tab');

  await page.getByTestId('add-assertion').click();
  await page.getByTestId('assertion-expected').first().fill('201');
  await page.getByTestId('assertion-expected').first().press('Tab');
  await page.getByTestId('add-assertion').click();

  const jsonType = page.getByTestId('assertion-type').nth(1);
  await jsonType.click();
  await page.locator('.n-base-select-option').filter({ hasText: 'JSON field' }).click();
  const jsonOperator = page.getByTestId('assertion-operator').nth(1);
  await jsonOperator.click();
  await page.locator('.n-base-select-option').filter({ hasText: /^equals$/ }).click();
  await page.getByTestId('assertion-target').fill('$.id');
  await page.getByTestId('assertion-target').press('Tab');
  await page.getByTestId('assertion-expected').nth(1).fill('42');
  await page.getByTestId('assertion-expected').nth(1).press('Tab');

  expect(relayAttempts).toBe(0);
  await page.getByTestId('send-request').click();

  await expect(page.getByTestId('single-response')).toContainText('201 Created');
  await expect(page.getByTestId('single-response')).toContainText('24 ms');
  await expect(page.getByTestId('single-response-body')).toContainText('"name": "Sample widget"');
  const report = page.getByTestId('single-assertion-report');
  await expect(report).toContainText('2/2 assertions passed');
  await expect(report.getByTestId('assertion-result')).toHaveCount(2);
  await expect(report.locator('[data-passed="true"]')).toHaveCount(2);
  await page.locator('.api-response-headers summary').click();
  await expect(page.locator('.api-response-headers pre')).toContainText('x-request-id');
  expect(relayAttempts).toBe(1);
  expect(relayPayloads[0].method).toBe('POST');
  expect(relayPayloads[0].url).toBe('https://api.example.test/v1/widgets?limit=2');
  expect(relayPayloads[0].headers).toContainEqual({ name: 'content-type', value: 'application/json' });
  expect(relayPayloads[0].body).toBe(JSON.stringify({ name: 'Sample widget', active: true }));
  await page.screenshot({ path: testInfo.outputPath('first-request-success-desktop.png'), fullPage: true });

  await page.getByTestId('send-request').click();
  await expect(page.getByTestId('single-response')).toContainText('503 Service Unavailable');
  const retry = page.getByTestId('retry-send');
  await expect(retry).toBeVisible();
  expect(relayAttempts).toBe(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeInViewport();
  const retryBox = await retry.boundingBox();
  expect(retryBox).not.toBeNull();
  expect(retryBox!.height).toBeGreaterThanOrEqual(44);
  const receivesPointer = await page.evaluate(({ x, y }) => {
    return Boolean(document.elementFromPoint(x, y)?.closest('[data-test-id="retry-send"]'));
  }, {
    x: retryBox!.x + retryBox!.width / 2,
    y: retryBox!.y + retryBox!.height / 2,
  });
  expect(receivesPointer).toBe(true);
  const mobileWidth = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(mobileWidth.document).toBeLessThanOrEqual(mobileWidth.viewport);
  await page.screenshot({ path: testInfo.outputPath('first-request-retry-mobile.png'), fullPage: true });

  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('single-response')).toContainText('201 Created');
  await expect(page.getByTestId('single-assertion-report')).toContainText('2/2 assertions passed');
  expect(relayAttempts).toBe(3);

  await page.reload();
  await expect(page.getByTestId('tree-row')).toHaveCount(1);
  await page.getByTestId('tree-method').click();
  await expect(page.getByTestId('editor-name')).toHaveValue('Create widget');
  await expect(page.getByTestId('editor-url')).toHaveValue('https://api.example.test/v1/widgets?limit=2');
  await expect(page.getByTestId('header-value')).toHaveValue('application/json');
  await expect(page.getByTestId('editor-body')).toHaveValue(JSON.stringify({ name: 'Sample widget', active: true }));
  await expect(page.getByTestId('assertion-row')).toHaveCount(2);
  await expect(page.getByTestId('run-collection')).toBeEnabled();
  await expect(page.getByTestId('manage-environments')).toBeVisible();

  const envSelect = page.getByTestId('env-select');
  await envSelect.click();
  const stagingOption = page.locator('.n-base-select-option').filter({ hasText: 'Staging' });
  await expect(stagingOption).toBeVisible();
  await stagingOption.click();
  await expect(envSelect).toHaveAttribute('aria-label', 'Environment: Staging');
  await expect(page.getByTestId('env-count')).toHaveText('1 var(s)');
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('api-studio:tree');
    const envRaw = localStorage.getItem('api-debugger:env');
    return {
      tree: raw ? JSON.parse(raw) as { items: { request: { url: string; body: string }; assertions: unknown[] }[] } : null,
      env: envRaw ? JSON.parse(envRaw) as { envs: Record<string, Record<string, string>> } : null,
    };
  });
  expect(stored.tree?.items[0].request.url).toBe('https://api.example.test/v1/widgets?limit=2');
  expect(stored.tree?.items[0].assertions).toHaveLength(2);
  expect(stored.env?.envs.Staging.apiBase).toBe('https://api.example.test');
  expect(relayAttempts).toBe(3);
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
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      apiRequests.push(request.url());
    }
  });
  await page.goto('/');
  apiRequests.length = 0;

  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '#guided-demo');
  await expect(page.getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '#guided-demo');

  const steps = page.getByRole('group', { name: 'Guided demo steps' });
  const assertions = steps.getByRole('button', { name: '03 Assertions' });
  await expect(steps.getByRole('button')).toHaveCount(4);
  await expect(steps.getByRole('button', { name: '01 Request' })).toHaveAttribute('aria-pressed', 'true');

  await assertions.focus();
  await page.keyboard.press('Enter');

  await expect(assertions).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.guided-demo-detail-meta')).toContainText('ILLUSTRATIVE · NO LIVE REQUEST');
  await expect(page.locator('#guided-demo-detail')).toContainText('Check the response');
  await expect(page.locator('#guided-demo-detail')).not.toContainText('does not send a request');
  await expect(page.locator('#guided-demo-detail')).toContainText('review which checks passed');
  expect(apiRequests).toEqual([]);
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

test('workspace data tools stay secondary behind a keyboard-accessible disclosure on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app/');

  const disclosure = page.getByTestId('data-tools-disclosure');
  const summary = disclosure.locator('summary');
  await expect(disclosure).toHaveJSProperty('open', false);
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('add-request')).toBeVisible();
  await expect(page.getByTestId('add-folder')).toBeVisible();
  await expect(page.getByTestId('run-collection')).toBeVisible();
  await expect(page.getByTestId('env-bar')).toBeVisible();
  await expect(page.getByTestId('create-first-request')).toBeVisible();
  await expect(page.getByTestId('import-file')).toHaveCount(1);
  await expect(page.getByTestId('backup-file')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('workspace-data-tools-desktop-collapsed.png') });
  for (const id of ['backup-safe', 'backup-with-secrets', 'restore-backup', 'import-collection', 'export-collection']) {
    await expect(page.getByTestId(id)).toBeHidden();
  }

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveJSProperty('open', true);
  const dataControls = page.getByRole('group', { name: 'Backup and collection transfer' });
  await expect(dataControls).toBeVisible();
  for (const id of ['backup-safe', 'backup-with-secrets', 'restore-backup', 'import-collection', 'export-collection']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath('workspace-data-tools-desktop-expanded.png') });

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('.api-studio-shell')).toHaveAttribute('data-api-theme', 'light');
  await expect(dataControls).toBeVisible();

  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveJSProperty('open', false);
});

test('workspace data disclosure preserves first-request priority on a 390px screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');

  const disclosure = page.getByTestId('data-tools-disclosure');
  const summary = disclosure.locator('summary');
  await expect(disclosure).toHaveJSProperty('open', false);
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('create-first-request')).toBeVisible();
  await expect(page.getByTestId('env-bar')).toBeVisible();
  for (const id of ['add-request', 'add-folder', 'run-collection']) {
    const target = await page.getByTestId(id).boundingBox();
    expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: testInfo.outputPath('workspace-data-tools-mobile-collapsed.png') });

  await summary.focus();
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveJSProperty('open', true);
  await expect(page.getByTestId('backup-safe')).toBeVisible();
  await expect(page.getByTestId('import-collection')).toBeVisible();
  await expect(page.getByTestId('api-studio-root')).toBeVisible();
  await expect(page.getByTestId('create-first-request')).toBeVisible();
  for (const id of ['backup-safe', 'backup-with-secrets', 'restore-backup', 'import-collection', 'export-collection']) {
    const target = await page.getByTestId(id).boundingBox();
    expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  const geometry = await page.evaluate(() => {
    const sidebar = document.querySelector('.api-sidebar')?.getBoundingClientRect();
    const root = document.querySelector('[data-test-id="api-studio-root"]')?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      sidebarHeight: sidebar?.height ?? 0,
      collectionRootBottom: root?.bottom ?? Number.POSITIVE_INFINITY,
      sidebarBottom: sidebar?.bottom ?? 0,
    };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.sidebarHeight).toBeLessThanOrEqual(400);
  expect(geometry.collectionRootBottom).toBeLessThanOrEqual(geometry.sidebarBottom);
  await page.screenshot({ path: testInfo.outputPath('workspace-data-tools-mobile-expanded.png') });

  await summary.focus();
  await page.keyboard.press('Space');
  await expect(disclosure).toHaveJSProperty('open', false);
  await expect(page.getByTestId('create-first-request')).toBeVisible();
});

test('environment selector keeps common names readable and exposes the full active name on desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('api-debugger:env', JSON.stringify({
      active: 'Default',
      envs: {
        'Default': {},
        'Staging-West-2-Production': {},
      },
      collection: {},
      global: {},
      secrets: [],
    }));
  });
  await page.goto('/app/');

  const envBar = page.getByTestId('env-bar');
  const label = envBar.locator('.api-envbar-label');
  const selector = page.getByTestId('env-select');
  const selectorWrap = page.getByTestId('env-select-wrap');

  await expect(label).toHaveText('Env');
  await expect(label).toHaveAttribute('title', 'Environment');
  await expect(selector).toHaveAttribute('aria-label', 'Environment: Default');
  await expect(selectorWrap).toHaveAttribute('title', 'Default');
  await expect(selector).toContainText('Default');
  await expect(page.getByTestId('manage-environments')).toBeVisible();
  await expect(page.getByTestId('env-count')).toHaveText('0 var(s)');

  const desktopWidth = await selector.boundingBox();
  expect(desktopWidth?.width ?? 0).toBeGreaterThanOrEqual(96);

  const trigger = selector.locator('[tabindex="0"]');
  await expect(trigger).toHaveCount(1);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const longEnvironment = page.locator('.n-base-select-option').filter({ hasText: 'Staging-West-2-Production' });
  await expect(longEnvironment).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await selector.click();
  await longEnvironment.click();
  await expect(selector).toHaveAttribute('aria-label', 'Environment: Staging-West-2-Production');
  await expect(selectorWrap).toHaveAttribute('title', 'Staging-West-2-Production');
  await expect(page.getByTestId('manage-environments')).toBeVisible();
  await expect(page.getByTestId('env-count')).toHaveText('0 var(s)');
  await page.screenshot({ path: testInfo.outputPath('environment-selector-desktop-long-name.png') });

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('.api-studio-shell')).toHaveAttribute('data-api-theme', 'light');
  await expect(selector).toHaveAttribute('aria-label', 'Environment: Staging-West-2-Production');
});

test('environment selector stays within the mobile workspace width with a long name', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('api-debugger:env', JSON.stringify({
      active: 'Staging-West-2-Production',
      envs: {
        'Default': {},
        'Staging-West-2-Production': {},
      },
      collection: {},
      global: {},
      secrets: [],
    }));
  });
  await page.goto('/app/');

  const selector = page.getByTestId('env-select');
  const selectorWrap = page.getByTestId('env-select-wrap');
  await expect(selector).toHaveAttribute('aria-label', 'Environment: Staging-West-2-Production');
  await expect(selectorWrap).toHaveAttribute('title', 'Staging-West-2-Production');
  await expect(page.getByTestId('manage-environments')).toBeVisible();
  await expect(page.getByTestId('env-count')).toHaveText('0 var(s)');

  const geometry = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    environmentBarWidth: document.querySelector('[data-test-id="env-bar"]')?.getBoundingClientRect().width ?? 0,
    selectorWidth: document.querySelector('[data-test-id="env-select"]')?.getBoundingClientRect().width ?? 0,
  }));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.environmentBarWidth).toBeLessThanOrEqual(390);
  expect(geometry.selectorWidth).toBeGreaterThanOrEqual(96);
  await page.screenshot({ path: testInfo.outputPath('environment-selector-mobile-long-name.png') });
});
