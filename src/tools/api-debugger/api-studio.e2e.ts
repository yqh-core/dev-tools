import process from 'node:process';
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * API Studio · G3 三层嵌套浏览器 E2E（A-003 查看/编辑/保存/重载 + A-008 三层嵌套/脚本继承）。
 *
 * 真浏览器（chromium）驱动 /api-studio 全屏壳，复用引擎 + 同源 relay 路径：
 *  · 三层嵌套：collection → folder → folder → folder → request，每层带脚本，
 *    断言运行期继承链 chainSources 的 pre(外→内)/test(内→外) 层级顺序；
 *  · 运行：mock /api/apiproxy 中继响应，点 Run，断言 run-result 出现且脚本测试通过；
 *  · 编辑/保存/重载：UI 新建文件夹 + 重命名 → reload 后仍在（localStorage 持久化）。
 * 截图取证写入 e2e-artifacts/（仓库不提交该目录）。
 */

const TREE_KEY = ['api-studio', 'tree'].join(':');
const ENV_KEY = ['api-debugger', 'env'].join(':');
const SHOTS = join(process.cwd(), 'e2e-artifacts');

function seedTree() {
  return {
    id: 'coll-1',
    name: 'Demo API',
    scripts: { prerequest: 'pm.collectionVariables.set("lvl", "collection")' },
    items: [
      {
        id: 'f1',
        name: 'Level One',
        scripts: { prerequest: '// level one pre' },
        items: [
          {
            id: 'f2',
            name: 'Level Two',
            items: [
              {
                id: 'f3',
                name: 'Level Three',
                scripts: { test: '// level three test' },
                items: [
                  {
                    id: 'req-1',
                    name: 'Deep Request',
                    request: { method: 'GET', url: 'https://api.test/deep', headers: [], body: '' },
                    scripts: { test: 'pm.test("status is 200", function () { pm.response.to.have.status(200); });' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function seedStorage(page: import('@playwright/test').Page) {
  return page.addInitScript(
    ([key, val]) => {
      localStorage.setItem(key, val);
    },
    [TREE_KEY, JSON.stringify(seedTree())] as [string, string],
  );
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test('creates a blank first request from the empty state without sending it', async ({ browser }, testInfo) => {
  const baseUrl = String(testInfo.project.use.baseURL ?? process.env.BASE_URL ?? 'http://127.0.0.1:5050');

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const relayRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/apiproxy') {
        relayRequests.push(request.url());
      }
    });

    await page.goto(new URL('/api-studio', baseUrl).toString());

    // The nested Naive UI provider must not insert a wrapper around the shell's
    // flex children, otherwise the header/body height chain collapses.
    const shellLayout = await page.evaluate(() => {
      const shell = document.querySelector('.api-studio-shell');
      const topbar = shell?.querySelector(':scope > .api-topbar');
      const body = shell?.querySelector(':scope > .api-shell-body');
      return {
        display: shell ? getComputedStyle(shell).display : '',
        topbarIsDirectChild: topbar?.parentElement === shell,
        bodyIsDirectChild: body?.parentElement === shell,
        bodyHeight: body?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(shellLayout.display).toBe('flex');
    expect(shellLayout.topbarIsDirectChild).toBe(true);
    expect(shellLayout.bodyIsDirectChild).toBe(true);
    expect(shellLayout.bodyHeight).toBeGreaterThan(600);

    const emptyState = page.locator('.api-editor-empty');
    await expect(emptyState).toBeVisible();
    const createButton = page.getByRole('button', { name: 'Create your first request' });
    await expect(createButton).toHaveText('Create your first request');
    await expect(createButton).toBeEnabled();
    await expect(page.locator('.api-editor-note')).toHaveText(
      'Saved collections and environment values stay in this browser. Requests pass through our first-party API relay.',
    );

    const beforeCreate = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(beforeCreate.scrollWidth).toBeLessThanOrEqual(beforeCreate.width);
    await page.screenshot({ path: join(SHOTS, `03-first-request-empty-${viewport.name}.png`), fullPage: true });

    await createButton.click();

    await expect(page.getByTestId('tree-row')).toHaveCount(1);
    await expect(page.locator('.api-editor-empty')).toHaveCount(0);
    await expect(page.getByTestId('editor-url')).toBeVisible();
    await expect(page.getByTestId('editor-url')).toHaveValue('');
    await expect(page.getByTestId('send-request')).toBeEnabled();
    expect(relayRequests).toEqual([]);

    await page.screenshot({ path: join(SHOTS, `04-first-request-created-${viewport.name}.png`), fullPage: true });
    await context.close();
  }
});

test('empty state clearly separates browser storage from request relay traffic', async ({ page }) => {
  await page.goto('/api-studio');

  await expect(page.locator('.api-editor-note')).toHaveText(
    'Saved collections and environment values stay in this browser. Requests pass through our first-party API relay.',
  );
});

test('three-level nested tree renders with correct script inheritance chain', async ({ page }) => {
  await seedStorage(page);
  await page.goto('/api-studio');

  // collection → f1 → f2 → f3 → req-1：4 个非根行，深度 0..3
  await expect(page.getByTestId('tree-row')).toHaveCount(4);
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'Level One' })).toHaveAttribute('data-depth', '0');
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'Deep Request' })).toHaveAttribute('data-depth', '3');

  // 选中唯一请求（方法徽章）
  await page.getByTestId('tree-method').click();

  // Before 外→内：collection, folder, folder, folder, request
  const before = page.getByTestId('chain-before').getByTestId('chain-item');
  await expect(before).toHaveCount(5);
  await expect(before.nth(0)).toHaveAttribute('data-level', 'collection');
  await expect(before.nth(1)).toHaveAttribute('data-level', 'folder');
  await expect(before.nth(2)).toHaveAttribute('data-level', 'folder');
  await expect(before.nth(3)).toHaveAttribute('data-level', 'folder');
  await expect(before.nth(4)).toHaveAttribute('data-level', 'request');

  // After 内→外：request 先，collection 后
  const after = page.getByTestId('chain-after').getByTestId('chain-item');
  await expect(after.nth(0)).toHaveAttribute('data-level', 'request');
  await expect(after.nth(4)).toHaveAttribute('data-level', 'collection');

  // 继承来源的「有脚本」标记：collection/f1/f3/request 有，f2 无
  await expect(before.nth(0)).toHaveAttribute('data-has-scripts', 'true');
  await expect(before.nth(2)).toHaveAttribute('data-has-scripts', 'false');

  await page.screenshot({ path: join(SHOTS, '01-nested-chain.png'), fullPage: true });
});

test('runs the nested collection through the relay and reports results', async ({ page }) => {
  // 用无脚本的嵌套请求，专注验证「collection→folder→request 按序执行 + 同源中继传输 + 报告呈现」。
  // 脚本继承的可视化由上一个用例（chain 视图）覆盖；运行期 pm.* 脚本执行由引擎单测覆盖。
  const simple = {
    id: 'coll-2',
    name: 'Ping API',
    items: [
      {
        id: 'grp',
        name: 'Group',
        items: [
          { id: 'ping', name: 'Ping', request: { method: 'GET', url: 'https://api.test/ping', headers: [], body: '' } },
        ],
      },
    ],
  };
  await page.addInitScript(
    ([key, val]) => {
      localStorage.setItem(key, val);
    },
    [TREE_KEY, JSON.stringify(simple)] as [string, string],
  );
  await page.route(/\/api\/apiproxy/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ url: 'https://api.test/ping', status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' }, body: '{"pong":true}', elapsedMs: 5 }),
  }));

  await page.goto('/api-studio');
  await page.getByTestId('run-collection').click();

  const result = page.getByTestId('run-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('1/1 requests');

  await page.screenshot({ path: join(SHOTS, '02-run-pass.png'), fullPage: true });
});

test('shows live collection progress and structured redacted request outcomes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const tree = {
    id: 'runner-progress',
    name: 'Progress Demo',
    items: [
      {
        id: 'first',
        name: 'First request',
        request: { method: 'GET', url: 'https://api.test/first', headers: [], body: '' },
        assertions: [{ id: 'first-status', enabled: true, type: 'status', target: '', operator: 'eq', expected: '200' }],
      },
      {
        id: 'second',
        name: 'Second request',
        request: { method: 'GET', url: 'https://api.test/second?token={{token}}', headers: [], body: '' },
        assertions: [{ id: 'secret-assertion', enabled: true, type: 'json', target: '$.token', operator: 'eq', expected: 'expected-different-value' }],
      },
    ],
  };
  const env = { active: 'Default', envs: { Default: { token: 'marked-secret-value' } }, secrets: ['token'] };
  await page.addInitScript(
    ([treeKey, treeValue, envKey, envValue]) => {
      localStorage.setItem(treeKey, treeValue);
      localStorage.setItem(envKey, envValue);
      // Keep the global consent prompt out of this workspace-flow test. This is
      // an isolated browser context; production consent defaults are untouched.
      localStorage.setItem('digdevbox.analytics-consent.v1', 'rejected');
    },
    [TREE_KEY, JSON.stringify(tree), 'api-debugger:env', JSON.stringify(env)] as [string, string, string, string],
  );

  let finishFirst = () => {};
  let finishSecond = () => {};
  let announceFirst = () => {};
  let announceSecond = () => {};
  const firstGate = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const secondGate = new Promise<void>((resolve) => {
    finishSecond = resolve;
  });
  const firstStarted = new Promise<void>((resolve) => {
    announceFirst = resolve;
  });
  const secondStarted = new Promise<void>((resolve) => {
    announceSecond = resolve;
  });
  const sentUrls: string[] = [];

  await page.route(/\/api\/apiproxy/, async (route) => {
    const payload = route.request().postDataJSON() as { url: string };
    sentUrls.push(payload.url);
    if (payload.url.includes('/first')) {
      announceFirst();
      await firstGate;
    }
    else {
      announceSecond();
      await secondGate;
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: payload.url,
        status: 200,
        statusText: 'OK',
        headers: {},
        body: payload.url.includes('/second') ? JSON.stringify({ token: 'marked-secret-value' }) : '{"ok":true}',
        elapsedMs: 8,
      }),
    });
  });

  await page.goto('/api-studio');
  await page.getByTestId('run-collection').click();
  await firstStarted;
  await expect(page.getByTestId('run-current-request')).toContainText('First request');
  await expect(page.getByTestId('run-current-request')).toContainText('GET https://api.test/first');

  finishFirst();
  await secondStarted;
  await expect(page.getByTestId('run-progress')).toHaveText('1/2 completed');
  await expect(page.getByTestId('run-current-request')).toContainText('Second request');
  await expect(page.getByTestId('run-current-request')).not.toContainText('marked-secret-value');
  finishSecond();

  await expect(page.getByTestId('banner')).toContainText('Run finished with failures');
  await expect(page.getByTestId('run-result')).toContainText('2/2 requests');
  await expect(page.getByTestId('run-request-result')).toHaveCount(2);
  await expect(page.getByTestId('run-request-result').nth(0)).toContainText('PASS');
  await expect(page.getByTestId('run-request-result').nth(1)).toContainText('FAIL');
  const secondResult = page.getByTestId('run-request-result').nth(1);
  await secondResult.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(secondResult).toHaveAttribute('open', '');
  const secondResultText = secondResult;
  await expect(secondResultText).not.toContainText('marked-secret-value');
  await expect(secondResultText).toContainText('Raw values are not printed by default');
  // The result row deliberately omits raw values; the downloadable report below
  // carries the explicit [REDACTED-Secret] marker for copied/exported diagnostics.
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await expect(page.locator('.api-editor-empty')).toHaveCount(0);

  const textReport = page.locator('.api-run-text-report');
  await textReport.locator('summary').click();
  await expect(textReport).toHaveAttribute('open', '');
  const reportText = page.getByTestId('run-text-report');
  await expect(reportText).toContainText('API Studio collection run report');
  await expect(reportText).toContainText('[REDACTED-Secret]');
  const downloadButton = page.getByTestId('download-run-report');
  await expect(downloadButton).toBeVisible();
  await downloadButton.scrollIntoViewIfNeeded();
  await expect(downloadButton).toBeInViewport();
  const downloadOutcome = page.waitForEvent('download', { timeout: 10000 })
    .then(download => ({ download, error: '' }))
    .catch(error => ({ download: null, error: String(error) }));
  await downloadButton.click({ timeout: 10000 });
  await expect(page.getByTestId('banner')).toContainText('Redacted collection report downloaded.');
  const outcome = await downloadOutcome;
  expect(outcome.download, outcome.error || 'The report button did not start a browser download.').not.toBeNull();
  const download = outcome.download!;
  const reportPath = await download.path();
  expect(reportPath).not.toBeNull();
  const downloadedReport = readFileSync(reportPath!, 'utf8');
  expect(downloadedReport).not.toContain('marked-secret-value');
  expect(downloadedReport).toContain('[REDACTED-Secret]');
  expect(sentUrls).toEqual([
    'https://api.test/first',
    'https://api.test/second?token=marked-secret-value',
  ]);
});

test('cancels a collection after the in-flight request finishes and does not send the next request', async ({ page }) => {
  const tree = {
    id: 'runner-cancel',
    name: 'Cancel Demo',
    items: [
      { id: 'first', name: 'Slow first', request: { method: 'GET', url: 'https://api.test/slow', headers: [], body: '' } },
      { id: 'second', name: 'Must not run', request: { method: 'GET', url: 'https://api.test/never', headers: [], body: '' } },
    ],
  };
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [TREE_KEY, JSON.stringify(tree)] as [string, string]);

  let finishFirst = () => {};
  let announceFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const firstStarted = new Promise<void>((resolve) => {
    announceFirst = resolve;
  });
  const sentUrls: string[] = [];
  await page.route(/\/api\/apiproxy/, async (route) => {
    const payload = route.request().postDataJSON() as { url: string };
    sentUrls.push(payload.url);
    announceFirst();
    await firstGate;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: payload.url, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 10 }),
    });
  });

  await page.goto('/api-studio');
  await page.getByTestId('run-collection').click();
  await firstStarted;
  await expect(page.getByTestId('run-current-request')).toContainText('Slow first');
  const cancelRun = page.getByTestId('cancel-run');
  await expect(cancelRun).toBeVisible();
  await expect(cancelRun).toBeInViewport();
  const cancelBounds = await cancelRun.boundingBox();
  expect(cancelBounds).not.toBeNull();
  const cancelReceivesPointer = await page.evaluate(({ x, y }) => {
    return Boolean(document.elementFromPoint(x, y)?.closest('[data-test-id="cancel-run"]'));
  }, {
    x: cancelBounds!.x + cancelBounds!.width / 2,
    y: cancelBounds!.y + cancelBounds!.height / 2,
  });
  expect(cancelReceivesPointer, 'The mobile sidebar must not cover the collection cancel control.').toBe(true);
  await cancelRun.click();
  await expect(page.getByTestId('run-cancel-note')).toContainText('current request or script will finish or time out');
  finishFirst();

  await expect(page.getByTestId('run-result-status')).toHaveText('Cancelled');
  await expect(page.getByTestId('run-result')).toContainText('1/2 requests');
  await expect(page.getByTestId('run-request-result')).toHaveCount(1);
  expect(sentUrls).toEqual(['https://api.test/slow']);
});

test('creating and renaming a folder via the UI persists across reload', async ({ page }) => {
  await page.goto('/api-studio');

  await page.getByTestId('add-folder').click();
  await page.locator('.api-rename').fill('My Folder');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'My Folder' })).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'My Folder' })).toBeVisible();

  await page.screenshot({ path: join(SHOTS, '03-persist-reload.png'), fullPage: true });
});

test('environment drives {{var}} resolution at run time (selector wired to active env)', async ({ page }) => {
  // 确定性验证环境→运行链路：共享 store active=Prod（含 baseUrl），请求 url 用模板 {{baseUrl}}/ping。
  // 载入即把选择器初始化到 active=Prod，运行期中继应收到解析后的真实 URL。
  const envSeed = { active: 'Prod', envs: { Default: {}, Prod: { baseUrl: 'https://api.test' } } };
  const treeSeed = {
    id: 'envcoll',
    name: 'Env Demo',
    items: [{ id: 'ping', name: 'Ping', request: { method: 'GET', url: '{{baseUrl}}/ping', headers: [], body: '' } }],
  };
  await page.addInitScript(
    ([key, val]) => {
      // addInitScript runs on every navigation, including reload. Seed only the empty origin
      // so the reload assertion observes the real persisted collection instead of resetting it.
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, val);
      }
    },
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );
  await page.addInitScript(
    ([key, val]) => {
      localStorage.setItem(key, val);
    },
    ['api-debugger:env', JSON.stringify(envSeed)] as [string, string],
  );

  let sentUrl = '';
  await page.route(/\/api\/apiproxy/, (route) => {
    const body = route.request().postDataJSON() as { url?: string };
    sentUrl = body?.url ?? '';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: sentUrl, status: 200, statusText: 'OK', headers: {}, body: '{}', elapsedMs: 3 }) });
  });

  await page.goto('/api-studio');

  // 选择器就位且初始化到 active 环境（Prod 有 1 个变量）
  await expect(page.getByTestId('env-select')).toBeVisible();
  await expect(page.getByTestId('env-count')).toHaveText('1 var(s)');

  await page.getByTestId('run-collection').click();
  await expect(page.getByTestId('run-result')).toContainText('1/1 requests');
  // {{baseUrl}} 在运行期被解析成真实 URL —— 证明环境接入 Run 生效
  expect(sentUrl).toBe('https://api.test/ping');

  await page.screenshot({ path: join(SHOTS, '04-env-resolve.png'), fullPage: true });
});

test('sends a selected request with edited query params and headers, then inspects the response', async ({ page }) => {
  const treeSeed = {
    id: 'send-collection',
    name: 'Users API',
    items: [
      {
        id: 'get-user',
        name: 'Get user',
        request: {
          method: 'GET',
          url: 'https://api.test/users/42?active=1',
          headers: [
            { name: 'x-api-version', value: 'v1' },
            { name: 'Authorization', value: 'Bearer local-secret' },
          ],
          body: '',
        },
      },
    ],
  };
  await page.addInitScript(
    ([key, val]) => {
      // Playwright runs this before every navigation, including reload. Never overwrite
      // the collection saved by the application when the page is refreshed.
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, val);
      }
    },
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );
  let sentPayload: { url: string; method: string; headers: { name: string; value: string }[]; body: string } | null = null;
  await page.route(/\/api\/apiproxy/, async (route) => {
    const payload = route.request().postDataJSON() as { url: string; method: string; headers: { name: string; value: string }[]; body: string };
    sentPayload = payload;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: payload.url,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"id":42,"active":true}',
        elapsedMs: 12,
      }),
    });
  });

  await page.goto('/api-studio');
  await page.getByTestId('tree-method').click();

  await expect(page.getByTestId('query-value')).toHaveCount(1);
  await page.getByTestId('query-value').fill('2');
  await page.getByTestId('header-value').nth(0).fill('v2');
  await expect(page.getByTestId('header-value').nth(1)).toHaveAttribute('type', 'password');

  await page.getByTestId('send-request').click();
  await expect(page.getByTestId('single-response')).toBeVisible();
  await expect(page.getByTestId('single-response')).toContainText('200 OK');
  await expect(page.getByTestId('single-response-body')).toContainText('"active": true');

  expect(sentPayload).not.toBeNull();
  expect(sentPayload?.method).toBe('GET');
  expect(sentPayload?.url).toBe('https://api.test/users/42?active=2');
  expect(sentPayload?.headers).toContainEqual({ name: 'x-api-version', value: 'v2' });
  expect(sentPayload?.headers).toContainEqual({ name: 'Authorization', value: 'Bearer local-secret' });

  // Assert the exact request is persisted before a reload can mask the source of a failure.
  const storedTree = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as { items: { request: { url: string; headers: { name: string; value: string }[] } }[] } : null;
  }, TREE_KEY);
  expect(storedTree?.items[0].request.url).toBe('https://api.test/users/42?active=2');
  expect(storedTree?.items[0].request.headers).toContainEqual({ name: 'x-api-version', value: 'v2' });

  // Editing and sending persists the collection request locally, including headers and query string.
  // The seed script above must not overwrite this value during the reload.
  await page.reload();
  const restoredTree = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as { items: { request: { url: string; headers: { name: string; value: string }[] } }[] } : null;
  }, TREE_KEY);
  expect(restoredTree?.items[0].request.url).toBe('https://api.test/users/42?active=2');
  expect(restoredTree?.items[0].request.headers).toContainEqual({ name: 'x-api-version', value: 'v2' });
  await page.getByTestId('tree-method').click();
  await expect(page.getByTestId('editor-url')).toHaveValue('https://api.test/users/42?active=2');
  await expect(page.getByTestId('header-value').nth(0)).toHaveValue('v2');
  await expect(page.getByTestId('header-value').nth(1)).toHaveAttribute('type', 'password');
});

test('runs saved structured request assertions and shows each pass/fail result', async ({ page }) => {
  const treeSeed = {
    id: 'assertion-collection',
    name: 'Assertion Demo',
    items: [{
      id: 'assertion-request',
      name: 'Get user',
      request: { method: 'GET', url: 'https://api.test/users/42', headers: [], body: '' },
      assertions: [
        { id: 'status-ok', enabled: true, type: 'status', target: '', operator: 'eq', expected: '200' },
        { id: 'json-id', enabled: true, type: 'json', target: '$.id', operator: 'eq', expected: '42' },
        { id: 'json-missing', enabled: true, type: 'json', target: '$.missing', operator: 'exists', expected: '' },
        { id: 'header-content-type', enabled: true, type: 'header', target: 'content-type', operator: 'contains', expected: 'application/json' },
        { id: 'response-time', enabled: true, type: 'time', target: '', operator: 'lt', expected: '1000' },
      ],
    }],
  };
  await page.addInitScript(
    ([key, val]) => {
      // addInitScript runs again on reload; preserve edits made by the application.
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, val);
      }
    },
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );
  await page.route(/\/api\/apiproxy/, route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      url: 'https://api.test/users/42',
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"id":42,"active":true}',
      elapsedMs: 12,
    }),
  }));

  await page.goto('/api-studio');
  await page.getByTestId('tree-method').click();
  await expect(page.getByTestId('request-assertions')).toBeVisible();
  await expect(page.getByTestId('assertion-row')).toHaveCount(5);
  await expect(page.getByTestId('request-assertions')).toContainText('Assertions');
  await expect(page.getByTestId('add-assertion')).toHaveText('+ Add assertion');

  // Edit a saved rule, blur to persist, then reload before executing the request.
  await page.getByTestId('assertion-expected').nth(0).fill('201');
  await page.getByTestId('assertion-expected').nth(0).press('Tab');
  const editedTree = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as { items: { assertions: { expected: string }[] }[] } : null;
  }, TREE_KEY);
  expect(editedTree?.items[0].assertions[0].expected).toBe('201');

  await page.reload();
  await page.getByTestId('tree-method').click();
  await expect(page.getByTestId('assertion-expected').nth(0)).toHaveValue('201');
  await page.getByTestId('send-request').click();

  const report = page.getByTestId('single-assertion-report');
  await expect(report).toBeVisible();
  await expect(report).toContainText('3/5 assertions passed');
  await expect(report.getByTestId('assertion-result')).toHaveCount(5);
  await expect(report.locator('[data-passed="true"]')).toHaveCount(3);
  await expect(report.locator('[data-passed="false"]')).toHaveCount(2);
  await expect(report).toContainText('JSON $.missing exists');
});

test('keeps the API Studio workbench usable and keyboard accessible at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/api-studio');

  await page.getByTestId('add-request').click();
  await expect(page.getByTestId('editor-url')).toBeVisible();
  await expect(page.getByTestId('send-request')).toBeVisible();

  const noHorizontalOverflow = async () => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  let width = await noHorizontalOverflow();
  expect(width.document).toBeLessThanOrEqual(width.viewport);

  const manage = page.getByTestId('manage-environments');
  await manage.focus();
  await expect(manage).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('env-manager')).toBeVisible();

  const managerWidth = await page.getByTestId('env-manager').evaluate(el => el.getBoundingClientRect().width);
  expect(managerWidth).toBeLessThanOrEqual(390);

  const collectionScope = page.getByTestId('scope-collection');
  await collectionScope.focus();
  await expect(collectionScope).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(collectionScope).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('new-var-name').fill('mobilePath');
  await page.getByTestId('new-var-value').fill('/mobile');
  await page.getByTestId('add-variable').click();
  await expect(page.locator('[data-test-id="var-row"][data-var-name="mobilePath"]')).toBeVisible();

  width = await noHorizontalOverflow();
  expect(width.document).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({ path: join(SHOTS, '06-mobile-environment-manager.png'), fullPage: true });
});

test('manages environments and scoped variables without changing the legacy active environment', async ({ page }) => {
  const envSeed = {
    active: 'Default',
    envs: {
      Default: { baseUrl: 'https://environment.test', defaultOnly: 'from environment' },
      Prod: { baseUrl: 'https://production.test' },
    },
    collection: { baseUrl: 'https://collection.test', collectionOnly: 'shared collection value' },
    global: { baseUrl: 'https://global.test', globalOnly: 'shared global value' },
    secrets: [],
  };
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    },
    [['api-debugger', 'env'].join(':'), JSON.stringify(envSeed)] as [string, string],
  );

  await page.goto('/api-studio');
  await page.getByTestId('manage-environments').click();
  await expect(page.getByTestId('env-manager')).toBeVisible();

  // Environment > Collection > Global is visible while browsing each raw scope.
  await page.getByTestId('scope-collection').click();
  let baseUrlRow = page.locator('[data-test-id="var-row"][data-var-name="baseUrl"]');
  await expect(baseUrlRow.getByTestId('var-value')).toHaveValue('https://collection.test');
  await expect(baseUrlRow.getByTestId('scope-origin')).toHaveText('Overridden by Environment');

  await page.getByTestId('scope-global').click();
  baseUrlRow = page.locator('[data-test-id="var-row"][data-var-name="baseUrl"]');
  await expect(baseUrlRow.getByTestId('var-value')).toHaveValue('https://global.test');
  await expect(baseUrlRow.getByTestId('scope-origin')).toHaveText('Overridden by Environment');

  // Creating and selecting a Studio environment must not rewrite the legacy API Debugger default.
  await page.getByTestId('scope-environment').click();
  await page.getByTestId('new-environment-name').fill('QA');
  await page.getByTestId('create-environment').click();
  await expect(page.getByTestId('env-select')).toContainText('QA');
  let store = await page.evaluate(() => JSON.parse(localStorage.getItem(['api-debugger', 'env'].join(':')) || '{}'));
  expect(store.active).toBe('Default');
  expect(store.envs.QA).toEqual({});

  // Add, edit and mask a secret variable; its value stays local and is blanked on export.
  await page.getByTestId('scope-environment').click();
  await page.getByTestId('new-var-name').fill('API_TOKEN');
  await page.getByTestId('new-var-value').fill('first-secret');
  await page.getByTestId('new-var-secret').check();
  await page.getByTestId('add-variable').click();

  const tokenRow = page.locator('[data-test-id="var-row"][data-var-name="API_TOKEN"]');
  await expect(tokenRow.getByTestId('var-value')).toHaveAttribute('type', 'password');
  await tokenRow.getByTestId('var-value').fill('updated-secret');
  await tokenRow.getByTestId('var-value').press('Tab');
  await tokenRow.getByTestId('show-variable').click();
  await expect(tokenRow.getByTestId('var-value')).toHaveAttribute('type', 'text');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-variables').click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = JSON.parse(readFileSync(downloadPath!, 'utf8')) as { environment: string; variables: Record<string, string> };
  expect(exported.environment).toBe('QA');
  expect(exported.variables.API_TOKEN).toBe('');

  // Variable removal works in the selected scope.
  await page.getByTestId('new-var-name').fill('TEMP_VALUE');
  await page.getByTestId('new-var-value').fill('temporary');
  await page.getByTestId('add-variable').click();
  await page.locator('[data-test-id="var-row"][data-var-name="TEMP_VALUE"]').getByTestId('remove-variable').click();
  await expect(page.locator('[data-test-id="var-row"][data-var-name="TEMP_VALUE"]')).toHaveCount(0);

  // Rename and delete the selected environment, but keep the last environment and legacy active intact.
  await page.getByTestId('env-rename-input').fill('Staging');
  await page.getByTestId('rename-environment').click();
  store = await page.evaluate(() => JSON.parse(localStorage.getItem(['api-debugger', 'env'].join(':')) || '{}'));
  expect(store.envs.Staging.API_TOKEN).toBe('updated-secret');
  expect(store.envs.QA).toBeUndefined();
  expect(store.active).toBe('Default');

  await page.getByTestId('delete-environment').click();
  store = await page.evaluate(() => JSON.parse(localStorage.getItem(['api-debugger', 'env'].join(':')) || '{}'));
  expect(store.envs.Staging).toBeUndefined();
  expect(store.envs.Default).toBeDefined();
  expect(store.active).toBe('Default');
  expect(store.secrets ?? []).not.toContain('API_TOKEN');

  // Collection-scope edits persist across reload and remain shared through the existing store.
  await page.getByTestId('scope-collection').click();
  await page.getByTestId('new-var-name').fill('sharedPath');
  await page.getByTestId('new-var-value').fill('/v2');
  await page.getByTestId('add-variable').click();
  await page.reload();
  await page.getByTestId('manage-environments').click();
  await page.getByTestId('scope-collection').click();
  const sharedRow = page.locator('[data-test-id="var-row"][data-var-name="sharedPath"]');
  await expect(sharedRow.getByTestId('var-value')).toHaveValue('/v2');
  store = await page.evaluate(() => JSON.parse(localStorage.getItem(['api-debugger', 'env'].join(':')) || '{}'));
  expect(store.active).toBe('Default');
  expect(store.collection.sharedPath).toBe('/v2');
  await expect(page.getByTestId('environment-disclosure')).toContainText('does not encrypt the value at rest');
});

test('imports a Postman v2.1 collection into the tree and exports it back (round-trip)', async ({ page }) => {
  // 空工作树 → 导入：直接采用集合（保留集合名 + folder 结构 + 请求），所见即所得。
  const postmanFixture = {
    info: { name: 'Petstore', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [
      {
        name: 'Auth',
        item: [
          { name: 'Login', request: { method: 'POST', header: [{ key: 'Content-Type', value: 'application/json' }], url: { raw: 'https://pet.test/login' }, body: { mode: 'raw', raw: '{"u":"a"}' } } },
        ],
      },
      { name: 'List Pets', request: { method: 'GET', header: [], url: { raw: 'https://pet.test/pets' } } },
    ],
  };

  await page.goto('/api-studio');
  await page.getByTestId('data-tools-disclosure').locator('summary').click();
  // 隐藏文件选择器：setInputFiles 直接喂 buffer，触发 @change → onImportFilePicked → importCollectionTree
  await page.getByTestId('import-file').setInputFiles({
    name: 'petstore_collection.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(postmanFixture), 'utf8'),
  });

  // 导入后集合名采用 "Petstore"，树里出现 folder Auth（深度 0）/ Login（深度 1）/ List Pets（深度 0）
  await expect(page.getByTestId('api-studio-root')).toContainText('Petstore');
  await expect(page.getByTestId('tree-row')).toHaveCount(3);
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'Login' })).toHaveAttribute('data-depth', '1');
  await expect(page.getByTestId('banner')).toContainText('Imported 2 request(s)');

  await page.screenshot({ path: join(SHOTS, '05-import-postman.png'), fullPage: true });

  // 导出：点 Export → 捕获下载 → 读回文件断言为 Postman v2.1 结构（info.schema + item 数组 + folder 保形）
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-collection').click(),
  ]);
  expect(download.suggestedFilename()).toContain('postman_collection.json');
  const dlPath = await download.path();
  const exported = JSON.parse(readFileSync(dlPath!, 'utf8'));
  expect(String(exported.info.schema)).toContain('v2.1');
  expect(exported.info.name).toBe('Petstore');
  const auth = (exported.item as any[]).find(it => it.name === 'Auth');
  expect(Array.isArray(auth?.item)).toBe(true);
  expect((auth.item as any[])[0].name).toBe('Login');
});

test('portable backup restores the workspace into a separate browser origin', async ({ page }, testInfo) => {
  const baseUrl = new URL(String(testInfo.project.use.baseURL ?? process.env.BASE_URL ?? 'http://127.0.0.1:5173'));
  const sourceOrigin = baseUrl.origin;
  const destinationOrigin = 'https://api-studio-migration.test';
  const tree = {
    id: 'migration-root',
    name: 'Cross Origin Workspace',
    items: [{
      id: 'auth-folder',
      name: 'Auth',
      items: [{
        id: 'token-request',
        name: 'Token request',
        request: {
          method: 'GET',
          url: 'https://api.example.test/me?token={{token}}',
          headers: [
            { name: 'Accept', value: 'application/json' },
            { name: 'X-API-Key', value: 'hard-coded-key-secret' },
          ],
          body: '{"note":"env-secret-value"}',
        },
      }],
    }],
  };
  const env = {
    active: 'Development',
    envs: {
      Development: { baseUrl: 'https://api.example.test', token: 'env-secret-value' },
      Production: { baseUrl: 'https://prod.example.test', token: 'prod-secret-value' },
    },
    global: { shared: 'shared-value', token: 'global-secret-value' },
    collection: { scopeName: 'workspace', token: 'collection-secret-value' },
    secrets: ['token'],
  };
  await page.addInitScript(
    ([origin, treeKey, treeValue, envKey, envValue]) => {
      if (location.origin === origin) {
        localStorage.setItem(treeKey, treeValue);
        localStorage.setItem(envKey, envValue);
      }
    },
    [sourceOrigin, TREE_KEY, JSON.stringify(tree), ENV_KEY, JSON.stringify(env)] as [string, string, string, string, string],
  );

  await page.goto('/api-studio');
  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'Token request' })).toBeVisible();
  await page.getByTestId('data-tools-disclosure').locator('summary').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('backup-safe').click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  if (!downloadPath) {
    throw new TypeError('The backup download did not produce a file.');
  }
  const backupText = readFileSync(downloadPath, 'utf8');
  expect(backupText).not.toContain('env-secret-value');
  expect(backupText).not.toContain('prod-secret-value');
  expect(backupText).not.toContain('global-secret-value');
  expect(backupText).not.toContain('collection-secret-value');
  expect(backupText).not.toContain('hard-coded-key-secret');

  // Route a second, distinct origin to the same built app while retaining its
  // own localStorage origin. This exercises the actual file-based hand-off.
  await page.route(`${destinationOrigin}/**`, async (route) => {
    const requested = new URL(route.request().url());
    const upstream = new URL(`${requested.pathname}${requested.search}`, baseUrl).toString();
    const response = await route.fetch({ url: upstream });
    await route.fulfill({ response });
  });
  await page.goto(`${destinationOrigin}/api-studio`);
  expect(new URL(page.url()).origin).toBe(destinationOrigin);
  const freshStorage = await page.evaluate(([treeKey, envKey]) => ({
    tree: localStorage.getItem(treeKey),
    env: localStorage.getItem(envKey),
  }), [TREE_KEY, ENV_KEY] as [string, string]);
  expect(freshStorage.tree).toBeNull();
  expect(freshStorage.env).toBeNull();

  await page.getByTestId('backup-file').setInputFiles(downloadPath);
  await expect(page.getByTestId('backup-restore-preview')).toContainText('Cross Origin Workspace');
  await expect(page.getByTestId('backup-restore-preview')).toContainText('1 request(s)');
  await expect(page.getByTestId('backup-restore-preview')).toContainText('Development, Production');
  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('apply-backup-restore').click();

  await expect(page.locator('[data-test-id="tree-row"]', { hasText: 'Token request' })).toBeVisible();
  await expect(page.getByTestId('env-select')).toContainText('Development');
  const restored = await page.evaluate(([treeKey, envKey]) => ({
    tree: JSON.parse(localStorage.getItem(treeKey) ?? 'null'),
    env: JSON.parse(localStorage.getItem(envKey) ?? 'null'),
  }), [TREE_KEY, ENV_KEY] as [string, string]);
  expect(restored.tree.name).toBe('Cross Origin Workspace');
  expect(restored.tree.items[0].items[0].request.headers.some((header: { name: string }) => header.name.toLowerCase() === 'x-api-key')).toBe(false);
  expect(restored.env.envs.Development.token).toBe('');
  expect(restored.env.envs.Production.token).toBe('');
  expect(restored.env.global.token).toBe('');
  expect(restored.env.collection.token).toBe('');
});

test('offers a keyboard-accessible manual retry only after a relay failure', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const treeSeed = {
    id: 'retry-collection',
    name: 'Retry Demo',
    items: [{
      id: 'retry-request',
      name: 'Retry request',
      request: {
        method: 'GET',
        url: '{{missingBaseUrl}}/retry',
        headers: [],
        body: '',
      },
    }],
  };
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    },
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );

  let attempts = 0;
  await page.route(/\/api\/apiproxy/, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://api.test/retry?force400=1',
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          body: '{"error":"Invalid request configuration."}',
          elapsedMs: 9,
        }),
      });
    }
    if (attempts === 2) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://api.test/retry',
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'content-type': 'application/json' },
          body: '{"error":"Upstream service temporarily unavailable."}',
          elapsedMs: 11,
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://api.test/retry',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"recovered":true}',
        elapsedMs: 14,
      }),
    });
  });

  await page.goto('/api-studio');
  // Make the consent choice explicit so the screenshot reviews the workbench, not its first-visit overlay.
  await page.getByRole('button', { name: 'Reject analytics' }).click();
  await page.getByTestId('tree-method').click();

  // Local configuration errors need a fix, not a retry button that would repeat the same failure.
  await page.getByTestId('send-request').click();
  await expect(page.getByTestId('single-send-error')).toContainText('Missing variables: missingBaseUrl');
  await expect(page.getByTestId('retry-send')).toHaveCount(0);
  expect(attempts).toBe(0);

  await page.getByTestId('editor-url').fill('https://api.test/retry?force400=1');
  await page.getByTestId('editor-url').press('Tab');
  await page.getByTestId('send-request').click();

  // The relay wraps the upstream 400 in a 200 JSON envelope. It is visible,
  // but repeating a non-transient 4xx cannot fix the request.
  await expect(page.getByTestId('single-response')).toContainText('400 Bad Request');
  await expect(page.getByTestId('retry-send')).toHaveCount(0);
  expect(attempts).toBe(1);

  await page.getByTestId('editor-url').fill('https://api.test/retry');
  await page.getByTestId('editor-url').press('Tab');
  await page.getByTestId('send-request').click();

  // The actual relay returns HTTP 200 with the upstream 503 in the JSON payload.
  await expect(page.getByTestId('single-response')).toContainText('503 Service Unavailable');
  const retry = page.getByTestId('retry-send');
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText('Retry request');
  expect(attempts).toBe(2);
  await page.screenshot({ path: join(SHOTS, '07-single-request-retry-desktop.png'), fullPage: true });

  // The request is never replayed automatically. At mobile width, the editor
  // must retain real viewport height and the retry action must be visible and reachable.
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => {
    const shellBody = document.querySelector('.api-shell-body')?.getBoundingClientRect();
    const main = document.querySelector('#main-content')?.getBoundingClientRect();
    const workspace = document.querySelector('.api-workspace')?.getBoundingClientRect();
    const editor = document.querySelector('.api-editor')?.getBoundingClientRect();
    return {
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      shellBodyHeight: shellBody?.height ?? 0,
      mainHeight: main?.height ?? 0,
      workspaceHeight: workspace?.height ?? 0,
      workspaceBottom: workspace?.bottom ?? 0,
      editorBottom: editor?.bottom ?? 0,
      editorHeight: editor?.height ?? 0,
    };
  });
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.shellBodyHeight).toBeGreaterThan(700);
  expect(dimensions.mainHeight).toBeGreaterThan(700);
  expect(dimensions.workspaceHeight).toBeGreaterThan(700);
  expect(dimensions.editorHeight).toBeGreaterThan(300);
  expect(dimensions.workspaceBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);
  expect(dimensions.editorBottom).toBeGreaterThanOrEqual(dimensions.viewportHeight - 1);

  const editor = page.locator('.api-editor');
  await expect(page.getByTestId('single-response')).toBeVisible();
  await retry.scrollIntoViewIfNeeded();
  await expect(retry).toBeVisible();
  await expect(retry).toBeInViewport();

  const retryBounds = await retry.boundingBox();
  expect(retryBounds).not.toBeNull();
  const retryReceivesPointer = await page.evaluate(({ x, y }) => {
    return Boolean(document.elementFromPoint(x, y)?.closest('[data-test-id="retry-send"]'));
  }, {
    x: retryBounds!.x + retryBounds!.width / 2,
    y: retryBounds!.y + retryBounds!.height / 2,
  });
  expect(retryReceivesPointer, 'The mobile retry action must not be covered by another layer.').toBe(true);
  await page.screenshot({ path: join(SHOTS, '08-single-request-retry-mobile.png'), fullPage: true });

  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('single-response')).toBeVisible();
  await expect(page.getByTestId('single-response')).toContainText('200 OK');
  await expect(page.getByTestId('single-response-body')).toContainText('"recovered": true');
  await expect(page.getByTestId('single-send-error')).toHaveCount(0);
  await expect(page.getByTestId('retry-send')).toHaveCount(0);
  expect(attempts).toBe(3);
});

test('offers a manual retry when the API relay connection fails', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const treeSeed = {
    id: 'network-retry-collection',
    name: 'Network Retry Demo',
    items: [{
      id: 'network-retry-request',
      name: 'Network retry request',
      request: {
        method: 'GET',
        url: 'https://api.test/network-retry',
        headers: [],
        body: '',
      },
    }],
  };
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    },
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );

  let attempts = 0;
  await page.route(/\/api\/apiproxy/, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      return route.abort('failed');
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        url: 'https://api.test/network-retry',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: '{"networkRecovered":true}',
        elapsedMs: 13,
      }),
    });
  });

  await page.goto('/api-studio');
  await page.getByRole('button', { name: 'Reject analytics' }).click();
  await page.getByTestId('tree-method').click();
  await page.getByTestId('send-request').click();

  await expect(page.getByTestId('single-send-error')).toContainText(
    'Could not reach the API relay. Check your connection and try again.',
  );
  const retry = page.getByTestId('retry-send');
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText('Retry request');
  expect(attempts).toBe(1);

  await retry.focus();
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByTestId('single-response')).toContainText('200 OK');
  await expect(page.getByTestId('single-response-body')).toContainText('"networkRecovered": true');
  await expect(page.getByTestId('single-send-error')).toHaveCount(0);
  await expect(retry).toHaveCount(0);
  expect(attempts).toBe(2);
});
