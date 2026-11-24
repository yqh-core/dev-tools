import { isArray, isEqual, isObject } from 'lodash';
import type { Difference, DifferenceStatus } from './json-diff.types';

export { diff };

export type ArrayComparisonMode = 'index' | 'ignore-order' | 'id';

export interface DiffOptions {
  onlyShowDifferences?: boolean
  arrayMode?: ArrayComparisonMode
  arrayIdKey?: string
  ignorePaths?: string[]
}

export const MAX_IGNORE_PATHS = 100;
export const MAX_IGNORE_PATHS_LENGTH = 8192;

export interface IgnorePathParseResult {
  paths: string[]
  error?: string
}

/** Parse exact RFC 6901 JSON Pointers, one per line. Wildcards are intentionally unsupported. */
export function parseIgnorePaths(raw: string): IgnorePathParseResult {
  if (raw.length > MAX_IGNORE_PATHS_LENGTH) {
    return { paths: [], error: `Ignore paths must be ${MAX_IGNORE_PATHS_LENGTH} characters or fewer.` };
  }

  const entries = raw.split(/\\r?\\n/).filter(line => line.length > 0);
  if (entries.length > MAX_IGNORE_PATHS) {
    return { paths: [], error: `Use no more than ${MAX_IGNORE_PATHS} ignore paths.` };
  }

  for (const pointer of entries) {
    if (!pointer.startsWith('/')) {
      return { paths: [], error: `Invalid JSON Pointer "${pointer}": each path must start with /.` };
    }
    if (/~(?:[^01]|$)/.test(pointer)) {
      return { paths: [], error: `Invalid JSON Pointer "${pointer}": escape ~ as ~0 and / as ~1.` };
    }
  }

  return { paths: [...new Set(entries)] };
}

function appendPointer(parent: string, segment: string | number): string {
  const escaped = String(segment).replace(/~/g, '~0').replace(/\\//g, '~1');
  return `${parent}/${escaped}`;
}

function isIgnoredPath(path: string, options: DiffOptions): boolean {
  return options.ignorePaths?.includes(path) ?? false;
}

function createIgnoredDifference(value: unknown, newValue: unknown, key: string | number): Difference {
  const type = getType(value === undefined ? newValue : value);
  if (type === 'object') {
    return { key, type, children: [], oldValue: value, value: newValue, status: 'unchanged' };
  }
  if (type === 'array') {
    return { key, type, children: [], oldValue: value, value: newValue, status: 'unchanged' };
  }
  return { key, type: 'value', oldValue: value, value: newValue, status: 'unchanged' };
}

export interface FlatDifference {
  path: string
  status: DifferenceStatus
  oldValue: unknown
  value: unknown
}

/** Flatten nested structural changes into stable JSONPath-like locations. */
export function flattenDifferences(difference: Difference, path = '$'): FlatDifference[] {
  if ('children' in difference && (difference.children.length > 0 || difference.status === 'children-updated')) {
    return difference.children.flatMap((child) => {
      const childPath = typeof child.key === 'number'
        ? `${path}[${child.key}]`
        : `${path}[${JSON.stringify(child.key)}]`;
      return flattenDifferences(child, childPath);
    });
  }

  if (difference.status === 'unchanged') {
    return [];
  }

  return [{
    path,
    status: difference.status,
    oldValue: difference.oldValue,
    value: difference.value,
  }];
}

/** ID matching is only safe when every element has a unique, non-empty string or finite numeric key. */
export function hasValidArrayIds(left: unknown[], right: unknown[], idKey: string): boolean {
  if (!idKey.trim()) {
    return false;
  }

  const validIds = (items: unknown[]) => {
    const ids = new Set<string | number>();
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return false;
      }
      if (!Object.prototype.hasOwnProperty.call(item, idKey)) {
        return false;
      }
      const id = (item as Record<string, unknown>)[idKey];
      if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isFinite(id))) {
        return false;
      }
      if (typeof id === 'string' && id.trim() === '') {
        return false;
      }
      if (ids.has(id)) {
        return false;
      }
      ids.add(id);
    }
    return true;
  };

  return validIds(left) && validIds(right);
}

function diff(
  obj: unknown,
  newObj: unknown,
  options: DiffOptions = {},
  path = '',
): Difference {
  if (isIgnoredPath(path, options)) {
    return createIgnoredDifference(obj, newObj, '');
  }
  if (isArray(obj) && isArray(newObj)) {
    return {
      key: '',
      type: 'array',
      children: diffArrays(obj, newObj, options, path),
      oldValue: obj,
      value: newObj,
      status: getStatus(obj, newObj),
    };
  }

  if (isObject(obj) && isObject(newObj)) {
    return {
      key: '',
      type: 'object',
      children: diffObjects(obj as Record<string, unknown>, newObj as Record<string, unknown>, options, path),
      oldValue: obj,
      value: newObj,
      status: getStatus(obj, newObj),
    };
  }

  return {
    key: '',
    type: 'value',
    oldValue: obj,
    value: newObj,
    status: getStatus(obj, newObj),
  };
}

function diffObjects(
  obj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  options: DiffOptions = {},
  path = '',
): Difference[] {
  const { onlyShowDifferences = false } = options;
  const keys = Object.keys({ ...obj, ...newObj });
  return keys
    .map(key => createDifference(obj?.[key], newObj?.[key], key, options, appendPointer(path, key)))
    .filter(difference => !onlyShowDifferences || difference.status !== 'unchanged');
}

function createDifference(
  value: unknown,
  newValue: unknown,
  key: string | number,
  options: DiffOptions = {},
  path = '',
): Difference {
  if (isIgnoredPath(path, options)) {
    return createIgnoredDifference(value, newValue, key);
  }
  const type = getType(value);

  if (type === 'object') {
    return {
      key,
      type,
      children: diffObjects(value as Record<string, unknown>, newValue as Record<string, unknown>, options, path),
      oldValue: value,
      value: newValue,
      status: getStatus(value, newValue),
    };
  }

  if (type === 'array') {
    return {
      key,
      type,
      children: diffArrays(value as unknown[], newValue as unknown[], options, path),
      value: newValue,
      oldValue: value,
      status: getStatus(value, newValue),
    };
  }

  return {
    key,
    type,
    value: newValue,
    oldValue: value,
    status: getStatus(value, newValue),
  };
}

function diffArrays(
  arr: unknown[],
  newArr: unknown[],
  options: DiffOptions = {},
  path = '',
): Difference[] {
  const { onlyShowDifferences = false, arrayMode = 'index', arrayIdKey = 'id' } = options;

  if (arrayMode === 'ignore-order') {
    return diffArraysIgnoringOrder(arr, newArr, options, path);
  }

  if (arrayMode === 'id' && hasValidArrayIds(arr, newArr, arrayIdKey)) {
    return diffArraysById(arr, newArr, arrayIdKey, options, path);
  }

  const maxLength = Math.max(0, arr?.length, newArr?.length);
  return Array.from({ length: maxLength }, (_, index) =>
    createDifference(arr?.[index], newArr?.[index], index, options, appendPointer(path, index)),
  ).filter(difference => !onlyShowDifferences || difference.status !== 'unchanged');
}

function isEqualIgnoringArrayOrder(left: unknown, right: unknown, options: DiffOptions, path: string): boolean {
  if (isIgnoredPath(path, options)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    const matchedIndexes = new Set<number>();
    return left.every((leftItem, leftIndex) => {
      const matchIndex = right.findIndex((rightItem, index) =>
        !matchedIndexes.has(index) && isEqualIgnoringArrayOrder(leftItem, rightItem, options, appendPointer(path, leftIndex)),
      );
      if (matchIndex < 0) {
        return false;
      }
      matchedIndexes.add(matchIndex);
      return true;
    });
  }

  if (
    left !== null
    && right !== null
    && typeof left === 'object'
    && typeof right === 'object'
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);
    return leftKeys.length === rightKeys.length
      && leftKeys.every(key =>
        Object.prototype.hasOwnProperty.call(rightRecord, key)
        && isEqualIgnoringArrayOrder(leftRecord[key], rightRecord[key], options, appendPointer(path, key)),
      );
  }

  return isEqual(left, right);
}

function diffArraysIgnoringOrder(
  arr: unknown[],
  newArr: unknown[],
  options: DiffOptions,
  path: string,
): Difference[] {
  const matchedNewIndexes = new Set<number>();
  const differences: Difference[] = [];

  arr.forEach((oldItem, oldIndex) => {
    const matchIndex = newArr.findIndex((newItem, index) =>
      !matchedNewIndexes.has(index) && isEqualIgnoringArrayOrder(oldItem, newItem, options, appendPointer(path, oldIndex)),
    );

    if (matchIndex >= 0) {
      matchedNewIndexes.add(matchIndex);
      differences.push(createDifference(oldItem, newArr[matchIndex], oldIndex, options, appendPointer(path, oldIndex)));
    }
    else {
      differences.push(createDifference(oldItem, undefined, oldIndex, options, appendPointer(path, oldIndex)));
    }
  });

  newArr.forEach((newItem, newIndex) => {
    if (!matchedNewIndexes.has(newIndex)) {
      differences.push(createDifference(undefined, newItem, newIndex, options, appendPointer(path, newIndex)));
    }
  });

  return options.onlyShowDifferences
    ? differences.filter(difference => difference.status !== 'unchanged')
    : differences;
}

function diffArraysById(
  arr: unknown[],
  newArr: unknown[],
  idKey: string,
  options: DiffOptions,
  path: string,
): Difference[] {
  const newById = new Map<string | number, unknown>();
  for (const item of newArr) {
    const id = (item as Record<string, unknown>)[idKey] as string | number;
    newById.set(id, item);
  }

  const matchedIds = new Set<string | number>();
  const differences = arr.map((oldItem, oldIndex) => {
    const id = (oldItem as Record<string, unknown>)[idKey] as string | number;
    const matchedItem = newById.get(id);
    if (matchedItem !== undefined) {
      matchedIds.add(id);
      return createDifference(oldItem, matchedItem, oldIndex, options, appendPointer(path, oldIndex));
    }
    return createDifference(oldItem, undefined, oldIndex, options, appendPointer(path, oldIndex));
  });

  newArr.forEach((newItem, newIndex) => {
    const id = (newItem as Record<string, unknown>)[idKey] as string | number;
    if (!matchedIds.has(id)) {
      differences.push(createDifference(undefined, newItem, newIndex, options, appendPointer(path, newIndex)));
    }
  });

  return options.onlyShowDifferences
    ? differences.filter(difference => difference.status !== 'unchanged')
    : differences;
}

function getType(value: unknown): 'object' | 'array' | 'value' {
  if (value === null) {
    return 'value';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  return 'value';
}

function getStatus(value: unknown, newValue: unknown): DifferenceStatus {
  if (value === undefined) {
    return 'added';
  }

  if (newValue === undefined) {
    return 'removed';
  }

  const bothAreObjects = getType(value) === 'object' && getType(newValue) === 'object';
  const bothAreArrays = getType(value) === 'array' && getType(newValue) === 'array';
  const bothAreDeepEqual = isEqual(value, newValue);

  if (bothAreDeepEqual) {
    return 'unchanged';
  }

  if (bothAreObjects || bothAreArrays) {
    return 'children-updated';
  }

  return 'updated';
}
