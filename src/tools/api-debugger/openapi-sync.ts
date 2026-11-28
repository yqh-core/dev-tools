import type { ApiRequestState } from './engine';
import {
  addRequest,
  cloneTree,
  findRequestNode,
  newNodeId,
  updateRequestNode,
} from './collection-tree';
import type { CollectionNode, OpenApiSyncMetadata, OpenApiSyncOperation } from './collection-tree';
import type { ImportedRequest, OpenApiImportResult } from './openapi';

export type OpenApiRefreshChoice = 'keep-current' | 'use-spec';
type FieldAction = 'apply' | 'preserve' | 'unchanged' | 'conflict';

export interface OpenApiRefreshFieldPlan {
  action: FieldAction
  incomingFingerprint: string
}

export type OpenApiRefreshStatus = 'added' | 'updated' | 'preserved' | 'unchanged' | 'conflict' | 'removed' | 'orphaned';

export interface OpenApiRefreshPlanItem {
  key: string
  status: OpenApiRefreshStatus
  imported?: ImportedRequest
  requestId?: string
  nameField?: OpenApiRefreshFieldPlan
  requestField?: OpenApiRefreshFieldPlan
  incomingNameFingerprint?: string
  incomingRequestFingerprint?: string
}

export interface OpenApiRefreshPlan {
  fileName: string
  title: string
  openApiVersion: string
  specFingerprint: string
  items: OpenApiRefreshPlanItem[]
}

export interface OpenApiRefreshSummary {
  added: number
  updated: number
  preserved: number
  unchanged: number
  conflictsResolved: number
  removed: number
  orphaned: number
}

export interface OpenApiRefreshResult {
  tree: CollectionNode
  summary: OpenApiRefreshSummary
}

/** Fingerprints support local dirty detection only. They are not encryption or credential protection. */
export async function fingerprintOpenApiValue(value: unknown): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Secure local fingerprinting is unavailable in this browser.');
  }
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `sha256-${hex}`;
}

export async function fingerprintOpenApiRequest(request: ApiRequestState): Promise<string> {
  return fingerprintOpenApiValue({
    method: request.method.trim().toUpperCase(),
    url: request.url,
    headers: request.headers.map(header => ({ name: header.name, value: header.value })),
    body: request.body,
  });
}

function operationKey(request: ImportedRequest): string {
  if (request.sourceKey) {
    return request.sourceKey;
  }
  const method = request.request.method.trim().toUpperCase();
  const path = String(request.path ?? '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  return `path:${method}:${path}`;
}

async function fingerprintSpec(parsed: OpenApiImportResult): Promise<string> {
  return fingerprintOpenApiValue({
    title: parsed.title ?? '',
    openApiVersion: parsed.openApiVersion ?? '',
    operations: parsed.requests.map(request => ({
      key: operationKey(request),
      name: request.name,
      request: request.request,
    })),
  });
}

export async function createOpenApiSyncMetadata(
  fileName: string,
  parsed: OpenApiImportResult,
  imported: Array<{ sourceKey: string; requestId: string; name: string; request: ApiRequestState }>,
  lastSyncedAt = new Date().toISOString(),
): Promise<OpenApiSyncMetadata> {
  const operations: OpenApiSyncOperation[] = await Promise.all(imported.map(async (item) => ({
    key: item.sourceKey,
    requestId: item.requestId,
    baseNameFingerprint: await fingerprintOpenApiValue(item.name),
    baseRequestFingerprint: await fingerprintOpenApiRequest(item.request),
  })));
  if (new Set(operations.map(item => item.key)).size !== operations.length
    || new Set(operations.map(item => item.requestId)).size !== operations.length) {
    throw new Error('The imported OpenAPI operations do not have unique source or request identities.');
  }
  return {
    version: 1,
    fileName: fileName.slice(0, 255),
    title: (parsed.title ?? '').slice(0, 256),
    openApiVersion: parsed.openApiVersion ?? '3.0.0',
    lastSyncedAt,
    specFingerprint: await fingerprintSpec(parsed),
    operations,
  };
}

function classifyField(base: string, current: string, incoming: string): OpenApiRefreshFieldPlan['action'] {
  const localChanged = current !== base;
  const sourceChanged = incoming !== base;
  if (!localChanged && sourceChanged) {
    return 'apply';
  }
  if (localChanged && !sourceChanged) {
    return 'preserve';
  }
  if (localChanged && sourceChanged && current !== incoming) {
    return 'conflict';
  }
  return 'unchanged';
}

/** Build a deterministic preview without mutating the current collection. */
export async function planOpenApiRefresh(
  collection: CollectionNode,
  parsed: OpenApiImportResult,
  fileName: string,
): Promise<OpenApiRefreshPlan> {
  const metadata = collection.openApiSync;
  if (!metadata) {
    throw new Error('This collection has no OpenAPI source association. Import a spec first.');
  }

  const previous = new Map(metadata.operations.map(item => [item.key, item]));
  const incomingKeys = new Set<string>();
  const items: OpenApiRefreshPlanItem[] = [];

  for (const imported of parsed.requests) {
    const key = operationKey(imported);
    if (incomingKeys.has(key)) {
      throw new Error(`The new spec contains a duplicate operation identity: ${key}`);
    }
    incomingKeys.add(key);
    const incomingNameFingerprint = await fingerprintOpenApiValue(imported.name);
    const incomingRequestFingerprint = await fingerprintOpenApiRequest(imported.request);
    const mapping = previous.get(key);

    if (!mapping) {
      items.push({
        key,
        status: 'added',
        imported,
        incomingNameFingerprint,
        incomingRequestFingerprint,
      });
      continue;
    }

    const current = findRequestNode(collection, mapping.requestId);
    if (!current) {
      items.push({ key, status: 'orphaned', imported, requestId: mapping.requestId });
      continue;
    }

    const [currentNameFingerprint, currentRequestFingerprint] = await Promise.all([
      fingerprintOpenApiValue(current.name),
      fingerprintOpenApiRequest(current.request),
    ]);
    const nameAction = classifyField(mapping.baseNameFingerprint, currentNameFingerprint, incomingNameFingerprint);
    const requestAction = classifyField(mapping.baseRequestFingerprint, currentRequestFingerprint, incomingRequestFingerprint);
    const hasConflict = nameAction === 'conflict' || requestAction === 'conflict';
    const hasUpdate = nameAction === 'apply' || requestAction === 'apply';
    const hasLocalEdit = nameAction === 'preserve' || requestAction === 'preserve';

    items.push({
      key,
      status: hasConflict ? 'conflict' : hasUpdate ? 'updated' : hasLocalEdit ? 'preserved' : 'unchanged',
      imported,
      requestId: mapping.requestId,
      nameField: { action: nameAction, incomingFingerprint: incomingNameFingerprint },
      requestField: { action: requestAction, incomingFingerprint: incomingRequestFingerprint },
      incomingNameFingerprint,
      incomingRequestFingerprint,
    });
  }

  for (const mapping of metadata.operations) {
    if (incomingKeys.has(mapping.key)) {
      continue;
    }
    items.push({
      key: mapping.key,
      status: findRequestNode(collection, mapping.requestId) ? 'removed' : 'orphaned',
      requestId: mapping.requestId,
    });
  }

  return {
    fileName: fileName.slice(0, 255),
    title: (parsed.title ?? '').slice(0, 256),
    openApiVersion: parsed.openApiVersion ?? metadata.openApiVersion,
    specFingerprint: await fingerprintSpec(parsed),
    items,
  };
}

/** Apply the reviewed plan as one immutable tree replacement; missing operations are retained. */
export async function applyOpenApiRefreshPlan(
  collection: CollectionNode,
  plan: OpenApiRefreshPlan,
  choices: Record<string, OpenApiRefreshChoice> = {},
  lastSyncedAt = new Date().toISOString(),
): Promise<OpenApiRefreshResult> {
  if (!collection.openApiSync) {
    throw new Error('The OpenAPI source association is missing. The collection was not changed.');
  }

  let next = cloneTree(collection);
  const mappings = new Map(collection.openApiSync.operations.map(item => [item.key, { ...item }]));
  const summary: OpenApiRefreshSummary = {
    added: 0,
    updated: 0,
    preserved: 0,
    unchanged: 0,
    conflictsResolved: 0,
    removed: 0,
    orphaned: 0,
  };

  for (const item of plan.items) {
    if (item.status === 'removed') {
      // Removed source operations are only flagged. Keep their mapping and local request.
      summary.removed++;
      continue;
    }
    if (item.status === 'orphaned') {
      summary.orphaned++;
      continue;
    }
    if (item.status === 'added') {
      if (!item.imported || !item.incomingNameFingerprint || !item.incomingRequestFingerprint) {
        throw new Error(`The preview for ${item.key} is incomplete. The collection was not changed.`);
      }
      const inserted = addRequest(next, null, {
        id: newNodeId(),
        name: item.imported.name,
        request: item.imported.request,
      });
      if (!inserted.node || inserted.error) {
        throw new Error(`Could not add ${item.key}: ${inserted.error ?? 'unknown collection error'}. The collection was not changed.`);
      }
      next = inserted.tree;
      mappings.set(item.key, {
        key: item.key,
        requestId: inserted.node.id,
        baseNameFingerprint: item.incomingNameFingerprint,
        baseRequestFingerprint: item.incomingRequestFingerprint,
      });
      summary.added++;
      continue;
    }

    const mapping = mappings.get(item.key);
    const imported = item.imported;
    if (!mapping || !imported || !item.requestId || !item.nameField || !item.requestField) {
      throw new Error(`The preview mapping for ${item.key} is incomplete. The collection was not changed.`);
    }

    const nameChoice = choices[`${item.key}:name`] ?? 'keep-current';
    const requestChoice = choices[`${item.key}:request`] ?? 'keep-current';
    const applyName = item.nameField.action === 'apply'
      || (item.nameField.action === 'conflict' && nameChoice === 'use-spec');
    const applyRequest = item.requestField.action === 'apply'
      || (item.requestField.action === 'conflict' && requestChoice === 'use-spec');
    const acknowledgeNameConflict = item.nameField.action === 'conflict' && nameChoice === 'keep-current';
    const acknowledgeRequestConflict = item.requestField.action === 'conflict' && requestChoice === 'keep-current';

    if (applyName || applyRequest) {
      const update = updateRequestNode(next, item.requestId, {
        ...(applyName ? { name: imported.name } : {}),
        ...(applyRequest ? { request: imported.request } : {}),
      });
      if (!update.node || update.error) {
        throw new Error(`Could not update ${item.key}: ${update.error ?? 'request no longer exists'}. The collection was not changed.`);
      }
      next = update.tree;
      summary.updated++;
    }
    else if (item.status === 'preserved') {
      summary.preserved++;
    }
    else if (item.status === 'conflict') {
      summary.conflictsResolved++;
    }
    else {
      summary.unchanged++;
    }

    // A source update or an explicit conflict decision acknowledges this incoming baseline.
    // Independent local-only edits do not advance the baseline, so future source changes remain visible.
    mappings.set(item.key, {
      ...mapping,
      baseNameFingerprint: applyName || item.nameField.action === 'unchanged' || acknowledgeNameConflict
        ? item.nameField.incomingFingerprint
        : mapping.baseNameFingerprint,
      baseRequestFingerprint: applyRequest || item.requestField.action === 'unchanged' || acknowledgeRequestConflict
        ? item.requestField.incomingFingerprint
        : mapping.baseRequestFingerprint,
    });
  }

  const openApiSync: OpenApiSyncMetadata = {
    version: 1,
    fileName: plan.fileName,
    title: plan.title,
    openApiVersion: plan.openApiVersion,
    lastSyncedAt,
    specFingerprint: plan.specFingerprint,
    operations: [...mappings.values()],
  };
  next = { ...next, openApiSync };
  return { tree: next, summary };
}
