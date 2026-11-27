import jwtDecode, { type JwtHeader, type JwtPayload } from 'jwt-decode';
import { isArray, isPlainObject, isString, map, toString } from 'lodash';
import { ALGORITHM_DESCRIPTIONS, CLAIM_DESCRIPTIONS } from './jwt-parser.constants';

export { decodeJwt };

export type JwtDecodeErrorCode = 'empty' | 'whitespace' | 'segments' | 'base64url' | 'decode';

export class JwtDecodeError extends Error {
  readonly code: JwtDecodeErrorCode;

  constructor(code: JwtDecodeErrorCode) {
    super(code);
    this.name = 'JwtDecodeError';
    this.code = code;
  }
}

/**
 * Decode the JOSE Header and Claims Set Payload from a three-part compact JWS.
 * The third segment is returned unchanged: it is not decoded or cryptographically verified.
 */
function decodeJwt({ jwt }: { jwt: string }) {
  if (!jwt) {
    throw new JwtDecodeError('empty');
  }

  if (/\s/.test(jwt)) {
    throw new JwtDecodeError('whitespace');
  }

  const parts = jwt.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1]) {
    throw new JwtDecodeError('segments');
  }

  if (parts.some(part => !/^[A-Za-z0-9_-]*$/.test(part))) {
    throw new JwtDecodeError('base64url');
  }

  let rawHeader: JwtHeader;
  let rawPayload: JwtPayload;

  try {
    rawHeader = jwtDecode<JwtHeader>(jwt, { header: true });
    rawPayload = jwtDecode<JwtPayload>(jwt);
  }
  catch {
    throw new JwtDecodeError('decode');
  }

  const header = map(rawHeader, (value, claim) => parseClaims({ claim, value }));
  const payload = map(rawPayload, (value, claim) => parseClaims({ claim, value }));

  return {
    header,
    payload,
    signatureSegment: parts[2],
  };
}

function parseClaims({ claim, value }: { claim: string; value: unknown }) {
  const claimDescription = CLAIM_DESCRIPTIONS[claim];
  const formattedValue = isPlainObject(value) || isArray(value) ? JSON.stringify(value, null, 3) : toString(value);
  const friendlyValue = getFriendlyValue({ claim, value });

  return {
    value: formattedValue,
    friendlyValue,
    claim,
    claimDescription,
  };
}

function getFriendlyValue({ claim, value }: { claim: string; value: unknown }) {
  if (['exp', 'nbf', 'iat'].includes(claim)) {
    return dateFormatter(value);
  }

  if (claim === 'alg' && isString(value)) {
    return ALGORITHM_DESCRIPTIONS[value];
  }

  return undefined;
}

function dateFormatter(value: unknown) {
  // JWT NumericDate claims are numeric seconds, not milliseconds or validated dates.
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleString();
}
