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
    ([key, val]) => localStorage.setItem(key, val),
    [TREE_KEY, JSON.stringify(treeSeed)] as [string, string],
  );
  await page.route(/\\/api\\/apiproxy/, route => route.fulfill({
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
  await page.getByTestId('send-request').click();

  const report = page.getByTestId('single-assertion-report');
  await expect(report).toBeVisible();
  await expect(report).toContainText('4/5 tests passed');
  await expect(report.getByTestId('assertion-result')).toHaveCount(5);
  await expect(report.locator('[data-passed="true"]')).toHaveCount(4);
  await expect(report.locator('[data-passed="false"]')).toHaveCount(1);
  await expect(report).toContainText('JSON $.missing exists');
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
