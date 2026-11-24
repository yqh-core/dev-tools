export interface HarResponseHeader {
  name: string
  value: string
}

export interface HarResponseEntry {
  id: string
  method: string
  url: string
  status: number
  statusText: string
  httpVersion: string
  headers: HarResponseHeader[]
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read standard HAR 1.2 response entries without sending the file anywhere.
 * Entries without a valid HTTP status are ignored; repeated headers are retained.
 */
export function parseHarResponseEntries(source: string): HarResponseEntry[] {
  const payload: unknown = JSON.parse(source);
  if (!isRecord(payload) || !isRecord(payload.log) || !Array.isArray(payload.log.entries)) {
    throw new Error('Invalid HAR: expected log.entries array');
  }

  return payload.log.entries.flatMap((rawEntry, index) => {
    if (!isRecord(rawEntry) || !isRecord(rawEntry.response)) {
      return [];
    }

    const response = rawEntry.response;
    const status = response.status;
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599) {
      return [];
    }

    const request = isRecord(rawEntry.request) ? rawEntry.request : {};
    const rawHeaders = Array.isArray(response.headers) ? response.headers : [];
    const headers = rawHeaders.flatMap((rawHeader) => {
      if (!isRecord(rawHeader) || typeof rawHeader.name !== 'string' || typeof rawHeader.value !== 'string') {
        return [];
      }

      const name = rawHeader.name.trim();
      if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name)) {
        return [];
      }

      return [{
        name,
        value: rawHeader.value.replace(/[\r\n]+/g, ' ').trim(),
      }];
    });

    const method = typeof request.method === 'string' ? request.method.trim().toUpperCase() : 'GET';
    const url = typeof request.url === 'string' ? request.url : '(unknown URL)';
    const statusText = typeof response.statusText === 'string'
      ? response.statusText.replace(/[\r\n]+/g, ' ').trim()
      : '';
    const candidateVersion = typeof response.httpVersion === 'string' ? response.httpVersion.trim() : '';
    const httpVersion = /^HTTP\/\d(?:\.\d)?$/i.test(candidateVersion) ? candidateVersion : 'HTTP/1.1';

    return [{
      id: String(index),
      method: method || 'GET',
      url,
      status,
      statusText,
      httpVersion,
      headers,
    }];
  });
}

/** Convert one selected HAR response into the raw header format already analyzed by the tool. */
export function formatHarResponseHeaders(entry: HarResponseEntry): string {
  const statusLine = `${entry.httpVersion} ${entry.status} ${entry.statusText}`.trim();
  return [
    statusLine,
    ...entry.headers.map(header => `${header.name}: ${header.value}`),
  ].join('\n');
}
