import { isNull } from 'lodash';
import type { ArrayDifference, Difference, ObjectDifference } from '../json-diff.types';
import { useCopy } from '@/composable/copy';

export function DiffRootViewer({ diff, focusedPath = '' }: { diff: Difference; focusedPath?: string }) {
  return (
    <div class={'diffs-viewer'}>
      <ul>{DiffViewer({ diff, showKeys: false, path: '$', focusedPath })}</ul>
    </div>
  );
}

function getChildPath(path: string, key: string | number) {
  return typeof key === 'number' ? `${path}[${key}]` : `${path}[${JSON.stringify(key)}]`;
}

function DiffViewer({ diff, showKeys = true, path, focusedPath }: {
  diff: Difference
  showKeys?: boolean
  path: string
  focusedPath: string
}) {
  const { type, status } = diff;

  if (status === 'updated') {
    return ComparisonViewer({ diff, showKeys, path, focusedPath });
  }

  if (type === 'array') {
    return ChildrenViewer({ diff, showKeys, showChildrenKeys: false, openTag: '[', closeTag: ']', path, focusedPath });
  }

  if (type === 'object') {
    return ChildrenViewer({ diff, showKeys, openTag: '{', closeTag: '}', path, focusedPath });
  }

  return LineDiffViewer({ diff, showKeys, path, focusedPath });
}

function LineDiffViewer({ diff, showKeys, path, focusedPath }: { diff: Difference; showKeys?: boolean; path: string; focusedPath: string }) {
  const { value, key, status, oldValue } = diff;
  const valueToDisplay = status === 'removed' ? oldValue : value;

  return (
    <li class={focusedPath === path ? 'is-focused' : undefined} data-json-path={path}>
      <span class={[status, 'result']}>
        {showKeys && (
          <>
            <span class={'key'}>{key}</span>
            {': '}
          </>
        )}
        {Value({ value: valueToDisplay, status })}
      </span>
      ,
    </li>
  );
}

function ComparisonViewer({ diff, showKeys, path, focusedPath }: { diff: Difference; showKeys?: boolean; path: string; focusedPath: string }) {
  const { value, key, oldValue } = diff;

  return (
    <li class={['updated-line', focusedPath === path ? 'is-focused' : '']} data-json-path={path}>
      {showKeys && (
        <>
          <span class={'key'}>{key}</span>
          {': '}
        </>
      )}
      {Value({ value: oldValue, status: 'removed' })}
      {Value({ value, status: 'added' })},
    </li>
  );
}

function ChildrenViewer({
  diff,
  openTag,
  closeTag,
  showKeys,
  path,
  focusedPath,
  showChildrenKeys = true,
}: {
  diff: ArrayDifference | ObjectDifference
  showKeys: boolean
  showChildrenKeys?: boolean
  openTag: string
  closeTag: string
  path: string
  focusedPath: string
}) {
  const { children, key, status, type } = diff;

  return (
    <li class={focusedPath === path ? 'is-focused' : undefined} data-json-path={path}>
      <div class={[type, status]} style={{ display: 'inline-block' }}>
        {showKeys && (
          <>
            <span class={'key'}>{key}</span>
            {': '}
          </>
        )}

        {openTag}
        {children.length > 0 && <ul>{children.map(child => DiffViewer({ diff: child, showKeys: showChildrenKeys, path: getChildPath(path, child.key), focusedPath }))}</ul>}
        {`${closeTag},`}
      </div>
    </li>
  );
}

function formatValue(value: unknown) {
  if (isNull(value)) {
    return 'null';
  }

  return JSON.stringify(value);
}

function Value({ value, status }: { value: unknown; status: string }) {
  const formatedValue = formatValue(value);

  const { copy } = useCopy({ source: formatedValue });

  return (
    <span class={['value', status]} onClick={() => copy()}>
      {formatedValue}
    </span>
  );
}
