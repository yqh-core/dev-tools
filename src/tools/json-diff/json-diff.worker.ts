import JSON5 from 'json5';
import { diff } from './json-diff.models';
import type { JsonDiffWorkerRequest, JsonDiffWorkerResponse } from './json-diff.worker.types';

const workerScope = globalThis as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<JsonDiffWorkerRequest>) => void) => void
  postMessage: (message: JsonDiffWorkerResponse) => void
};

workerScope.addEventListener('message', ({ data }) => {
  try {
    const leftJson = JSON5.parse(data.leftText);
    const rightJson = JSON5.parse(data.rightText);
    const difference = diff(leftJson, rightJson, data.options);
    workerScope.postMessage({
      type: 'success',
      leftJson,
      rightJson,
      difference,
    });
  }
  catch (error) {
    workerScope.postMessage({
      type: 'error',
      message: error instanceof Error
        ? `Invalid JSON format: ${error.message}`
        : 'Invalid JSON format. Check both inputs.',
    });
  }
});
