import { describe, expect, it } from 'vitest';
import {
  addFolder,
  addRequest,
  emptyCollection,
  findRequestNode,
  updateRequestNode,
} from './collection-tree';
import { importOpenApi } from './openapi';
import {
  applyOpenApiRefreshPlan,
  createOpenApiSyncMetadata,
  planOpenApiRefresh,
} from './openapi-sync';

function spec(path = '/users/{id}', includeTeam = false): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Users API' },
    servers: [{ url: 'https://api.example.test/v1' }],
    paths: {
      [path]: {
        get: { operationId: 'getUser' },
      },
      ...(includeTeam ? { '/teams': { get: { operationId: 'listTeams' } } } : {}),
    },
  });
}

async function associatedTree() {
  const parsed = importOpenApi(spec());
  const imported = parsed.requests[0];
  let tree = emptyCollection('Users');
  tree = addFolder(tree, null, 'Accounts', 'folder-accounts').tree;
  const added = addRequest(tree, 'folder-accounts', {
    id: 'request-user',
    name: imported.name,
    request: imported.request,
    scripts: { test: 'expect(response.status).toBe(200);' },
    assertions: [{ id: 'status-200', enabled: true, type: 'status', target: 'status', operator: 'equals', expected: '200' }],
  });
  tree = added.tree;
  tree = {
    ...tree,
    openApiSync: await createOpenApiSyncMetadata('users.yaml', parsed, [{
      sourceKey: imported.sourceKey!,
      requestId: added.node!.id,
      name: added.node!.name,
      request: added.node!.request,
    }], '2026-11-28T12:00:00.000Z'),
  };
  return { tree, parsed };
}

describe('safe local OpenAPI refresh', () => {
  it('matches renamed paths by unique operationId, preserves node identity, folder, scripts and assertions, and previews additions', async () => {
    const { tree } = await associatedTree();
    const nextSpec = importOpenApi(spec('/users/{id}/profile', true));
    const plan = await planOpenApiRefresh(tree, nextSpec, 'users-v2.yaml');
    expect(plan.items.map(item => item.status)).toEqual(['updated', 'added']);

    const applied = await applyOpenApiRefreshPlan(tree, plan);
    const existing = findRequestNode(applied.tree, 'request-user')!;
    expect(existing.request.url).toBe('https://api.example.test/v1/users/{{id}}/profile');
    expect(existing.name).toBe('getUser');
    expect(existing.scripts?.test).toBe('expect(response.status).toBe(200);');
    expect(existing.assertions).toHaveLength(1);
    expect(applied.tree.items[0]).toMatchObject({ id: 'folder-accounts' });
    expect(applied.summary).toMatchObject({ added: 1, updated: 1 });
    expect(applied.tree.openApiSync?.fileName).toBe('users-v2.yaml');
  });

  it('keeps local edits by default, acknowledges a resolved conflict and does not repeat it', async () => {
    const { tree, parsed } = await associatedTree();
    const current = findRequestNode(tree, 'request-user')!;
    const locallyEdited = updateRequestNode(tree, current.id, {
      request: { ...current.request, url: 'https://local.example.test/manual' },
    }).tree;
    const changedSpec = importOpenApi(spec('/users/{id}/v2'));
    const plan = await planOpenApiRefresh(locallyEdited, changedSpec, 'users-v2.yaml');
    expect(plan.items[0].status).toBe('conflict');
    expect(plan.items[0].requestField?.action).toBe('conflict');

    const applied = await applyOpenApiRefreshPlan(locallyEdited, plan);
    expect(findRequestNode(applied.tree, 'request-user')?.request.url).toBe('https://local.example.test/manual');

    const nextPlan = await planOpenApiRefresh(applied.tree, changedSpec, 'users-v2.yaml');
    expect(nextPlan.items[0].status).toBe('preserved');
    expect(findRequestNode(applied.tree, 'request-user')?.request.url).not.toBe(parsed.requests[0].request.url);
  });

  it('allows an explicit Use spec decision for a conflicting request field', async () => {
    const { tree } = await associatedTree();
    const current = findRequestNode(tree, 'request-user')!;
    const locallyEdited = updateRequestNode(tree, current.id, {
      request: { ...current.request, url: 'https://local.example.test/manual' },
    }).tree;
    const changedSpec = importOpenApi(spec('/users/{id}/new'));
    const plan = await planOpenApiRefresh(locallyEdited, changedSpec, 'users-v2.yaml');
    const result = await applyOpenApiRefreshPlan(locallyEdited, plan, {
      'operationId:getUser:request': 'use-spec',
    });
    expect(findRequestNode(result.tree, 'request-user')?.request.url).toBe('https://api.example.test/v1/users/{{id}}/new');
  });

  it('flags operations removed from the new spec but never deletes local requests', async () => {
    const { tree } = await associatedTree();
    const removed = importOpenApi(JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Users API' },
      paths: {},
    }));
    const plan = await planOpenApiRefresh(tree, removed, 'users-v3.yaml');
    expect(plan.items[0].status).toBe('removed');
    const result = await applyOpenApiRefreshPlan(tree, plan);
    expect(findRequestNode(result.tree, 'request-user')).not.toBeNull();
    expect(result.summary.removed).toBe(1);
  });

  it('Cancel has no mutation path because planning is pure and Apply returns a new tree', async () => {
    const { tree } = await associatedTree();
    const before = JSON.stringify(tree);
    const next = importOpenApi(spec('/users/{id}/next', true));
    await planOpenApiRefresh(tree, next, 'users-v2.yaml');
    expect(JSON.stringify(tree)).toBe(before);
  });
});
