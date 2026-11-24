import { normalizeEmail } from 'email-normalizer';

export type EmailNormalizationMode = 'conservative' | 'provider-aware';
export type EmailRowStatus = 'normalized' | 'duplicate' | 'invalid';

export interface EmailNormalizeOptions {
  mode: EmailNormalizationMode
  removeDuplicates: boolean
}

export interface EmailNormalizeRow {
  lineNumber: number
  source: string
  address: string
  normalized: string
  status: EmailRowStatus
  error: string
}

export const MAX_EMAIL_INPUT_LENGTH = 100_000;
export const MAX_EMAIL_ROWS = 1_000;

function extractAddress(source: string): string {
  const value = source.trim().replace(/^mailto:/i, '');
  const displayNameMatch = value.match(/^[^<>]*<([^<>]+)>$/);
  const address = displayNameMatch ? displayNameMatch[1].trim() : value;

  if (!address || /[<>\s]/.test(address)) {
    throw new Error('Invalid or unsupported email syntax.');
  }

  return address;
}

function normalizeAddress(address: string, mode: EmailNormalizationMode): string {
  // The existing package validates syntax and supplies the current provider-aware rules.
  // Its result is intentionally discarded in conservative mode so the local part is preserved.
  const providerNormalized = normalizeEmail({ email: address });
  if (!providerNormalized) {
    throw new Error('Invalid or unsupported email syntax.');
  }

  if (mode === 'provider-aware') {
    return providerNormalized;
  }

  const separator = address.lastIndexOf('@');
  if (separator <= 0 || separator === address.length - 1) {
    throw new Error('Invalid or unsupported email syntax.');
  }

  const localPart = address.slice(0, separator);
  const domainPart = address.slice(separator + 1).toLowerCase();
  return `${localPart}@${domainPart}`;
}

/**
 * Normalize one email address per non-empty line.
 * The conservative mode preserves the local part and lowercases only the domain.
 * Provider-aware mode retains the existing email-normalizer package rules.
 */
export function normalizeEmailList(
  input: string,
  options: EmailNormalizeOptions,
): EmailNormalizeRow[] {
  if (input.length > MAX_EMAIL_INPUT_LENGTH) {
    throw new RangeError(`Input must be ${MAX_EMAIL_INPUT_LENGTH.toLocaleString()} characters or fewer.`);
  }

  const rows = input
    .split(/\r?\n/)
    .map((source, index) => ({ source: source.trim(), lineNumber: index + 1 }))
    .filter(row => row.source.length > 0);

  if (rows.length > MAX_EMAIL_ROWS) {
    throw new RangeError(`Enter ${MAX_EMAIL_ROWS.toLocaleString()} email addresses or fewer.`);
  }

  const seen = new Set<string>();

  return rows.map(({ source, lineNumber }) => {
    try {
      const address = extractAddress(source);
      const normalized = normalizeAddress(address, options.mode);
      const duplicateKey = normalized;

      if (options.removeDuplicates && seen.has(duplicateKey)) {
        return {
          lineNumber,
          source,
          address,
          normalized,
          status: 'duplicate',
          error: '',
        };
      }

      seen.add(duplicateKey);
      return {
        lineNumber,
        source,
        address,
        normalized,
        status: 'normalized',
        error: '',
      };
    }
    catch {
      return {
        lineNumber,
        source,
        address: '',
        normalized: '',
        status: 'invalid',
        error: 'Invalid or unsupported email syntax.',
      };
    }
  });
}

export function getCleanedEmailList(rows: EmailNormalizeRow[]): string {
  return rows
    .filter(row => row.status === 'normalized')
    .map(row => row.normalized)
    .join('\n');
}

function protectSpreadsheetFormula(value: string): string {
  const firstMeaningfulCharacter = Array.from(value).find((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code > 0x20;
  });

  return firstMeaningfulCharacter && '=+-@'.includes(firstMeaningfulCharacter)
    ? `'${value}`
    : value;
}

function csvCell(value: string): string {
  const safe = protectSpreadsheetFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export function emailNormalizeRowsToCsv(rows: EmailNormalizeRow[]): string {
  const header = ['Line', 'Original input', 'Email address', 'Normalized address', 'Status', 'Note'];
  const values = rows.map(row => [
    String(row.lineNumber),
    row.source,
    row.address,
    row.normalized,
    row.status,
    row.error,
  ]);

  return [header, ...values].map(row => row.map(csvCell).join(',')).join('\r\n');
}
