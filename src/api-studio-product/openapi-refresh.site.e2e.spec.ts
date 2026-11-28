import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

function spec(path: string, version: string): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Users API' },
    servers: [
      { url: 'https://api.example.test/v1' },
      { url: 'https://staging.example.test/v1' },
    ],
    paths: {
      [path]: {
        get: {
          operationId: 'getUser',
          parameters: [{ name: 'id', in: 'path' }],
          responses: { 200: { description: 'OK' } },
          description: version,
        },
      },
    },
  });
}

test('OpenAPI refresh preserves local edits, supports explicit source choice, and cancels atomically', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const relayCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/apiproxy')) {
      relayCalls.push(request.url());
    }
  });

  await page.goto('/app/');
  await page.getByTestId('data-tools-disclosure').locator('summary').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'users-v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(spec('/users/{id}', 'v1')),
  });
  await expect(page.getByTestId('openapi-preview')).toBeVisible();
  await page.getByTestId('confirm-openapi-import').click();

  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('api-studio:tree') || 'null'));
  expect(stored.openApiSync.version).toBe(1);
  expect(stored.openApiSync.operations).toHaveLength(1);
  expect(stored.openApiSync.operations[0].key).toBe('operationId:getUser');
  await expect(page.getByTestId('openapi-source-status')).toContainText('users-v1.json');
  await expect(page.getByTestId('openapi-source-status')).toContainText('Last sync:');
  const requestId = stored.openApiSync.operations[0].requestId;

  // A second spec may add independent requests, but it must not silently replace
  // the collection's existing single-source refresh association.
  await page.getByTestId('import-openapi').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'inventory.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Inventory API' },
      servers: [{ url: 'https://inventory.example.test/v1' }],
      paths: {
        '/inventory': {
          get: {
            operationId: 'listInventory',
            responses: { 200: { description: 'OK' } },
          },
        },
      },
    })),
  });
  await expect(page.getByTestId('openapi-preview')).toBeVisible();
  await page.getByTestId('confirm-openapi-import').click();
  await expect(page.getByTestId('banner')).toContainText('users-v1.json');
  await expect(page.getByTestId('banner')).toContainText('not linked to Refresh OpenAPI');
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('api-studio:tree') || 'null'));
  expect(stored.openApiSync.fileName).toBe('users-v1.json');
  expect(stored.openApiSync.operations.map((item: { key: string }) => item.key)).toEqual(['operationId:getUser']);
  expect(stored.items.some((item: { name: string }) => item.name === 'listInventory')).toBe(true);

  // Model a user-authored override plus scripts/assertions that a refresh must preserve.
  await page.evaluate((id) => {
    const tree = JSON.parse(localStorage.getItem('api-studio:tree') || 'null');
    const request = tree.items.find((item: { id: string }) => item.id === id);
    request.request.url = 'https://local.example.test/manual-override';
    request.scripts = { test: 'expect(response.status).toBe(204);' };
    request.assertions = [{
      id: 'local-assertion',
      enabled: true,
      type: 'status',
      target: 'status',
      operator: 'equals',
      expected: '204',
    }];
    localStorage.setItem('api-studio:tree', JSON.stringify(tree));
  }, requestId);
  await page.reload();
  await page.getByTestId('data-tools-disclosure').locator('summary').click();

  await page.getByTestId('refresh-openapi').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'users-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(spec('/users/{id}/v2', 'v2')),
  });
  const preview = page.getByTestId('openapi-refresh-preview');
  await expect(preview).toBeVisible();
  await expect(page.getByTestId('openapi-refresh-operations')).toContainText('conflict');
  await expect(preview).toContainText('Keep your current value');
  await expect(page.getByTestId('openapi-refresh-server').locator('option')).toHaveCount(2);
  await page.getByTestId('openapi-refresh-server').selectOption('https://staging.example.test/v1');
  await expect(page.getByTestId('openapi-refresh-operations')).toContainText('https://staging.example.test/v1/users/{{id}}/v2');
  await page.screenshot({ path: testInfo.outputPath('openapi-refresh-conflict-desktop.png') });

  // Default action is Keep current; no silent request replacement.
  await page.getByTestId('confirm-refresh-openapi').click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('api-studio:tree') || 'null'));
  let current = stored.items.find((item: { id: string }) => item.id === requestId);
  expect(current.request.url).toBe('https://local.example.test/manual-override');
  expect(current.scripts.test).toBe('expect(response.status).toBe(204);');
  expect(current.assertions).toHaveLength(1);
  expect(current.assertions[0].id).toBe('local-assertion');

  // The acknowledged conflict is not repeated on an identical source refresh.
  await page.getByTestId('refresh-openapi').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'users-v2.json',
    mimeType: 'application/json',
    buffer: Buffer.from(spec('/users/{id}/v2', 'v2')),
  });
  await page.getByTestId('openapi-refresh-server').selectOption('https://staging.example.test/v1');
  await expect(page.getByTestId('openapi-refresh-operations')).toContainText('preserved');
  await page.getByTestId('cancel-refresh-openapi').click();

  // A later source change can be deliberately accepted field by field.
  await page.getByTestId('refresh-openapi').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'users-v3.json',
    mimeType: 'application/json',
    buffer: Buffer.from(spec('/users/{id}/v3', 'v3')),
  });
  await page.getByTestId('openapi-refresh-server').selectOption('https://staging.example.test/v1');
  await expect(page.getByTestId('openapi-refresh-operations')).toContainText('conflict');
  await page.getByTestId('openapi-request-choice-operationId:getUser').selectOption('use-spec');
  await page.getByTestId('confirm-refresh-openapi').click();
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem('api-studio:tree') || 'null'));
  current = stored.items.find((item: { id: string }) => item.id === requestId);
  expect(current.request.url).toBe('https://staging.example.test/v1/users/{{id}}/v3');
  expect(current.scripts.test).toBe('expect(response.status).toBe(204);');
  expect(current.assertions[0].id).toBe('local-assertion');

  // Cancel is byte-for-byte unchanged, including the source baseline.
  const beforeCancel = await page.evaluate(() => localStorage.getItem('api-studio:tree'));
  await page.getByTestId('refresh-openapi').click();
  await page.getByTestId('openapi-file').setInputFiles({
    name: 'users-v4.json',
    mimeType: 'application/json',
    buffer: Buffer.from(spec('/users/{id}/v4', 'v4')),
  });
  await expect(page.getByTestId('openapi-refresh-preview')).toBeVisible();
  await page.getByTestId('cancel-refresh-openapi').click();
  const afterCancel = await page.evaluate(() => localStorage.getItem('api-studio:tree'));
  expect(afterCancel).toBe(beforeCancel);
  expect(relayCalls).toEqual([]);
});
