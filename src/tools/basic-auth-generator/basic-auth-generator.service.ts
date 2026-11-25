import { base64ToText, isValidBase64 } from '@/utils/base64';

export interface BasicAuthExamples {
  url: string
  curl: string
  nodeFetch: string
  pythonRequests: string
}

function shellQuote(value: string): string {
  const escapedQuote = String.raw`'\''`;
  return `'${value.replace(/'/g, escapedQuote)}'`;
}

/**
 * Build examples that keep credentials in environment variables instead of
 * embedding them in copied source code. The URL is validated and never fetched.
 */
export function buildBasicAuthExamples(requestUrl: string): BasicAuthExamples {
  let parsed: URL;

  try {
    parsed = new URL(requestUrl.trim());
  }
  catch {
    throw new Error('Enter a valid absolute HTTP or HTTPS request URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Request URL must use HTTP or HTTPS');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Do not embed credentials in the request URL');
  }

  // URL fragments are client-side only and are not sent in an HTTP request.
  parsed.hash = '';
  const url = parsed.toString();

  const curl = `curl --user "$BASIC_AUTH_USERNAME:$BASIC_AUTH_PASSWORD" ${shellQuote(url)}`;
  const nodeFetch = [
    'import { Buffer } from \'node:buffer\';',
    '',
    'const credentials = process.env.BASIC_AUTH_USERNAME + \':\' + process.env.BASIC_AUTH_PASSWORD;',
    'const token = Buffer.from(credentials, \'utf8\').toString(\'base64\');',
    `const response = await fetch(${JSON.stringify(url)}, {`,
    '  headers: { Authorization: \'Basic \' + token },',
    '});',
    '',
    'console.log(response.status);',
  ].join('\n');

  const pythonRequests = [
    'import os',
    'import requests',
    '',
    'response = requests.get(',
    `    ${JSON.stringify(url)},`,
    '    auth=(',
    '        os.environ["BASIC_AUTH_USERNAME"],',
    '        os.environ["BASIC_AUTH_PASSWORD"],',
    '    ),',
    '    timeout=30,',
    ')',
    'print(response.status_code)',
  ].join('\n');

  return { url, curl, nodeFetch, pythonRequests };
}

export function hasBasicAuthControlCharacters(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

export function decodeBasicAuthHeader(input: string) {
  const token = input.trim()
    .replace(/^Authorization\s*:\s*Basic\s+/i, '')
    .replace(/^Basic\s+/i, '');

  if (!token || !isValidBase64(token)) {
    throw new Error('Enter a valid Basic Authorization header or Base64 token');
  }

  let decodedCredentials: string;

  try {
    decodedCredentials = base64ToText(token);
  }
  catch {
    throw new Error('The Basic Authorization value could not be decoded');
  }

  if (hasBasicAuthControlCharacters(decodedCredentials)) {
    throw new Error('Basic Authorization credentials cannot contain control characters');
  }

  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex < 0) {
    throw new Error('Decoded credentials do not contain a username/password separator');
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
}
