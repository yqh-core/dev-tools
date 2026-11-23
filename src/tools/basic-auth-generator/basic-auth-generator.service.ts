import { base64ToText, isValidBase64 } from '@/utils/base64';

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

  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex < 0) {
    throw new Error('Decoded credentials do not contain a username/password separator');
  }

  return {
    username: decodedCredentials.slice(0, separatorIndex),
    password: decodedCredentials.slice(separatorIndex + 1),
  };
}
