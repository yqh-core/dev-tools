const SAFE_LINKS_HOST_SUFFIX = '.safelinks.protection.outlook.com';
const MAX_NESTED_SAFE_LINKS = 5;

function getSafeLinksDestination(value: string): string | null {
  let wrapper: URL;

  try {
    wrapper = new URL(value.trim().replace(/&amp;/g, '&'));
  }
  catch {
    return null;
  }

  const hostname = wrapper.hostname.toLowerCase();
  const isOutlookSafeLinksHost = hostname.length > SAFE_LINKS_HOST_SUFFIX.length
    && hostname.endsWith(SAFE_LINKS_HOST_SUFFIX);

  if (!isOutlookSafeLinksHost) {
    return null;
  }

  if (wrapper.protocol !== 'https:') {
    throw new Error('Invalid SafeLinks URL provided');
  }

  const destination = wrapper.searchParams.get('url');

  if (!destination) {
    throw new Error('SafeLinks URL is missing its destination URL');
  }

  return destination;
}

export interface SafeLinksDecodeDetails {
  destinationUrl: string
  scheme: 'http' | 'https'
  host: string
  nestedLayers: number
}

function decodeSafeLinksURLWithDetails(safeLinksUrl: string): SafeLinksDecodeDetails {
  let destination = getSafeLinksDestination(safeLinksUrl);

  if (!destination) {
    throw new Error('Invalid SafeLinks URL provided');
  }

  let nestedLayers = 1;

  for (let depth = 1; depth < MAX_NESTED_SAFE_LINKS; depth++) {
    const nestedDestination = getSafeLinksDestination(destination);

    if (!nestedDestination) {
      let parsedDestination: URL;

      try {
        parsedDestination = new URL(destination);
      }
      catch {
        throw new Error('SafeLinks destination is not a valid absolute URL');
      }

      if (!['http:', 'https:'].includes(parsedDestination.protocol)) {
        throw new Error('SafeLinks destination must use HTTP or HTTPS');
      }

      return {
        destinationUrl: destination,
        scheme: parsedDestination.protocol.slice(0, -1) as 'http' | 'https',
        host: parsedDestination.host,
        nestedLayers,
      };
    }

    destination = nestedDestination;
    nestedLayers += 1;
  }

  if (getSafeLinksDestination(destination)) {
    throw new Error(`SafeLinks nesting exceeds the maximum of ${MAX_NESTED_SAFE_LINKS} layers`);
  }

  let parsedDestination: URL;

  try {
    parsedDestination = new URL(destination);
  }
  catch {
    throw new Error('SafeLinks destination is not a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsedDestination.protocol)) {
    throw new Error('SafeLinks destination must use HTTP or HTTPS');
  }

  return {
    destinationUrl: destination,
    scheme: parsedDestination.protocol.slice(0, -1) as 'http' | 'https',
    host: parsedDestination.host,
    nestedLayers,
  };
}

export function decodeSafeLinksURL(safeLinksUrl: string): string {
  return decodeSafeLinksURLWithDetails(safeLinksUrl).destinationUrl;
}

export interface SafeLinksBatchResult {
  line: number
  input: string
  decodedUrl: string | null
  error: string | null
  scheme: 'http' | 'https' | null
  host: string | null
  nestedLayers: number | null
}

/**
 * Decode one Safe Links wrapper per non-empty line.
 * Blank lines are ignored, source line numbers are preserved, and one invalid
 * wrapper never prevents other rows from being decoded.
 */
export function decodeSafeLinksBatch(input: string): SafeLinksBatchResult[] {
  return input
    .split(/\r?\n/)
    .map((value, index) => ({ line: index + 1, input: value.trim() }))
    .filter(row => row.input.length > 0)
    .map(({ line, input: value }) => {
      try {
        const details = decodeSafeLinksURLWithDetails(value);

        return {
          line,
          input: value,
          decodedUrl: details.destinationUrl,
          error: null,
          scheme: details.scheme,
          host: details.host,
          nestedLayers: details.nestedLayers,
        };
      }
      catch (error) {
        return {
          line,
          input: value,
          decodedUrl: null,
          error: error instanceof Error ? error.message : String(error),
          scheme: null,
          host: null,
          nestedLayers: null,
        };
      }
    });
}
