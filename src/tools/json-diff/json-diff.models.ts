import { isArray, isEqual, isObject } from 'lodash';
import type { Difference, DifferenceStatus } from './json-diff.types';

export { diff };

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
function diff(
  obj: unknown,
  newObj: unknown,
  { onlyShowDifferences = false }: { onlyShowDifferences?: boolean } = {},
): Difference {
  if (isArray(obj) && isArray(newObj)) {
    return {
      key: '',
      type: 'array',
      children: diffArrays(obj, newObj, { onlyShowDifferences }),
      oldValue: obj,
      value: newObj,
      status: getStatus(obj, newObj),
    };
  }

  if (isObject(obj) && isObject(newObj)) {
    return {
      key: '',
      type: 'object',
      children: diffObjects(obj as Record<string, unknown>, newObj as Record<string, unknown>, { onlyShowDifferences }),
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
  { onlyShowDifferences = false }: { onlyShowDifferences?: boolean } = {},
): Difference[] {
  const keys = Object.keys({ ...obj, ...newObj });
  return keys
    .map(key => createDifference(obj?.[key], newObj?.[key], key, { onlyShowDifferences }))
    .filter(diff => !onlyShowDifferences || diff.status !== 'unchanged');
}

function createDifference(
  value: unknown,
  newValue: unknown,
  key: string | number,
  { onlyShowDifferences = false }: { onlyShowDifferences?: boolean } = {},
): Difference {
  const type = getType(value);

  if (type === 'object') {
    return {
      key,
      type,
      children: diffObjects(value as Record<string, unknown>, newValue as Record<string, unknown>, {
        onlyShowDifferences,
      }),
      oldValue: value,
      value: newValue,
      status: getStatus(value, newValue),
    };
  }

  if (type === 'array') {
    return {
      key,
      type,
      children: diffArrays(value as unknown[], newValue as unknown[], { onlyShowDifferences }),
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
  { onlyShowDifferences = false }: { onlyShowDifferences?: boolean } = {},
): Difference[] {
  const maxLength = Math.max(0, arr?.length, newArr?.length);
  return Array.from({ length: maxLength }, (_, i) =>
    createDifference(arr?.[i], newArr?.[i], i, { onlyShowDifferences }),
  ).filter(diff => !onlyShowDifferences || diff.status !== 'unchanged');
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
