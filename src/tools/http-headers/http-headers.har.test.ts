import { describe, expect, it } from 'vitest';
import { formatHarResponseHeaders, parseHarResponseEntries } from './http-headers.har';

describe('parseHarResponseEntries', () => {
  it('extracts valid responses and preserves repeated response headers', () => {
    const result = parseHarResponseEntries(JSON.stringify({
      log: {
        entries: [
          {
            request: { method: 'get', url: 'https://example.com/' },
            response: {
              status: 200,
              statusText: 'OK',
              httpVersion: 'HTTP/2',
              headers: [
                { name: 'Set-Cookie', value: 'a=1; Secure' },
                { name: 'Set-Cookie', value: 'b=2; HttpOnly' },
                { name: 'X-Test', value: 'one\r\ntwo' },
              ],
            },
          },
          { request: { url: 'https://blocked.example/' }, response: { status: 0, headers: [] } },
          { request: {}, response: { status: 404, headers: [] } },
        ],
      },
    }));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: '0',
      method: 'GET',
      url: 'https://example.com/',
      status: 200,
      httpVersion: 'HTTP/2',
    });
    expect(result[0].headers).toHaveLength(3);
    expect(result[0].headers[2].value).toBe('one two');
  });

  it('formats one selected response for the existing analyzer', () => {
    const entries = parseHarResponseEntries(JSON.stringify({
      log: {
        entries: [{
          request: { method: 'GET', url: 'https://example.com/' },
          response: {
            status: 204,
            statusText: 'No Content',
            httpVersion: 'HTTP/2',
            headers: [{ name: 'X-Content-Type-Options', value: 'nosniff' }],
          },
        }],
      },
    }));

    expect(formatHarResponseHeaders(entries[0])).toBe(
      'HTTP/2 204 No Content\nX-Content-Type-Options: nosniff',
    );
  });

  it('rejects malformed or non-HAR JSON structures', () => {
    expect(() => parseHarResponseEntries('{invalid')).toThrow();
    expect(() => parseHarResponseEntries(JSON.stringify({ log: { entries: 'invalid' } })))
      .toThrow('Invalid HAR');
  });
});
