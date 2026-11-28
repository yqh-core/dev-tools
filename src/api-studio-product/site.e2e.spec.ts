import { expect, test } from '@playwright/test';

interface RelayHeader {
  name: string
  value: string
}

interface RelayPayload {
  url: string
  method: string
  headers: RelayHeader[]
  body: string
}

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

test('guided demo shows four inspectable fixture scenes without sending a request', async ({ page }, testInfo) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      apiRequests.push(request.url());
    }
  });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const;
  const scenes = [
    { id: 'request', button: '01 Request', expected: ['POST', '/v1/orders', 'Staging', 'REQUEST BODY'] },
    { id: 'response', button: '02 Response', expected: ['201', 'Created', '14 ms', 'SAMPLE RESPONSE'] },
    { id: 'assertions', button: '03 Assertions', expected: ['JSON path $.id exists', '2 passed', '0 failed', 'SAMPLE RESULT'] },
    { id: 'collection', button: '04 Collection run', expected: ['Checkout smoke tests', '3 requests', '3 / 3 sample outcomes', 'Not a live collection run'] },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    apiRequests.length = 0;

    const steps = page.getByRole('group', { name: 'Guided demo steps' });
    const preview = page.getByTestId('guided-demo-preview');
    await expect(preview).toHaveAttribute('aria-live', 'polite');
    await expect(preview).toHaveAttribute('aria-atomic', 'false');
    await expect(steps.getByRole('button').first()).toHaveAttribute('aria-controls', 'guided-demo-detail guided-demo-preview');
    await expect(steps.getByRole('button')).toHaveCount(4);

    for (const scene of scenes) {
      const button = steps.getByRole('button', { name: scene.button });
      if (scene.id === 'assertions') {
        await button.focus();
        await page.keyboard.press('Enter');
      }
      else {
        await button.click();
      }

      await expect(button).toHaveAttribute('aria-pressed', 'true');
      const scenePanel = page.getByTestId(`guided-demo-scene-${scene.id}`);
      await expect(scenePanel).toBeVisible();
      await expect(preview.locator('.guided-demo-fixture-badge')).toHaveText('FIXTURE DATA · NOT EXECUTED');
      for (const label of scene.expected) {
        await expect(scenePanel).toContainText(label);
      }

      const target = await button.boundingBox();
      expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);

      if (viewport.width === 390) {
        const dimensions = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          previewWidth: document.querySelector('[data-test-id="guided-demo-preview"]')?.getBoundingClientRect().width ?? 0,
        }));
        expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
        expect(dimensions.previewWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
      }

      await page.screenshot({
        path: testInfo.outputPath(`guided-demo-${viewport.name}-${scene.id}.png`),
      });
    }

    expect(apiRequests).toEqual([]);
  }
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

test('completes the first-request journey from a clean /app origin on desktop and mobile', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const baseURL = String(testInfo.project.use.baseURL ?? 'http://127.0.0.1:5050');

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    // Each journey starts at its target viewport. Resizing a live app shell from
    // desktop to mobile can preserve transient desktop intrinsic widths.
    const context = await browser.newContext({
      baseURL,
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const relayPayloads: RelayPayload[] = [];
    let relayAttempts = 0;
    const relayRequests: string[] = [];
    const analyticsRequests: string[] = [];

    // The standalone product HTML deliberately does not load the Main site's consent
    // banner or analytics bootstrap. Verify that privacy boundary instead of waiting
    // for a Reject button that this independent noindex workspace does not render.
    page.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname === '/api/apiproxy') {
        relayRequests.push(request.url());
      }
      if (/google-analytics|googletagmanager|plausible\.io/i.test(requestUrl.hostname)) {
        analyticsRequests.push(request.url());
      }
    });
    // Synthetic responses stay inside the Playwright mock. No live upstream API is called.
    await page.route('**/api/apiproxy', async (route) => {
      const payload = route.request().postDataJSON() as RelayPayload;
      relayPayloads.push(payload);
      relayAttempts += 1;
      const recovered = relayAttempts > 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: payload.url,
          status: recovered ? 200 : 503,
          statusText: recovered ? 'OK' : 'Service Unavailable',
          headers: { 'content-type': 'application/json', 'x-request-id': 'e2e-first-request' },
          body: recovered ? '{"id":42,"created":true}' : '{"error":"Temporary upstream outage"}',
          elapsedMs: recovered ? 14 : 11,
        }),
      });
    });

    await page.goto('/app/');

    // Start with a genuinely fresh product origin. The standalone workspace is noindex
    // and intentionally does not load the Main site's analytics-consent.js; assert that
    // no analytics bootstrap/request or consent state is introduced here.
    const freshStorage = await page.evaluate(() => ({
      tree: localStorage.getItem('api-studio:tree'),
      environment: localStorage.getItem('api-debugger:env'),
      consent: localStorage.getItem('digdevbox.analytics-consent.v1'),
      consentUi: Boolean(document.querySelector('#digdevbox-analytics-consent')),
    }));
    expect(freshStorage).toEqual({ tree: null, environment: null, consent: null, consentUi: false });
    expect(analyticsRequests).toEqual([]);
    await expect(page.getByText('No requests yet')).toBeVisible();

    await page.getByTestId('create-first-request').click();
    await expect(page.getByTestId('tree-row')).toHaveCount(1);
    await expect(page.getByTestId('editor-url')).toBeVisible();
    expect(relayRequests).toEqual([]);
    expect(relayAttempts).toBe(0);

    // Create an environment and variable through the product UI, not localStorage fixtures.
    await page.getByTestId('manage-environments').click();
    await expect(page.getByTestId('environment-management')).toBeVisible();
    await page.getByTestId('new-environment-name').fill('QA');
    await page.getByTestId('create-environment').click();
    await expect(page.getByTestId('env-select')).toContainText('QA');
    await page.getByTestId('scope-environment').click();
    await page.getByTestId('new-var-name').fill('apiVersion');
    await page.getByTestId('new-var-value').fill('v2');
    await page.getByTestId('add-variable').click();
    await expect(page.locator('[data-test-id="var-row"][data-var-name="apiVersion"]')).toBeVisible();
    await page.getByTestId('close-env-manager').click();

    // Configure the request through the editor controls. The environment token is
    // intentionally non-sensitive synthetic data; the relay receives the resolved value.
    await page.getByTestId('editor-name').fill('Create user');
    await page.getByTestId('editor-name').press('Tab');

    const methodSelect = page.getByTestId('editor-method');
    await methodSelect.click();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(methodSelect).toContainText('POST');

    await page.getByTestId('editor-url').fill('https://api.test/users');
    await page.getByTestId('editor-url').press('Tab');
    await page.getByTestId('add-query-param').click();
    await page.getByTestId('query-name').fill('active');
    await page.getByTestId('query-value').fill('true');
    await page.getByTestId('apply-query-params').click();
    await expect(page.getByTestId('editor-url')).toHaveValue('https://api.test/users?active=true');

    await page.getByTestId('add-header').click();
    await page.getByTestId('header-name').fill('x-api-version');
    await page.getByTestId('header-value').fill('{{apiVersion}}');
    await page.getByTestId('header-value').press('Tab');
    await page.getByTestId('editor-body').fill('{"name":"Ada"}');
    await page.getByTestId('editor-body').press('Tab');

    // Add two response checks using the visible assertion editor.
    await page.getByTestId('add-assertion').click();
    await page.getByTestId('assertion-expected').first().fill('200');
    await page.getByTestId('assertion-expected').first().press('Tab');
    await page.getByTestId('add-assertion').click();
    await page.getByTestId('assertion-type').nth(1).click();
    await page.locator('.n-base-select-option').filter({ hasText: /^JSON field$/ }).click();
    await page.getByTestId('assertion-target').fill('$.id');
    // JSON assertions default to "exists", which intentionally has no expected-value field.
    // Select "equals" first so the expected value editor is visible.
    await page.getByTestId('assertion-operator').nth(1).click();
    await page.locator('.n-base-select-option').filter({ hasText: /^equals$/ }).click();
    // A teleported Naive UI menu can remain in its leave transition for one frame.
    // Ensure no stale popup can cover the later Retry hit target.
    await expect(page.locator('.n-base-select-menu:visible')).toHaveCount(0);
    await page.getByTestId('assertion-expected').nth(1).fill('42');
    await page.getByTestId('assertion-expected').nth(1).press('Tab');
    await expect(page.getByTestId('assertion-row')).toHaveCount(2);

    // Nothing is sent until the user explicitly activates Send.
    expect(relayRequests).toEqual([]);
    expect(relayAttempts).toBe(0);
    const send = page.getByTestId('send-request');
    await expect(send).toBeVisible();
    await send.click();

    await expect(page.getByTestId('single-response')).toContainText('503 Service Unavailable');
    const retry = page.getByTestId('retry-send');
    await expect(retry).toBeVisible();
    expect(relayAttempts).toBe(1);
    expect(relayPayloads[0].method).toBe('POST');
    expect(relayPayloads[0].url).toBe('https://api.test/users?active=true');
    expect(relayPayloads[0].headers).toContainEqual({ name: 'x-api-version', value: 'v2' });
    expect(relayPayloads[0].body).toBe('{"name":"Ada"}');

    // A recoverable response never replays by itself. Check the actual mobile target,
    // then require deliberate keyboard activation to send the second attempt.
    expect(relayAttempts).toBe(1);
    await retry.scrollIntoViewIfNeeded();
    await expect(retry).toBeInViewport();
    const retryBox = await retry.boundingBox();
    expect(retryBox).not.toBeNull();
    if (viewport.name === 'mobile') {
      await expect(retry).toHaveCSS('min-height', '44px');
      expect(retryBox!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: testInfo.outputPath('first-request-mobile-503-before-retry.png') });
      const retryHitTest = await retry.evaluate((element) => {
        // Read a viewport-relative DOM rect after scroll. Return the hit element
        // details so a failure identifies an actual overlapping surface.
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hitTarget = document.elementFromPoint(x, y);
        return {
          receivesPointer: hitTarget === element || Boolean(hitTarget && element.contains(hitTarget)),
          hitTag: hitTarget?.tagName ?? null,
          hitClass: typeof hitTarget?.className === 'string' ? hitTarget.className : '',
          hitTestId: hitTarget?.getAttribute('data-test-id') ?? null,
          hitText: hitTarget?.textContent?.trim().slice(0, 100) ?? '',
          rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
          scroll: { x: window.scrollX, y: window.scrollY },
          openMenus: Array.from(document.querySelectorAll('.n-base-select-menu'))
            .filter((menu) => {
              const style = getComputedStyle(menu);
              return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
            })
            .map(menu => ({
              className: menu.className,
              rect: (() => {
                const box = menu.getBoundingClientRect();
                return { left: box.left, top: box.top, width: box.width, height: box.height };
              })(),
            })),
        };
      });
      await testInfo.attach('retry-pointer-hit-test.json', {
        body: JSON.stringify(retryHitTest, null, 2),
        contentType: 'application/json',
      });
      expect(retryHitTest.receivesPointer, JSON.stringify(retryHitTest)).toBe(true);
    }
    const retryViewportGeometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(retryViewportGeometry.documentWidth).toBeLessThanOrEqual(retryViewportGeometry.viewportWidth);
    await retry.focus();
    await expect(retry).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('single-response')).toContainText('200 OK');
    await expect(page.getByTestId('single-response')).toContainText('14 ms');
    await expect(page.getByTestId('single-response-body')).toContainText('"id": 42');
    const assertionReport = page.getByTestId('single-assertion-report');
    await expect(assertionReport).toContainText('2/2 assertions passed');
    await expect(assertionReport.locator('[data-passed="true"]')).toHaveCount(2);
    expect(relayAttempts).toBe(2);

    // Persisted request and environment state is checked at the target viewport.
    const persisted = await page.evaluate(() => ({
      tree: JSON.parse(localStorage.getItem('api-studio:tree') || 'null'),
      environment: JSON.parse(localStorage.getItem('api-debugger:env') || 'null'),
      selectedEnvironment: localStorage.getItem('api-studio:selected-environment'),
    }));
    const savedRequest = persisted.tree?.items?.find((item: { name?: string }) => item.name === 'Create user');
    expect(savedRequest?.request).toMatchObject({
      method: 'POST',
      url: 'https://api.test/users?active=true',
      body: '{"name":"Ada"}',
      headers: [{ name: 'x-api-version', value: '{{apiVersion}}' }],
    });
    expect(savedRequest?.assertions).toHaveLength(2);
    // API Studio keeps its own selection without mutating the legacy API Debugger default.
    expect(persisted.environment?.active).toBe('Default');
    expect(persisted.environment?.envs?.QA?.apiVersion).toBe('v2');
    expect(persisted.selectedEnvironment).toBe('QA');
    await page.screenshot({ path: testInfo.outputPath(`first-request-${viewport.name}-after-retry.png`) });

    // Reload without a seed script: the request and active environment must survive.
    await page.reload();
    await expect(page.getByTestId('tree-row')).toHaveCount(1);
    await page.getByTestId('tree-method').click();
    await expect(page.getByTestId('editor-name')).toHaveValue('Create user');
    await expect(page.getByTestId('editor-method')).toContainText('POST');
    await expect(page.getByTestId('editor-url')).toHaveValue('https://api.test/users?active=true');
    await expect(page.getByTestId('header-value')).toHaveValue('{{apiVersion}}');
    await expect(page.getByTestId('editor-body')).toHaveValue('{"name":"Ada"}');
    await expect(page.getByTestId('assertion-row')).toHaveCount(2);
    await expect(page.getByTestId('env-select')).toContainText('QA');
    await expect(page.getByTestId('env-count')).toHaveText('1 var(s)');

    // Reuse the same saved request and selected environment through Collection Runner.
    await page.getByTestId('run-collection').click();
    await expect(page.getByTestId('run-result')).toContainText('1/1 requests');
    expect(relayAttempts).toBe(3);
    expect(relayPayloads[2].url).toBe('https://api.test/users?active=true');
    expect(relayPayloads[2].headers).toContainEqual({ name: 'x-api-version', value: 'v2' });

    // The full journey stays at its target viewport from first visit through reuse.
    const finalGeometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(finalGeometry.documentWidth).toBeLessThanOrEqual(finalGeometry.viewportWidth);
    await expect(page.getByTestId('editor-url')).toHaveValue('https://api.test/users?active=true');
    await send.focus();
    await expect(send).toBeFocused();
    await expect(send).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('single-response')).toContainText('200 OK');
    expect(relayAttempts).toBe(4);
    await page.screenshot({ path: testInfo.outputPath(`first-request-${viewport.name}-keyboard-send.png`), fullPage: true });
    await context.close();
  }
});
