// 从 dev-toolbox src/data/reference.ts 同步；改数据时两边一起改。
export interface HttpHeaderEntry {
  name: string
  dir: string
  zh: string
}

export const httpHeaderEntries: HttpHeaderEntry[] = [
  { name: 'Host', dir: 'Request', zh: 'Target host and port; required since HTTP/1.1' },
  { name: 'User-Agent', dir: 'Request', zh: 'Client identifier; many APIs use it to block or rate-limit' },
  { name: 'Accept', dir: 'Request', zh: 'Acceptable response types, e.g. text/html,application/json' },
  { name: 'Accept-Encoding', dir: 'Request', zh: 'Acceptable compression methods, e.g. gzip, br, zstd' },
  { name: 'Accept-Language', dir: 'Request', zh: 'Preferred languages, e.g. zh-CN,zh;q=0.9' },
  { name: 'Accept-Charset', dir: 'Request', zh: 'Acceptable character sets (largely obsolete)' },
  { name: 'Authorization', dir: 'Request', zh: 'Credentials, e.g. Bearer <token> or Basic <base64>' },
  { name: 'Cookie', dir: 'Request', zh: 'Cookies sent by the client' },
  { name: 'Referer', dir: 'Request', zh: 'Address of the referring page; used for hotlink protection and traffic analysis' },
  { name: 'Origin', dir: 'Request', zh: 'Origin of a cross-origin request; what CORS checks against' },
  { name: 'Content-Type', dir: 'Request and response', zh: 'Media type of the body, e.g. application/json; charset=utf-8' },
  { name: 'Content-Length', dir: 'Request and response', zh: 'Size of the body in bytes' },
  { name: 'Content-Encoding', dir: 'Request and response', zh: 'Compression encoding applied to the body' },
  { name: 'Content-Disposition', dir: 'Response', zh: 'inline displays it in place / attachment downloads it, with an optional file name' },
  { name: 'Content-Range', dir: 'Response', zh: 'Byte range covered by a partial response' },
  { name: 'Content-Security-Policy', dir: 'Response', zh: 'CSP: restricts where resources may load from, mitigating XSS' },
  { name: 'Cache-Control', dir: 'Request and response', zh: 'Caching policy, e.g. no-cache / max-age=3600' },
  { name: 'ETag', dir: 'Response', zh: 'Version fingerprint of a resource; used with If-None-Match for conditional requests' },
  { name: 'Last-Modified', dir: 'Response', zh: 'When the resource last changed; used with If-Modified-Since' },
  { name: 'If-None-Match', dir: 'Request', zh: 'Sends a local ETag; the server answers 304 if it has not changed' },
  { name: 'If-Modified-Since', dir: 'Request', zh: 'Sends a local timestamp; the server answers 304 if nothing changed' },
  { name: 'If-Match', dir: 'Request', zh: 'Optimistic locking: proceeds only if the ETag matches' },
  { name: 'Expires', dir: 'Response', zh: 'Absolute expiry time (HTTP/1.0 legacy, lower priority than Cache-Control)' },
  { name: 'Age', dir: 'Response', zh: 'Seconds this response has sat in a cache' },
  { name: 'Date', dir: 'Response', zh: 'When the response was generated' },
  { name: 'Server', dir: 'Response', zh: 'Server software identifier; best hidden in production' },
  { name: 'Via', dir: 'Response', zh: 'The chain of proxies the request passed through' },
  { name: 'Location', dir: 'Response', zh: 'Redirect target, or the address of a resource created with 201' },
  { name: 'Set-Cookie', dir: 'Response', zh: 'Issues a cookie; supports HttpOnly / Secure / SameSite' },
  { name: 'Strict-Transport-Security', dir: 'Response', zh: 'HSTS: forces the browser to use HTTPS from now on' },
  { name: 'X-Frame-Options', dir: 'Response', zh: 'Whether the page may be embedded in an iframe; prevents clickjacking' },
  { name: 'X-Content-Type-Options', dir: 'Response', zh: 'Set to nosniff to stop the browser guessing the type' },
  { name: 'X-XSS-Protection', dir: 'Response', zh: 'Legacy browser XSS filter switch (superseded by CSP)' },
  { name: 'Referrer-Policy', dir: 'Response', zh: 'Controls how much Referer information is sent' },
  { name: 'Permissions-Policy', dir: 'Response', zh: 'Grants camera / microphone / geolocation and similar features per origin' },
  { name: 'Access-Control-Allow-Origin', dir: 'Response', zh: 'CORS: allowed origins; cannot be * together with credentials' },
  { name: 'Access-Control-Allow-Methods', dir: 'Response', zh: 'CORS: allowed methods' },
  { name: 'Access-Control-Allow-Headers', dir: 'Response', zh: 'CORS: allowed custom request headers' },
  { name: 'Access-Control-Allow-Credentials', dir: 'Response', zh: 'CORS: whether cookies may be sent' },
  { name: 'Access-Control-Max-Age', dir: 'Response', zh: 'How many seconds a CORS preflight result is cached' },
  { name: 'Vary', dir: 'Response', zh: 'Extra dimension in the cache key, e.g. Accept-Encoding' },
  { name: 'Transfer-Encoding', dir: 'Response', zh: 'Transfer coding; chunked means the body is sent in chunks' },
  { name: 'Connection', dir: 'Request and response', zh: 'Connection control; keep-alive reuses the connection' },
  { name: 'Upgrade', dir: 'Request and response', zh: 'Requests a protocol upgrade, e.g. websocket' },
  { name: 'TE', dir: 'Request', zh: 'Acceptable transfer encodings (for trailers alongside chunked)' },
  { name: 'Range', dir: 'Request', zh: 'Requests part of the content, e.g. bytes=0-1023' },
  { name: 'Retry-After', dir: 'Response', zh: 'How long to wait before retrying; usually paired with 429/503' },
  { name: 'WWW-Authenticate', dir: 'Response', zh: 'Authentication challenge; paired with 401' },
  { name: 'Forwarded / X-Forwarded-For', dir: 'Request', zh: 'Original client IP; written when a proxy forwards the request' },
  { name: 'X-Forwarded-Proto', dir: 'Request', zh: 'Original protocol (http/https), used to build correct redirect URLs' },
  { name: 'X-Request-Id', dir: 'Request and response', zh: 'Trace ID for a request chain' },
  { name: 'CF-Connecting-IP', dir: 'Request', zh: 'Real client IP that Cloudflare carries when forwarding to the origin' },
];

/**
 * HTTP request methods reference — merged from the retired `/legacy/requestmethod/`
 * page (2026-10-17 C5). Same "reference table" purpose as the header list above, so it
 * lives on the same page instead of a standalone tool; the legacy URL 301s here.
 */
export interface HttpMethodEntry {
  name: string
  safe: string
  idempotent: string
  zh: string
}

export const httpMethodEntries: HttpMethodEntry[] = [
  { name: 'GET', safe: 'Yes', idempotent: 'Yes', zh: 'Read a resource; parameters go in the URL. Never changes server state.' },
  { name: 'HEAD', safe: 'Yes', idempotent: 'Yes', zh: 'Like GET but returns headers only, no body — used to check a resource exists or is fresh.' },
  { name: 'POST', safe: 'No', idempotent: 'No', zh: 'Submit data to be processed; repeated calls may create duplicates (e.g. place another order).' },
  { name: 'PUT', safe: 'No', idempotent: 'Yes', zh: 'Replace a resource wholesale; sending the same body again yields the same result.' },
  { name: 'PATCH', safe: 'No', idempotent: 'No', zh: 'Partial update of a resource; whether it is idempotent depends on the server.' },
  { name: 'DELETE', safe: 'No', idempotent: 'Yes', zh: 'Remove a resource; deleting an already-deleted resource is the same end state.' },
  { name: 'OPTIONS', safe: 'Yes', idempotent: 'Yes', zh: 'Describe the communication options; browsers send it as the CORS preflight request.' },
  { name: 'CONNECT', safe: 'No', idempotent: 'No', zh: 'Establish a tunnel to the server, typically for TLS through an HTTP proxy.' },
  { name: 'TRACE', safe: 'Yes', idempotent: 'Yes', zh: 'Loop back the request for diagnostics; usually disabled because it enables XST attacks.' },
];
