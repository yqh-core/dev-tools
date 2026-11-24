import { evaluateRegex, evaluateRegexTestCases, type RegexTestCase } from './regex-tester.service';

interface RegexWorkerRequest {
  id: number
  regex: string
  text: string
  flags: string
  replacement: string
  testCases?: RegexTestCase[]
}

interface RegexWorkerResponse {
  id: number
  result?: ReturnType<typeof evaluateRegex>
  error?: string
  testCaseResults?: ReturnType<typeof evaluateRegexTestCases>
}

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null
  postMessage: (message: RegexWorkerResponse) => void
};

workerScope.onmessage = (event) => {
  const { id, regex, text, flags, replacement } = event.data;
  try {
    workerScope.postMessage({
      id,
      result: evaluateRegex(regex, text, flags, replacement),
      testCaseResults: evaluateRegexTestCases(regex, flags, event.data.testCases ?? []),
    });
  }
  catch (error) {
    workerScope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
