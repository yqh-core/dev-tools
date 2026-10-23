import { has, isError, isObject, isString } from 'lodash';

export { getErrorMessageIfThrows };

function getErrorMessageIfThrows(cb: () => unknown) {
  try {
    cb();
    return undefined;
  }
  catch (err) {
    if (isString(err)) {
      return err;
    }

    if (isError(err)) {
      return err.message;
    }

    if (isObject(err) && has(err, 'message')) {
      return (err as { message: string }).message;
    }

    return 'An error as occurred.';
  }
}
