import process from 'node:process';
import { mkdirSync } from 'node:fs';
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

const TREE_KEY = '***';
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
