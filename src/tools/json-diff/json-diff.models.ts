import { isArray, isEqual, isObject } from 'lodash';
import type { Difference, DifferenceStatus } from './json-diff.types';

export { diff };

export type ArrayComparisonMode = 'index' | 'ignore-order' | 'id';

export interface DiffOptions {
  onlyShowDifferences?: boolean
  arrayMode?: ArrayComparisonMode
  arrayIdKey?: string
}

export interface FlatDifference {
  path: string
  status: DifferenceStatus
  oldValue: unknown
  value: unknown
}

/** Flatten nested structural changes into stable JSONPath-like locations. */
export function flattenDifferences(difference: Difference, path = '$'): FlatDifference[] {
  if ('children' in difference && difference.children.length > 0) {
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
): Difference {
  const { onlyShowDifferences = false } = options;

  if (isArray(obj) && isArray(newObj)) {
    return {
      key: '',
      type: 'array',
      children: diffArrays(obj, newObj, options),
      oldValue: obj,
      value: newObj,
      status: getStatus(obj, newObj),
    };
  }

  if (isObject(obj) && isObject(newObj)) {
    return {
      key: '',
      type: 'object',
      children: diffObjects(obj as Record<string, unknown>, newObj as Record<string, unknown>, options),
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
): Difference[] {
  const { onlyShowDifferences = false } = options;
  const keys = Object.keys({ ...obj, ...newObj });
  return keys
    .map(key => createDifference(obj?.[key], newObj?.[key], key, options))
    .filter(difference => !onlyShowDifferences || difference.status !== 'unchanged');
}

function createDifference(
  value: unknown,
  newValue: unknown,
  key: string | number,
  options: DiffOptions = {},
): Difference {
  const type = getType(value);

  if (type === 'object') {
    return {
      key,
      type,
      children: diffObjects(value as Record<string, unknown>, newValue as Record<string, unknown>, options),
      oldValue: value,
      value: newValue,
      status: getStatus(value, newValue),
    };
  }

  if (type === 'array') {
    return {
      key,
      type,
      children: diffArrays(value as unknown[], newValue as unknown[], options),
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
): Difference[] {
  const { onlyShowDifferences = false, arrayMode = 'index', arrayIdKey = 'id' } = options;

  if (arrayMode === 'ignore-order') {
    return diffArraysIgnoringOrder(arr, newArr, options);
  }

  if (arrayMode === 'id' && hasValidArrayIds(arr, newArr, arrayIdKey)) {
    return diffArraysById(arr, newArr, arrayIdKey, options);
  }

  const maxLength = Math.max(0, arr?.length, newArr?.length);
  return Array.from({ length: maxLength }, (_, index) =>
    createDifference(arr?.[index], newArr?.[index], index, options),
  ).filter(difference => !onlyShowDifferences || difference.status !== 'unchanged');
}

function diffArraysIgnoringOrder(
  arr: unknown[],
  newArr: unknown[],
  options: DiffOptions,
): Difference[] {
  const matchedNewIndexes = new Set<number>();
  const differences: Difference[] = [];

  arr.forEach((oldItem, oldIndex) => {
    const matchIndex = newArr.findIndex((newItem, index) =>
      !matchedNewIndexes.has(index) && isEqual(oldItem, newItem),
    );

    if (matchIndex >= 0) {
      matchedNewIndexes.add(matchIndex);
      differences.push(createDifference(oldItem, newArr[matchIndex], oldIndex, options));
    }
    else {
      differences.push(createDifference(oldItem, undefined, oldIndex, options));
    }
  });

  newArr.forEach((newItem, newIndex) => {
    if (!matchedNewIndexes.has(newIndex)) {
      differences.push(createDifference(undefined, newItem, newIndex, options));
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
      return createDifference(oldItem, matchedItem, oldIndex, options);
    }
    return createDifference(oldItem, undefined, oldIndex, options);
  });

  newArr.forEach((newItem, newIndex) => {
    const id = (newItem as Record<string, unknown>)[idKey] as string | number;
    if (!matchedIds.has(id)) {
      differences.push(createDifference(undefined, newItem, newIndex, options));
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
