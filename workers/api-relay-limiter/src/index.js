// Internal Durable Object used by the Pages API relay.
//
// This Worker deliberately exposes no public API route. Pages reaches the
// IpRateLimiter class through a Durable Object namespace binding. The object
// receives only a random lease ID; client IPs are HMACed in the Pages Function,
// and request URLs, bodies, headers and credentials never enter this Worker.

const STATE_KEY = 'rate-limit-state';
const WINDOW_MS = 60_000;
const WINDOW_LIMIT = 30;
const BURST_WINDOW_MS = 10_000;
const BURST_LIMIT = 10;
const MAX_IN_FLIGHT = 4;
const LEASE_TTL_MS = 20_000;
const MAX_REQUEST_BYTES = 256;
const LEASE_ID_RE = /^[A-Za-z0-9_-]{16,80}$/;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

function retryAfter(seconds, reason) {
  const retryAfterSeconds = Math.max(1, Math.ceil(seconds));
  return {
    allowed: false,
    reason,
    retryAfterSeconds,
  };
}

function readState(value) {
  if (value === undefined) {
    return { timestamps: [], leases: [] };
  }
  if (!value || !Array.isArray(value.timestamps) || !Array.isArray(value.leases)) {
    return null;
  }
  if (!value.timestamps.every(Number.isSafeInteger)) {
    return null;
  }
  if (!value.leases.every(lease =>
    lease
    && typeof lease.id === 'string'
    && Number.isSafeInteger(lease.expiresAt),
  )) {
    return null;
  }
  return {
    timestamps: value.timestamps,
    leases: value.leases,
  };
}

export class IpRateLimiter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' });
    }

    const path = new URL(request.url).pathname;
    if (path !== '/acquire' && path !== '/release') {
      return json({ error: 'Not found.' }, 404);
    }

    const contentLength = request.headers.get('content-length');
    if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_REQUEST_BYTES)) {
      return json({ error: 'Invalid limiter request.' }, 400);
    }

    let raw;
    try {
      raw = await request.text();
    }
    catch {
      return json({ error: 'Invalid limiter request.' }, 400);
    }
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return json({ error: 'Invalid limiter request.' }, 400);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    }
    catch {
      return json({ error: 'Invalid limiter request.' }, 400);
    }

    if (
      !payload
      || typeof payload !== 'object'
      || Array.isArray(payload)
      || Object.keys(payload).length !== 1
      || typeof payload.leaseId !== 'string'
      || !LEASE_ID_RE.test(payload.leaseId)
    ) {
      return json({ error: 'Invalid limiter request.' }, 400);
    }

    try {
      const decision = await this.state.storage.transaction(async (txn) => {
        const stored = readState(await txn.get(STATE_KEY));
        if (!stored) {
          return { status: 503, body: { allowed: false, reason: 'state_unavailable' } };
        }

        const now = Date.now();
        const timestamps = stored.timestamps.filter(timestamp =>
          timestamp > now - WINDOW_MS && timestamp <= now,
        );
        const leases = stored.leases.filter(lease => lease.expiresAt > now);

        if (path === '/release') {
          const nextLeases = leases.filter(lease => lease.id !== payload.leaseId);
          if (timestamps.length !== stored.timestamps.length || nextLeases.length !== stored.leases.length) {
            await txn.put(STATE_KEY, { timestamps, leases: nextLeases });
          }
          return { status: 200, body: { released: true } };
        }

        // A retry of an already admitted acquire is idempotent.
        if (leases.some(lease => lease.id === payload.leaseId)) {
          return { status: 200, body: { allowed: true } };
        }

        if (timestamps.length >= WINDOW_LIMIT) {
          const retry = (timestamps[0] + WINDOW_MS - now) / 1000;
          await txn.put(STATE_KEY, { timestamps, leases });
          return { status: 429, body: retryAfter(retry, 'window') };
        }

        const burstTimestamps = timestamps.filter(timestamp => timestamp > now - BURST_WINDOW_MS);
        if (burstTimestamps.length >= BURST_LIMIT) {
          const retry = (burstTimestamps[0] + BURST_WINDOW_MS - now) / 1000;
          await txn.put(STATE_KEY, { timestamps, leases });
          return { status: 429, body: retryAfter(retry, 'burst') };
        }

        // Count attempts that hit the concurrency ceiling against the rate
        // policy too; otherwise clients could hammer acquire without spending
        // their rate budget.
        timestamps.push(now);

        if (leases.length >= MAX_IN_FLIGHT) {
          const earliestExpiry = Math.min(...leases.map(lease => lease.expiresAt));
          await txn.put(STATE_KEY, { timestamps, leases });
          return {
            status: 429,
            body: retryAfter((earliestExpiry - now) / 1000, 'concurrency'),
          };
        }

        leases.push({ id: payload.leaseId, expiresAt: now + LEASE_TTL_MS });
        await txn.put(STATE_KEY, { timestamps, leases });
        return { status: 200, body: { allowed: true } };
      });

      return json(decision.body, decision.status, decision.body.retryAfterSeconds
        ? { 'retry-after': String(decision.body.retryAfterSeconds) }
        : {});
    }
    catch {
      // Do not leak storage details. The Pages Function fails closed in shared
      // mode and does not contact the user-supplied upstream target.
      return json({ allowed: false, reason: 'limiter_unavailable' }, 503);
    }
  }
}

export default {
  async fetch() {
    return json({ error: 'Not found.' }, 404);
  },
};
