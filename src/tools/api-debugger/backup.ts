import type { Assertion } from './assertions';
import {
  type CollectionNode,
  type RequestNode,
  type TreeNode,
  isFolderNode,
  mergeImportedTree,
  parseCollectionTree,
  parseOpenApiSyncMetadata,
} from './collection-tree';
import { type ApiRequestState, isRequestAuthConfig, type RequestAuthConfig, sanitizeForShare } from './engine';
import { type EnvStore, collectSecretValues } from './environments';

export const API_STUDIO_BACKUP_FORMAT = 'digdevbox-api-studio-backup';
export const API_STUDIO_BACKUP_VERSION = 3;
export const API_STUDIO_BACKUP_MAX_BYTES = 10 * 1024 * 1024;
export const API_STUDIO_BACKUP_REDACTED = '[REDACTED]';

export interface ApiStudioBackupSecurity {
  secretsIncluded: boolean
  omittedSecretVariables: string[]
  redactedValues: number
  removedCredentialHeaders: number
  removedUrlCredentials: number
  notes: string[]
}

interface ApiStudioBackupBase {
  format: typeof API_STUDIO_BACKUP_FORMAT
  exportedAt: string
  collection: CollectionNode
  environments: EnvStore
  security: ApiStudioBackupSecurity
}

export interface ApiStudioBackupV1 extends ApiStudioBackupBase {
  version: 1
}

export interface ApiStudioBackupV2 extends ApiStudioBackupBase {
  version: 2
}

export interface ApiStudioBackupV3 extends ApiStudioBackupBase {
  version: 3
}

/** New exports use v3 auth profiles; restores continue to accept v1/v2 archives. */
export type ApiStudioBackupArchive = ApiStudioBackupV1 | ApiStudioBackupV2 | ApiStudioBackupV3;

export type BackupRestoreStrategy = 'replace' | 'merge';

function isVariableReference(value: string): boolean {
  return /^\s*\{\{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*\}\}\s*$/.test(value);
}

function authCredentialValues(auth: RequestAuthConfig): string[] {
  if (auth.type === 'bearer') {
    return [auth.token];
  }
  if (auth.type === 'basic') {
    return [auth.username, auth.password];
  }
  if (auth.type === 'api-key-header' || auth.type === 'api-key-query') {
    return [auth.value];
  }
  return [];
}

/** Preserve the selected mode and non-secret field names without exporting literal credentials. */
function redactAuthProfileForBackup(auth: RequestAuthConfig): RequestAuthConfig {
  if (auth.type === 'none') {
    return { type: 'none' };
  }
  if (auth.type === 'bearer') {
    return { type: 'bearer', token: isVariableReference(auth.token) ? auth.token : '' };
  }
  if (auth.type === 'basic') {
    return {
      type: 'basic',
      username: isVariableReference(auth.username) ? auth.username : '',
      password: isVariableReference(auth.password) ? auth.password : '',
    };
  }
  return { type: auth.type, key: auth.key, value: isVariableReference(auth.value) ? auth.value : '' };
}

export interface ApiStudioBackupPreview {
  requestCount: number
  folderCount: number
  collectionName: string
  environmentNames: string[]
  secretValuesIncluded: boolean
  omittedSecretVariables: string[]
  existingNodeConflicts: string[]
  newEnvironmentNames: string[]
  existingEnvironmentNames: string[]
  notes: string[]
}

export interface ApiStudioRestoreState {
  collection: CollectionNode
  environments: EnvStore
  addedRequests: number
  replacedNodes: number
  addedEnvironments: number
  preservedEnvironmentValues: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[], where: string): void {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) {
    throw new TypeError(`Unsupported field(s) in ${where}: ${unknown.join(', ')}.`);
  }
}

function assertStringMap(value: unknown, where: string): asserts value is Record<string, string> {
  if (!isRecord(value) || Object.values(value).some(item => typeof item !== 'string')) {
    throw new TypeError(`${where} must be an object containing only string values.`);
  }
}

function validateScripts(value: unknown, where: string): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    throw new TypeError(`${where} must be an object.`);
  }
  assertOnlyKeys(value, ['prerequest', 'test'], where);
  if (Object.values(value).some(item => typeof item !== 'string')) {
    throw new TypeError(`${where} fields must be strings.`);
  }
}

function validateAssertion(value: unknown, where: string): void {
  if (!isRecord(value)) {
    throw new TypeError(`${where} must be an object.`);
  }
  assertOnlyKeys(value, ['id', 'enabled', 'type', 'target', 'operator', 'expected'], where);
  if (
    typeof value.id !== 'string'
    || typeof value.enabled !== 'boolean'
    || !['status', 'json', 'header', 'time'].includes(String(value.type))
    || typeof value.target !== 'string'
    || typeof value.operator !== 'string'
    || typeof value.expected !== 'string'
  ) {
    throw new TypeError(`${where} has an invalid assertion shape.`);
  }
}

function validateRequest(value: unknown, where: string, backupVersion: 1 | 2 | 3): void {
  if (!isRecord(value)) {
    throw new TypeError(`${where} must be an object.`);
  }
  assertOnlyKeys(value, backupVersion >= 3 ? ['method', 'url', 'headers', 'body', 'auth'] : ['method', 'url', 'headers', 'body'], where);
  if (
    typeof value.method !== 'string'
    || typeof value.url !== 'string'
    || typeof value.body !== 'string'
    || !Array.isArray(value.headers)
  ) {
    throw new TypeError(`${where} has an invalid request shape.`);
  }
  if (value.auth !== undefined && (backupVersion < 3 || !isRequestAuthConfig(value.auth))) {
    throw new TypeError(`${where}.auth has an invalid or unsupported request auth profile.`);
  }
  value.headers.forEach((header, index) => {
    if (!isRecord(header)) {
      throw new TypeError(`${where}.headers[${index}] must be an object.`);
    }
    assertOnlyKeys(header, ['name', 'value'], `${where}.headers[${index}]`);
    if (typeof header.name !== 'string' || typeof header.value !== 'string') {
      throw new TypeError(`${where}.headers[${index}] has an invalid header shape.`);
    }
  });
}

function validateTreeNode(value: unknown, ids: Set<string>, where: string, allowOpenApiSync = false, backupVersion: 1 | 2 | 3 = 2): void {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim() || typeof value.name !== 'string') {
    throw new TypeError(`${where} has an invalid node identity.`);
  }
  if (ids.has(value.id)) {
    throw new TypeError(`Duplicate collection node ID "${value.id}".`);
  }
  ids.add(value.id);
  validateScripts(value.scripts, `${where}.scripts`);

  if ('items' in value) {
    assertOnlyKeys(value, allowOpenApiSync
      ? ['id', 'name', 'items', 'scripts', 'openApiSync']
      : ['id', 'name', 'items', 'scripts'], where);
    if (allowOpenApiSync && value.openApiSync !== undefined && !parseOpenApiSyncMetadata(value.openApiSync)) {
      throw new TypeError(`${where}.openApiSync has an invalid shape.`);
    }
    if (!Array.isArray(value.items)) {
      throw new TypeError(`${where}.items must be an array.`);
    }
    value.items.forEach((item, index) => validateTreeNode(item, ids, `${where}.items[${index}]`, false, backupVersion));
    return;
  }

  assertOnlyKeys(value, ['id', 'name', 'request', 'assertions', 'scripts'], where);
  validateRequest(value.request, `${where}.request`, backupVersion);
  if (value.assertions !== undefined) {
    if (!Array.isArray(value.assertions)) {
      throw new TypeError(`${where}.assertions must be an array.`);
    }
    value.assertions.forEach((assertion, index) => validateAssertion(assertion, `${where}.assertions[${index}]`));
  }
}

function validateCollection(value: unknown, backupVersion: 1 | 2 | 3): CollectionNode {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.id !== 'string' || typeof value.name !== 'string') {
    throw new TypeError('The backup does not contain a valid collection tree.');
  }
  const ids = new Set<string>();
  validateTreeNode(value, ids, 'collection', backupVersion >= 2, backupVersion);
  const parsed = parseCollectionTree(value);
  if (!parsed) {
    throw new TypeError('The backup collection tree could not be parsed.');
  }
  return parsed;
}

function validateEnvironments(value: unknown): EnvStore {
  if (!isRecord(value)) {
    throw new TypeError('The backup environments field must be an object.');
  }
  assertOnlyKeys(value, ['active', 'envs', 'global', 'collection', 'secrets'], 'environments');
  if (typeof value.active !== 'string' || !isRecord(value.envs)) {
    throw new TypeError('The backup environments field has an invalid shape.');
  }
  for (const [name, vars] of Object.entries(value.envs)) {
    assertStringMap(vars, `environments.envs["${name}"]`);
  }
  if (!Object.prototype.hasOwnProperty.call(value.envs, value.active)) {
    throw new TypeError('The active environment is missing from the environment list.');
  }
  if (value.global !== undefined) {
    assertStringMap(value.global, 'environments.global');
  }
  if (value.collection !== undefined) {
    assertStringMap(value.collection, 'environments.collection');
  }
  if (value.secrets !== undefined && (
    !Array.isArray(value.secrets)
    || value.secrets.some(name => typeof name !== 'string')
    || new Set(value.secrets).size !== value.secrets.length
  )) {
    throw new TypeError('environments.secrets must be a unique array of variable names.');
  }
  return JSON.parse(JSON.stringify(value)) as EnvStore;
}

function urlHasCredentials(raw: string): boolean {
  try {
    const url = new URL(raw);
    return !!url.username || !!url.password;
  }
  catch {
    return false;
  }
}

function redactText(input: string, secrets: string[]): { value: string; redacted: number } {
  let value = input;
  let redacted = 0;
  for (const secret of secrets) {
    if (!secret) {
      continue;
    }
    const occurrences = value.split(secret).length - 1;
    if (occurrences) {
      value = value.split(secret).join(API_STUDIO_BACKUP_REDACTED);
      redacted += occurrences;
    }
  }
  return { value, redacted };
}

function redactArbitraryStrings<T>(value: T, secrets: string[]): { value: T; redacted: number } {
  if (typeof value === 'string') {
    const result = redactText(value, secrets);
    return { value: result.value as T, redacted: result.redacted };
  }
  if (Array.isArray(value)) {
    let redacted = 0;
    const result = value.map((item) => {
      const next = redactArbitraryStrings(item, secrets);
      redacted += next.redacted;
      return next.value;
    });
    return { value: result as T, redacted };
  }
  if (isRecord(value)) {
    let redacted = 0;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const next = redactArbitraryStrings(item, secrets);
      result[key] = next.value;
      redacted += next.redacted;
    }
    return { value: result as T, redacted };
  }
  return { value, redacted: 0 };
}

function countRequests(node: CollectionNode): number {
  return node.items.reduce((count, item) => count + (isFolderNode(item) ? countRequests(item) : 1), 0);
}

function countFolders(node: CollectionNode): number {
  return node.items.reduce((count, item) => count + (isFolderNode(item) ? 1 + countFolders(item) : 0), 0);
}

function collectNodeIds(node: CollectionNode, ids = new Set<string>()): Set<string> {
  ids.add(node.id);
  for (const item of node.items) {
    if (isFolderNode(item)) {
      collectNodeIds(item, ids);
    }
    else {
      ids.add(item.id);
    }
  }
  return ids;
}

function collectRequestIds(node: CollectionNode, ids = new Set<string>()): Set<string> {
  for (const item of node.items) {
    if (isFolderNode(item)) {
      collectRequestIds(item, ids);
    }
    else {
      ids.add(item.id);
    }
  }
  return ids;
}

function countNodes(node: CollectionNode): number {
  return node.items.reduce((count, item) => count + (isFolderNode(item) ? 1 + countNodes(item) : 1), 0);
}

export function createApiStudioBackup(
  collection: CollectionNode,
  environments: EnvStore,
  options: { includeSecrets?: boolean; exportedAt?: string } = {},
): ApiStudioBackupV3 {
  const includeSecrets = options.includeSecrets === true;
  const secretNames = [...new Set(environments.secrets ?? [])];
  const secretValues = includeSecrets
    ? []
    : collectSecretValues(environments).sort((a, b) => b.length - a.length);
  let redactedValues = 0;
  let removedCredentialHeaders = 0;
  let removedUrlCredentials = 0;
  let safeCollection: CollectionNode = JSON.parse(JSON.stringify(collection)) as CollectionNode;

  if (!includeSecrets) {
    const scrubNode = (node: TreeNode): TreeNode => {
      if (isFolderNode(node)) {
        const scrubbed = redactArbitraryStrings(node.scripts ?? {}, secretValues);
        redactedValues += scrubbed.redacted;
        return {
          ...node,
          ...(node.scripts ? { scripts: scrubbed.value as typeof node.scripts } : {}),
          items: node.items.map(scrubNode),
        };
      }
      const original = node.request;
      const { auth: originalAuth, ...requestWithoutAuth } = original;
      const sanitized = sanitizeForShare(requestWithoutAuth);
      const safeAuth = originalAuth ? redactAuthProfileForBackup(originalAuth) : undefined;
      if (safeAuth && originalAuth) {
        redactedValues += authCredentialValues(originalAuth).filter(value => value.length > 0 && !isVariableReference(value)).length;
      }
      removedCredentialHeaders += original.headers.length - sanitized.headers.length;
      if (urlHasCredentials(original.url)) {
        removedUrlCredentials++;
      }
      const requestForBackup: ApiRequestState = {
        ...sanitized,
        ...(safeAuth ? { auth: safeAuth } : {}),
      };
      const scrubbed = redactArbitraryStrings({
        request: requestForBackup,
        scripts: node.scripts,
        assertions: node.assertions,
      }, secretValues);
      redactedValues += scrubbed.redacted;
      const safe = scrubbed.value as { request: ApiRequestState; scripts?: RequestNode['scripts']; assertions?: Assertion[] };
      return {
        ...node,
        request: safe.request,
        ...(safe.scripts ? { scripts: safe.scripts } : {}),
        ...(safe.assertions ? { assertions: safe.assertions } : {}),
      };
    };
    safeCollection = {
      ...collection,
      ...(collection.scripts ? { scripts: redactArbitraryStrings(collection.scripts, secretValues).value } : {}),
      items: collection.items.map(scrubNode),
    };
    if (collection.scripts) {
      redactedValues += redactArbitraryStrings(collection.scripts, secretValues).redacted;
    }
  }

  const safeEnvironments: EnvStore = includeSecrets
    ? JSON.parse(JSON.stringify(environments)) as EnvStore
    : {
        ...environments,
        envs: Object.fromEntries(Object.entries(environments.envs).map(([name, vars]) => [
          name,
          Object.fromEntries(Object.entries(vars).map(([key, value]) => [key, secretNames.includes(key) ? '' : value])),
        ])),
        ...(environments.global ? { global: Object.fromEntries(Object.entries(environments.global).map(([key, value]) => [key, secretNames.includes(key) ? '' : value])) } : {}),
        ...(environments.collection ? { collection: Object.fromEntries(Object.entries(environments.collection).map(([key, value]) => [key, secretNames.includes(key) ? '' : value])) } : {}),
      };
  const omittedSecretVariables = includeSecrets ? [] : secretNames;
  const shortSecretNames = includeSecrets
    ? []
    : secretNames.filter((name) => {
      const values = [environments.global?.[name], environments.collection?.[name], ...Object.values(environments.envs).map(vars => vars[name])];
      return values.some(value => typeof value === 'string' && value.length > 0 && value.length <= 3);
    });

  return {
    format: API_STUDIO_BACKUP_FORMAT,
    version: API_STUDIO_BACKUP_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    collection: safeCollection,
    environments: safeEnvironments,
    security: {
      secretsIncluded: includeSecrets,
      omittedSecretVariables,
      redactedValues,
      removedCredentialHeaders,
      removedUrlCredentials,
      notes: includeSecrets
        ? ['This archive includes all stored environment values and request credentials. Keep the file private.']
        : [
            'Marked environment secret values are blanked in every scope.',
            'Credential headers and URL-embedded username/password are removed.',
            'Request auth mode and non-secret key names are preserved; credential values are blanked. Unresolved {{variable}} references are retained.',
            'Marked secret values longer than three characters are redacted when found in collection text fields.',
            'Free-form body, query and script content may contain unmarked secrets that cannot be identified automatically.',
            ...(shortSecretNames.length ? [`Short marked secret values (1–3 characters) were omitted from variables but may remain in free-form text: ${shortSecretNames.join(', ')}.`] : []),
          ],
    },
  };
}

export function serializeApiStudioBackup(backup: ApiStudioBackupArchive): string {
  return JSON.stringify(backup, null, 2);
}

export function parseApiStudioBackup(text: string): ApiStudioBackupArchive {
  if (typeof text !== 'string') {
    throw new TypeError('Choose a backup file to restore.');
  }
  if (new TextEncoder().encode(text).byteLength > API_STUDIO_BACKUP_MAX_BYTES) {
    throw new TypeError('Backup file is too large (maximum 10 MB).');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  }
  catch {
    throw new TypeError('The selected file is not valid JSON.');
  }
  if (!isRecord(raw)) {
    throw new TypeError('The selected file is not an API Studio backup.');
  }
  assertOnlyKeys(raw, ['format', 'version', 'exportedAt', 'collection', 'environments', 'security'], 'backup');
  if (raw.format !== API_STUDIO_BACKUP_FORMAT || (raw.version !== 1 && raw.version !== 2 && raw.version !== 3)) {
    throw new TypeError('Unsupported API Studio backup format or version.');
  }
  if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt))) {
    throw new TypeError('The backup export timestamp is invalid.');
  }
  if (!isRecord(raw.security)) {
    throw new TypeError('The backup security summary is missing.');
  }
  assertOnlyKeys(raw.security, [
    'secretsIncluded',
    'omittedSecretVariables',
    'redactedValues',
    'removedCredentialHeaders',
    'removedUrlCredentials',
    'notes',
  ], 'security');
  if (
    typeof raw.security.secretsIncluded !== 'boolean'
    || !Array.isArray(raw.security.omittedSecretVariables)
    || raw.security.omittedSecretVariables.some(value => typeof value !== 'string')
    || typeof raw.security.redactedValues !== 'number'
    || typeof raw.security.removedCredentialHeaders !== 'number'
    || typeof raw.security.removedUrlCredentials !== 'number'
    || !Array.isArray(raw.security.notes)
    || raw.security.notes.some(value => typeof value !== 'string')
  ) {
    throw new TypeError('The backup security summary has an invalid shape.');
  }
  return {
    format: API_STUDIO_BACKUP_FORMAT,
    version: raw.version,
    exportedAt: raw.exportedAt,
    collection: validateCollection(raw.collection, raw.version),
    environments: validateEnvironments(raw.environments),
    security: JSON.parse(JSON.stringify(raw.security)) as ApiStudioBackupSecurity,
  } as ApiStudioBackupArchive;
}

export function previewApiStudioBackup(
  backup: ApiStudioBackupArchive,
  currentCollection: CollectionNode,
  currentEnvironments: EnvStore,
): ApiStudioBackupPreview {
  const currentIds = collectNodeIds(currentCollection);
  const backupIds = collectNodeIds(backup.collection);
  const existingNodeConflicts = [...backupIds].filter(id => currentIds.has(id));
  const existingEnvironmentNames = Object.keys(backup.environments.envs).filter(name => Object.prototype.hasOwnProperty.call(currentEnvironments.envs, name));
  const newEnvironmentNames = Object.keys(backup.environments.envs).filter(name => !Object.prototype.hasOwnProperty.call(currentEnvironments.envs, name));
  const notes = [...backup.security.notes];
  if (existingNodeConflicts.length) {
    notes.push(`${existingNodeConflicts.length} collection node ID(s) already exist and will be replaced at their current position when merging.`);
  }
  if (existingEnvironmentNames.length) {
    notes.push('During merge, existing environment variables keep their current values; only missing values are restored.');
  }
  return {
    requestCount: countRequests(backup.collection),
    folderCount: countFolders(backup.collection),
    collectionName: backup.collection.name,
    environmentNames: Object.keys(backup.environments.envs),
    secretValuesIncluded: backup.security.secretsIncluded,
    omittedSecretVariables: backup.security.omittedSecretVariables,
    existingNodeConflicts,
    newEnvironmentNames,
    existingEnvironmentNames,
    notes,
  };
}

function mergeEnvironmentStores(current: EnvStore, incoming: EnvStore): { environments: EnvStore; addedEnvironments: number; preservedEnvironmentValues: number } {
  const envs: EnvStore['envs'] = { ...incoming.envs };
  let preservedEnvironmentValues = 0;
  for (const [name, vars] of Object.entries(current.envs)) {
    if (!envs[name]) {
      envs[name] = { ...vars };
      continue;
    }
    const merged = { ...incoming.envs[name] };
    for (const [key, value] of Object.entries(vars)) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        preservedEnvironmentValues++;
      }
      merged[key] = value;
    }
    envs[name] = merged;
  }
  const mergeScope = (incomingScope?: Record<string, string>, currentScope?: Record<string, string>) => {
    const merged = { ...(incomingScope ?? {}) };
    for (const [key, value] of Object.entries(currentScope ?? {})) {
      if (Object.prototype.hasOwnProperty.call(merged, key)) {
        preservedEnvironmentValues++;
      }
      merged[key] = value;
    }
    return Object.keys(merged).length ? merged : undefined;
  };
  const global = mergeScope(incoming.global, current.global);
  const collection = mergeScope(incoming.collection, current.collection);
  const secrets = [...new Set([...(incoming.secrets ?? []), ...(current.secrets ?? [])])];
  return {
    environments: {
      active: Object.prototype.hasOwnProperty.call(envs, current.active) ? current.active : incoming.active,
      envs,
      ...(global ? { global } : {}),
      ...(collection ? { collection } : {}),
      ...(secrets.length ? { secrets } : {}),
    },
    addedEnvironments: Object.keys(incoming.envs).filter(name => !Object.prototype.hasOwnProperty.call(current.envs, name)).length,
    preservedEnvironmentValues,
  };
}

export function planApiStudioRestore(
  currentCollection: CollectionNode,
  currentEnvironments: EnvStore,
  backup: ApiStudioBackupArchive,
  strategy: BackupRestoreStrategy,
): ApiStudioRestoreState {
  if (strategy === 'replace') {
    return {
      collection: JSON.parse(JSON.stringify(backup.collection)) as CollectionNode,
      environments: JSON.parse(JSON.stringify(backup.environments)) as EnvStore,
      addedRequests: countRequests(backup.collection),
      replacedNodes: countNodes(currentCollection),
      addedEnvironments: Object.keys(backup.environments.envs).length,
      preservedEnvironmentValues: 0,
    };
  }
  const mergedTree = mergeImportedTree(currentCollection, backup.collection);
  const mergedEnvironments = mergeEnvironmentStores(currentEnvironments, backup.environments);
  const currentRequestIds = collectRequestIds(currentCollection);
  const incomingRequestIds = collectRequestIds(backup.collection);
  const addedRequests = [...incomingRequestIds].filter(id => !currentRequestIds.has(id)).length;
  return {
    collection: mergedTree.tree,
    environments: mergedEnvironments.environments,
    addedRequests,
    replacedNodes: mergedTree.replaced,
    addedEnvironments: mergedEnvironments.addedEnvironments,
    preservedEnvironmentValues: mergedEnvironments.preservedEnvironmentValues,
  };
}
